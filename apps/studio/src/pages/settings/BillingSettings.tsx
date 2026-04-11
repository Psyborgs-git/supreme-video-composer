import { useState, useEffect } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useBillingStore } from "../../stores/billingStore";

export const BillingSettings: React.FC = () => {
  const { currentOrg } = useAuthStore();
  const { plan, planConfig, creditBalance, isLoading, fetch: fetchBilling } = useBillingStore();
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (currentOrg?.slug) {
      fetchBilling(currentOrg.slug);
    }
  }, [currentOrg?.slug]);

  const handleUpgrade = async (targetPlan: string) => {
    if (!currentOrg) return;
    setUpgradeLoading(targetPlan);
    try {
      const res = await fetch(`/api/orgs/${currentOrg.slug}/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: targetPlan }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setUpgradeLoading(null);
    }
  };

  const handlePortal = async () => {
    if (!currentOrg) return;
    setPortalLoading(true);
    try {
      const res = await fetch(`/api/orgs/${currentOrg.slug}/billing/portal`, { method: "POST" });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } finally {
      setPortalLoading(false);
    }
  };

  const plans = [
    { id: "free", name: "Free", price: "$0/mo", credits: 50, renders: "10", automations: 0 },
    { id: "pro", name: "Pro", price: "$29/mo", credits: 500, renders: "Unlimited", automations: 5 },
    { id: "team", name: "Team", price: "$99/mo", credits: 2000, renders: "Unlimited", automations: 20 },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-6">Billing &amp; Credits</h1>

      {/* Current plan & credits */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Current plan</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-zinc-100 capitalize">{planConfig?.name ?? plan}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Credits remaining</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-zinc-100">{isLoading ? "…" : creditBalance}</p>
          </div>
          {plan !== "free" && (
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              {portalLoading ? "Opening…" : "Manage billing"}
            </button>
          )}
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {plans.map((p) => (
          <div
            key={p.id}
            className={`relative bg-white dark:bg-zinc-900 border rounded-xl p-5 ${
              plan === p.id
                ? "border-blue-500 ring-2 ring-blue-500/30"
                : "border-gray-200 dark:border-zinc-800"
            }`}
          >
            {plan === p.id && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-blue-600 text-white text-xs font-semibold rounded-full">
                Current
              </span>
            )}
            <h3 className="font-semibold text-gray-900 dark:text-zinc-100">{p.name}</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mt-1">{p.price}</p>
            <ul className="mt-3 space-y-1 text-sm text-gray-600 dark:text-zinc-400">
              <li>{p.credits} credits/mo</li>
              <li>{p.renders} renders</li>
              <li>{p.automations === 0 ? "No automations" : `${p.automations} automations`}</li>
            </ul>
            {plan !== p.id && p.id !== "free" && (
              <button
                onClick={() => handleUpgrade(p.id)}
                disabled={upgradeLoading === p.id}
                className="mt-4 w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {upgradeLoading === p.id ? "Redirecting…" : `Upgrade to ${p.name}`}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
