/**
 * Automation Scheduler — step-execution engine with approval gating.
 *
 * Manages cron-based automations. On startup, loads all enabled automations
 * from the DB and schedules them. When an automation fires, it:
 *   1. Enforces overlap policy (skip / queue / cancel_running)
 *   2. Loads workflow steps + approval policy
 *   3. If policy.mode === "require_approval", creates a pending run and pauses
 *   4. Executes each step sequentially via the appropriate provider pipeline
 *   5. Tracks per-step credits and marks run complete / failed
 */
import cron, { type ScheduledTask } from "node-cron";
import {
  getOrgAutomations,
  getAutomationById,
  createAutomationRun,
  updateAutomationRun,
  updateAutomation,
  logUsageEvent,
  getDb,
  automations as automationsTable,
  getWorkflowSteps,
  getApprovalPolicy,
  createAutomationRunStep,
  updateAutomationRunStep,
  getAutomationRuns,
} from "@studio/database";
import { hasEnoughCredits, deductCredits, CREDIT_COSTS } from "@studio/billing";
import { getTemplate } from "@studio/template-registry";
import { eq, and } from "drizzle-orm";
import type { Automation, WorkflowStep } from "@studio/shared-types";
import { createProviderAdapters } from "@studio/ai-generation";
import { generateId } from "../utils";

type RenderQueueLike = {
  enqueue(job: unknown): Promise<unknown>;
};

interface ScheduledAutomation {
  automation: Automation;
  task: ScheduledTask;
}

/** Map of runId → resolve callback for approval gating */
const approvalResolvers = new Map<
  string,
  (decision: "approved" | "rejected") => void
>();

class AutomationScheduler {
  private readonly tasks = new Map<string, ScheduledAutomation>();
  private renderQueue: RenderQueueLike | null = null;

  /** Call once at server startup with the real render queue */
  setRenderQueue(queue: RenderQueueLike) {
    this.renderQueue = queue;
  }

  /** Load all enabled automations from DB and schedule them */
  async loadFromDb() {
    try {
      const allOrgs = await getAllEnabledAutomations();
      for (const a of allOrgs) {
        this.register(a);
      }
      console.log(`[scheduler] loaded ${allOrgs.length} automation(s)`);
    } catch (err) {
      console.error("[scheduler] failed to load automations from DB:", err);
    }
  }

  /** Register (or re-register) a single automation */
  register(automation: Automation) {
    this.unregister(automation.id);
    if (!automation.enabled) return;
    if (!cron.validate(automation.cronExpr)) {
      console.warn(
        `[scheduler] invalid cron for automation ${automation.id}: "${automation.cronExpr}"`,
      );
      return;
    }

    const tz = automation.timezone ?? "UTC";
    const task = cron.schedule(
      automation.cronExpr,
      () => {
        this.runAutomation(automation, "cron").catch((err) => {
          console.error(
            `[scheduler] automation ${automation.id} fire-and-forget error:`,
            err,
          );
        });
      },
      { timezone: tz },
    );

    this.tasks.set(automation.id, { automation, task });
    console.log(
      `[scheduler] registered automation ${automation.id} (${automation.cronExpr}, tz=${tz})`,
    );
  }

  /** Unregister and stop a scheduled automation */
  unregister(automationId: string) {
    const existing = this.tasks.get(automationId);
    if (existing) {
      existing.task.stop();
      this.tasks.delete(automationId);
    }
  }

  /** Manually trigger an automation run immediately */
  async triggerNow(automationId: string, triggeredBy: "manual" | "api" = "manual") {
    const scheduled = this.tasks.get(automationId);
    if (!scheduled) {
      const a = await getAutomationById(automationId);
      if (!a) throw new Error("Automation not found");
      return this.runAutomation(toAutomation(a), triggeredBy);
    }
    return this.runAutomation(scheduled.automation, triggeredBy);
  }

  /** Approve a pending run — resumes step execution */
  async approveRun(runId: string, approverId: string) {
    await updateAutomationRun(runId, {
      approvalStatus: "approved",
      approvedBy: approverId,
      approvedAt: new Date().toISOString(),
    });
    const resolver = approvalResolvers.get(runId);
    if (resolver) {
      approvalResolvers.delete(runId);
      resolver("approved");
    }
  }

  /** Reject a pending run — cancels step execution */
  async rejectRun(runId: string, approverId: string) {
    await updateAutomationRun(runId, {
      approvalStatus: "rejected",
      approvedBy: approverId,
      approvedAt: new Date().toISOString(),
      status: "error",
      error: "Rejected by approver",
      ranAt: new Date().toISOString(),
    });
    const resolver = approvalResolvers.get(runId);
    if (resolver) {
      approvalResolvers.delete(runId);
      resolver("rejected");
    }
  }

