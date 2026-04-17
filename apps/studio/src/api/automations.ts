/**
 * Automation CRUD routes — /api/orgs/:orgSlug/automations/*
 */
import { Hono } from "hono";
import { requireAuth, requireOrgAccess, requireOrgMember } from "@studio/auth";
import {
  getOrgBySlug,
  getOrgAutomations,
  getAutomationById,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  getAutomationRuns,
  getAutomationRunById,
  getPendingApprovalRuns,
  getApprovalPolicy,
  upsertApprovalPolicy,
  getWorkflowSteps,
  createWorkflowStep,
  updateWorkflowStep,
  deleteWorkflowStep,
  reorderWorkflowSteps,
  getOrgMember,
} from "@studio/database";
import { automationScheduler } from "../services/scheduler";
import type { Automation } from "@studio/shared-types";

export const automationsRouter = new Hono();

// ─── List automations ─────────────────────────────────────────────────────────

automationsRouter.get("/:orgSlug/automations", requireAuth, requireOrgAccess("viewer"), async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const automations = await getOrgAutomations(org.id);
  // Attach pending approval count
  const results = await Promise.all(
    automations.map(async (a) => {
      const pending = await getPendingApprovalRuns(a.id);
      return { ...normalizeAutomation(a), pendingApprovals: pending.length };
    }),
  );
  return c.json({ automations: results });
});

// ─── Create automation ────────────────────────────────────────────────────────

automationsRouter.post("/:orgSlug/automations", requireAuth, requireOrgMember, async (c) => {
  const user = c.get("user");
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const body = await c.req.json<{
    name: string;
    cronExpr: string;
    templateId: string;
    inputProps?: Record<string, unknown>;
    timezone?: string;
    overlapPolicy?: string;
  }>().catch(() => null);

  if (!body?.name?.trim() || !body.cronExpr?.trim() || !body.templateId?.trim()) {
    return c.json({ error: "name, cronExpr, and templateId are required" }, 400);
  }

  const automation = await createAutomation({
    orgId: org.id,
    createdBy: user.id,
    name: body.name.trim(),
    cronExpr: body.cronExpr.trim(),
    templateId: body.templateId.trim(),
    inputProps: body.inputProps,
  });

  // Register with scheduler
  automationScheduler.register(normalizeAutomation(automation));

  return c.json({ automation: normalizeAutomation(automation) }, 201);
});

// ─── Get automation ───────────────────────────────────────────────────────────

automationsRouter.get("/:orgSlug/automations/:id", requireAuth, requireOrgAccess("viewer"), async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const automation = await getAutomationById(c.req.param("id"));
  if (!automation || automation.orgId !== org.id) {
    return c.json({ error: "Automation not found" }, 404);
  }

  const [runs, steps, policy, pendingApprovals] = await Promise.all([
    getAutomationRuns(automation.id, 10),
    getWorkflowSteps(automation.id),
    getApprovalPolicy(automation.id),
    getPendingApprovalRuns(automation.id),
  ]);

  return c.json({
    automation: normalizeAutomation(automation),
    recentRuns: runs,
    steps,
    policy: policy ?? null,
    pendingApprovals,
  });
});

// ─── Update automation ────────────────────────────────────────────────────────

automationsRouter.patch("/:orgSlug/automations/:id", requireAuth, requireOrgMember, async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const automation = await getAutomationById(c.req.param("id"));
  if (!automation || automation.orgId !== org.id) {
    return c.json({ error: "Automation not found" }, 404);
  }

  const body = await c.req.json<{
    name?: string;
    cronExpr?: string;
    templateId?: string;
    inputProps?: Record<string, unknown>;
    enabled?: boolean;
    timezone?: string;
    overlapPolicy?: string;
  }>().catch(() => ({}));

  const updated = await updateAutomation(automation.id, body);
  if (!updated) return c.json({ error: "Update failed" }, 500);

  automationScheduler.unregister(automation.id);
  automationScheduler.register(normalizeAutomation(updated));

  return c.json({ automation: normalizeAutomation(updated) });
});

// ─── Delete automation ────────────────────────────────────────────────────────

automationsRouter.delete("/:orgSlug/automations/:id", requireAuth, requireOrgMember, async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const automation = await getAutomationById(c.req.param("id"));
  if (!automation || automation.orgId !== org.id) {
    return c.json({ error: "Automation not found" }, 404);
  }

  automationScheduler.unregister(automation.id);
  await deleteAutomation(automation.id);
  return c.json({ success: true });
});

// ─── List runs ────────────────────────────────────────────────────────────────

