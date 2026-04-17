/**
 * TimelineEditor — visual arrangement of scenes / tracks.
 *
 * Architecture:
 *  - Pure view projection on top of `inputProps.scenes` (or equivalent array).
 *  - Changes write back to `inputProps` immediately via the `onChange` callback.
 *  - Syncs playhead with Remotion Player via `playerRef.currentFrame`.
 *
 * Tracks:
 *  - Video  → scenes array; each block = one scene; resize = change durationFrames
 *  - Audio  → narrationUrl / backgroundMusicUrl
 *  - Text   → text layers within scenes
 *  - Images → imageUrl per scene
 *
 * Interactions:
 *  - Drag to reorder scenes
 *  - Resize right edge to change durationFrames
 *  - Double-click block to open per-scene slot editor popover
 *  - Right-click menu: Split, Delete, Duplicate, Generate content
 *  - Snap-to-grid toggle
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlayerRef } from "@remotion/player";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Scene {
  id?: string;
  title?: string;
  body?: string;
  imageUrl?: string;
  videoUrl?: string;
  durationFrames?: number;
  narrationUrl?: string;
  [key: string]: unknown;
}

interface TimelineEditorProps {
  inputProps: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  playerRef?: React.RefObject<PlayerRef | null>;
  fps?: number;
  totalDurationInFrames?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FRAME_WIDTH_PX = 4; // pixels per frame at zoom 1
const MIN_BLOCK_FRAMES = 15;
const TRACK_HEIGHT = 52;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getScenes(inputProps: Record<string, unknown>): Scene[] {
  const raw = inputProps.scenes ?? inputProps.items ?? inputProps.events ?? [];
  if (!Array.isArray(raw)) return [];
  return raw as Scene[];
}

function framesToPx(frames: number, zoom: number): number {
  return frames * FRAME_WIDTH_PX * zoom;
}

function pxToFrames(px: number, zoom: number): number {
  return Math.max(MIN_BLOCK_FRAMES, Math.round(px / (FRAME_WIDTH_PX * zoom)));
}

// ─── Context menu ─────────────────────────────────────────────────────────────

interface CtxMenu {
  x: number;
  y: number;
  sceneIndex: number;
}

// ─── Block component ──────────────────────────────────────────────────────────

function SceneBlock({
  scene,
  index,
  zoom,
  fps,
  isSelected,
  onSelect,
  onDoubleClick,
  onContextMenu,
  onDragStart,
  onResizeEnd,
}: {
  scene: Scene;
  index: number;
  zoom: number;
  fps: number;
  isSelected: boolean;
  onSelect: (i: number) => void;
  onDoubleClick: (i: number) => void;
  onContextMenu: (i: number, x: number, y: number) => void;
  onDragStart: (i: number, e: React.DragEvent) => void;
  onResizeEnd: (i: number, newFrames: number) => void;
}) {
  const durationFrames = scene.durationFrames ?? fps * 3;
  const widthPx = framesToPx(durationFrames, zoom);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startWidth: widthPx };

    const onMove = (me: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = me.clientX - resizeRef.current.startX;
      const newWidth = Math.max(MIN_BLOCK_FRAMES * FRAME_WIDTH_PX * zoom, resizeRef.current.startWidth + delta);
      const newFrames = pxToFrames(newWidth, zoom);
      onResizeEnd(index, newFrames);
    };
    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const colors = [
    "bg-blue-500 dark:bg-blue-600",
    "bg-violet-500 dark:bg-violet-600",
    "bg-teal-500 dark:bg-teal-600",
    "bg-orange-500 dark:bg-orange-600",
    "bg-pink-500 dark:bg-pink-600",
  ];
  const color = colors[index % colors.length];

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(index, e)}
      onClick={() => onSelect(index)}
      onDoubleClick={() => onDoubleClick(index)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(index, e.clientX, e.clientY);
      }}
      style={{ width: widthPx, minWidth: 30, height: TRACK_HEIGHT }}
      className={`relative flex-shrink-0 rounded-lg mr-1 cursor-pointer select-none flex flex-col justify-center px-2 ${color} ${isSelected ? "ring-2 ring-white/80" : ""}`}
    >
      <p className="text-white text-xs font-medium truncate leading-tight">
        {scene.title ?? `Scene ${index + 1}`}
      </p>
      <p className="text-white/70 text-[10px] truncate">
        {(durationFrames / fps).toFixed(1)}s
      </p>
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize flex items-center justify-center"
      >
        <div className="w-0.5 h-6 bg-white/40 rounded-full" />
      </div>
    </div>
  );
}

// ─── TimelineEditor ───────────────────────────────────────────────────────────

export const TimelineEditor: React.FC<TimelineEditorProps> = ({
  inputProps,
  onChange,
  playerRef,
  fps = 30,
  totalDurationInFrames = 300,
}) => {
  const scenes = useMemo(() => getScenes(inputProps), [inputProps]);
  const [zoom, setZoom] = useState(1);
  const [snap, setSnap] = useState(true);
  const [selectedScene, setSelectedScene] = useState<number | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [editScene, setEditScene] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragSrcRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Compute total width from scenes
  const totalFrames = scenes.reduce((sum, s) => sum + (s.durationFrames ?? fps * 3), 0);
  const totalWidthPx = Math.max(framesToPx(Math.max(totalFrames, totalDurationInFrames), zoom), 400);

  // Close context menu on outside click
  useEffect(() => {
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  // ── Scene mutations ────────────────────────────────────────────────────────

  const getScenesKey = () =>
    "scenes" in inputProps ? "scenes" : "items" in inputProps ? "items" : "events";

  const updateScenes = (next: Scene[]) => {
    onChange(getScenesKey(), next);
  };

  const handleResizeEnd = useCallback((index: number, newFrames: number) => {
    const snapped = snap ? Math.round(newFrames / fps) * fps : newFrames;
    const next = scenes.map((s, i) =>
      i === index ? { ...s, durationFrames: snapped } : s,
    );
    updateScenes(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes, snap, fps]);

  const handleDragStart = (index: number, e: React.DragEvent) => {
    dragSrcRef.current = index;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (targetIndex: number) => {
    const src = dragSrcRef.current;
    if (src === null || src === targetIndex) return;
    const next = [...scenes];
    const [moved] = next.splice(src, 1);
    next.splice(targetIndex, 0, moved);
    updateScenes(next);
    dragSrcRef.current = null;
    setDragOver(null);
  };

  const handleDelete = (index: number) => {
    updateScenes(scenes.filter((_, i) => i !== index));
    setCtxMenu(null);
    if (selectedScene === index) setSelectedScene(null);
  };

  const handleDuplicate = (index: number) => {
    const next = [...scenes];
    next.splice(index + 1, 0, { ...scenes[index] });
    updateScenes(next);
    setCtxMenu(null);
  };

  const handleSplit = (index: number) => {
    const scene = scenes[index];
    const halfFrames = Math.max(MIN_BLOCK_FRAMES, Math.floor((scene.durationFrames ?? fps * 3) / 2));
    const next = [...scenes];
    next.splice(
      index,
      1,
      { ...scene, durationFrames: halfFrames },
      { ...scene, title: `${scene.title ?? `Scene ${index + 1}`} (2)`, durationFrames: halfFrames },
    );
    updateScenes(next);
    setCtxMenu(null);
  };

  // ── Audio tracks ──────────────────────────────────────────────────────────
  const narrationUrl = typeof inputProps.narrationUrl === "string" ? inputProps.narrationUrl : null;
  const backgroundMusicUrl = typeof inputProps.backgroundMusicUrl === "string" ? inputProps.backgroundMusicUrl : null;

  // ── Playhead ──────────────────────────────────────────────────────────────
  const [currentFrame, setCurrentFrame] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const frame = (playerRef?.current as unknown as { getCurrentFrame?: () => number })?.getCurrentFrame?.();
        if (typeof frame === "number") setCurrentFrame(frame);
      } catch {
        // player may not be mounted
      }
    }, 100);
    return () => clearInterval(interval);
  }, [playerRef]);

  const playheadLeft = framesToPx(currentFrame, zoom);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col bg-white dark:bg-zinc-950 border-t border-gray-200 dark:border-zinc-800 select-none">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-zinc-800">
        <span className="text-xs font-medium text-gray-600 dark:text-zinc-400">Timeline</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
            className="px-2 py-0.5 text-xs rounded border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
            title="Zoom out"
          >
            −
          </button>
          <span className="text-xs text-gray-500 dark:text-zinc-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            className="px-2 py-0.5 text-xs rounded border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
            title="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => setSnap((s) => !s)}
            className={`px-2 py-0.5 text-xs rounded border transition-colors ${
              snap
                ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                : "border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-zinc-500"
            }`}
          >
            Snap
          </button>
        </div>
      </div>

      {/* Track area */}
      <div className="flex overflow-x-auto" ref={scrollRef} style={{ maxHeight: 260 }}>
        {/* Track labels */}
        <div className="flex-shrink-0 w-24 border-r border-gray-200 dark:border-zinc-800">
          {scenes.length > 0 && (
            <div className="flex items-center h-[52px] px-3 text-xs font-medium text-gray-500 dark:text-zinc-500 border-b border-gray-100 dark:border-zinc-800/60">
              Video
            </div>
          )}
          {narrationUrl !== null && (
            <div className="flex items-center h-[52px] px-3 text-xs font-medium text-gray-500 dark:text-zinc-500 border-b border-gray-100 dark:border-zinc-800/60">
              Narration
            </div>
          )}
          {backgroundMusicUrl !== null && (
            <div className="flex items-center h-[52px] px-3 text-xs font-medium text-gray-500 dark:text-zinc-500 border-b border-gray-100 dark:border-zinc-800/60">
              Music
            </div>
          )}
          {scenes.length === 0 && (
            <div className="flex items-center h-[52px] px-3 text-xs text-gray-400 dark:text-zinc-600">
              No tracks
            </div>
          )}
        </div>

        {/* Track lanes */}
        <div className="relative flex-1 overflow-x-auto overflow-y-hidden" style={{ minWidth: 0 }}>
          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-px bg-red-500/80 z-10 pointer-events-none"
            style={{ left: playheadLeft }}
          />

          {/* Video track */}
          {scenes.length > 0 && (
            <div
              className="flex items-center h-[52px] border-b border-gray-100 dark:border-zinc-800/60 px-1"
              style={{ width: totalWidthPx }}
              onDragOver={(e) => e.preventDefault()}
            >
              {scenes.map((scene, i) => (
                <div
                  key={i}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(i); }}
                  onDrop={() => handleDrop(i)}
                  className={`${dragOver === i ? "ring-2 ring-blue-400 ring-offset-1" : ""}`}
                >
                  <SceneBlock
                    scene={scene}
                    index={i}
                    zoom={zoom}
                    fps={fps}
                    isSelected={selectedScene === i}
                    onSelect={setSelectedScene}
                    onDoubleClick={(idx) => setEditScene(idx)}
                    onContextMenu={(idx, x, y) => setCtxMenu({ x, y, sceneIndex: idx })}
                    onDragStart={handleDragStart}
                    onResizeEnd={handleResizeEnd}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Audio track — narration */}
          {narrationUrl !== null && (
            <div
              className="flex items-center h-[52px] border-b border-gray-100 dark:border-zinc-800/60 px-1"
              style={{ width: totalWidthPx }}
            >
              <div
                className="h-8 rounded-lg bg-teal-400/60 dark:bg-teal-600/40 flex items-center px-3 text-xs text-teal-800 dark:text-teal-300 truncate"
                style={{ width: Math.min(framesToPx(totalFrames, zoom), totalWidthPx) }}
              >
                🎙️ Narration
              </div>
            </div>
          )}

          {/* Audio track — music */}
          {backgroundMusicUrl !== null && (
            <div
              className="flex items-center h-[52px] border-b border-gray-100 dark:border-zinc-800/60 px-1"
              style={{ width: totalWidthPx }}
            >
              <div
                className="h-8 rounded-lg bg-indigo-400/60 dark:bg-indigo-600/40 flex items-center px-3 text-xs text-indigo-800 dark:text-indigo-300 truncate"
                style={{ width: Math.min(framesToPx(totalFrames, zoom), totalWidthPx) }}
              >
                🎵 Background music
              </div>
            </div>
          )}

          {scenes.length === 0 && (
            <div className="flex items-center justify-center h-[52px] text-xs text-gray-400 dark:text-zinc-600 italic">
              No scenes in inputProps
            </div>
          )}
        </div>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-gray-200 dark:border-zinc-700 py-1 text-sm"
          style={{ top: ctxMenu.y, left: ctxMenu.x, minWidth: 160 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800"
            onClick={() => { setEditScene(ctxMenu.sceneIndex); setCtxMenu(null); }}
          >
            ✏️ Edit slot
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800"
            onClick={() => handleDuplicate(ctxMenu.sceneIndex)}
          >
            📋 Duplicate
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800"
            onClick={() => handleSplit(ctxMenu.sceneIndex)}
          >
            ✂️ Split
          </button>
          <div className="border-t border-gray-100 dark:border-zinc-800 my-1" />
          <button
            className="w-full text-left px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={() => handleDelete(ctxMenu.sceneIndex)}
          >
            🗑️ Delete
          </button>
        </div>
      )}

      {/* Per-scene inline editor popover */}
      {editScene !== null && scenes[editScene] && (
        <SceneEditPopover
          scene={scenes[editScene]}
          index={editScene}
          onClose={() => setEditScene(null)}
          onUpdate={(patch) => {
            const next = scenes.map((s, i) => i === editScene ? { ...s, ...patch } : s);
            updateScenes(next);
            setEditScene(null);
          }}
        />
      )}
    </div>
  );
};

// ─── Scene edit popover ───────────────────────────────────────────────────────

function SceneEditPopover({
  scene,
  index,
  onClose,
  onUpdate,
}: {
  scene: Scene;
  index: number;
  onClose: () => void;
  onUpdate: (patch: Partial<Scene>) => void;
}) {
  const [title, setTitle] = useState(scene.title ?? "");
  const [body, setBody] = useState(scene.body ?? "");
  const [durationFrames, setDurationFrames] = useState(scene.durationFrames ?? 90);
  const [imageUrl, setImageUrl] = useState(scene.imageUrl ?? "");

  const handleSave = () => {
    onUpdate({ title, body, durationFrames, imageUrl: imageUrl || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Edit Scene {index + 1}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Body / Description</label>
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Image URL</label>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Duration (frames)</label>
          <input
            type="number"
            min={15}
            value={durationFrames}
            onChange={(e) => setDurationFrames(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
