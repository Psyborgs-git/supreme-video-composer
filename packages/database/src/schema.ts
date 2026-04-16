import { sqliteTable, text, integer, primaryKey, unique } from "drizzle-orm/sqlite-core";
import { sql, relations } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique().notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  passwordHash: text("password_hash"),
  emailVerified: integer("email_verified").default(0),
  emailVerificationToken: text("email_verification_token"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const oauthAccounts = sqliteTable(
  "oauth_accounts",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
  },
  (t) => [unique("oauth_provider_user_idx").on(t.provider, t.providerUserId)],
);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  slug: text("slug").unique().notNull(),
  name: text("name").notNull(),
  plan: text("plan").default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const orgMembers = sqliteTable(
  "org_members",
  {
    orgId: text("org_id").references(() => organizations.id),
    userId: text("user_id").references(() => users.id),
    role: text("role").notNull().default("member"),
    invitedAt: text("invited_at"),
    joinedAt: text("joined_at"),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] })],
);

export const orgInvites = sqliteTable("org_invites", {
  id: text("id").primaryKey(),
  orgId: text("org_id").references(() => organizations.id),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"),
  token: text("token").unique().notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  orgId: text("org_id").references(() => organizations.id),
  createdBy: text("created_by").references(() => users.id),
  name: text("name").notNull(),
  templateId: text("template_id").notNull(),
  inputProps: text("input_props").default("{}"),
  aspectRatio: text("aspect_ratio"),
  exportFormat: text("export_format"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  orgId: text("org_id").references(() => organizations.id),
  uploadedBy: text("uploaded_by").references(() => users.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  path: text("path").notNull(),
  url: text("url").notNull(),
  sizeBytes: integer("size_bytes").notNull().default(0),
  metadata: text("metadata").default("{}"),
  mimeType: text("mime_type"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const renderJobs = sqliteTable("render_jobs", {
  id: text("id").primaryKey(),
  orgId: text("org_id").references(() => organizations.id),
  userId: text("user_id").references(() => users.id),
  projectId: text("project_id").references(() => projects.id),
  status: text("status").notNull().default("queued"),
  outputUrl: text("output_url"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  creditsUsed: integer("credits_used").default(0),
  error: text("error"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const generationJobs = sqliteTable("generation_jobs", {
  id: text("id").primaryKey(),
  orgId: text("org_id").references(() => organizations.id),
  userId: text("user_id").references(() => users.id),
  status: text("status").notNull().default("queued"),
  prompt: text("prompt").notNull(),
  modality: text("modality"),
  outputs: text("outputs").default("{}"),
  creditsUsed: integer("credits_used").default(0),
  error: text("error"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const automations = sqliteTable("automations", {
  id: text("id").primaryKey(),
  orgId: text("org_id").references(() => organizations.id),
  createdBy: text("created_by").references(() => users.id),
  name: text("name").notNull(),
  cronExpr: text("cron_expr").notNull(),
  templateId: text("template_id").notNull(),
  inputProps: text("input_props").default("{}"),
  enabled: integer("enabled").default(1),
  lastRunAt: text("last_run_at"),
  nextRunAt: text("next_run_at"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const automationRuns = sqliteTable("automation_runs", {
  id: text("id").primaryKey(),
  automationId: text("automation_id").references(() => automations.id),
  status: text("status").notNull().default("pending"),
  outputUrl: text("output_url"),
  error: text("error"),
  ranAt: text("ran_at"),
  creditsUsed: integer("credits_used").default(0),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  orgId: text("org_id").references(() => organizations.id),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  plan: text("plan").notNull().default("free"),
  status: text("status").notNull().default("active"),
  currentPeriodEnd: text("current_period_end"),
  cancelAtPeriodEnd: integer("cancel_at_period_end").default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const creditLedger = sqliteTable("credit_ledger", {
  id: text("id").primaryKey(),
  orgId: text("org_id").references(() => organizations.id),
  userId: text("user_id").references(() => users.id),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  referenceId: text("reference_id"),
  referenceType: text("reference_type"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const usageEvents = sqliteTable("usage_events", {
  id: text("id").primaryKey(),
  orgId: text("org_id").references(() => organizations.id),
  userId: text("user_id").references(() => users.id),
  eventType: text("event_type").notNull(),
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  meta: text("meta").default("{}"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  oauthAccounts: many(oauthAccounts),
  sessions: many(sessions),
  orgMembers: many(orgMembers),
}));

export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
  user: one(users, { fields: [oauthAccounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(orgMembers),
  invites: many(orgInvites),
  projects: many(projects),
  assets: many(assets),
  renderJobs: many(renderJobs),
  generationJobs: many(generationJobs),
  automations: many(automations),
  subscriptions: many(subscriptions),
  creditLedger: many(creditLedger),
  usageEvents: many(usageEvents),
}));

export const orgMembersRelations = relations(orgMembers, ({ one }) => ({
  org: one(organizations, { fields: [orgMembers.orgId], references: [organizations.id] }),
  user: one(users, { fields: [orgMembers.userId], references: [users.id] }),
}));

export const orgInvitesRelations = relations(orgInvites, ({ one }) => ({
  org: one(organizations, { fields: [orgInvites.orgId], references: [organizations.id] }),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
  org: one(organizations, { fields: [projects.orgId], references: [organizations.id] }),
  createdByUser: one(users, { fields: [projects.createdBy], references: [users.id] }),
}));

export const assetsRelations = relations(assets, ({ one }) => ({
  org: one(organizations, { fields: [assets.orgId], references: [organizations.id] }),
  uploadedByUser: one(users, { fields: [assets.uploadedBy], references: [users.id] }),
}));

export const renderJobsRelations = relations(renderJobs, ({ one }) => ({
  org: one(organizations, { fields: [renderJobs.orgId], references: [organizations.id] }),
  user: one(users, { fields: [renderJobs.userId], references: [users.id] }),
  project: one(projects, { fields: [renderJobs.projectId], references: [projects.id] }),
}));

export const generationJobsRelations = relations(generationJobs, ({ one }) => ({
  org: one(organizations, { fields: [generationJobs.orgId], references: [organizations.id] }),
  user: one(users, { fields: [generationJobs.userId], references: [users.id] }),
}));

export const automationsRelations = relations(automations, ({ one, many }) => ({
  org: one(organizations, { fields: [automations.orgId], references: [organizations.id] }),
  createdByUser: one(users, { fields: [automations.createdBy], references: [users.id] }),
  runs: many(automationRuns),
}));

export const automationRunsRelations = relations(automationRuns, ({ one }) => ({
  automation: one(automations, { fields: [automationRuns.automationId], references: [automations.id] }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  org: one(organizations, { fields: [subscriptions.orgId], references: [organizations.id] }),
}));

export const creditLedgerRelations = relations(creditLedger, ({ one }) => ({
  org: one(organizations, { fields: [creditLedger.orgId], references: [organizations.id] }),
  user: one(users, { fields: [creditLedger.userId], references: [users.id] }),
}));

export const usageEventsRelations = relations(usageEvents, ({ one }) => ({
  org: one(organizations, { fields: [usageEvents.orgId], references: [organizations.id] }),
  user: one(users, { fields: [usageEvents.userId], references: [users.id] }),
}));
