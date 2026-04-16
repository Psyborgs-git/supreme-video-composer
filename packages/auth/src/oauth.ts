import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import bcrypt from "bcryptjs";
import {
  upsertUser,
  upsertOAuthAccount,
  getOAuthAccount,
  createSession,
  deleteSession,
  createOrg,
  getUserOrgs,
  getOrgBySlug,
  createEmailUser,
  getUserByEmailWithPassword,
  getUserByEmail,
} from "@studio/database";
import { randomUUID } from "node:crypto";

const COOKIE_NAME = "session_id";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

function getConfig() {
  return {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
    appUrl: process.env.APP_URL ?? "http://localhost:3000",
  };
}

export const authRouter = new Hono();

// ─── GitHub OAuth ─────────────────────────────────────────────────────────────

authRouter.get("/github", (c) => {
  const config = getConfig();
  const state = randomUUID();
  const params = new URLSearchParams({
    client_id: config.github.clientId,
    redirect_uri: `${config.appUrl}/auth/github/callback`,
    scope: "read:user user:email",
    state,
  });
  setCookie(c, "oauth_state", state, { httpOnly: true, maxAge: 600, sameSite: "Lax" });
  return c.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

authRouter.get("/github/callback", async (c) => {
  const config = getConfig();
  const code = c.req.query("code");
  if (!code) return c.redirect(`${config.appUrl}/login?error=no_code`);

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.github.clientId,
        client_secret: config.github.clientSecret,
        code,
        redirect_uri: `${config.appUrl}/auth/github/callback`,
      }),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenData.access_token;
    if (!accessToken) return c.redirect(`${config.appUrl}/login?error=token_exchange`);

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "studio-app" },
    });
    const ghUser = (await userRes.json()) as {
      id: number;
      email?: string | null;
      name?: string | null;
      avatar_url?: string;
      login: string;
    };

    let email = ghUser.email ?? null;
    if (!email) {
      const emailRes = await fetch("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "studio-app" },
      });
      const emails = (await emailRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      email = emails.find((e) => e.primary && e.verified)?.email ?? emails[0]?.email ?? null;
    }
    if (!email) return c.redirect(`${config.appUrl}/login?error=no_email`);

    const userId = await upsertAndCreateUser("github", String(ghUser.id), {
      email,
      name: ghUser.name ?? ghUser.login,
      avatarUrl: ghUser.avatar_url,
    }, accessToken);

    const session = await createSession(userId);
    setCookie(c, COOKIE_NAME, session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    return c.redirect(`${config.appUrl}/`);
  } catch (err) {
    console.error("[auth/github] callback error:", err);
    return c.redirect(`${config.appUrl}/login?error=server_error`);
  }
});

// ─── Google OAuth ─────────────────────────────────────────────────────────────

authRouter.get("/google", (c) => {
  const config = getConfig();
  const state = randomUUID();
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: `${config.appUrl}/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
  });
  setCookie(c, "oauth_state", state, { httpOnly: true, maxAge: 600, sameSite: "Lax" });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

authRouter.get("/google/callback", async (c) => {
  const config = getConfig();
  const code = c.req.query("code");
  if (!code) return c.redirect(`${config.appUrl}/login?error=no_code`);

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: `${config.appUrl}/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenData.access_token;
    if (!accessToken) return c.redirect(`${config.appUrl}/login?error=token_exchange`);

    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const googleUser = (await userRes.json()) as {
      id: string;
      email: string;
      name?: string;
      picture?: string;
    };
    if (!googleUser.email) return c.redirect(`${config.appUrl}/login?error=no_email`);

    const userId = await upsertAndCreateUser("google", googleUser.id, {
      email: googleUser.email,
      name: googleUser.name,
      avatarUrl: googleUser.picture,
    }, accessToken);

    const session = await createSession(userId);
    setCookie(c, COOKIE_NAME, session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    return c.redirect(`${config.appUrl}/`);
  } catch (err) {
    console.error("[auth/google] callback error:", err);
    return c.redirect(`${config.appUrl}/login?error=server_error`);
  }
});

// ─── Email/Password Auth ──────────────────────────────────────────────────────

authRouter.post("/register", async (c) => {
  try {
    const body = await c.req.json() as {
      email?: string;
      password?: string;
      name?: string;
    };

    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const name = body.name?.trim();

    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    if (password.length < 8) {
      return c.json({ error: "Password must be at least 8 characters" }, 400);
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return c.json({ error: "Email already registered" }, 400);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createEmailUser({
      email,
      passwordHash,
      name,
    });

    const session = await createSession(user.id);
    setCookie(c, COOKIE_NAME, session.id, {
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE,
      sameSite: "Lax",
      path: "/",
    });

    const orgs = await getUserOrgs(user.id);
    if (orgs.length === 0) {
      const displayName = name ?? email.split("@")[0];
      const slug = await generateUniqueSlug(email.split("@")[0] ?? "user");
      await createOrg({
        slug,
        name: `${displayName}'s Workspace`,
        createdBy: user.id,
      });
    }

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    console.error("[auth/register] error:", err);
    return c.json({ error: "An unexpected error occurred" }, 500);
  }
});

authRouter.post("/login", async (c) => {
  try {
    const body = await c.req.json() as {
      email?: string;
      password?: string;
    };

    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const user = await getUserByEmailWithPassword(email);
    if (!user || !user.passwordHash) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const session = await createSession(user.id);
    setCookie(c, COOKIE_NAME, session.id, {
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE,
      sameSite: "Lax",
      path: "/",
    });

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    console.error("[auth/login] error:", err);
    return c.json({ error: "An unexpected error occurred" }, 500);
  }
});

// ─── Logout ───────────────────────────────────────────────────────────────────

authRouter.post("/logout", async (c) => {
  const sessionId = getCookie(c, COOKIE_NAME);
  if (sessionId) {
    await deleteSession(sessionId).catch(() => {});
  }
  deleteCookie(c, COOKIE_NAME, { path: "/" });
  return c.json({ success: true });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function upsertAndCreateUser(
  provider: string,
  providerUserId: string,
  profile: { email: string; name?: string | null; avatarUrl?: string | null },
  accessToken: string,
): Promise<string> {
  const existing = await getOAuthAccount(provider, providerUserId);
  let userId: string;

  if (existing) {
    userId = existing.userId;
    await upsertUser({
      id: userId,
      email: profile.email,
      name: profile.name ?? undefined,
      avatarUrl: profile.avatarUrl ?? undefined,
    });
  } else {
    const user = await upsertUser({
      email: profile.email,
      name: profile.name ?? undefined,
      avatarUrl: profile.avatarUrl ?? undefined,
    });
    userId = user.id;
    await upsertOAuthAccount({
      provider,
      providerUserId,
      userId,
      accessToken,
    });

    // Auto-create a personal org for new users
    const orgs = await getUserOrgs(userId);
    if (orgs.length === 0) {
      const displayName = profile.name ?? profile.email.split("@")[0];
      const slug = await generateUniqueSlug(profile.email.split("@")[0] ?? "user");
      await createOrg({
        slug,
        name: `${displayName}'s Workspace`,
        createdBy: userId,
      });
      // createOrg already calls addOrgMember with "owner" role internally
    }
  }

  return userId;
}

async function generateUniqueSlug(base: string): Promise<string> {
  const sanitized =
    base
      .replace(/[^a-z0-9-]/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 30) || "workspace";

  const existing = await getOrgBySlug(sanitized);
  if (!existing) return sanitized;
  return `${sanitized}-${Math.random().toString(36).slice(2, 7)}`;
}
