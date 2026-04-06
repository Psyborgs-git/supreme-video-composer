import { useEffect, useMemo, useRef } from "react";
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
      <div className="flex items-center justify-center h-[80vh] text-zinc-400">
        Template not found
      </div>
    );
  }

  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-57px)] text-zinc-400">
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

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Left: Preview */}
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 p-6 overflow-auto">
        <div className="mb-4 text-sm text-zinc-500">
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
            boxShadow: "0 0 40px rgba(0,0,0,0.5)",
          }}
          acknowledgeRemotionLicense
        />
      </div>

      {/* Right: Controls sidebar */}
      <aside className="w-96 border-l border-zinc-800 bg-zinc-900 overflow-y-auto">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="font-semibold text-lg">{template.manifest.name}</h2>
          <p className="text-sm text-zinc-400 mt-1">{template.manifest.description}</p>
        </div>

        {/* Aspect Ratio */}
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Aspect Ratio</h3>
          <AspectRatioSelector
            value={aspectRatio.preset}
            supported={template.manifest.supportedAspectRatios as AspectRatioPreset[]}
            onChange={(preset) => setAspectRatio(preset)}
          />
        </div>

        {/* Props Form */}
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Properties</h3>
          <PropsForm
            schema={template.manifest.propsSchema}
            values={inputProps}
            onChange={updateInputProp}
          />
        </div>

        {/* Export */}
        <div className="border-t border-zinc-800">
          <div className="p-4 pb-0">
            <h3 className="text-sm font-medium text-zinc-300">Export</h3>
          </div>
          <ExportPanel />
        </div>
      </aside>
    </div>
  );
};
