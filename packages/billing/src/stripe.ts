import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
  }
  return _stripe;
}

export async function createCheckoutSession(params: {
  orgId: string;
  customerId?: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: params.customerId,
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: { orgId: params.orgId },
    allow_promotion_codes: true,
  });
  return session.url ?? "";
}

export async function createBillingPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<string> {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
  return session.url;
}

export async function createStripeCustomer(params: {
  email: string;
  name?: string;
  orgId: string;
}): Promise<string> {
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: { orgId: params.orgId },
  });
  return customer.id;
}

export function constructWebhookEvent(payload: string | Buffer, sig: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return getStripe().webhooks.constructEvent(payload, sig, secret);
}

export type { Stripe };
