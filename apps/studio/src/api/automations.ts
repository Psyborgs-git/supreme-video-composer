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
} from "@studio/database";
import { automationScheduler } from "../services/scheduler";
import type { Automation } from "@studio/shared-types";

export const automationsRouter = new Hono();

// ─── List automations ─────────────────────────────────────────────────────────

automationsRouter.get("/:orgSlug/automations", requireAuth, requireOrgAccess("viewer"), async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const automations = await getOrgAutomations(org.id);
  return c.json({
    automations: automations.map(normalizeAutomation),
  });
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

  const runs = await getAutomationRuns(automation.id, 10);
  return c.json({ automation: normalizeAutomation(automation), recentRuns: runs });
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
  }>().catch(() => ({}));

  const updated = await updateAutomation(automation.id, body);
  if (!updated) return c.json({ error: "Update failed" }, 500);

  // Hot-reload in scheduler
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

// ─── Manual trigger ───────────────────────────────────────────────────────────

automationsRouter.post("/:orgSlug/automations/:id/run", requireAuth, requireOrgMember, async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const automation = await getAutomationById(c.req.param("id"));
  if (!automation || automation.orgId !== org.id) {
    return c.json({ error: "Automation not found" }, 404);
  }

  const run = await automationScheduler.triggerNow(automation.id);
  return c.json({ run }, 202);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  createdAt: string | null;
  updatedAt: string | null;
}) {
  return {
    id: a.id,
    orgId: a.orgId,
    createdBy: a.createdBy,
    name: a.name,
    cronExpr: a.cronExpr,
    templateId: a.templateId,
    inputProps: safeJson(a.inputProps, {}),
    enabled: a.enabled === 1 || a.enabled === null,
    lastRunAt: a.lastRunAt,
    nextRunAt: a.nextRunAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
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
