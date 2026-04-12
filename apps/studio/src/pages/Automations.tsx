import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

interface Automation {
  id: string;
  name: string;
  cronExpr: string;
  templateId: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export const Automations: React.FC = () => {
  const { currentOrg } = useAuthStore();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [name, setName] = useState("");
  const [cronExpr, setCronExpr] = useState("0 9 * * 1"); // Every Monday at 9am
  const [templateId, setTemplateId] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentOrg) return;
    setIsLoading(true);
    fetch(`/api/orgs/${currentOrg.slug}/automations`)
      .then((r) => r.json())
      .then((d) => setAutomations((d as { automations: Automation[] }).automations))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [currentOrg?.slug]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg) return;
    setCreateError(null);
    setCreateLoading(true);
    try {
      const res = await fetch(`/api/orgs/${currentOrg.slug}/automations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, cronExpr, templateId }),
      });
      const data = await res.json() as { automation?: Automation; error?: string };
      if (!res.ok) {
        setCreateError(data.error ?? "Failed to create automation");
        return;
      }
      if (data.automation) {
        setAutomations((prev) => [data.automation!, ...prev]);
        setShowCreate(false);
        setName("");
        setCronExpr("0 9 * * 1");
        setTemplateId("");
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    if (!currentOrg) return;
    const res = await fetch(`/api/orgs/${currentOrg.slug}/automations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    if (res.ok) {
      setAutomations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, enabled: !enabled } : a)),
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentOrg || !confirm("Delete this automation?")) return;
    const res = await fetch(`/api/orgs/${currentOrg.slug}/automations/${id}`, { method: "DELETE" });
    if (res.ok) {
      setAutomations((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const handleTrigger = async (id: string) => {
    if (!currentOrg) return;
    await fetch(`/api/orgs/${currentOrg.slug}/automations/${id}/run`, { method: "POST" });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Automations</h1>
        <button
          onClick={() => setShowCreate((s) => !s)}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          + New automation
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-4">Create automation</h2>
          {createError && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">{createError}</div>
          )}
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Weekly promo video"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Template ID</label>
                <input
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  required
                  placeholder="history-storyline"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  CRON expression
                  <span className="ml-2 text-xs text-gray-400 font-normal">e.g. "0 9 * * 1" = every Monday 9am</span>
                </label>
                <input
                  value={cronExpr}
                  onChange={(e) => setCronExpr(e.target.value)}
                  required
                  placeholder="0 9 * * 1"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createLoading}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {createLoading ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Automations list */}
      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-zinc-400">Loading…</p>
      ) : automations.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-zinc-600">
          <p className="text-lg font-medium mb-2">No automations yet</p>
          <p className="text-sm">Create an automation to schedule recurring video renders.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map((a) => (
            <div
              key={a.id}
              className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <Link
                  to={`/automations/${a.id}`}
                  className="font-medium text-gray-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate block"
                >
                  {a.name}
                </Link>
                <p className="text-xs text-gray-400 dark:text-zinc-500 font-mono mt-0.5">{a.cronExpr}</p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                  Template: {a.templateId}
                  {a.lastRunAt && ` · Last run: ${new Date(a.lastRunAt).toLocaleString()}`}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Toggle */}
                <button
                  onClick={() => handleToggle(a.id, a.enabled)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    a.enabled
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400"
                  }`}
                >
                  {a.enabled ? "Active" : "Paused"}
                </button>

                {/* Trigger now */}
                <button
                  onClick={() => handleTrigger(a.id)}
                  title="Run now"
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 transition-colors"
                >
                  ▶
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(a.id)}
                  title="Delete"
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-400 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
