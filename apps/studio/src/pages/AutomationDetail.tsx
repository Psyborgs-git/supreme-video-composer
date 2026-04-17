/**
 * AutomationDetail — per-workflow configuration page.
 *
 * Sections:
 *  1. Header (name, enable/disable, Run Now, last run badge)
 *  2. Trigger (cron, timezone, overlap policy)
 *  3. Workflow Steps (no-code step builder + Advanced mode JSON editor)
 *  4. Approval & Permissions
 *  5. Run History (with step-level drill-down)
 *  6. Pending Approvals panel
 */
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { PROVIDER_CAPABILITY_MAP } from "@studio/shared-types";
import type { WorkflowStep, ApprovalPolicy, AutomationRun } from "@studio/shared-types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AutomationDetail {
  id: string;
  name: string;
  cronExpr: string;
  templateId: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  workflowVersion: number;
  timezone: string;
  overlapPolicy: "skip" | "queue" | "cancel_running";
}

const STEP_TYPES = [
  { value: "generate_text", label: "Generate text / script" },
  { value: "generate_image", label: "Generate images" },
  { value: "generate_audio", label: "Generate audio" },
  { value: "generate_video", label: "Generate video" },
  { value: "render", label: "Render video" },
  { value: "approve", label: "Approval gate" },
  { value: "custom_code", label: "Custom code (advanced)" },
];

const TIMEZONES = [
  "UTC", "America/New_York", "America/Los_Angeles", "America/Chicago",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo",
  "Asia/Shanghai", "Asia/Kolkata", "Australia/Sydney",
];

