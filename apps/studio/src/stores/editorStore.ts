import { create } from "zustand";
import type {
  AspectRatioConfig,
  AspectRatioPreset,
  ExportFormat,
  QualityPreset,
  RenderStatus,
  VideoCodec,
  Project,
} from "@studio/shared-types";
import {
  ASPECT_RATIO_DIMENSIONS,
  DEFAULT_ASPECT_RATIO_PRESET,
  QUALITY_CRF,
} from "@studio/shared-types";

interface EditorState {
  templateId: string | null;
  inputProps: Record<string, unknown>;
  aspectRatio: AspectRatioConfig;
  qualityPreset: QualityPreset;
  exportFormat: ExportFormat;
  initialized: boolean;
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
  setResolutionScale: (scale: number) => void;
  setFps: (fps: number) => void;
  loadProject: (projectId: string) => Promise<void>;
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
  aspectRatio: {
    preset: DEFAULT_ASPECT_RATIO_PRESET,
    width: ASPECT_RATIO_DIMENSIONS[DEFAULT_ASPECT_RATIO_PRESET].width,
    height: ASPECT_RATIO_DIMENSIONS[DEFAULT_ASPECT_RATIO_PRESET].height,
  },
  qualityPreset: "standard",
  exportFormat: {
    codec: "h264",
    fileExtension: ".mp4",
    crf: 18,
    fps: 30,
    scale: 1,
  },
  initialized: false,
  projectId: null,
  renderJobId: null,
  renderProgress: 0,
  renderStatus: null,
  renderOutputPath: null,
  renderError: null,

  setTemplateId: (id) => set({ templateId: id, initialized: false, inputProps: {} }),

  setInputProps: (props) => set({ inputProps: props, initialized: true }),

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

  setResolutionScale: (scale) =>
    set((state) => ({
      exportFormat: { ...state.exportFormat, scale },
    })),

  setFps: (fps) =>
    set((state) => ({
      exportFormat: { ...state.exportFormat, fps },
    })),

  loadProject: async (projectId: string) => {
    const res = await fetch(`/api/projects/${projectId}`);
    if (!res.ok) throw new Error("Project not found");
    const project: Project = await res.json();
    const inferredPreset =
      (Object.entries(QUALITY_CRF).find(([, crf]) => crf === project.exportFormat.crf)?.[0] as QualityPreset | undefined) ??
      "standard";
    set({
      templateId: project.templateId,
      inputProps: project.inputProps,
      aspectRatio: project.aspectRatio,
      exportFormat: project.exportFormat,
      qualityPreset: inferredPreset,
      projectId: project.id,
      initialized: true,
    });
  },

  saveProject: async (name: string) => {
    const { templateId, inputProps, aspectRatio, exportFormat } = get();
    if (!templateId) throw new Error("No template selected");

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId,
        name,
        inputProps,
        aspectRatio: aspectRatio.preset,
        exportFormat,
      }),
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
      body: JSON.stringify({
        codec: exportFormat.codec,
        quality: qualityPreset,
        fps: exportFormat.fps,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      set({ renderStatus: "error", renderError: err });
      throw new Error(err);
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
    set({
      renderStatus: null,
      renderProgress: 0,
      renderJobId: null,
      renderOutputPath: null,
      renderError: null,
    }),
}));
