import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/stores/editorStore";
import type { VideoCodec, QualityPreset } from "@studio/shared-types";

const CODECS: { value: VideoCodec; label: string; ext: string }[] = [
  { value: "h264", label: "H.264 (MP4)", ext: ".mp4" },
  { value: "h265", label: "H.265 (MP4)", ext: ".mp4" },
  { value: "vp8", label: "VP8 (WebM)", ext: ".webm" },
  { value: "vp9", label: "VP9 (WebM)", ext: ".webm" },
  { value: "av1", label: "AV1 (WebM)", ext: ".webm" },
  { value: "prores", label: "ProRes (MOV)", ext: ".mov" },
  { value: "gif", label: "GIF", ext: ".gif" },
];

const RESOLUTION_SCALES: { value: number; label: string }[] = [
  { value: 0.5, label: "0.5×" },
  { value: 1, label: "1×" },
  { value: 2, label: "2×" },
];

const FPS_OPTIONS = [24, 25, 30, 60];

const QUALITY_OPTIONS: { value: QualityPreset; label: string; description: string }[] = [
  { value: "draft", label: "Draft", description: "Fast, larger file" },
  { value: "standard", label: "Standard", description: "Balanced" },
  { value: "high", label: "High", description: "Smaller, slower" },
  { value: "max", label: "Max", description: "Lossless" },
];

const TERMINAL_STATUSES = ["complete", "error", "cancelled"] as const;

export const ExportPanel: React.FC = () => {
  const {
    projectId,
    qualityPreset,
    exportFormat,
    renderStatus,
    renderProgress,
    renderOutputPath,
    renderError,
    renderJobId,
    setQualityPreset,
    setCodec,
    setResolutionScale,
    setFps,
    saveProject,
    startRender,
    pollRenderStatus,
    resetRender,
  } = useEditorStore();

  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll render status while a job is active
  useEffect(() => {
    const isActive = renderStatus && !(TERMINAL_STATUSES as readonly string[]).includes(renderStatus);
    if (isActive) {
      pollRef.current = setInterval(pollRenderStatus, 1500);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [renderStatus, pollRenderStatus]);

  const handleSave = async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveProject(saveName.trim());
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      await startRender();
    } catch (e: unknown) {
      // error is already stored in renderError via the store
    }
  };

  const isRendering = renderStatus != null && !(TERMINAL_STATUSES as readonly string[]).includes(renderStatus);
  const progressPct = Math.round(renderProgress * 100);

  const sectionLabel = "text-sm font-medium text-gray-700 dark:text-zinc-300";
  const btnGroup = "rounded-lg px-2 sm:px-3 py-2 text-xs font-medium transition-colors";
  const activeBtn = "bg-blue-600 text-white";
  const inactiveBtn = "bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300";

  return (
    <div className="p-4 space-y-5">
      {/* ── Save Project ── */}
      {!projectId && (
        <div className="space-y-2">
          <h3 className={sectionLabel}>Save Project</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="Project name…"
              className="flex-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              onClick={handleSave}
              disabled={!saveName.trim() || saving}
              className="px-3 py-2 bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 disabled:opacity-40 rounded-lg text-sm font-medium transition-colors text-gray-800 dark:text-zinc-100"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
          {saveError && <p className="text-xs text-red-600 dark:text-red-400">{saveError}</p>}
        </div>
      )}

      {projectId && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <span>✓</span>
          <span>Project saved (id: {projectId.slice(0, 8)}…)</span>
        </p>
      )}

      {/* ── Quality ── */}
      <div className="space-y-2">
        <h3 className={sectionLabel}>Quality</h3>
        <div className="grid grid-cols-2 gap-1.5">
          {QUALITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setQualityPreset(opt.value)}
              className={`rounded-lg px-3 py-2 text-left transition-colors ${
                qualityPreset === opt.value
                  ? "bg-blue-600 text-white"
                  : `${inactiveBtn}`
              }`}
            >
              <div className="text-xs font-semibold">{opt.label}</div>
              <div className="text-[10px] opacity-70 mt-0.5">{opt.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Codec ── */}
      <div className="space-y-2">
        <h3 className={sectionLabel}>Format</h3>
        <select
          value={exportFormat.codec}
          onChange={(e) => setCodec(e.target.value as VideoCodec)}
          className="w-full bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors"
        >
          {CODECS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Resolution Scale ── */}
      <div className="space-y-2">
        <h3 className={sectionLabel}>Resolution</h3>
        <div className="flex gap-1.5">
          {RESOLUTION_SCALES.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setResolutionScale(opt.value)}
              className={`flex-1 ${btnGroup} ${exportFormat.scale === opt.value ? activeBtn : inactiveBtn}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── FPS ── */}
      <div className="space-y-2">
        <h3 className={sectionLabel}>Frame Rate</h3>
        <div className="flex gap-1.5">
          {FPS_OPTIONS.map((fps) => (
            <button
              key={fps}
              onClick={() => setFps(fps)}
              className={`flex-1 ${btnGroup} ${exportFormat.fps === fps ? activeBtn : inactiveBtn}`}
            >
              {fps}
            </button>
          ))}
        </div>
      </div>

      {/* ── Export button / progress ── */}
      {!renderStatus || renderStatus === "complete" || renderStatus === "error" || renderStatus === "cancelled" ? (
        <button
          onClick={handleExport}
          disabled={!projectId}
          title={!projectId ? "Save project first" : ""}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 text-white"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Video
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-500 dark:text-zinc-400">
            <span className="capitalize">{renderStatus}…</span>
            <span>{progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Result messages ── */}
      {renderStatus === "complete" && renderOutputPath && (
        <div className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-3 space-y-3">
          <div className="flex items-start gap-2">
            <span className="text-emerald-500 dark:text-emerald-400 mt-0.5">✓</span>
            <span className="break-all leading-relaxed">Render complete!</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {renderJobId && (
              <a
                href={`/api/renders/${renderJobId}/download`}
                download
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download File
              </a>
            )}
            <button
              onClick={resetRender}
              className="px-3 py-1.5 bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-600 dark:text-zinc-300 rounded-lg text-xs font-medium transition-colors"
            >
              Dismiss
            </button>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-zinc-500 break-all">{renderOutputPath}</p>
        </div>
      )}
      {renderStatus === "error" && renderError && (
        <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 rounded-xl p-3 flex items-start gap-2">
          <span className="shrink-0">✗</span>
          <div className="flex-1">
            <p className="break-all">{renderError}</p>
            <button
              onClick={resetRender}
              className="mt-2 underline opacity-70 hover:opacity-100"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