const OVERLAP_POLICIES = [
  { value: "skip", label: "Skip (default) — ignore trigger if already running" },
  { value: "queue", label: "Queue — wait until previous run completes" },
  { value: "cancel_running", label: "Cancel running — stop previous and start fresh" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    complete: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    running: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

function approvalBadge(status: string) {
  if (status === "none" || !status) return null;
  const colors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={`ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? ""}`}>
      {status}
    </span>
  );
}

// ─── Step card ────────────────────────────────────────────────────────────────

function StepCard({
  step,
  index,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  advancedMode,
}: {
  step: WorkflowStep;
  index: number;
  onUpdate: (id: string, patch: Partial<WorkflowStep>) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  advancedMode: boolean;
}) {
  const providerOptions = Object.entries(PROVIDER_CAPABILITY_MAP)
    .filter(([, cap]) => {
      if (step.type === "generate_text") return cap.modalities.includes("text");
      if (step.type === "generate_image") return cap.modalities.includes("image");
      if (step.type === "generate_audio") return cap.modalities.includes("audio");
      if (step.type === "generate_video") return cap.modalities.includes("video");
      return false;
    })
    .map(([key, cap]) => ({ value: key, label: cap.label }));

  const modelOptions =
    step.provider && PROVIDER_CAPABILITY_MAP[step.provider]
      ? (() => {
          const mod =
            step.type === "generate_text" ? "text"
            : step.type === "generate_image" ? "image"
            : step.type === "generate_audio" ? "audio"
            : "video";
          return PROVIDER_CAPABILITY_MAP[step.provider].availableModels[mod] ?? [];
        })()
      : [];

  const needsProvider = ["generate_text", "generate_image", "generate_audio", "generate_video"].includes(step.type);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-xs font-bold">
            {index + 1}
          </span>
          <select
            value={step.type}
            onChange={(e) => onUpdate(step.id, { type: e.target.value as WorkflowStep["type"] })}
            className="text-sm font-medium bg-transparent border-none focus:outline-none focus:ring-0 text-gray-900 dark:text-zinc-100"
          >
            {STEP_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onMoveUp(step.id)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200" title="Move up">↑</button>
          <button onClick={() => onMoveDown(step.id)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200" title="Move down">↓</button>
          <button onClick={() => onDelete(step.id)} className="p-1 text-red-400 hover:text-red-600" title="Delete step">✕</button>
        </div>
      </div>

      {step.type === "approve" ? (
        <p className="text-xs text-gray-500 dark:text-zinc-400 italic">
          Pauses execution and waits for a team member to approve before continuing.
        </p>
      ) : step.type === "render" ? (
        <p className="text-xs text-gray-500 dark:text-zinc-400 italic">
          Renders the template using all context values collected from previous steps.
        </p>
      ) : step.type === "custom_code" ? (
        <div>
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
            ⚠️ Advanced mode only — define custom logic as JSON. Execution happens in a future runtime.
          </p>
          {advancedMode && (
            <textarea
              rows={4}
              value={step.advancedCode ?? ""}
              onChange={(e) => onUpdate(step.id, { advancedCode: e.target.value })}
              placeholder='{"action": "custom", "code": "..."}'
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {needsProvider && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Provider</label>
                <select
                  value={step.provider ?? ""}
                  onChange={(e) => onUpdate(step.id, { provider: e.target.value || undefined, model: undefined })}
                  className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Auto (from env)</option>
                  {providerOptions.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              {modelOptions.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Model</label>
                  <select
                    value={step.model ?? ""}
                    onChange={(e) => onUpdate(step.id, { model: e.target.value || undefined })}
                    className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Default</option>
                    {modelOptions.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">
              Prompt template
              <span className="ml-1 text-gray-400 font-normal">— use {"{{slot_key}}"} for variable substitution</span>
            </label>
            <textarea
              rows={2}
              value={step.promptTemplate ?? ""}
              onChange={(e) => onUpdate(step.id, { promptTemplate: e.target.value })}
              placeholder="Create a video about {{topic}} in {{style}} style"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Output slot key</label>
            <input
              value={step.outputSlotKey ?? ""}
              onChange={(e) => onUpdate(step.id, { outputSlotKey: e.target.value || undefined })}
              placeholder="e.g. generatedScript"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {advancedMode && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">
                Condition expression <span className="text-gray-400">(skip this step if false)</span>
              </label>
              <input
                value={step.conditionExpr ?? ""}
                onChange={(e) => onUpdate(step.id, { conditionExpr: e.target.value || undefined })}
                placeholder='context.sceneCount > 3'
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export const AutomationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentOrg, user } = useAuthStore();
  const navigate = useNavigate();

  const [automation, setAutomation] = useState<AutomationDetail | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [policy, setPolicy] = useState<ApprovalPolicy | null>(null);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<AutomationRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advancedMode, setAdvancedMode] = useState(false);

  // Editable trigger fields
  const [cronExpr, setCronExpr] = useState("0 9 * * 1");
  const [timezone, setTimezone] = useState("UTC");
  const [overlapPolicy, setOverlapPolicy] = useState<"skip" | "queue" | "cancel_running">("skip");

  const loadData = useCallback(async () => {
    if (!currentOrg || !id) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/orgs/${currentOrg.slug}/automations/${id}`);
      const data = await res.json() as {
        automation: AutomationDetail;
        steps: WorkflowStep[];
        policy: ApprovalPolicy | null;
        recentRuns: AutomationRun[];
        pendingApprovals: AutomationRun[];
      };
      setAutomation(data.automation);
      setSteps(data.steps ?? []);
      setPolicy(data.policy);
      setRuns(data.recentRuns ?? []);
      setPendingApprovals(data.pendingApprovals ?? []);
      setCronExpr(data.automation.cronExpr);
      setTimezone(data.automation.timezone ?? "UTC");
      setOverlapPolicy(data.automation.overlapPolicy ?? "skip");
    } catch (e) {
      setError("Failed to load automation");
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg, id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Toggle enable ─────────────────────────────────────────────────────────
  const handleToggle = async () => {
    if (!automation || !currentOrg) return;
    const res = await fetch(`/api/orgs/${currentOrg.slug}/automations/${automation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !automation.enabled }),
    });
    if (res.ok) setAutomation((a) => a ? { ...a, enabled: !a.enabled } : a);
  };

  // ── Run now ───────────────────────────────────────────────────────────────
  const handleRunNow = async () => {
    if (!automation || !currentOrg) return;
    await fetch(`/api/orgs/${currentOrg.slug}/automations/${automation.id}/run`, { method: "POST" });
    setTimeout(loadData, 1000);
  };

  // ── Save trigger settings ─────────────────────────────────────────────────
  const handleSaveTrigger = async () => {
    if (!automation || !currentOrg) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/orgs/${currentOrg.slug}/automations/${automation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cronExpr, timezone, overlapPolicy }),
      });
      const data = await res.json() as { automation?: AutomationDetail; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      if (data.automation) setAutomation(data.automation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Step management ───────────────────────────────────────────────────────
  const handleAddStep = async (type: string) => {
    if (!automation || !currentOrg) return;
    const res = await fetch(`/api/orgs/${currentOrg.slug}/automations/${automation.id}/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, order: steps.length }),
    });
    const data = await res.json() as { step?: WorkflowStep };
    if (data.step) setSteps((s) => [...s, data.step!]);
  };

  const handleUpdateStep = async (stepId: string, patch: Partial<WorkflowStep>) => {
    if (!automation || !currentOrg) return;
    setSteps((s) => s.map((st) => st.id === stepId ? { ...st, ...patch } : st));
    await fetch(`/api/orgs/${currentOrg.slug}/automations/${automation.id}/steps/${stepId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!automation || !currentOrg) return;
    setSteps((s) => s.filter((st) => st.id !== stepId));
    await fetch(`/api/orgs/${currentOrg.slug}/automations/${automation.id}/steps/${stepId}`, {
      method: "DELETE",
    });
  };

  const handleMoveStep = async (stepId: string, direction: "up" | "down") => {
    const idx = steps.findIndex((s) => s.id === stepId);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= steps.length) return;
    const reordered = [...steps];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    setSteps(reordered);
    if (!automation || !currentOrg) return;
    await fetch(`/api/orgs/${currentOrg.slug}/automations/${automation.id}/steps/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((s) => s.id) }),
    });
  };

  // ── Approval policy ───────────────────────────────────────────────────────
  const handleSavePolicy = async (p: Partial<ApprovalPolicy>) => {
    if (!automation || !currentOrg) return;
    const res = await fetch(`/api/orgs/${currentOrg.slug}/automations/${automation.id}/policy`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    const data = await res.json() as { policy?: ApprovalPolicy };
    if (data.policy) setPolicy(data.policy);
  };

  // ── Approve / Reject run ──────────────────────────────────────────────────
  const handleApproveRun = async (runId: string) => {
    if (!automation || !currentOrg) return;
    await fetch(`/api/orgs/${currentOrg.slug}/automations/${automation.id}/runs/${runId}/approve`, { method: "POST" });
    setPendingApprovals((p) => p.filter((r) => r.id !== runId));
    loadData();
  };

  const handleRejectRun = async (runId: string) => {
    if (!automation || !currentOrg) return;
    await fetch(`/api/orgs/${currentOrg.slug}/automations/${automation.id}/runs/${runId}/reject`, { method: "POST" });
    setPendingApprovals((p) => p.filter((r) => r.id !== runId));
    loadData();
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-sm text-gray-500 dark:text-zinc-400">Loading…</p>
      </div>
    );
  }

  if (!automation) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-sm text-red-500">{error ?? "Automation not found"}</p>
        <button onClick={() => navigate("/automations")} className="mt-3 text-sm text-blue-600 hover:underline">
          ← Back to Automations
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <button onClick={() => navigate("/automations")} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 mb-1 flex items-center gap-1">
            ← Automations
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{automation.name}</h1>
          {automation.lastRunAt && (
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
              Last run: {new Date(automation.lastRunAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggle}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              automation.enabled
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200"
                : "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-gray-200"
            }`}
          >
            {automation.enabled ? "● Enabled" : "○ Disabled"}
          </button>
          <button
            onClick={handleRunNow}
            className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
          >
            ▶ Run now
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ── Pending approvals panel ──────────────────────────────────────────── */}
      {pendingApprovals.length > 0 && (
        <section className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
          <h2 className="text-base font-semibold text-amber-900 dark:text-amber-300 mb-3">
            ⏳ Pending approvals ({pendingApprovals.length})
          </h2>
          <div className="space-y-3">
            {pendingApprovals.map((run) => (
              <div key={run.id} className="flex items-center justify-between bg-white dark:bg-zinc-900 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                    Run {run.id.slice(0, 8)}…
                    {approvalBadge(run.approvalStatus)}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500">
                    Triggered: {run.triggeredBy} · {run.ranAt ? new Date(run.ranAt).toLocaleString() : "queued"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApproveRun(run.id)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleRejectRun(run.id)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Trigger ──────────────────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100 mb-4">Trigger</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
              CRON expression
            </label>
            <input
              value={cronExpr}
              onChange={(e) => setCronExpr(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0 9 * * 1"
            />
            <p className="text-xs text-gray-400 mt-1">e.g. "0 9 * * 1" = every Monday at 9am</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
              Overlap policy
            </label>
            <select
              value={overlapPolicy}
              onChange={(e) => setOverlapPolicy(e.target.value as typeof overlapPolicy)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {OVERLAP_POLICIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <button
          onClick={handleSaveTrigger}
          disabled={isSaving}
          className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium"
        >
          {isSaving ? "Saving…" : "Save trigger"}
        </button>
      </section>

      {/* ── Workflow Steps ────────────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">Workflow steps</h2>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={advancedMode}
                onChange={(e) => setAdvancedMode(e.target.checked)}
                className="w-3.5 h-3.5"
              />
              Advanced mode
            </label>
          </div>
        </div>

        {steps.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-zinc-600 italic mb-4">
            No steps yet. Add steps below to build your generation pipeline.
            If no steps are defined, the automation renders directly using the template's input props.
          </p>
        ) : (
          <div className="space-y-3 mb-4">
            {steps.map((step, i) => (
              <StepCard
                key={step.id}
                step={step}
                index={i}
                onUpdate={handleUpdateStep}
                onDelete={handleDeleteStep}
                onMoveUp={(sid) => handleMoveStep(sid, "up")}
                onMoveDown={(sid) => handleMoveStep(sid, "down")}
                advancedMode={advancedMode}
              />
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {STEP_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => handleAddStep(t.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-dashed border-gray-300 dark:border-zinc-700 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 text-gray-500 dark:text-zinc-500 transition-colors"
            >
              + {t.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Approval & Permissions ────────────────────────────────────────────── */}
      <ApprovalPolicyEditor policy={policy} onSave={handleSavePolicy} />

      {/* ── Run History ───────────────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100 mb-4">Run history</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-zinc-600 italic">No runs yet.</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-zinc-800">
            {runs.map((run) => (
              <div key={run.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {statusBadge(run.status)}
                    {approvalBadge(run.approvalStatus)}
                    <span className="text-xs text-gray-400 dark:text-zinc-500 font-mono">{run.id.slice(0, 8)}…</span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                    Triggered by: {run.triggeredBy}
                    {run.ranAt && ` · ${new Date(run.ranAt).toLocaleString()}`}
                    {run.creditsUsed ? ` · ${run.creditsUsed} credits` : ""}
                  </p>
                  {run.error && (
                    <p className="text-xs text-red-500 mt-0.5">{run.error}</p>
                  )}
                </div>
                {run.outputUrl && (
                  <a
                    href={run.outputUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Download
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

// ─── Approval policy editor ────────────────────────────────────────────────────

function ApprovalPolicyEditor({
  policy,
  onSave,
}: {
  policy: ApprovalPolicy | null;
  onSave: (p: Partial<ApprovalPolicy>) => void;
}) {
  const [mode, setMode] = useState(policy?.mode ?? "none");
  const [approverRole, setApproverRole] = useState(policy?.approverRole ?? "admin");
  const [timeoutMinutes, setTimeoutMinutes] = useState(policy?.timeoutMinutes ?? 60);
  const [onTimeout, setOnTimeout] = useState(policy?.onTimeout ?? "pause");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (policy) {
      setMode(policy.mode);
      setApproverRole(policy.approverRole);
      setTimeoutMinutes(policy.timeoutMinutes);
      setOnTimeout(policy.onTimeout);
    }
  }, [policy]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      onSave({ mode, approverRole, timeoutMinutes, onTimeout });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
      <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100 mb-4">Approval &amp; permissions</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">Approval mode</label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "none", label: "None", desc: "Run immediately, no approval needed" },
              { value: "auto", label: "Auto-approve", desc: "Log for review but don't block" },
              { value: "require_approval", label: "Require approval", desc: "Pause and wait for a team member" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value as typeof mode)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  mode === opt.value
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                }`}
                title={opt.desc}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {mode !== "none" && (
            <p className="text-xs text-gray-400 mt-1">
              {mode === "auto"
                ? "Runs will be logged and flagged for review, but execution continues."
                : "Runs will pause until approved. Rejected runs are cancelled."}
            </p>
          )}
        </div>

        {mode === "require_approval" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                Minimum role to approve
              </label>
              <select
                value={approverRole}
                onChange={(e) => setApproverRole(e.target.value as typeof approverRole)}
                className="w-full max-w-xs px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="owner">Owner only</option>
                <option value="admin">Admin and above</option>
                <option value="member">Any member</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  Approval timeout (minutes)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10080}
                  value={timeoutMinutes}
                  onChange={(e) => setTimeoutMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  On timeout
                </label>
                <select
                  value={onTimeout}
                  onChange={(e) => setOnTimeout(e.target.value as typeof onTimeout)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pause">Pause (keep pending)</option>
                  <option value="approve">Auto-approve</option>
                  <option value="reject">Auto-reject</option>
                </select>
              </div>
            </div>
          </>
        )}

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium"
        >
          {isSaving ? "Saving…" : "Save permissions"}
        </button>
      </div>
    </section>
  );
}
