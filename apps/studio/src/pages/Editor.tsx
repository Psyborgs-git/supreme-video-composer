import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Player } from "@remotion/player";
import type { PlayerRef } from "@remotion/player";
import { getTemplate } from "@studio/template-registry";
import { useEditorStore } from "@/stores/editorStore";
import { SlotEditor } from "@/components/SlotEditor";
import { AspectRatioSelector } from "@/components/AspectRatioSelector";
import { ExportPanel } from "@/components/ExportPanel";
import { AiGenerationPanel } from "@/components/AiGenerationPanel";
import { TimelineEditor } from "@/components/TimelineEditor";
import { ASPECT_RATIO_PRESETS } from "@studio/shared-types";
import type { AspectRatioPreset } from "@studio/shared-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readPositiveNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  return fallback;
}

function readDynamicVideoMeta(inputProps: Record<string, unknown>) {
  const rawMeta = inputProps.meta;
  if (!isRecord(rawMeta)) {
    return null;
  }

  return {
    title:
      typeof rawMeta.title === "string" && rawMeta.title.trim().length > 0
        ? rawMeta.title
        : "Generated Remotion Video",
    compositionId:
      typeof rawMeta.compositionId === "string" && rawMeta.compositionId.trim().length > 0
        ? rawMeta.compositionId
        : "Main",
    width: readPositiveNumber(rawMeta.width, 1920),
    height: readPositiveNumber(rawMeta.height, 1080),
    fps: readPositiveNumber(rawMeta.fps, 30),
    durationInFrames: readPositiveNumber(rawMeta.durationInFrames, 150),
  };
}

function readDynamicVideoSourceSummary(inputProps: Record<string, unknown>) {
  const rawSourceProject = inputProps.sourceProject;
  if (!isRecord(rawSourceProject)) {
    return null;
  }

  const files = isRecord(rawSourceProject.files) ? rawSourceProject.files : null;
  return {
    entryFile:
      typeof rawSourceProject.entryFile === "string" ? rawSourceProject.entryFile : null,
    fileCount: files ? Object.keys(files).length : null,
    compileError:
      typeof inputProps.compileError === "string" && inputProps.compileError.trim().length > 0
        ? inputProps.compileError
        : null,
  };
}

