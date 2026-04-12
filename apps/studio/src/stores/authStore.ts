/**
 * Auth store — manages the current user, their orgs, and active org context.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface UserOrg {
  id: string;
  slug: string;
  name: string;
  plan: string;
  role: string;
}

interface AuthState {
  user: AuthUser | null;
  orgs: UserOrg[];
  currentOrg: UserOrg | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initialize(): Promise<void>;
  logout(): Promise<void>;
  switchOrg(orgSlug: string): void;
  refreshOrgs(): Promise<void>;
  setUser(user: AuthUser | null): void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      orgs: [],
      currentOrg: null,
      isLoading: false,
      isInitialized: false,

      async initialize() {
        if (get().isInitialized) return;
        set({ isLoading: true });
        try {
          const res = await fetch("/api/users/me");
          if (!res.ok) {
            set({ user: null, orgs: [], currentOrg: null, isInitialized: true, isLoading: false });
            return;
          }
          const data = await res.json() as { user?: AuthUser };
          if (!data.user) {
            set({ user: null, orgs: [], currentOrg: null, isInitialized: true, isLoading: false });
            return;
          }
          const { user } = data;

          const orgsRes = await fetch("/api/users/me/orgs");
          const { orgs } = orgsRes.ok
            ? await orgsRes.json() as { orgs: UserOrg[] }
            : { orgs: [] };

          const savedSlug = localStorage.getItem("currentOrgSlug");
          const currentOrg =
            orgs.find((o) => o.slug === savedSlug) ?? orgs[0] ?? null;

          set({ user, orgs, currentOrg, isInitialized: true, isLoading: false });
        } catch {
          set({ user: null, orgs: [], currentOrg: null, isInitialized: true, isLoading: false });
        }
      },

      async logout() {
        await fetch("/auth/logout", { method: "POST" }).catch(() => {});
        set({ user: null, orgs: [], currentOrg: null, isInitialized: false });
        localStorage.removeItem("currentOrgSlug");
        window.location.href = "/login";
      },

      switchOrg(orgSlug: string) {
        const { orgs } = get();
        const org = orgs.find((o) => o.slug === orgSlug);
        if (org) {
          set({ currentOrg: org });
          localStorage.setItem("currentOrgSlug", orgSlug);
        }
      },

      async refreshOrgs() {
        const res = await fetch("/api/users/me/orgs");
        if (!res.ok) return;
        const { orgs } = await res.json() as { orgs: UserOrg[] };
        const { currentOrg } = get();
        const refreshedCurrent = currentOrg
          ? (orgs.find((o) => o.id === currentOrg.id) ?? orgs[0] ?? null)
          : orgs[0] ?? null;
        set({ orgs, currentOrg: refreshedCurrent });
      },

      setUser(user: AuthUser | null) {
        set({ user });
      },
    }),
    {
      name: "auth-store",
      partialize: (s) => ({ currentOrg: s.currentOrg }),
    },
  ),
);
