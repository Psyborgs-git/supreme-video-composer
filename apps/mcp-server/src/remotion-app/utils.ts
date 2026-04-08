import path from "node:path";
import { build, type Loader, type Plugin } from "esbuild";
import * as ReactModule from "react";
import * as ReactJsxRuntimeModule from "react/jsx-runtime";
import * as ReactJsxDevRuntimeModule from "react/jsx-dev-runtime";
import * as RemotionModule from "remotion";
import { z } from "zod";
import {
  RUNTIME_BUNDLE_GLOBAL,
  RUNTIME_PACKAGE_GLOBAL,
  type ProjectVideoInput,
  type SessionProjectState,
  type VideoProjectData,
} from "./types.js";

const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const USER_FILE_NAMESPACE = "user-file";
const SHIM_FILE_NAMESPACE = "runtime-shim";
const SUPPORTED_FILE_EXTENSIONS = [
  ".tsx",
  ".ts",
  ".jsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".mp4",
  ".webm",
  ".mov",
  ".mp3",
  ".wav",
  ".ogg",
] as const;

const RUNTIME_MODULES: Record<string, Record<string, unknown>> = {
  react: ReactModule as Record<string, unknown>,
  "react/jsx-runtime": ReactJsxRuntimeModule as Record<string, unknown>,
  "react/jsx-dev-runtime": ReactJsxDevRuntimeModule as Record<string, unknown>,
  remotion: RemotionModule as Record<string, unknown>,
};

function ensureRuntimePackages(): void {
  const root = globalThis as Record<string, unknown>;
  const existing = root[RUNTIME_PACKAGE_GLOBAL];

  if (existing && typeof existing === "object") {
    Object.assign(existing as Record<string, unknown>, RUNTIME_MODULES);
    return;
  }

  root[RUNTIME_PACKAGE_GLOBAL] = RUNTIME_MODULES;
}

ensureRuntimePackages();

function createRuntimeShim(moduleName: string, moduleNamespace: Record<string, unknown>): string {
  const namedExports = Object.keys(moduleNamespace)
    .filter((name) => name !== "default" && IDENTIFIER_PATTERN.test(name))
    .sort();

  const exportLines = namedExports
    .map((name) => `export const ${name} = runtime.${name};`)
    .join("\n");

  return [
    `const modules = globalThis.${RUNTIME_PACKAGE_GLOBAL};`,
    `const runtime = modules?.[${JSON.stringify(moduleName)}];`,
    `if (!runtime) throw new Error(${JSON.stringify(`Missing runtime module: ${moduleName}`)});`,
    "export default runtime.default;",
    exportLines,
    "",
  ].join("\n");
}

const SHIM_MODULE_SOURCES: Record<string, string> = Object.fromEntries(
  Object.entries(RUNTIME_MODULES).map(([moduleName, moduleNamespace]) => [
    moduleName,
    createRuntimeShim(moduleName, moduleNamespace),
  ]),
);

export const DEFAULT_META = {
  title: "Untitled",
  compositionId: "Main",
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 150,
};

const ERROR_FALLBACK_BUNDLE = `var ${RUNTIME_BUNDLE_GLOBAL} = { default: function RemotionFallback() { return null; } };`;
const MAX_SESSION_PROJECTS = 250;
const sessionProjects = new Map<string, SessionProjectState>();

export const projectVideoSchema = z.object({
  title: z.string().optional().default(DEFAULT_META.title),
  compositionId: z.string().optional().default(DEFAULT_META.compositionId),
  width: z.number().optional().default(DEFAULT_META.width),
  height: z.number().optional().default(DEFAULT_META.height),
  fps: z.number().optional().default(DEFAULT_META.fps),
  durationInFrames: z.number().optional().default(DEFAULT_META.durationInFrames),
  entryFile: z.string().optional().default("/src/Video.tsx"),
  files: z.record(z.string(), z.string()),
  defaultProps: z.record(z.unknown()).optional().default({}),
  inputProps: z.record(z.unknown()).optional().default({}),
});

function normalizeVirtualPath(filePath: string): string {
  const unixPath = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const normalized = path.posix.normalize(`/${unixPath}`);
  if (!normalized.startsWith("/")) {
    throw new Error(`Invalid file path: ${filePath}`);
  }
  return normalized;
}

function normalizeFileMap(files: Record<string, string>): Record<string, string> {
  const normalizedFiles: Record<string, string> = {};
  for (const [rawFilePath, contents] of Object.entries(files)) {
    if (typeof contents !== "string") {
      throw new Error(`File "${rawFilePath}" must be a string.`);
    }
    normalizedFiles[normalizeVirtualPath(rawFilePath)] = contents;
  }
  return normalizedFiles;
}