automationsRouter.get("/:orgSlug/automations/:id/runs", requireAuth, requireOrgAccess("viewer"), async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const automation = await getAutomationById(c.req.param("id"));
  if (!automation || automation.orgId !== org.id) {
    return c.json({ error: "Automation not found" }, 404);
  }

  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  const runs = await getAutomationRuns(automation.id, limit);
  return c.json({ runs });
});

// ─── Get single run ───────────────────────────────────────────────────────────

automationsRouter.get("/:orgSlug/automations/:id/runs/:runId", requireAuth, requireOrgAccess("viewer"), async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const automation = await getAutomationById(c.req.param("id"));
  if (!automation || automation.orgId !== org.id) {
    return c.json({ error: "Automation not found" }, 404);
  }

  const run = await getAutomationRunById(c.req.param("runId"));
  if (!run || run.automationId !== automation.id) {
    return c.json({ error: "Run not found" }, 404);
  }
  return c.json({ run });
});

// ─── Approve run ──────────────────────────────────────────────────────────────

automationsRouter.post("/:orgSlug/automations/:id/runs/:runId/approve", requireAuth, requireOrgMember, async (c) => {
  const user = c.get("user");
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const automation = await getAutomationById(c.req.param("id"));
  if (!automation || automation.orgId !== org.id) {
    return c.json({ error: "Automation not found" }, 404);
  }

  // Enforce approver role
  const policy = await getApprovalPolicy(automation.id);
  if (policy?.mode === "require_approval") {
    const member = await getOrgMember(org.id, user.id);
    if (!member || !hasRequiredRole(member.role ?? "member", policy.approverRole ?? "admin")) {
      return c.json({ error: "Insufficient permissions to approve" }, 403);
    }
  }

  const run = await getAutomationRunById(c.req.param("runId"));
  if (!run || run.automationId !== automation.id) {
    return c.json({ error: "Run not found" }, 404);
  }
  if (run.approvalStatus !== "pending") {
    return c.json({ error: "Run is not awaiting approval" }, 409);
  }

  await automationScheduler.approveRun(run.id, user.id);
  return c.json({ success: true });
});

// ─── Reject run ───────────────────────────────────────────────────────────────

automationsRouter.post("/:orgSlug/automations/:id/runs/:runId/reject", requireAuth, requireOrgMember, async (c) => {
  const user = c.get("user");
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const automation = await getAutomationById(c.req.param("id"));
  if (!automation || automation.orgId !== org.id) {
    return c.json({ error: "Automation not found" }, 404);
  }

  // Enforce approver role
  const policy = await getApprovalPolicy(automation.id);
  if (policy?.mode === "require_approval") {
    const member = await getOrgMember(org.id, user.id);
    if (!member || !hasRequiredRole(member.role ?? "member", policy.approverRole ?? "admin")) {
      return c.json({ error: "Insufficient permissions to reject" }, 403);
    }
  }

  const run = await getAutomationRunById(c.req.param("runId"));
  if (!run || run.automationId !== automation.id) {
    return c.json({ error: "Run not found" }, 404);
  }
  if (run.approvalStatus !== "pending") {
    return c.json({ error: "Run is not awaiting approval" }, 409);
  }

  await automationScheduler.rejectRun(run.id, user.id);
  return c.json({ success: true });
});

// ─── Manual trigger ───────────────────────────────────────────────────────────

automationsRouter.post("/:orgSlug/automations/:id/run", requireAuth, requireOrgMember, async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const automation = await getAutomationById(c.req.param("id"));
  if (!automation || automation.orgId !== org.id) {
    return c.json({ error: "Automation not found" }, 404);
  }

  const run = await automationScheduler.triggerNow(automation.id, "manual");
  return c.json({ run }, 202);
});

// ─── Approval policy ──────────────────────────────────────────────────────────

automationsRouter.get("/:orgSlug/automations/:id/policy", requireAuth, requireOrgAccess("viewer"), async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const automation = await getAutomationById(c.req.param("id"));
  if (!automation || automation.orgId !== org.id) {
    return c.json({ error: "Automation not found" }, 404);
  }

  const policy = await getApprovalPolicy(automation.id);
  return c.json({ policy: policy ?? null });
});

automationsRouter.put("/:orgSlug/automations/:id/policy", requireAuth, requireOrgMember, async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const automation = await getAutomationById(c.req.param("id"));
  if (!automation || automation.orgId !== org.id) {
    return c.json({ error: "Automation not found" }, 404);
  }

  const body = await c.req.json<{
    mode: string;
    approverRole?: string;
    approverUserIds?: string[];
    timeoutMinutes?: number;
    onTimeout?: string;
  }>().catch(() => null);

  if (!body?.mode) {
    return c.json({ error: "mode is required (none|auto|require_approval)" }, 400);
  }

  const policy = await upsertApprovalPolicy({
    automationId: automation.id,
    mode: body.mode,
    approverRole: body.approverRole,
    approverUserIds: body.approverUserIds,
    timeoutMinutes: body.timeoutMinutes,
    onTimeout: body.onTimeout,
  });
  return c.json({ policy });
});