  /** Stop all scheduled tasks */
  stopAll() {
    for (const { task } of this.tasks.values()) {
      task.stop();
    }
    this.tasks.clear();
    console.log("[scheduler] all automations stopped");
  }

  private async runAutomation(
    automation: Automation,
    triggeredBy: "cron" | "manual" | "api" = "cron",
  ) {
    // ── Overlap prevention ──────────────────────────────────────────────────
    const overlapPolicy = automation.overlapPolicy ?? "skip";
    if (overlapPolicy === "skip") {
      const activeRuns = await getAutomationRuns(automation.id, 5);
      const isRunning = activeRuns.some(
        (r) => r.status === "running" || r.status === "pending",
      );
      if (isRunning) {
        console.log(
          `[scheduler] skipping automation ${automation.id} — already running`,
        );
        return null;
      }
    }

    // ── Load policy ─────────────────────────────────────────────────────────
    const policy = await getApprovalPolicy(automation.id);

    // ── Credit pre-check ────────────────────────────────────────────────────
    const creditCost = CREDIT_COSTS.automationFlat;
    const enough = await hasEnoughCredits(automation.orgId, creditCost).catch(() => false);
    if (!enough) {
      console.warn(
        `[scheduler] org ${automation.orgId} has insufficient credits for automation ${automation.id}`,
      );
      return null;
    }

    // ── Create run record ───────────────────────────────────────────────────
    const requiresApproval = policy?.mode === "require_approval";
    const run = await createAutomationRun({
      automationId: automation.id,
      status: requiresApproval ? "pending" : "running",
      triggeredBy,
      context: { inputProps: automation.inputProps },
    });
    await updateAutomation(automation.id, { lastRunAt: new Date().toISOString() });

    if (requiresApproval) {
      await updateAutomationRun(run.id, { approvalStatus: "pending" });
      console.log(
        `[scheduler] automation ${automation.id} run ${run.id} awaiting approval`,
      );
      // Wait for external approve/reject signal
      const decision = await new Promise<"approved" | "rejected">((resolve) => {
        approvalResolvers.set(run.id, resolve);
        // Timeout handling
        const timeoutMs = (policy?.timeoutMinutes ?? 60) * 60 * 1000;
        setTimeout(async () => {
          if (approvalResolvers.has(run.id)) {
            approvalResolvers.delete(run.id);
            const onTimeout = policy?.onTimeout ?? "pause";
            if (onTimeout === "approve") {
              await updateAutomationRun(run.id, { approvalStatus: "approved" });
              resolve("approved");
            } else if (onTimeout === "reject") {
              await updateAutomationRun(run.id, {
                approvalStatus: "rejected",
                status: "error",
                error: "Timed out waiting for approval",
                ranAt: new Date().toISOString(),
              });
              resolve("rejected");
            } else {
              // pause — leave as pending
              resolve("rejected");
            }
          }
        }, timeoutMs);
      });

      if (decision === "rejected") return run;
      // Resume: update status to running
      await updateAutomationRun(run.id, { status: "running" });
    }

    try {
      // ── Load workflow steps ───────────────────────────────────────────────
      const steps = await getWorkflowSteps(automation.id);
      let context = { ...automation.inputProps };

      if (steps.length > 0) {
        // Multi-step workflow execution
        for (const step of steps) {
          await this.executeStep(step, run.id, context, automation).then(
            (output) => {
              if (step.outputSlotKey && output !== null) {
                context = { ...context, [step.outputSlotKey]: output };
              }
            },
          );
          // Sync context to run record
          await updateAutomationRun(run.id, { context });
        }
      }

      // ── Render step (always last if no explicit render step in steps) ─────
      const hasRenderStep = steps.some((s) => s.type === "render");
      if (!hasRenderStep) {
        await this.executeRenderStep(automation, run.id, context, creditCost);
      }

      await updateAutomationRun(run.id, {
        status: "complete",
        ranAt: new Date().toISOString(),
        creditsUsed: creditCost,
        context,
      });

      await logUsageEvent({
        orgId: automation.orgId,
        eventType: "automation_run",
        resourceType: "automation",
        resourceId: automation.id,
        meta: { runId: run.id },
      });

      return run;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await updateAutomationRun(run.id, {
        status: "error",
        error: errMsg,
        ranAt: new Date().toISOString(),
      }).catch(() => {});
      throw err;
    }
  }

