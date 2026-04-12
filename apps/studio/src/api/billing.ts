/**
 * Billing routes — /api/orgs/:orgSlug/billing, /api/stripe/webhook
 */
import { Hono } from "hono";
import { requireAuth, requireOrgOwner, requireOrgAccess } from "@studio/auth";
import {
  getOrgBySlug,
  getOrgSubscription,
  updateOrg,
} from "@studio/database";
import {
  getCreditBalance,
  createCheckoutSession,
  createBillingPortalSession,
  createStripeCustomer,
  constructWebhookEvent,
  handleInvoicePaid,
  PLANS,
} from "@studio/billing";
import type Stripe from "stripe";

export const billingRouter = new Hono();
export const stripeWebhookRouter = new Hono();

// ─── GET /api/orgs/:orgSlug/billing ──────────────────────────────────────────

billingRouter.get("/:orgSlug/billing", requireAuth, requireOrgAccess("viewer"), async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const [subscription, creditBalance] = await Promise.all([
    getOrgSubscription(org.id),
    getCreditBalance(org.id),
  ]);

  const planId = (subscription?.plan ?? org.plan ?? "free") as keyof typeof PLANS;
  const planConfig = PLANS[planId] ?? PLANS.free;

  return c.json({
    plan: planId,
    planConfig: {
      name: planConfig.name,
      price: planConfig.price,
      creditsPerMonth: planConfig.creditsPerMonth,
      maxRenders: planConfig.maxRenders,
      maxAutomations: planConfig.maxAutomations,
    },
    creditBalance,
    subscription: subscription ?? null,
  });
});

// ─── POST /api/orgs/:orgSlug/billing/checkout ─────────────────────────────────

billingRouter.post("/:orgSlug/billing/checkout", requireAuth, requireOrgOwner, async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  const body = await c.req.json<{ plan: string }>().catch(() => null);
  if (!body?.plan) {
    return c.json({ error: "plan is required" }, 400);
  }

  const planConfig = PLANS[body.plan as keyof typeof PLANS];
  if (!planConfig?.stripePriceId) {
    return c.json({ error: "Invalid or non-upgradable plan" }, 400);
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const user = c.get("user");

  // Ensure org has a Stripe customer
  let customerId = org.stripeCustomerId ?? undefined;
  if (!customerId) {
    customerId = await createStripeCustomer({
      email: user.email,
      name: org.name,
      orgId: org.id,
    });
    await updateOrg(org.id, { stripeCustomerId: customerId });
  }

  const url = await createCheckoutSession({
    orgId: org.id,
    customerId,
    priceId: planConfig.stripePriceId,
    successUrl: `${appUrl}/settings/billing?success=1`,
    cancelUrl: `${appUrl}/settings/billing`,
  });

  return c.json({ url });
});

// ─── POST /api/orgs/:orgSlug/billing/portal ────────────────────────────────────

billingRouter.post("/:orgSlug/billing/portal", requireAuth, requireOrgOwner, async (c) => {
  const org = await getOrgBySlug(c.req.param("orgSlug"));
  if (!org) return c.json({ error: "Organization not found" }, 404);

  if (!org.stripeCustomerId) {
    return c.json({ error: "No billing account found" }, 404);
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const url = await createBillingPortalSession({
    customerId: org.stripeCustomerId,
    returnUrl: `${appUrl}/settings/billing`,
  });

  return c.json({ url });
});

// ─── POST /api/stripe/webhook ─────────────────────────────────────────────────

stripeWebhookRouter.post("/webhook", async (c) => {
  const sig = c.req.header("stripe-signature");
  if (!sig) {
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }

  const rawBody = await c.req.text();

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, sig);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Webhook signature verification failed";
    return c.json({ error: msg }, 400);
  }

  try {
    switch (event.type) {
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const orgId = (invoice.metadata as Record<string, string>)?.orgId;
        if (!orgId) break;

        // In Stripe API v2026, subscription is accessed via parent.subscription_details
        const parentSub = (invoice.parent as Stripe.Invoice.Parent | null)?.subscription_details?.subscription;
        const subId = typeof parentSub === "string" ? parentSub : (parentSub as { id: string } | null | undefined)?.id ?? "";

        await handleInvoicePaid({
          orgId: String(orgId),
          stripeSubscriptionId: subId,
          plan: (invoice.lines?.data[0]?.metadata?.plan ?? "pro") as "free" | "pro" | "team" | "enterprise",
          currentPeriodEnd: new Date((invoice.period_end ?? 0) * 1000).toISOString(),
        });
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = (sub.metadata as Record<string, string>)?.orgId;
        if (!orgId) break;

        // current_period_end moved to items in v2026; fall back to billing_cycle_anchor
        const periodEnd = (sub as unknown as Record<string, unknown>).current_period_end as number | undefined;

        const { upsertSubscription } = await import("@studio/database");
        await upsertSubscription({
          orgId: String(orgId),
          stripeSubscriptionId: sub.id,
          plan: (sub.metadata as Record<string, string>)?.plan ?? "free",
          status: sub.status as string,
          currentPeriodEnd: new Date((periodEnd ?? sub.billing_cycle_anchor) * 1000).toISOString(),
        });
        break;
      }

      default:
        // Unhandled event type — ignore
        break;
    }
  } catch (err) {
    console.error("[stripe/webhook] handler error:", err);
    // Return 200 to prevent Stripe retries for internal errors
  }

  return c.json({ received: true });
});
