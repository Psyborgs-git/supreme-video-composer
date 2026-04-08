import path from "node:path";
import { bundle } from "@remotion/bundler";
import {
  renderMedia,
  renderStill,
  selectComposition,
  makeCancelSignal,
} from "@remotion/renderer";
import type {
  RenderJob,
  RenderProgress,
  ExportFormat,
  AspectRatioConfig,
  VideoCodec,
} from "@studio/shared-types";

const CODEC_MAP: Record<VideoCodec, string> = {
  h264: "h264",
  h265: "h265",
  vp8: "vp8",
  vp9: "vp9",
  av1: "av1",
  prores: "prores",
  gif: "gif",
};

export interface RenderOptions {
  compositionsEntryPoint: string;
  outputDir: string;
  browserExecutable?: string | null;
}

let bundledUrl: string | null = null;

export function resolveBrowserExecutable(options: RenderOptions): string | null {
  return (
    options.browserExecutable ??
    process.env.REMOTION_CHROME_EXECUTABLE ??
    process.env.CHROME_PATH ??
    null
  );
}

export async function ensureBundle(entryPoint: string): Promise<string> {
  if (bundledUrl) return bundledUrl;
  bundledUrl = await bundle({
    entryPoint,
    onProgress: (progress) => {
      // Could emit bundling progress here
    },
  });
  return bundledUrl;
}

export function invalidateBundle(): void {
  bundledUrl = null;
}

export async function executeRender(
  job: RenderJob,
  onProgress: (progress: RenderProgress) => void,
  options: RenderOptions,
): Promise<string> {
  const serveUrl = await ensureBundle(options.compositionsEntryPoint);
  const browserExecutable = resolveBrowserExecutable(options);

  onProgress({
    progress: 0,
    renderedFrames: 0,
    encodedFrames: 0,
    totalFrames: 0,
    stage: "bundling",
  });

  const composition = await selectComposition({
    serveUrl,
    id: job.templateId,
    inputProps: job.inputProps,
    browserExecutable,
  });

  const useCompositionDimensions = job.templateId === "DynamicVideo";
  const overrideWidth = useCompositionDimensions ? composition.width : job.aspectRatio.width;
  const overrideHeight = useCompositionDimensions ? composition.height : job.aspectRatio.height;

  const codec = CODEC_MAP[job.exportFormat.codec] as any;

  const ext = getFileExtension(job.exportFormat.codec);
  const outputFile = path.join(
    options.outputDir,
    `${job.templateId}_${job.projectId}_${overrideWidth}x${overrideHeight}_${Date.now()}${ext}`,
  );

  const { cancel, cancelSignal } = makeCancelSignal();

  // Check for cancellation during render
  const cancelCheckInterval = setInterval(() => {
    if (job.status === "cancelled") {
      cancel();
    }
  }, 500);

  try {
    await renderMedia({
      serveUrl,
      composition: useCompositionDimensions
        ? composition
        : {
            ...composition,
            width: overrideWidth,
            height: overrideHeight,
          },
      browserExecutable,
      codec,
      outputLocation: outputFile,
      inputProps: job.inputProps,
      crf: job.exportFormat.crf,
      scale: job.exportFormat.scale || 1,
      cancelSignal,
      onProgress: (renderProgress) => {
        const totalFrames = composition.durationInFrames;
        onProgress({
          progress: renderProgress.progress,
          renderedFrames: renderProgress.renderedFrames ?? 0,
          encodedFrames: renderProgress.encodedFrames ?? 0,
          totalFrames,
          stage: renderProgress.stitchStage === "muxing" ? "encoding" : "rendering",
        });
      },
    });

    return outputFile;
  } finally {
    clearInterval(cancelCheckInterval);
  }
}

export async function renderThumbnail(
  compositionId: string,
  inputProps: Record<string, unknown>,
  frame: number,
  options: RenderOptions,
): Promise<Buffer> {
  const serveUrl = await ensureBundle(options.compositionsEntryPoint);
  const browserExecutable = resolveBrowserExecutable(options);

  const composition = await selectComposition({
    serveUrl,
    id: compositionId,
    inputProps,
    browserExecutable,
  });

  const result = await renderStill({
    serveUrl,
    composition,
    frame,
    inputProps,
    browserExecutable,
    imageFormat: "jpeg",
    jpegQuality: 80,
    output: null as any, // return buffer
  });

  return result as unknown as Buffer;
}

function getFileExtension(codec: VideoCodec): string {
  switch (codec) {
    case "h264":
    case "h265":
      return ".mp4";
    case "vp8":
    case "vp9":
    case "av1":
      return ".webm";
    case "prores":
      return ".mov";
    case "gif":
      return ".gif";
    default:
      return ".mp4";
  }
}