function getLoader(filePath: string): Loader {
  const extension = path.posix.extname(filePath).toLowerCase();
  switch (extension) {
    case ".tsx":
      return "tsx";
    case ".ts":
      return "ts";
    case ".jsx":
      return "jsx";
    case ".mjs":
    case ".cjs":
    case ".js":
      return "js";
    case ".json":
      return "json";
    case ".css":
      return "css";
    case ".svg":
    case ".png":
    case ".jpg":
    case ".jpeg":
    case ".gif":
    case ".webp":
    case ".mp4":
    case ".webm":
    case ".mov":
    case ".mp3":
    case ".wav":
    case ".ogg":
      return "dataurl";
    default:
      return "tsx";
  }
}

function resolveVirtualImport(importPath: string, importer: string, files: Record<string, string>): string | null {
  if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
    return null;
  }

  const basePath = importPath.startsWith("/")
    ? normalizeVirtualPath(importPath)
    : normalizeVirtualPath(path.posix.resolve(path.posix.dirname(importer), importPath));

  const candidates = new Set<string>();
  const extension = path.posix.extname(basePath);

  if (extension.length > 0) {
    candidates.add(basePath);
  } else {
    candidates.add(basePath);
    for (const candidateExtension of SUPPORTED_FILE_EXTENSIONS) {
      candidates.add(`${basePath}${candidateExtension}`);
      candidates.add(path.posix.join(basePath, `index${candidateExtension}`));
    }
  }

  for (const candidate of candidates) {
    if (candidate in files) {
      return candidate;
    }
  }

  return null;
}

function formatCompileFailure(error: unknown): string {
  const fallback = (error as Error)?.message ?? "Unknown build error.";
  const maybe = error as {
    errors?: Array<{
      text: string;
      location?: {
        file?: string;
        line?: number;
        column?: number;
        lineText?: string;
      } | null;
    }>;
  };

  if (!Array.isArray(maybe.errors) || maybe.errors.length === 0) {
    return fallback;
  }

  const lines = maybe.errors.slice(0, 5).map((err) => {
    const location = err.location;
    if (!location) {
      return err.text;
    }

    const column = typeof location.column === "number" ? location.column + 1 : undefined;
    const at = [location.file, location.line, column].filter(Boolean).join(":");
    const context = location.lineText ? `\n> ${location.lineText.trim()}` : "";
    return `${at} ${err.text}${context}`;
  });

  return lines.join("\n");
}

function addRemotionCompileHints(message: string): string {
  const hints: string[] = [];

  if (message.includes("No matching export") && message.includes("TransitionSeries")) {
    hints.push("Hint: import TransitionSeries from @remotion/transitions, not from remotion.");
  }
  if (message.includes("No matching export") && message.includes("fade")) {
    hints.push("Hint: import fade from @remotion/transitions/fade.");
  }
  if (message.toLowerCase().includes("unterminated string literal")) {
    hints.push("Hint: check for missing quote characters in JSX style/object literals.");
  }

  if (!hints.length) {
    return message;
  }

  return `${message}\n\n${hints.join("\n")}`;
}

