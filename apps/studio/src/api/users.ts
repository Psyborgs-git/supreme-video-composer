/**
 * User management routes — /api/users/*
 */
import { Hono } from "hono";
import { requireAuth } from "@studio/auth";
import { getUserOrgs, updateUser } from "@studio/database";
import type { AuthUser } from "@studio/auth";

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

export const usersRouter = new Hono();

// GET /api/users/me
usersRouter.get("/me", requireAuth, (c) => {
  const user = c.get("user");
  return c.json({ user });
});

// PATCH /api/users/me — update display name or avatar
usersRouter.patch("/me", requireAuth, async (c) => {
  const user = c.get("user");
  const raw = await c.req.json().catch(() => null) as { name?: string; avatarUrl?: string } | null;
  if (!raw) return c.json({ error: "Invalid JSON body" }, 400);

  const updated = await updateUser(user.id, {
    name: raw.name,
    avatarUrl: raw.avatarUrl,
  });

  return c.json({ user: updated });
});

// GET /api/users/me/orgs
usersRouter.get("/me/orgs", requireAuth, async (c) => {
  const user = c.get("user");
  const orgs = await getUserOrgs(user.id);
  return c.json({ orgs });
});
