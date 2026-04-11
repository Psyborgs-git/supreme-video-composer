/**
 * Organisation management routes — /api/orgs/:orgSlug/*
 */
import { Hono } from "hono";
import { requireAuth, requireOrgAccess, requireOrgOwner, requireOrgAdmin } from "@studio/auth";
import {
  createOrg,
  getOrgBySlug,
  updateOrg,
  deleteOrg,
  getOrgMembers,
  addOrgMember,
  updateOrgMemberRole,
  removeOrgMember,
  createInvite,
  getInviteByToken,
  deleteInvite,
  getUserOrgs,
} from "@studio/database";
import { randomUUID } from "node:crypto";

export const orgsRouter = new Hono();

// ─── Create org ───────────────────────────────────────────────────────────────

orgsRouter.post("/", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{ name: string; slug?: string }>().catch(() => null);
  if (!body?.name?.trim()) {
    return c.json({ error: "name is required" }, 400);
  }

  const slug =
    body.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") ||
    body.name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 30);

  if (!slug) {
    return c.json({ error: "Invalid slug" }, 400);
  }

  const existing = await getOrgBySlug(slug);
  if (existing) {
    return c.json({ error: "Slug already taken" }, 409);
  }

  const org = await createOrg({ slug, name: body.name.trim(), createdBy: user.id });
  return c.json({ org }, 201);
});

// ─── Get org ──────────────────────────────────────────────────────────────────

orgsRouter.get("/:orgSlug", requireAuth, requireOrgAccess("viewer"), async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);
  return c.json({ org });
});

// ─── Update org ───────────────────────────────────────────────────────────────

orgsRouter.patch("/:orgSlug", requireAuth, requireOrgAdmin, async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const body = await c.req.json<{ name?: string }>().catch(() => ({}));
  if (!body.name?.trim()) {
    return c.json({ error: "name is required" }, 400);
  }

  const updated = await updateOrg(org.id, { name: body.name.trim() });
  return c.json({ org: updated });
});

// ─── Delete org ───────────────────────────────────────────────────────────────

orgsRouter.delete("/:orgSlug", requireAuth, requireOrgOwner, async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);
  await deleteOrg(org.id);
  return c.json({ success: true });
});

// ─── List members ─────────────────────────────────────────────────────────────

orgsRouter.get("/:orgSlug/members", requireAuth, requireOrgAccess("viewer"), async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);
  const members = await getOrgMembers(org.id);
  return c.json({ members });
});

// ─── Invite member ────────────────────────────────────────────────────────────

orgsRouter.post("/:orgSlug/members/invite", requireAuth, requireOrgAdmin, async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const body = await c.req.json<{ email: string; role?: string }>().catch(() => null);
  if (!body?.email?.trim()) {
    return c.json({ error: "email is required" }, 400);
  }

  const role = body.role ?? "member";
  const invite = await createInvite({ orgId: org.id, email: body.email.trim(), role });
  return c.json({ invite }, 201);
});

// ─── Accept invite ────────────────────────────────────────────────────────────

orgsRouter.post("/:orgSlug/members/accept", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{ token: string }>().catch(() => null);
  if (!body?.token) {
    return c.json({ error: "token is required" }, 400);
  }

  const invite = await getInviteByToken(body.token);
  if (!invite) {
    return c.json({ error: "Invite not found or expired" }, 404);
  }
  if (new Date(invite.expiresAt) < new Date()) {
    return c.json({ error: "Invite has expired" }, 410);
  }

  await addOrgMember(invite.orgId, user.id, invite.role);
  await deleteInvite(invite.id);

  return c.json({ success: true, orgId: invite.orgId });
});

// ─── Update member role ───────────────────────────────────────────────────────

orgsRouter.patch("/:orgSlug/members/:userId", requireAuth, requireOrgAdmin, async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const body = await c.req.json<{ role: string }>().catch(() => null);
  if (!body?.role) {
    return c.json({ error: "role is required" }, 400);
  }

  const updated = await updateOrgMemberRole(org.id, c.req.param("userId"), body.role);
  return c.json({ member: updated });
});

// ─── Remove member ────────────────────────────────────────────────────────────

orgsRouter.delete("/:orgSlug/members/:userId", requireAuth, requireOrgAdmin, async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);
  await removeOrgMember(org.id, c.req.param("userId"));
  return c.json({ success: true });
});
