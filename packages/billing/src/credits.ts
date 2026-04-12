import {
  getCreditBalance,
  addCreditTransaction,
  logUsageEvent,
  getOrgSubscription,
  upsertSubscription,
} from "@studio/database";
import { PLANS, CREDIT_COSTS } from "./plans";
import type { PlanId } from "./plans";

export { getCreditBalance };

/**
 * Check if org has enough credits. Returns true if they do.
 */
export async function hasEnoughCredits(orgId: string, required: number): Promise<boolean> {
  const balance = await getCreditBalance(orgId);
  return balance >= required;
}

/**
 * Deduct credits from org. Throws if insufficient.
 */
export async function deductCredits(params: {
  orgId: string;
  userId?: string;
  amount: number;
  reason: string;
  referenceId?: string;
  referenceType?: string;
}): Promise<void> {
  const balance = await getCreditBalance(params.orgId);
  if (balance < params.amount) {
    throw new Error(`Insufficient credits: need ${params.amount}, have ${balance}`);
  }
  await addCreditTransaction({
    orgId: params.orgId,
    userId: params.userId,
    delta: -params.amount,
    reason: params.reason,
    referenceId: params.referenceId,
    referenceType: params.referenceType,
  });
}

/**
 * Grant credits to org (e.g., on subscription renewal).
 */
export async function grantCredits(params: {
  orgId: string;
  amount: number;
  reason: string;
  referenceId?: string;
}): Promise<void> {
  await addCreditTransaction({
    orgId: params.orgId,
    delta: params.amount,
    reason: params.reason,
    referenceId: params.referenceId,
    referenceType: "billing",
  });
}

/**
 * Calculate render credit cost based on duration in seconds.
 */
export function calcRenderCredits(durationSeconds: number): number {
  const minutes = Math.ceil(durationSeconds / 60);
  return Math.max(1, minutes) * CREDIT_COSTS.renderPerMinute;
}

/**
 * On invoice.paid from Stripe, reset org credits to plan's monthly allowance.
 */
export async function handleInvoicePaid(params: {
  orgId: string;
  stripeSubscriptionId: string;
  plan: PlanId;
  currentPeriodEnd: string;
}): Promise<void> {
  const planConfig = PLANS[params.plan];
  if (!planConfig || planConfig.creditsPerMonth < 0) return; // enterprise custom

  await upsertSubscription({
    orgId: params.orgId,
    stripeSubscriptionId: params.stripeSubscriptionId,
    plan: params.plan,
    status: "active",
    currentPeriodEnd: params.currentPeriodEnd,
  });

  await grantCredits({
    orgId: params.orgId,
    amount: planConfig.creditsPerMonth,
    reason: `Monthly credit refresh for ${planConfig.name} plan`,
    referenceId: params.stripeSubscriptionId,
  });
}

export { logUsageEvent, CREDIT_COSTS };
