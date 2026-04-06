import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Player } from "@remotion/player";
import type { PlayerRef } from "@remotion/player";
import { getTemplate } from "@studio/template-registry";
import { useEditorStore } from "@/stores/editorStore";
import { PropsForm } from "@/components/PropsForm";
import { AspectRatioSelector } from "@/components/AspectRatioSelector";
import { ExportPanel } from "@/components/ExportPanel";
import { ASPECT_RATIO_PRESETS } from "@studio/shared-types";
import type { AspectRatioPreset } from "@studio/shared-types";

export const Editor: React.FC = () => {
  const { templateId, projectId } = useParams<{ templateId: string; projectId?: string }>();
  const navigate = useNavigate();
  const playerRef = useRef<PlayerRef>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"properties" | "export">("properties");

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

  const { width, height } = aspectRatio;
  const aspectRatioLabel =
    ASPECT_RATIO_PRESETS[aspectRatio.preset as keyof typeof ASPECT_RATIO_PRESETS]?.label ??
    aspectRatio.preset;

  const maxPlayerWidth = 800;
  const playerScale = Math.min(1, maxPlayerWidth / width);
  const playerWidth = width * playerScale;
  const playerHeight = height * playerScale;

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 dark:border-zinc-800">
        <h2 className="font-semibold text-base dark:text-zinc-100">{template.manifest.name}</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">{template.manifest.description}</p>
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
              <PropsForm
                schema={template.manifest.propsSchema}
                values={inputProps}
                onChange={updateInputProp}
              />
            </div>
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
      {/* Desktop layout: side-by-side */}
      <div className="hidden lg:flex h-[calc(100vh-57px)]">
        {/* Left: Preview */}
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-950 p-6 overflow-auto transition-colors">
          <div className="mb-4 text-sm text-gray-400 dark:text-zinc-500">
            {width} × {height} · {aspectRatioLabel}
          </div>

          <Player
            ref={playerRef}
            component={template.component}
            durationInFrames={template.manifest.defaultDurationInFrames}
            fps={template.manifest.defaultFps}
            compositionWidth={width}
            compositionHeight={height}
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
        </div>

        {/* Right: Controls sidebar */}
        <aside className="w-96 border-l border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-y-auto flex flex-col transition-colors">
          {sidebarContent}
        </aside>
      </div>

      {/* Mobile layout: stacked */}
      <div className="lg:hidden flex flex-col h-[calc(100vh-57px)]">
        {/* Preview area */}
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-950 p-4 min-h-0 transition-colors">
          <div className="mb-2 text-xs text-gray-400 dark:text-zinc-500">
            {width} × {height} · {aspectRatioLabel}
          </div>

          {(() => {
            const maxW = Math.min(width, 600);
            const scale = maxW / width;
            const pw = width * scale;
            const ph = height * scale;
            return (
              <Player
                ref={playerRef}
                component={template.component}
                durationInFrames={template.manifest.defaultDurationInFrames}
                fps={template.manifest.defaultFps}
                compositionWidth={width}
                compositionHeight={height}
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
