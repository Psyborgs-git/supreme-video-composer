import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { getSession, getUserById, getOrgMember, getOrgBySlug } from "@studio/database";
import type { AuthUser, AuthSession, OrgRole } from "./types";
import { ROLE_HIERARCHY } from "./types";

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
    session: AuthSession;
    orgRole: OrgRole;
  }
}

/**
 * Reads `session_id` cookie, validates session, attaches c.var.user and
 * c.var.session. Returns 401 if missing or expired.
 */
export const requireAuth: MiddlewareHandler = async (c, next) => {
  const sessionId = getCookie(c, "session_id");
  if (!sessionId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const session = await getSession(sessionId);
  if (!session || new Date(session.expiresAt) < new Date()) {
    return c.json({ error: "Session expired" }, 401);
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }

  c.set("user", {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    avatarUrl: user.avatarUrl ?? null,
  });
  c.set("session", {
    id: session.id,
    userId: session.userId,
    expiresAt: session.expiresAt,
  });

  await next();
};

/**
 * After requireAuth, checks membership in :orgSlug param. Attaches
 * c.var.orgRole. Returns 403 if the user lacks the required role.
 */
export function requireOrgAccess(minRole: OrgRole = "viewer"): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const slug = c.req.param("orgSlug");
    if (!slug) {
      return c.json({ error: "Missing org slug" }, 400);
    }

    const org = await getOrgBySlug(slug);
    if (!org) {
      return c.json({ error: "Organization not found" }, 404);
    }

    const member = await getOrgMember(org.id, user.id);
    if (!member) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const userRoleLevel = ROLE_HIERARCHY[member.role as OrgRole] ?? -1;
    const requiredLevel = ROLE_HIERARCHY[minRole];
    if (userRoleLevel < requiredLevel) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }

    c.set("orgRole", member.role as OrgRole);
    await next();
  };
}

export const requireOrgOwner = requireOrgAccess("owner");
export const requireOrgAdmin = requireOrgAccess("admin");
export const requireOrgMember = requireOrgAccess("member");