// ─── Workflow steps ───────────────────────────────────────────────────────────

automationsRouter.get("/:orgSlug/automations/:id/steps", requireAuth, requireOrgAccess("viewer"), async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const automation = await getAutomationById(c.req.param("id"));
  if (!automation || automation.orgId !== org.id) {
    return c.json({ error: "Automation not found" }, 404);
  }

  const steps = await getWorkflowSteps(automation.id);
  return c.json({ steps });
});

automationsRouter.post("/:orgSlug/automations/:id/steps", requireAuth, requireOrgMember, async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const automation = await getAutomationById(c.req.param("id"));
  if (!automation || automation.orgId !== org.id) {
    return c.json({ error: "Automation not found" }, 404);
  }

  const body = await c.req.json<{
    type: string;
    order?: number;
    provider?: string;
    model?: string;
    promptTemplate?: string;
    inputSlotBindings?: Record<string, unknown>;
    outputSlotKey?: string;
    conditionExpr?: string;
    advancedCode?: string;
  }>().catch(() => null);

  if (!body?.type) {
    return c.json({ error: "type is required" }, 400);
  }

  const existingSteps = await getWorkflowSteps(automation.id);
  const order = body.order ?? existingSteps.length;
  const step = await createWorkflowStep({ automationId: automation.id, order, ...body });
  return c.json({ step }, 201);
});

automationsRouter.patch("/:orgSlug/automations/:id/steps/:stepId", requireAuth, requireOrgMember, async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const automation = await getAutomationById(c.req.param("id"));
  if (!automation || automation.orgId !== org.id) {
    return c.json({ error: "Automation not found" }, 404);
  }

  const body = await c.req.json<{
    type?: string;
    order?: number;
    provider?: string;
    model?: string;
    promptTemplate?: string;
    inputSlotBindings?: Record<string, unknown>;
    outputSlotKey?: string;
    conditionExpr?: string;
    advancedCode?: string;
  }>().catch(() => ({}));

  const updated = await updateWorkflowStep(c.req.param("stepId"), body);
  if (!updated) return c.json({ error: "Step not found" }, 404);
  return c.json({ step: updated });
});

automationsRouter.delete("/:orgSlug/automations/:id/steps/:stepId", requireAuth, requireOrgMember, async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const automation = await getAutomationById(c.req.param("id"));
  if (!automation || automation.orgId !== org.id) {
    return c.json({ error: "Automation not found" }, 404);
  }

  await deleteWorkflowStep(c.req.param("stepId"));
  return c.json({ success: true });
});

automationsRouter.post("/:orgSlug/automations/:id/steps/reorder", requireAuth, requireOrgMember, async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const automation = await getAutomationById(c.req.param("id"));
  if (!automation || automation.orgId !== org.id) {
    return c.json({ error: "Automation not found" }, 404);
  }

  const body = await c.req.json<{ orderedIds: string[] }>().catch(() => null);
  if (!body?.orderedIds?.length) {
    return c.json({ error: "orderedIds array is required" }, 400);
  }

  await reorderWorkflowSteps(automation.id, body.orderedIds);
  return c.json({ success: true });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_WEIGHT: Record<string, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

function hasRequiredRole(userRole: string, requiredRole: string): boolean {
  return (ROLE_WEIGHT[userRole] ?? 0) >= (ROLE_WEIGHT[requiredRole] ?? 0);
}

function normalizeAutomation(a: {
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
}) {
  return {
    id: a.id,
    orgId: a.orgId ?? "",
    createdBy: a.createdBy ?? "",
    name: a.name,
    cronExpr: a.cronExpr,
    templateId: a.templateId,
    inputProps: safeJson(a.inputProps, {}) as Record<string, unknown>,
    enabled: a.enabled === 1 || a.enabled === null,
    lastRunAt: a.lastRunAt,
    nextRunAt: a.nextRunAt,
    workflowVersion: a.workflowVersion ?? 1,
    timezone: a.timezone ?? "UTC",
    overlapPolicy: (a.overlapPolicy as Automation["overlapPolicy"]) ?? "skip",
    createdAt: a.createdAt ?? new Date().toISOString(),
    updatedAt: a.updatedAt ?? new Date().toISOString(),
  };
}

function safeJson(value: string | null, fallback: unknown) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

