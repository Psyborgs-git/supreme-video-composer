/**
 * Billing store — credit balance, plan, and usage summary for the current org.
 */
import { create } from "zustand";
import { useAuthStore } from "./authStore";

interface PlanConfig {
  name: string;
  price: number;
  creditsPerMonth: number;
  maxRenders: number | null;
  maxAutomations: number;
}

interface BillingState {
  plan: string;
  planConfig: PlanConfig | null;
  creditBalance: number;
  subscription: unknown | null;
  isLoading: boolean;
  lastFetched: number | null;

  fetch(orgSlug: string): Promise<void>;
  clear(): void;
}

const DEFAULT_PLAN_CONFIG: PlanConfig = {
  name: "Free",
  price: 0,
  creditsPerMonth: 50,
  maxRenders: 10,
  maxAutomations: 0,
};

export const useBillingStore = create<BillingState>()((set) => ({
  plan: "free",
  planConfig: DEFAULT_PLAN_CONFIG,
  creditBalance: 0,
  subscription: null,
  isLoading: false,
  lastFetched: null,

  async fetch(orgSlug: string) {
    set({ isLoading: true });
    try {
      const res = await fetch(`/api/orgs/${orgSlug}/billing`);
      if (!res.ok) return;
      const data = await res.json() as {
        plan: string;
        planConfig: PlanConfig;
        creditBalance: number;
        subscription: unknown;
      };
      set({
        plan: data.plan,
        planConfig: data.planConfig,
        creditBalance: data.creditBalance,
        subscription: data.subscription,
        lastFetched: Date.now(),
      });
    } finally {
      set({ isLoading: false });
    }
  },

  clear() {
    set({
      plan: "free",
      planConfig: DEFAULT_PLAN_CONFIG,
      creditBalance: 0,
      subscription: null,
      lastFetched: null,
    });
  },
}));
