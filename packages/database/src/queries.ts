import { eq, and, sum, desc } from "drizzle-orm";
import { getDb } from "./client";
import * as schema from "./schema";
import { randomUUID } from "node:crypto";

export { randomUUID };

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUserById(id: string) {
  return getDb().query.users.findFirst({ where: eq(schema.users.id, id) });
}

export async function getUserByEmail(email: string) {
  return getDb().query.users.findFirst({ where: eq(schema.users.email, email) });
}

export async function upsertUser(data: {
  id?: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}) {
  const existing = await getUserByEmail(data.email);
  if (existing) {
    const [updated] = await getDb()
      .update(schema.users)
      .set({ name: data.name, avatarUrl: data.avatarUrl })
      .where(eq(schema.users.email, data.email))
      .returning();
    return updated;
  }
  const [created] = await getDb()
    .insert(schema.users)
    .values({
      id: data.id ?? randomUUID(),
      email: data.email,
      name: data.name,
      avatarUrl: data.avatarUrl,
    })
    .returning();
  return created;
}

export async function updateUser(
  id: string,
  data: Partial<{ name: string; avatarUrl: string }>,
) {
  const [updated] = await getDb()
    .update(schema.users)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
    })
    .where(eq(schema.users.id, id))
    .returning();
  return updated;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function createSession(
  userId: string,
  ttlMs = 30 * 24 * 60 * 60 * 1000,
) {
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const [session] = await getDb()
    .insert(schema.sessions)
    .values({ id: randomUUID(), userId, expiresAt })
    .returning();
  return session;
}

export async function getSession(id: string) {
  return getDb().query.sessions.findFirst({ where: eq(schema.sessions.id, id) });
}

export async function deleteSession(id: string) {
  return getDb().delete(schema.sessions).where(eq(schema.sessions.id, id));
}

// ─── OAuth accounts ───────────────────────────────────────────────────────────

export async function getOAuthAccount(provider: string, providerUserId: string) {
  return getDb().query.oauthAccounts.findFirst({
    where: and(
      eq(schema.oauthAccounts.provider, provider),
      eq(schema.oauthAccounts.providerUserId, providerUserId),
    ),
  });
}

export async function upsertOAuthAccount(data: {
  provider: string;
  providerUserId: string;
  userId: string;
  accessToken?: string;
  refreshToken?: string;
}) {
  const existing = await getOAuthAccount(data.provider, data.providerUserId);
  if (existing) {
    const [updated] = await getDb()
      .update(schema.oauthAccounts)
      .set({ accessToken: data.accessToken, refreshToken: data.refreshToken })
      .where(
        and(
          eq(schema.oauthAccounts.provider, data.provider),
          eq(schema.oauthAccounts.providerUserId, data.providerUserId),
        ),
      )
      .returning();
    return updated;
  }
  const [created] = await getDb()
    .insert(schema.oauthAccounts)
    .values({
      id: randomUUID(),
      provider: data.provider,
      providerUserId: data.providerUserId,
      userId: data.userId,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    })
    .returning();
  return created;
}

// ─── Organizations ────────────────────────────────────────────────────────────

export async function createOrg(data: {
  slug: string;
  name: string;
  createdBy: string;
}) {
  const orgId = randomUUID();
  const [org] = await getDb()
    .insert(schema.organizations)
    .values({ id: orgId, slug: data.slug, name: data.name })
    .returning();
  await addOrgMember(orgId, data.createdBy, "owner");
  return org;
}

export async function getOrgBySlug(slug: string) {
  return getDb().query.organizations.findFirst({
    where: eq(schema.organizations.slug, slug),
  });
}

export async function getOrgById(id: string) {
  return getDb().query.organizations.findFirst({
    where: eq(schema.organizations.id, id),
  });
}

export async function updateOrg(
  id: string,
  data: Partial<{ name: string; plan: string; stripeCustomerId: string }>,
) {
  const [updated] = await getDb()
    .update(schema.organizations)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.plan !== undefined && { plan: data.plan }),
      ...(data.stripeCustomerId !== undefined && {
        stripeCustomerId: data.stripeCustomerId,
      }),
    })
    .where(eq(schema.organizations.id, id))
    .returning();
  return updated;
}

export async function deleteOrg(id: string) {
  return getDb().delete(schema.organizations).where(eq(schema.organizations.id, id));
}