export async function compileProjectBundle(files: Record<string, string>, entryFile: string): Promise<string> {
  const normalizedFiles = normalizeFileMap(files);
  const normalizedEntry = normalizeVirtualPath(entryFile);

  if (!(normalizedEntry in normalizedFiles)) {
    const availableFiles = Object.keys(normalizedFiles).sort().join(", ");
    throw new Error(
      `Entry file "${normalizedEntry}" does not exist. Available files: ${availableFiles || "none"}.`,
    );
  }

  const virtualProjectPlugin: Plugin = {
    name: "virtual-project",
    setup(buildContext) {
      buildContext.onResolve({ filter: /.*/ }, (args) => {
        if (args.path in SHIM_MODULE_SOURCES) {
          return { path: args.path, namespace: SHIM_FILE_NAMESPACE };
        }

        if (args.path.startsWith(".") || args.path.startsWith("/")) {
          const importer = args.importer && args.importer !== "<stdin>" ? args.importer : normalizedEntry;
          const resolvedFilePath = resolveVirtualImport(args.path, importer, normalizedFiles);
          if (resolvedFilePath) {
            return { path: resolvedFilePath, namespace: USER_FILE_NAMESPACE };
          }

          return {
            errors: [{ text: `Cannot resolve import "${args.path}" from "${importer}".` }],
          };
        }

        return undefined;
      });

      buildContext.onLoad({ filter: /.*/, namespace: SHIM_FILE_NAMESPACE }, (args) => {
        return {
          contents: SHIM_MODULE_SOURCES[args.path],
          loader: "js",
          resolveDir: "/",
        };
      });

      buildContext.onLoad({ filter: /.*/, namespace: USER_FILE_NAMESPACE }, (args) => {
        const contents = normalizedFiles[args.path];
        if (typeof contents !== "string") {
          return {
            errors: [{ text: `Could not load file "${args.path}".` }],
          };
        }

        return {
          contents,
          loader: getLoader(args.path),
          resolveDir: process.cwd(),
        };
      });
    },
  };

  try {
    const result = await build({
      bundle: true,
      write: false,
      format: "iife",
      platform: "browser",
      target: ["es2020"],
      globalName: RUNTIME_BUNDLE_GLOBAL,
      jsx: "automatic",
      logLevel: "silent",
      stdin: {
        loader: "ts",
        resolveDir: process.cwd(),
        contents: [
          `import * as entryModule from ${JSON.stringify(normalizedEntry)};`,
          "export default entryModule.default;",
          `export * from ${JSON.stringify(normalizedEntry)};`,
        ].join("\n"),
      },
      plugins: [virtualProjectPlugin],
    });

    const output = result.outputFiles[0]?.text;
    if (!output) {
      throw new Error("Compilation produced no JavaScript output.");
    }

    return output;
  } catch (error) {
    throw new Error(addRemotionCompileHints(formatCompileFailure(error)));
  }
}

function validatePositiveNumber(name: string, value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) {
    return `${name} must be a positive number.`;
  }
  return null;
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return { ...value };
}

function cloneFileMap(value: Record<string, string>): Record<string, string> {
  return { ...value };
}

