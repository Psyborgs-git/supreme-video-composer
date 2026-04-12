export type PlanId = "free" | "pro" | "team" | "enterprise";

export interface Plan {
  id: PlanId;
  name: string;
  price: number; // monthly USD cents
  creditsPerMonth: number;
  maxRenders: number | null; // null = unlimited
  maxAutomations: number;
  stripePriceId?: string; // from env
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    creditsPerMonth: 50,
    maxRenders: 10,
    maxAutomations: 0,
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 2900,
    creditsPerMonth: 500,
    maxRenders: null,
    maxAutomations: 5,
    get stripePriceId() { return process.env.STRIPE_PRICE_ID_PRO; },
  },
  team: {
    id: "team",
    name: "Team",
    price: 9900,
    creditsPerMonth: 2000,
    maxRenders: null,
    maxAutomations: 20,
    get stripePriceId() { return process.env.STRIPE_PRICE_ID_TEAM; },
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    price: -1, // custom
    creditsPerMonth: -1, // custom
    maxRenders: null,
    maxAutomations: -1, // unlimited
  },
};

// Credit costs per operation
export const CREDIT_COSTS = {
  generationScript: 5,
  generationImage: 10,
  generationAudio: 8,
  generationVideo: 20,
  renderPerMinute: 10,
  automationFlat: 2,
} as const;