export async function getUserOrgs(userId: string) {
  const members = await getDb().query.orgMembers.findMany({
    where: eq(schema.orgMembers.userId, userId),
    with: { org: true },
  });
  return members
    .filter((m) => m.org != null)
    .map((m) => ({ role: m.role, ...(m.org as typeof schema.organizations.$inferSelect) }));
}

// ─── Org members ──────────────────────────────────────────────────────────────

export async function addOrgMember(orgId: string, userId: string, role: string) {
  const [member] = await getDb()
    .insert(schema.orgMembers)
    .values({
      orgId,
      userId,
      role,
      joinedAt: new Date().toISOString(),
    })
    .returning();
  return member;
}

export async function getOrgMember(orgId: string, userId: string) {
  return getDb().query.orgMembers.findFirst({
    where: and(
      eq(schema.orgMembers.orgId, orgId),
      eq(schema.orgMembers.userId, userId),
    ),
  });
}

export async function getOrgMembers(orgId: string) {
  return getDb().query.orgMembers.findMany({
    where: eq(schema.orgMembers.orgId, orgId),
    with: { user: true },
  });
}

export async function updateOrgMemberRole(
  orgId: string,
  userId: string,
  role: string,
) {
  const [updated] = await getDb()
    .update(schema.orgMembers)
    .set({ role })
    .where(
      and(
        eq(schema.orgMembers.orgId, orgId),
        eq(schema.orgMembers.userId, userId),
      ),
    )
    .returning();
  return updated;
}

export async function removeOrgMember(orgId: string, userId: string) {
  return getDb()
    .delete(schema.orgMembers)
    .where(
      and(
        eq(schema.orgMembers.orgId, orgId),
        eq(schema.orgMembers.userId, userId),
      ),
    );
}

// ─── Org invites ──────────────────────────────────────────────────────────────