export const Editor: React.FC = () => {
  const { templateId, projectId } = useParams<{ templateId: string; projectId?: string }>();
  const navigate = useNavigate();
  const playerRef = useRef<PlayerRef>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"properties" | "export">("properties");
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const {
    inputProps,
    aspectRatio,
    initialized,
    setTemplateId,
    setInputProps,
    updateInputProp,
    setAspectRatio,
    loadProject,
  } = useEditorStore();

  const template = useMemo(
    () => (templateId ? getTemplate(templateId) : undefined),
    [templateId],
  );
  const isDynamicVideo = template?.manifest.id === "dynamic-video";
  const dynamicMeta = useMemo(() => readDynamicVideoMeta(inputProps), [inputProps]);
  const dynamicSourceSummary = useMemo(
    () => readDynamicVideoSourceSummary(inputProps),
    [inputProps],
  );

  useEffect(() => {
    if (!template || !templateId) {
      navigate("/");
      return;
    }

    if (projectId) {
      loadProject(projectId).catch(() => navigate("/projects"));
    } else {
      setTemplateId(templateId);
      setInputProps(template.manifest.defaultProps);
      const supported = template.manifest.supportedAspectRatios as AspectRatioPreset[];
      if (!supported.includes(aspectRatio.preset)) {
        setAspectRatio(supported[0]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, projectId]);

  if (!template) {
    return (
      <div className="flex items-center justify-center h-[80vh] text-gray-400 dark:text-zinc-400">
        Template not found
      </div>
    );
  }

  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-57px)] text-gray-400 dark:text-zinc-400">
        Loading…
      </div>
    );
  }

  const previewWidth = dynamicMeta?.width ?? aspectRatio.width;
  const previewHeight = dynamicMeta?.height ?? aspectRatio.height;
  const previewFps = dynamicMeta?.fps ?? template.manifest.defaultFps;
  const previewDuration = dynamicMeta?.durationInFrames ?? template.manifest.defaultDurationInFrames;
  const aspectRatioLabel =
    isDynamicVideo
      ? "Generated project"
      : ASPECT_RATIO_PRESETS[aspectRatio.preset as keyof typeof ASPECT_RATIO_PRESETS]?.label ??
        aspectRatio.preset;

  const maxPlayerWidth = 800;
  const playerScale = Math.min(1, maxPlayerWidth / previewWidth);
  const playerWidth = previewWidth * playerScale;
  const playerHeight = previewHeight * playerScale;

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 dark:border-zinc-800">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold text-base dark:text-zinc-100">{template.manifest.name}</h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">{template.manifest.description}</p>
          </div>
          <button
            onClick={() => setAiPanelOpen((v) => !v)}
            className="shrink-0 flex items-center gap-1 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors"
            title="AI generation assist"
          >
            ✨ AI
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("properties")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "properties"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
              : "text-gray-500 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-zinc-300"
          }`}
        >
          Properties
        </button>
        <button
          onClick={() => setActiveTab("export")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "export"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
              : "text-gray-500 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-zinc-300"
          }`}
        >
          Export
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "properties" && (
          <>
            {isDynamicVideo ? (
              <div className="p-4 space-y-4">
                <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950/60 p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-zinc-300">Generated video</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                      This project was created via MCP. To change the code or slot props, call
                      <code className="mx-1 rounded bg-gray-200 dark:bg-zinc-800 px-1.5 py-0.5 text-xs">create_video</code>
                      again and the same saved project will update automatically.
                    </p>
                  </div>

                  <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-gray-500 dark:text-zinc-500">Composition</dt>
                      <dd className="mt-1 font-medium text-gray-900 dark:text-zinc-100">{dynamicMeta?.compositionId ?? "Main"}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-zinc-500">Output</dt>
                      <dd className="mt-1 font-medium text-gray-900 dark:text-zinc-100">
                        {previewWidth} × {previewHeight}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-zinc-500">Timing</dt>
                      <dd className="mt-1 font-medium text-gray-900 dark:text-zinc-100">
                        {previewDuration} frames · {previewFps}fps
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-zinc-500">Source files</dt>
                      <dd className="mt-1 font-medium text-gray-900 dark:text-zinc-100">
                        {dynamicSourceSummary?.fileCount ?? 0}
                      </dd>
                    </div>
                    {dynamicSourceSummary?.entryFile && (
                      <div className="sm:col-span-2">
                        <dt className="text-gray-500 dark:text-zinc-500">Entry file</dt>
                        <dd className="mt-1 break-all font-mono text-xs text-gray-900 dark:text-zinc-100">
                          {dynamicSourceSummary.entryFile}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                {dynamicSourceSummary?.compileError && (
                  <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-300">
                    <div className="font-semibold">Compilation error</div>
                    <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs">
                      {dynamicSourceSummary.compileError}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Aspect Ratio */}
                <div className="p-4 border-b border-gray-200 dark:border-zinc-800">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-3">Aspect Ratio</h3>
                  <AspectRatioSelector
                    value={aspectRatio.preset}
                    supported={template.manifest.supportedAspectRatios as AspectRatioPreset[]}
                    onChange={(preset) => setAspectRatio(preset)}
                  />
                </div>

                {/* Props Form */}
                <div className="p-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-3">Properties</h3>
                  <SlotEditor
                    schema={template.manifest.propsSchema}
                    values={inputProps}
                    onChange={updateInputProp}
                  />
                </div>
              </>
            )}
          </>
        )}

        {activeTab === "export" && (
          <ExportPanel />
        )}
      </div>
    </div>
  );

  return (
    <>
      {aiPanelOpen && (
        <AiGenerationPanel onClose={() => setAiPanelOpen(false)} />
      )}
      {/* Desktop layout: side-by-side */}
      <div className="hidden lg:flex flex-col h-[calc(100vh-57px)]">
        <div className="flex flex-1 min-h-0">
          {/* Left: Preview */}
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-950 p-6 overflow-auto transition-colors">
            <div className="mb-4 text-sm text-gray-400 dark:text-zinc-500">
              {previewWidth} × {previewHeight} · {aspectRatioLabel}
            </div>

            <Player
              ref={playerRef}
              component={template.component}
              durationInFrames={previewDuration}
              fps={previewFps}
              compositionWidth={previewWidth}
              compositionHeight={previewHeight}
              inputProps={inputProps}
              controls
              loop
              style={{
                width: playerWidth,
                height: playerHeight,
                borderRadius: 8,
                overflow: "hidden",
                boxShadow: "0 0 40px rgba(0,0,0,0.15)",
              }}
              acknowledgeRemotionLicense
            />

            {/* Timeline toggle */}
            <button
              onClick={() => setTimelineOpen((o) => !o)}
              className="mt-4 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-zinc-500 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors"
            >
              ⬛ {timelineOpen ? "Hide timeline" : "Show timeline"}
            </button>
          </div>

          {/* Right: Controls sidebar */}
          <aside className="w-96 border-l border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-y-auto flex flex-col transition-colors">
            {sidebarContent}
          </aside>
        </div>

        {/* Timeline panel (collapsible) */}
        {timelineOpen && (
          <TimelineEditor
            inputProps={inputProps}
            onChange={updateInputProp}
            playerRef={playerRef}
            fps={previewFps}
            totalDurationInFrames={previewDuration}
          />
        )}
      </div>

      {/* Mobile layout: stacked */}
      <div className="lg:hidden flex flex-col h-[calc(100vh-57px)]">
        {/* Preview area */}
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-950 p-4 min-h-0 transition-colors">
          <div className="mb-2 text-xs text-gray-400 dark:text-zinc-500">
            {previewWidth} × {previewHeight} · {aspectRatioLabel}
          </div>

          {(() => {
            const maxW = Math.min(previewWidth, 600);
            const scale = maxW / previewWidth;
            const pw = previewWidth * scale;
            const ph = previewHeight * scale;
            return (
              <Player
                ref={playerRef}
                component={template.component}
                durationInFrames={previewDuration}
                fps={previewFps}
                compositionWidth={previewWidth}
                compositionHeight={previewHeight}
                inputProps={inputProps}
                controls
                loop
                style={{
                  width: pw,
                  height: ph,
                  maxWidth: "100%",
                  borderRadius: 8,
                  overflow: "hidden",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                }}
                acknowledgeRemotionLicense
              />
            );
          })()}
        </div>

        {/* Toggle button */}
        <div className="border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2 flex items-center justify-between transition-colors">
          <span className="text-sm font-medium text-gray-600 dark:text-zinc-400">
            {sidebarOpen ? "Hide controls" : "Edit properties & export"}
          </span>
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {sidebarOpen ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
                Hide
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                Edit
              </>
            )}
          </button>
        </div>

        {/* Collapsible sidebar panel */}
        {sidebarOpen && (
          <div className="border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-y-auto max-h-[55vh] transition-colors">
            {sidebarContent}
          </div>
        )}
      </div>
    </>
  );
};
