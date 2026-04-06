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
  { value: 0.5, label: "0.5× (half)" },
  { value: 1, label: "1× (native)" },
  { value: 2, label: "2× (double)" },
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

  return (
    <div className="p-4 space-y-5">
      {/* ── Save Project ── */}
      {!projectId && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-300">Save Project</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="Project name…"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleSave}
              disabled={!saveName.trim() || saving}
              className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
          {saveError && <p className="text-xs text-red-400">{saveError}</p>}
        </div>
      )}

      {projectId && (
        <p className="text-xs text-emerald-400 flex items-center gap-1">
          <span>✓</span>
          <span>Project saved (id: {projectId.slice(0, 8)}…)</span>
        </p>
      )}

      {/* ── Quality ── */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-zinc-300">Quality</h3>
        <div className="grid grid-cols-2 gap-1.5">
          {QUALITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setQualityPreset(opt.value)}
              className={`rounded-lg px-3 py-2 text-left transition-colors ${
                qualityPreset === opt.value
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
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
        <h3 className="text-sm font-medium text-zinc-300">Format</h3>
        <select
          value={exportFormat.codec}
          onChange={(e) => setCodec(e.target.value as VideoCodec)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
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
        <h3 className="text-sm font-medium text-zinc-300">Resolution Scale</h3>
        <div className="flex gap-1.5">
          {RESOLUTION_SCALES.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setResolutionScale(opt.value)}
              className={`flex-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
                exportFormat.scale === opt.value
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── FPS ── */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-zinc-300">Frame Rate</h3>
        <div className="flex gap-1.5">
          {FPS_OPTIONS.map((fps) => (
            <button
              key={fps}
              onClick={() => setFps(fps)}
              className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                exportFormat.fps === fps
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              }`}
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
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Video
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-zinc-400">
            <span className="capitalize">{renderStatus}…</span>
            <span>{progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Result messages ── */}
      {renderStatus === "complete" && renderOutputPath && (
        <div className="text-xs text-emerald-400 bg-emerald-900/30 rounded-lg p-3 space-y-2">
          <div className="break-all">✓ Done — {renderOutputPath}</div>
          <div className="flex gap-2">
            {renderJobId && (
              <a
                href={`/api/renders/${renderJobId}/download`}
                download
                className="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-medium transition-colors"
              >
                Download
              </a>
            )}
            <button
              onClick={resetRender}
              className="underline opacity-70 hover:opacity-100 text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {renderStatus === "error" && renderError && (
        <div className="text-xs text-red-400 bg-red-900/30 rounded-lg p-3">
          ✗ {renderError}
          <button
            onClick={resetRender}
            className="ml-2 underline opacity-70 hover:opacity-100"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};
