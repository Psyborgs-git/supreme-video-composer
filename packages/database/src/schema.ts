import { sqliteTable, text, integer, primaryKey, unique } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique().notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
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
  (t) => [unique().on(t.provider, t.providerUserId)],
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