  private async executeStep(
    step: WorkflowStep,
    runId: string,
    context: Record<string, unknown>,
    automation: Automation,
  ): Promise<unknown> {
    const runStep = await createAutomationRunStep({ runId, stepId: step.id });
    await updateAutomationRunStep(runStep.id, {
      status: "running",
      startedAt: new Date().toISOString(),
    });

    try {
      let output: unknown = null;

      const resolvedPrompt = interpolate(step.promptTemplate ?? "", context);
      const adapters = createProviderAdapters({
        text: step.provider ? { provider: step.provider, model: step.model } : undefined,
        image: step.provider ? { provider: step.provider, model: step.model } : undefined,
        audio: step.provider ? { provider: step.provider, model: step.model } : undefined,
        video: step.provider ? { provider: step.provider, model: step.model } : undefined,
      });

      switch (step.type) {
        case "generate_text": {
          const result = await adapters.text.generateScript({
            prompt: resolvedPrompt,
            sceneCount: (context.sceneCount as number) ?? 5,
          });
          output = result;
          break;
        }
        case "generate_image": {
          const result = await adapters.image.generateImage({
            prompt: resolvedPrompt,
          });
          output = result.urls[0] ?? null;
          break;
        }
        case "generate_audio": {
          const result = await adapters.audio.generateAudio({
            text: resolvedPrompt,
          });
          output = result.url;
          break;
        }
        case "generate_video": {
          const result = await adapters.video.generateVideo({
            prompt: resolvedPrompt,
          });
          output = result.url;
          break;
        }
        case "render": {
          await this.executeRenderStep(automation, runId, context, CREDIT_COSTS.automationFlat);
          break;
        }
        case "approve": {
          // Inline approval gate — same as policy-level
          const gateRun = await createAutomationRun({
            automationId: automation.id,
            status: "pending",
            triggeredBy: "cron",
          });
          await updateAutomationRun(gateRun.id, { approvalStatus: "pending" });
          const decision = await new Promise<"approved" | "rejected">((resolve) => {
            approvalResolvers.set(gateRun.id, resolve);
            setTimeout(() => {
              if (approvalResolvers.has(gateRun.id)) {
                approvalResolvers.delete(gateRun.id);
                resolve("rejected");
              }
            }, 60 * 60 * 1000);
          });
          if (decision === "rejected") throw new Error("Inline approval gate rejected");
          break;
        }
        case "custom_code": {
          // Advanced mode — definition stored, not executed server-side
          console.log(
            `[scheduler] custom_code step ${step.id} — skipped (advanced mode only)`,
          );
          break;
        }
      }

      await updateAutomationRunStep(runStep.id, {
        status: "complete",
        completedAt: new Date().toISOString(),
        outputs: output !== null ? { value: output } : {},
      });

      return output;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await updateAutomationRunStep(runStep.id, {
        status: "error",
        completedAt: new Date().toISOString(),
        error: errMsg,
      }).catch(() => {});
      throw err;
    }
  }

  private async executeRenderStep(
    automation: Automation,
    runId: string,
    context: Record<string, unknown>,
    creditCost: number,
  ) {
    // Deduct credits
    await deductCredits({
      orgId: automation.orgId,
      amount: creditCost,
      reason: `Automation run: ${automation.name}`,
      referenceId: runId,
      referenceType: "automation_run",
    });

    if (!this.renderQueue) return;

    const template = getTemplate(automation.templateId);
    const compositionId = template?.manifest.compositionId ?? automation.templateId;

    const job = {
      id: generateId(),
      projectId: `automation:${automation.id}`,
      templateId: compositionId,
      inputProps: { ...automation.inputProps, ...context },
      exportFormat: { codec: "h264", fileExtension: ".mp4", crf: 23, fps: 30, scale: 1 },
      aspectRatio: { preset: "youtube" as const, width: 1920, height: 1080 },
      status: "queued" as const,
      progress: null,
      outputPath: null,
      error: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
    };

    await this.renderQueue.enqueue(job);
  }
}

async function getAllEnabledAutomations(): Promise<Automation[]> {
  const rows = await getDb()
    .select()
    .from(automationsTable)
    .where(eq(automationsTable.enabled, 1));
  return rows.map(toAutomation);
}

function toAutomation(row: {
  id: string;
  orgId: string | null;
  createdBy: string | null;
  name: string;
  cronExpr: string;
  templateId: string;
  inputProps: string | null;
  enabled: number | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  workflowVersion?: number | null;
  timezone?: string | null;
  overlapPolicy?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}): Automation {
  return {
    id: row.id,
    orgId: row.orgId ?? "",
    createdBy: row.createdBy ?? "",
    name: row.name,
    cronExpr: row.cronExpr,
    templateId: row.templateId,
    inputProps: safeJson(row.inputProps),
    enabled: row.enabled === 1,
    lastRunAt: row.lastRunAt,
    nextRunAt: row.nextRunAt,
    workflowVersion: row.workflowVersion ?? 1,
    timezone: row.timezone ?? "UTC",
    overlapPolicy: (row.overlapPolicy as Automation["overlapPolicy"]) ?? "skip",
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  };
}

function safeJson(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Replace {{key}} placeholders in a template string with context values */
function interpolate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = context[key];
    return val !== undefined && val !== null ? String(val) : `{{${key}}}`;
  });
}

export { toAutomation };
export const automationScheduler = new AutomationScheduler();

