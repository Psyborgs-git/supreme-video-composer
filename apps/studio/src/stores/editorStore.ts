import { create } from "zustand";
import type {
  AspectRatioConfig,
  AspectRatioPreset,
  ExportFormat,
  QualityPreset,
  RenderStatus,
  VideoCodec,
} from "@studio/shared-types";
import { ASPECT_RATIO_DIMENSIONS, QUALITY_CRF } from "@studio/shared-types";

interface EditorState {
  templateId: string | null;
  inputProps: Record<string, unknown>;
  aspectRatio: AspectRatioConfig;
  qualityPreset: QualityPreset;
  exportFormat: ExportFormat;
  // Render state
  projectId: string | null;
  renderJobId: string | null;
  renderProgress: number; // 0–1
  renderStatus: RenderStatus | null;
  renderOutputPath: string | null;
  renderError: string | null;

  setTemplateId: (id: string) => void;
  setInputProps: (props: Record<string, unknown>) => void;
  updateInputProp: (key: string, value: unknown) => void;
  setAspectRatio: (preset: AspectRatioPreset, custom?: { width: number; height: number }) => void;
  setQualityPreset: (preset: QualityPreset) => void;
  setCodec: (codec: VideoCodec) => void;
  /** Save current editor state as a project on the backend and return the project id */
  saveProject: (name: string) => Promise<string>;
  /** Queue a render job for the current project */
  startRender: () => Promise<void>;
  /** Poll render status — call on interval while rendering */
  pollRenderStatus: () => Promise<void>;
  resetRender: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  templateId: null,
  inputProps: {},
  aspectRatio: { preset: "16:9", width: 1920, height: 1080 },
  qualityPreset: "standard",
  exportFormat: {
    codec: "h264",
    fileExtension: ".mp4",
    crf: 18,
    fps: 30,
    scale: 1,
  },
  projectId: null,
  renderJobId: null,
  renderProgress: 0,
  renderStatus: null,
  renderOutputPath: null,
  renderError: null,

  setTemplateId: (id) => set({ templateId: id }),

  setInputProps: (props) => set({ inputProps: props }),

  updateInputProp: (key, value) =>
    set((state) => ({
      inputProps: { ...state.inputProps, [key]: value },
    })),

  setAspectRatio: (preset, custom) => {
    if (preset === "custom" && custom) {
      set({ aspectRatio: { preset, ...custom } });
    } else if (preset !== "custom") {
      const dims = ASPECT_RATIO_DIMENSIONS[preset];
      set({ aspectRatio: { preset, ...dims } });
    }
  },

  setQualityPreset: (preset) =>
    set((state) => ({
      qualityPreset: preset,
      exportFormat: {
        ...state.exportFormat,
        crf: QUALITY_CRF[preset],
      },
    })),

  setCodec: (codec) => {
    const extMap: Record<string, string> = {
      h264: ".mp4", h265: ".mp4", vp8: ".webm", vp9: ".webm",
      av1: ".webm", prores: ".mov", gif: ".gif",
    };
    set((state) => ({
      exportFormat: {
        ...state.exportFormat,
        codec,
        fileExtension: extMap[codec] ?? ".mp4",
      },
    }));
  },

  saveProject: async (name: string) => {
    const { templateId, inputProps, aspectRatio } = get();
    if (!templateId) throw new Error("No template selected");

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, name, inputProps, aspectRatio: aspectRatio.preset }),
    });
    if (!res.ok) throw new Error(await res.text());
    const project = await res.json();
    set({ projectId: project.id });
    return project.id;
  },

  startRender: async () => {
    const { projectId, exportFormat, qualityPreset } = get();
    if (!projectId) throw new Error("No project saved. Save project first.");

    set({ renderStatus: "queued", renderProgress: 0, renderError: null, renderOutputPath: null });

    const res = await fetch(`/api/projects/${projectId}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codec: exportFormat.codec, quality: qualityPreset }),
    });
    if (!res.ok) {
      const err = await res.text();
      set({ renderStatus: "error", renderError: err });
      return;
    }
    const job = await res.json();
    set({ renderJobId: job.id });
  },

  pollRenderStatus: async () => {
    const { renderJobId } = get();
    if (!renderJobId) return;
    const res = await fetch(`/api/renders/${renderJobId}`);
    if (!res.ok) return;
    const job = await res.json();
    set({
      renderStatus: job.status,
      renderProgress: job.progress?.progress ?? 0,
      renderOutputPath: job.outputPath ?? null,
      renderError: job.error ?? null,
    });
  },

  resetRender: () =>
    set({ renderJobId: null, renderProgress: 0, renderStatus: null, renderOutputPath: null, renderError: null }),
}));
