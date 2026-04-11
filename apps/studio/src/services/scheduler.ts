/**
 * Automation Scheduler
 *
 * Manages cron-based automations. On startup, loads all enabled automations
 * from the DB and schedules them. When an automation fires, it:
 *   1. Checks org credit balance
 *   2. Creates an automation_run record
 *   3. Enqueues a render job
 *   4. Deducts credits
 *   5. Logs a usage event
 *
 * The scheduler can hot-reload individual automations without a server restart.
 */
import cron from "node-cron";
import {
  getOrgAutomations,
  createAutomationRun,
  updateAutomationRun,
  updateAutomation,
  logUsageEvent,
} from "@studio/database";
import { hasEnoughCredits, deductCredits, CREDIT_COSTS } from "@studio/billing";
import type { Automation } from "@studio/shared-types";

type RenderQueueLike = {
  enqueue(job: unknown): Promise<unknown>;
};

interface ScheduledAutomation {
  automation: Automation;
  task: cron.ScheduledTask;
}

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
    // Unregister existing task if any
    this.unregister(automation.id);

    if (!automation.enabled) return;

    if (!cron.validate(automation.cronExpr)) {
      console.warn(`[scheduler] invalid cron expression for automation ${automation.id}: "${automation.cronExpr}"`);
      return;
    }

    const task = cron.schedule(automation.cronExpr, () => {
      this.runAutomation(automation).catch((err) => {
        console.error(`[scheduler] automation ${automation.id} fire-and-forget error:`, err);
      });
    });

    this.tasks.set(automation.id, { automation, task });
    console.log(`[scheduler] registered automation ${automation.id} (${automation.cronExpr})`);
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
  async triggerNow(automationId: string) {
    const scheduled = this.tasks.get(automationId);
    if (!scheduled) {
      // Try loading directly from DB
      const { getAutomationById } = await import("@studio/database");
      const a = await getAutomationById(automationId);
      if (!a) throw new Error("Automation not found");
      return this.runAutomation(toAutomation(a));
    }
    return this.runAutomation(scheduled.automation);
  }

  /** Stop all scheduled tasks */
  stopAll() {
    for (const { task } of this.tasks.values()) {
      task.stop();
    }
    this.tasks.clear();
    console.log("[scheduler] all automations stopped");
  }

  private async runAutomation(automation: Automation) {
    const creditCost = CREDIT_COSTS.automationFlat;

    // Check credits
    const enough = await hasEnoughCredits(automation.orgId, creditCost).catch(() => false);
    if (!enough) {
      console.warn(`[scheduler] org ${automation.orgId} has insufficient credits for automation ${automation.id}`);
      return null;
    }

    // Create run record
    const run = await createAutomationRun({ automationId: automation.id, status: "running" });

    try {
      // Update last_run_at
      await updateAutomation(automation.id, { lastRunAt: new Date().toISOString() });

      // Deduct flat automation credit
      await deductCredits({
        orgId: automation.orgId,
        amount: creditCost,
        reason: `Automation run: ${automation.name}`,
        referenceId: run.id,
        referenceType: "automation_run",
      });

      // Enqueue render job if queue is available
      if (this.renderQueue) {
        const { generateId } = await import("../api");
        const { getTemplate } = await import("@studio/template-registry");
        const template = getTemplate(automation.templateId);
        const compositionId = template?.manifest.compositionId ?? automation.templateId;

        const job = {
          id: generateId(),
          projectId: `automation:${automation.id}`,
          templateId: compositionId,
          inputProps: automation.inputProps,
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
        await updateAutomationRun(run.id, {
          status: "complete",
          ranAt: new Date().toISOString(),
          creditsUsed: creditCost,
        });
      } else {
        await updateAutomationRun(run.id, {
          status: "complete",
          ranAt: new Date().toISOString(),
          creditsUsed: creditCost,
        });
      }

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
}

async function getAllEnabledAutomations(): Promise<Automation[]> {
  // We need to get ALL automations across all orgs.
  // This is a simplification — in a large app you'd paginate.
  const { getDb } = await import("@studio/database");
  const { automations } = await import("@studio/database");
  const { eq } = await import("drizzle-orm");
  const rows = await getDb()
    .select()
    .from(automations)
    .where(eq(automations.enabled, 1));
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

export const automationScheduler = new AutomationScheduler();