export async function createInvite(data: {
  orgId: string;
  email: string;
  role: string;
}) {
  const [invite] = await getDb()
    .insert(schema.orgInvites)
    .values({
      id: randomUUID(),
      orgId: data.orgId,
      email: data.email,
      role: data.role,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .returning();
  return invite;
}

export async function getInviteByToken(token: string) {
  return getDb().query.orgInvites.findFirst({
    where: eq(schema.orgInvites.token, token),
  });
}

export async function deleteInvite(id: string) {
  return getDb().delete(schema.orgInvites).where(eq(schema.orgInvites.id, id));
}

// ─── Credit ledger ────────────────────────────────────────────────────────────

export async function getCreditBalance(orgId: string): Promise<number> {
  const result = await getDb()
    .select({ total: sum(schema.creditLedger.delta) })
    .from(schema.creditLedger)
    .where(eq(schema.creditLedger.orgId, orgId));
  return Number(result[0]?.total ?? 0);
}

export async function addCreditTransaction(data: {
  orgId: string;
  userId?: string;
  delta: number;
  reason: string;
  referenceId?: string;
  referenceType?: string;
}) {
  const [entry] = await getDb()
    .insert(schema.creditLedger)
    .values({
      id: randomUUID(),
      orgId: data.orgId,
      userId: data.userId,
      delta: data.delta,
      reason: data.reason,
      referenceId: data.referenceId,
      referenceType: data.referenceType,
    })
    .returning();
  return entry;
}

// ─── Usage events ─────────────────────────────────────────────────────────────

export async function logUsageEvent(data: {
  orgId: string;
  userId?: string;
  eventType: string;
  resourceType?: string;
  resourceId?: string;
  meta?: Record<string, unknown>;
}) {
  const [event] = await getDb()
    .insert(schema.usageEvents)
    .values({
      id: randomUUID(),
      orgId: data.orgId,
      userId: data.userId,
      eventType: data.eventType,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      meta: JSON.stringify(data.meta ?? {}),
    })
    .returning();
  return event;
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export async function getOrgSubscription(orgId: string) {
  return getDb().query.subscriptions.findFirst({
    where: eq(schema.subscriptions.orgId, orgId),
  });
}

export async function upsertSubscription(data: {
  orgId: string;
  stripeSubscriptionId?: string;
  plan: string;
  status: string;
  currentPeriodEnd?: string;
}) {
  const existing = await getOrgSubscription(data.orgId);
  if (existing) {
    const [updated] = await getDb()
      .update(schema.subscriptions)
      .set({
        stripeSubscriptionId: data.stripeSubscriptionId,
        plan: data.plan,
        status: data.status,
        currentPeriodEnd: data.currentPeriodEnd,
      })
      .where(eq(schema.subscriptions.orgId, data.orgId))
      .returning();
    return updated;
  }
  const [created] = await getDb()
    .insert(schema.subscriptions)
    .values({
      id: randomUUID(),
      orgId: data.orgId,
      stripeSubscriptionId: data.stripeSubscriptionId,
      plan: data.plan,
      status: data.status,
      currentPeriodEnd: data.currentPeriodEnd,
    })
    .returning();
  return created;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function getOrgProjects(orgId: string) {
  return getDb().query.projects.findMany({
    where: eq(schema.projects.orgId, orgId),
    orderBy: desc(schema.projects.createdAt),
  });
}

export async function getProjectById(id: string) {
  return getDb().query.projects.findFirst({ where: eq(schema.projects.id, id) });
}

// ─── Automations ──────────────────────────────────────────────────────────────

export async function getOrgAutomations(orgId: string) {
  return getDb().query.automations.findMany({
    where: eq(schema.automations.orgId, orgId),
    orderBy: desc(schema.automations.createdAt),
  });
}

export async function getAutomationById(id: string) {
  return getDb().query.automations.findFirst({
    where: eq(schema.automations.id, id),
  });
}

export async function createAutomation(data: {
  orgId: string;
  createdBy: string;
  name: string;
  cronExpr: string;
  templateId: string;
  inputProps?: Record<string, unknown>;
}) {
  const [automation] = await getDb()
    .insert(schema.automations)
    .values({
      id: randomUUID(),
      orgId: data.orgId,
      createdBy: data.createdBy,
      name: data.name,
      cronExpr: data.cronExpr,
      templateId: data.templateId,
      inputProps: JSON.stringify(data.inputProps ?? {}),
    })
    .returning();
  return automation;
}

export async function updateAutomation(
  id: string,
  data: Partial<{
    name: string;
    cronExpr: string;
    templateId: string;
    inputProps: Record<string, unknown>;
    enabled: boolean;
    lastRunAt: string;
    nextRunAt: string;
  }>,
) {
  const [updated] = await getDb()
    .update(schema.automations)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.cronExpr !== undefined && { cronExpr: data.cronExpr }),
      ...(data.templateId !== undefined && { templateId: data.templateId }),
      ...(data.inputProps !== undefined && {
        inputProps: JSON.stringify(data.inputProps),
      }),
      ...(data.enabled !== undefined && { enabled: data.enabled ? 1 : 0 }),
      ...(data.lastRunAt !== undefined && { lastRunAt: data.lastRunAt }),
      ...(data.nextRunAt !== undefined && { nextRunAt: data.nextRunAt }),
    })
    .where(eq(schema.automations.id, id))
    .returning();
  return updated;
}

export async function deleteAutomation(id: string) {
  return getDb().delete(schema.automations).where(eq(schema.automations.id, id));
}

export async function createAutomationRun(data: {
  automationId: string;
  status?: string;
}) {
  const [run] = await getDb()
    .insert(schema.automationRuns)
    .values({
      id: randomUUID(),
      automationId: data.automationId,
      status: data.status ?? "pending",
    })
    .returning();
  return run;
}

export async function updateAutomationRun(
  id: string,
  data: Partial<{
    status: string;
    outputUrl: string;
    error: string;
    ranAt: string;
    creditsUsed: number;
  }>,
) {
  const [updated] = await getDb()
    .update(schema.automationRuns)
    .set({
      ...(data.status !== undefined && { status: data.status }),
      ...(data.outputUrl !== undefined && { outputUrl: data.outputUrl }),
      ...(data.error !== undefined && { error: data.error }),
      ...(data.ranAt !== undefined && { ranAt: data.ranAt }),
      ...(data.creditsUsed !== undefined && { creditsUsed: data.creditsUsed }),
    })
    .where(eq(schema.automationRuns.id, id))
    .returning();
  return updated;
}

export async function getAutomationRuns(automationId: string, limit?: number) {
  return getDb().query.automationRuns.findMany({
    where: eq(schema.automationRuns.automationId, automationId),
    orderBy: desc(schema.automationRuns.ranAt),
    ...(limit !== undefined && { limit }),
  });
}
