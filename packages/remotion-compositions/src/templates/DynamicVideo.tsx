import { z } from "zod";
import * as React from "react";
import * as ReactJsxRuntimeModule from "react/jsx-runtime";
import * as ReactJsxDevRuntimeModule from "react/jsx-dev-runtime";
import * as RemotionModule from "remotion";
import { AbsoluteFill } from "remotion";

const RUNTIME_BUNDLE_GLOBAL = "__REMOTION_MCP_BUNDLE";
const RUNTIME_PACKAGE_GLOBAL = "__REMOTION_MCP_PACKAGES";

const DynamicVideoMetaSchema = z.object({
  title: z.string().default("Untitled"),
  compositionId: z.string().default("Main"),
  width: z.number().positive().default(1920),
  height: z.number().positive().default(1080),
  fps: z.number().positive().default(30),
  durationInFrames: z.number().positive().default(150),
});

const SourceProjectSchema = z.object({
  title: z.string().default("Untitled"),
  compositionId: z.string().default("Main"),
  width: z.number().positive().default(1920),
  height: z.number().positive().default(1080),
  fps: z.number().positive().default(30),
  durationInFrames: z.number().positive().default(150),
  entryFile: z.string().default("/src/Video.tsx"),
  files: z.record(z.string(), z.string()).default({
    "/src/Video.tsx": 'import {AbsoluteFill} from "remotion"; export default function Video(){ return <AbsoluteFill style={{backgroundColor:"#000"}} />; }',
  }),
  defaultProps: z.record(z.string(), z.unknown()).default({}),
  inputProps: z.record(z.string(), z.unknown()).default({}),
});

export const DynamicVideoSchema = z.object({
  meta: DynamicVideoMetaSchema.default({}),
  bundle: z
    .string()
    .default(
      "var __REMOTION_MCP_BUNDLE = { default: function DynamicVideoFallback(){ return null; } };",
    ),
  defaultProps: z.record(z.string(), z.unknown()).default({}),
  inputProps: z.record(z.string(), z.unknown()).default({}),
  compileError: z.string().optional(),
  sourceProject: SourceProjectSchema.optional(),
});

export type DynamicVideoProps = z.infer<typeof DynamicVideoSchema>;
export type DynamicVideoMeta = z.infer<typeof DynamicVideoMetaSchema>;

type RuntimeMetadataInput = {
  props: Record<string, unknown>;
  defaultProps: Record<string, unknown>;
  compositionId: string;
  abortSignal?: AbortSignal;
};

type CompiledBundle = {
  component: React.ComponentType<Record<string, unknown>>;
  calculateMetadata?: (input: RuntimeMetadataInput) => unknown | Promise<unknown>;
};

type RuntimeExports = {
  default?: unknown;
  calculateMetadata?: unknown;
};

const runtimePackages: Record<string, Record<string, unknown>> = {
  react: React as Record<string, unknown>,
  "react/jsx-runtime": ReactJsxRuntimeModule as Record<string, unknown>,
  "react/jsx-dev-runtime": ReactJsxDevRuntimeModule as Record<string, unknown>,
  remotion: RemotionModule as Record<string, unknown>,
};

function ensureRuntimePackages(): void {
  const root = globalThis as Record<string, unknown>;
  const existing = root[RUNTIME_PACKAGE_GLOBAL];

  if (existing && typeof existing === "object") {
    Object.assign(existing as Record<string, unknown>, runtimePackages);
    return;
  }

  root[RUNTIME_PACKAGE_GLOBAL] = runtimePackages;
}

ensureRuntimePackages();

function compileBundle(bundleCode: string): CompiledBundle | { error: string } {
  try {
    const evaluator = new Function(
      `${bundleCode}\nreturn typeof ${RUNTIME_BUNDLE_GLOBAL} !== "undefined" ? ${RUNTIME_BUNDLE_GLOBAL} : null;`,
    );

    const exports = evaluator() as RuntimeExports | null;
    if (!exports || typeof exports !== "object") {
      return { error: "Compilation error: bundle did not return exports." };
    }

    if (typeof exports.default !== "function") {
      return {
        error:
          "Compilation error: entry module must export a default React component (export default function ...).",
      };
    }

    return {
      component: exports.default as React.ComponentType<Record<string, unknown>>,
      calculateMetadata:
        typeof exports.calculateMetadata === "function"
          ? (exports.calculateMetadata as (
              input: RuntimeMetadataInput,
            ) => unknown | Promise<unknown>)
          : undefined,
    };
  } catch (error) {
    return { error: `Compilation error: ${(error as Error).message}` };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function positiveNumberOrFallback(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  return fallback;
}

function mergeProps(
  defaultProps: Record<string, unknown>,
  inputProps: Record<string, unknown>,
): Record<string, unknown> {
  return { ...defaultProps, ...inputProps };
}

function readMetadataOverrides(
  overrides: Record<string, unknown>,
  fallback: DynamicVideoMeta,
): DynamicVideoMeta {
  return {
    ...fallback,
    width: positiveNumberOrFallback(overrides.width, fallback.width),
    height: positiveNumberOrFallback(overrides.height, fallback.height),
    fps: positiveNumberOrFallback(overrides.fps, fallback.fps),
    durationInFrames: positiveNumberOrFallback(
      overrides.durationInFrames,
      fallback.durationInFrames,
    ),
  };
}

function renderErrorCard(title: string, body: string) {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0b0b0b",
        justifyContent: "center",
        alignItems: "center",
        padding: 48,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 960,
          borderRadius: 20,
          backgroundColor: "#171717",
          color: "#f5f5f5",
          padding: 32,
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>{title}</div>
        <div
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 16,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            color: "#ff8a8a",
          }}
        >
          {body}
        </div>
      </div>
    </AbsoluteFill>
  );
}

export const calculateDynamicVideoMetadata = async ({
  props,
}: {
  props: DynamicVideoProps;
}) => {
  const parsed = DynamicVideoSchema.parse(props);
  const fallbackMeta = parsed.meta;

  if (parsed.compileError) {
    return { ...fallbackMeta, props: parsed };
  }

  const compiled = compileBundle(parsed.bundle);
  if ("error" in compiled || !compiled.calculateMetadata) {
    return { ...fallbackMeta, props: parsed };
  }

  try {
    const metadata = await compiled.calculateMetadata({
      props: mergeProps(parsed.defaultProps, parsed.inputProps),
      defaultProps: parsed.defaultProps,
      compositionId: parsed.meta.compositionId,
    });

    if (!isRecord(metadata)) {
      return { ...fallbackMeta, props: parsed };
    }

    return {
      ...readMetadataOverrides(metadata, fallbackMeta),
      props: parsed,
    };
  } catch {
    return { ...fallbackMeta, props: parsed };
  }
};

export const DynamicVideo: React.FC<DynamicVideoProps> = (rawProps) => {
  const props = DynamicVideoSchema.parse(rawProps ?? {});
  const compiled = React.useMemo(() => {
    if (props.compileError) {
      return null;
    }

    return compileBundle(props.bundle);
  }, [props.bundle, props.compileError]);

  const mergedProps = React.useMemo(
    () => mergeProps(props.defaultProps, props.inputProps),
    [props.defaultProps, props.inputProps],
  );

  if (props.compileError) {
    return renderErrorCard("Compilation Error", props.compileError);
  }

  if (!compiled) {
    return renderErrorCard("Missing Bundle", "No generated video bundle was provided.");
  }

  if ("error" in compiled) {
    return renderErrorCard("Runtime Error", compiled.error);
  }

  const Component = compiled.component;
  return <Component {...mergedProps} />;
};