function cloneSessionProjectState(value: SessionProjectState): SessionProjectState {
  return {
    ...value,
    files: cloneFileMap(value.files),
    defaultProps: cloneRecord(value.defaultProps),
    inputProps: cloneRecord(value.inputProps),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readPositiveNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  return fallback;
}

type RuntimeExports = {
  default?: unknown;
  calculateMetadata?: unknown;
};

async function resolveBundleMetadata(
  bundle: string,
  fallbackMeta: VideoProjectData["meta"],
  defaultProps: Record<string, unknown>,
  inputProps: Record<string, unknown>,
): Promise<VideoProjectData["meta"]> {
  try {
    ensureRuntimePackages();
    const evaluator = new Function(
      `${bundle}\nreturn typeof ${RUNTIME_BUNDLE_GLOBAL} !== "undefined" ? ${RUNTIME_BUNDLE_GLOBAL} : null;`,
    );

    const exports = evaluator() as RuntimeExports | null;
    if (!exports || typeof exports !== "object" || typeof exports.calculateMetadata !== "function") {
      return fallbackMeta;
    }

    const metadata = await (exports.calculateMetadata as (input: {
      props: Record<string, unknown>;
      defaultProps: Record<string, unknown>;
      compositionId: string;
      abortSignal?: AbortSignal;
    }) => unknown | Promise<unknown>)({
      props: { ...defaultProps, ...inputProps },
      defaultProps,
      compositionId: fallbackMeta.compositionId,
    });

    if (!isRecord(metadata)) {
      return fallbackMeta;
    }

    return {
      ...fallbackMeta,
      width: readPositiveNumber(metadata.width, fallbackMeta.width),
      height: readPositiveNumber(metadata.height, fallbackMeta.height),
      fps: readPositiveNumber(metadata.fps, fallbackMeta.fps),
      durationInFrames: readPositiveNumber(
        metadata.durationInFrames,
        fallbackMeta.durationInFrames,
      ),
    };
  } catch {
    return fallbackMeta;
  }
}

function rememberSessionProject(sessionId: string, project: SessionProjectState): void {
  if (!sessionId) {
    return;
  }

  if (sessionProjects.has(sessionId)) {
    sessionProjects.delete(sessionId);
  }

  sessionProjects.set(sessionId, project);

  while (sessionProjects.size > MAX_SESSION_PROJECTS) {
    const oldestKey = sessionProjects.keys().next().value;
    if (typeof oldestKey !== "string") {
      break;
    }
    sessionProjects.delete(oldestKey);
  }
}

function buildProjectData(
  overrides: Partial<VideoProjectData["meta"]> & { title?: string },
  config: {
    bundle?: string;
    defaultProps?: Record<string, unknown>;
    inputProps?: Record<string, unknown>;
    compileError?: string;
    sourceProject?: SessionProjectState;
  },
): VideoProjectData {
  return {
    meta: {
      title: overrides.title ?? DEFAULT_META.title,
      compositionId: overrides.compositionId ?? DEFAULT_META.compositionId,
      width: overrides.width ?? DEFAULT_META.width,
      height: overrides.height ?? DEFAULT_META.height,
      fps: overrides.fps ?? DEFAULT_META.fps,
      durationInFrames: overrides.durationInFrames ?? DEFAULT_META.durationInFrames,
    },
    bundle: config.bundle ?? ERROR_FALLBACK_BUNDLE,
    defaultProps: config.defaultProps ?? {},
    inputProps: config.inputProps ?? {},
    compileError: config.compileError,
    sourceProject: config.sourceProject ? cloneSessionProjectState(config.sourceProject) : undefined,
  };
}

export function formatZodIssues(error: z.ZodError): string {
  if (!error.issues.length) {
    return "Invalid input.";
  }

  return error.issues
    .map((issue) => {
      const issuePath = issue.path.length ? issue.path.join(".") : "input";
      return `${issuePath}: ${issue.message}`;
    })
    .join("; ");
}

export function buildFailureProject(
  message: string,
  fallbackMeta?: Partial<VideoProjectData["meta"]>,
  fallbackProps?: {
    defaultProps?: Record<string, unknown>;
    inputProps?: Record<string, unknown>;
    sourceProject?: SessionProjectState;
  },
): VideoProjectData {
  return buildProjectData(fallbackMeta ?? {}, {
    compileError: message,
    defaultProps: fallbackProps?.defaultProps,
    inputProps: fallbackProps?.inputProps,
    sourceProject: fallbackProps?.sourceProject,
  });
}

export function getSessionProject(sessionId: string): SessionProjectState | null {
  return sessionProjects.get(sessionId) ?? null;
}

export type CompileProjectSuccess = {
  projectData: VideoProjectData;
  statusLines: string[];
};

export type CompileProjectFailure = {
  error: string;
  projectData: VideoProjectData;
};

export async function compileSessionProject(
  parsedInput: ProjectVideoInput,
  sessionId: string,
  statusPrefixLines: string[],
): Promise<CompileProjectSuccess | CompileProjectFailure> {
  const {
    title,
    compositionId,
    width,
    height,
    fps,
    durationInFrames,
    entryFile,
    files,
    defaultProps,
    inputProps,
  } = parsedInput;

  const meta = { title, compositionId, width, height, fps, durationInFrames };

  for (const [fieldName, value] of [
    ["width", width],
    ["height", height],
    ["fps", fps],
    ["durationInFrames", durationInFrames],
  ] as const) {
    const error = validatePositiveNumber(fieldName, value);
    if (error) {
      return {
        error,
        projectData: buildFailureProject(error, meta, { defaultProps, inputProps }),
      };
    }
  }

  const currentState: SessionProjectState = {
    title,
    compositionId,
    width,
    height,
    fps,
    durationInFrames,
    entryFile,
    files: cloneFileMap(files),
    defaultProps: cloneRecord(defaultProps),
    inputProps: cloneRecord(inputProps),
  };
  rememberSessionProject(sessionId, currentState);

  try {
    const bundle = await compileProjectBundle(files, entryFile);
    const resolvedMeta = await resolveBundleMetadata(bundle, meta, defaultProps, inputProps);
    const usesCalculatedMetadata =
      resolvedMeta.width !== width ||
      resolvedMeta.height !== height ||
      resolvedMeta.fps !== fps ||
      resolvedMeta.durationInFrames !== durationInFrames;

    return {
      projectData: buildProjectData(resolvedMeta, {
        bundle,
        defaultProps,
        inputProps,
        sourceProject: currentState,
      }),
      statusLines: [
        ...statusPrefixLines,
        `Created video project "${title}".`,
        `Entry: ${entryFile} (${Object.keys(files).length} files).`,
        `${usesCalculatedMetadata ? "Resolved" : "Fallback"} meta: ${resolvedMeta.width}x${resolvedMeta.height}, ${resolvedMeta.fps}fps, ${resolvedMeta.durationInFrames} frames (~${(
          resolvedMeta.durationInFrames / resolvedMeta.fps
        ).toFixed(1)}s).`,
        "The player uses merged props (defaultProps + inputProps).",
        "To iterate: update files, props, or metadata and call create_video again.",
      ],
    };
  } catch (error) {
    const message = `Project compilation error: ${(error as Error).message}`;
    return {
      error: message,
      projectData: buildFailureProject(message, meta, {
        defaultProps,
        inputProps,
        sourceProject: currentState,
      }),
    };
  }
}

export function clearSessionProjects(): void {
  sessionProjects.clear();
}
