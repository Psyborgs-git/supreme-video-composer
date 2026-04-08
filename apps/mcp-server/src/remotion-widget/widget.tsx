import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { GrainGradient } from "@paper-design/shaders-react";
import type { VideoMeta, VideoProjectData } from "../remotion-app/types.js";
import { compileBundle } from "./compile-bundle.js";

type DisplayMode = "inline" | "fullscreen" | "pip";

type ToolResultEnvelope = {
  structuredContent?: Record<string, unknown>;
  content?: unknown[];
  _meta?: Record<string, unknown>;
};

type OpenAiBridge = {
  toolInput?: Record<string, unknown>;
  toolOutput?: Record<string, unknown>;
  toolResponseMetadata?: Record<string, unknown>;
  theme?: "light" | "dark";
  displayMode?: DisplayMode;
  requestDisplayMode?: (args: { mode: DisplayMode }) => Promise<void>;
  sendFollowUpMessage?: (args: {
    prompt: string;
    scrollToBottom?: boolean;
  }) => Promise<void>;
  setOpenInAppUrl?: (args: { href: string }) => Promise<void>;
  notifyIntrinsicHeight?: ((height: number) => void) | ((args?: { height?: number }) => void);
};

declare global {
  interface Window {
    openai?: OpenAiBridge;
  }
}

type HostState = {
  toolOutput: Record<string, unknown> | null;
  theme: "light" | "dark";
  displayMode: DisplayMode;
};

const DEFAULT_META: VideoMeta = {
  title: "Untitled",
  compositionId: "Main",
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 150,
};

class WidgetErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[remotion-player] top-level error:", error.message, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, color: "#ff6b6b", fontFamily: "monospace", fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Widget Error</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{this.state.error}</div>
        </div>
      );
    }

    return this.props.children;
  }
}

class PlayerErrorBoundary extends Component<
  { children: ReactNode; onError?: (msg: string) => void; dark: boolean },
  { error: string | null }
> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error.message);
    console.error("[remotion-player] player error:", error.message, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const dark = this.props.dark;
      return (
        <div
          style={{
            padding: 16,
            background: dark ? "#1c1c1c" : "#f5f5f5",
            borderRadius: 8,
            fontFamily: "system-ui, sans-serif",
            color: dark ? "#ff6b6b" : "#dc3545",
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Error</div>
          <div
            style={{ opacity: 0.8, fontSize: 12, fontFamily: "monospace", whiteSpace: "pre-wrap" }}
          >
            {this.state.error}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function positiveNumberOrFallback(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  return fallback;
}

function toPropsObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function parseVideoProject(output: Record<string, unknown> | null): VideoProjectData | null {
  if (!output) return null;

  const raw = output.videoProject;
  if (typeof raw !== "string") return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!isRecord(parsed)) return null;
    const meta = parsed.meta;
    const bundle = parsed.bundle;
    if (!isRecord(meta) || typeof bundle !== "string" || bundle.trim().length === 0) {
      return null;
    }

    return {
      meta: {
        title:
          typeof meta.title === "string" && meta.title.trim().length > 0
            ? meta.title
            : DEFAULT_META.title,
        compositionId:
          typeof meta.compositionId === "string" && meta.compositionId.trim().length > 0
            ? meta.compositionId
            : DEFAULT_META.compositionId,
        width: positiveNumberOrFallback(meta.width, DEFAULT_META.width),
        height: positiveNumberOrFallback(meta.height, DEFAULT_META.height),
        fps: positiveNumberOrFallback(meta.fps, DEFAULT_META.fps),
        durationInFrames: positiveNumberOrFallback(
          meta.durationInFrames,
          DEFAULT_META.durationInFrames,
        ),
      },
      bundle,
      defaultProps: toPropsObject(parsed.defaultProps),
      inputProps: toPropsObject(parsed.inputProps),
      compileError:
        typeof parsed.compileError === "string" && parsed.compileError.trim().length > 0
          ? parsed.compileError
          : undefined,
    };
  } catch {
    return null;
  }
}

function mergeProps(
  defaultProps: Record<string, unknown>,
  inputProps: Record<string, unknown>,
): Record<string, unknown> {
  return { ...defaultProps, ...inputProps };
}

function readMetadataOverrides(overrides: Record<string, unknown>, fallback: VideoMeta): VideoMeta {
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

function useLoadingWord(active: boolean) {
  const LOADING_WORDS = [
    "Storyboarding",
    "Keyframing",
    "Colorgrading",
    "Montaging",
    "Clipjuggling",
    "Renderwrangling",
    "Timeline-taming",
    "Scene-stitching",
    "Framebuffing",
    "Beziering",
    "Rotoscoping",
    "Whooshing",
    "Boom-micing",
    "Greenscreening",
    "Lensfiddling",
    "Foleying",
    "Pixel-peeping",
    "Shot-sweetening",
    "Captionifying",
    "Transition-wizarding",
    "Slo-moing",
    "B-rolling",
    "Audio-polishing",
    "Stabilizing",
    "Export-spelunking",
    "Render-re-rendering",
    "Compiling-and-smiling",
    "Cinema-cooking",
  ];

  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!active) {
      setVisible(true);
      return;
    }

    const rotateMs = 2500;
    const fadeMs = 220;
    let timeout: number | null = null;
    const interval = window.setInterval(() => {
      setVisible(false);
      timeout = window.setTimeout(() => {
        setIndex((prev) => (prev + 1) % LOADING_WORDS.length);
        setVisible(true);
      }, fadeMs);
    }, rotateMs);

    return () => {
      window.clearInterval(interval);
      if (timeout !== null) window.clearTimeout(timeout);
    };
  }, [active]);

  return { word: `${LOADING_WORDS[index]}...`, visible };
}

function ShaderBackground({ style }: { style?: React.CSSProperties }) {
  return (
    <GrainGradient
      width="100%"
      height="100%"
      colors={["#7300ff", "#eba8ff", "#00bfff", "#2b00ff", "#33cc99", "#3399cc", "#3333cc"]}
      colorBack="#00000000"
      softness={1}
      intensity={1}
      noise={0}
      shape="corners"
      speed={2}
      scale={1.8}
      style={style}
    />
  );
}

function LoadingView({
  word,
  visible,
  dark,
  fullscreen,
  onExitFullscreen,
}: {
  word: string;
  visible: boolean;
  dark: boolean;
  fullscreen: boolean;
  onExitFullscreen?: () => void;
}) {
  const height = fullscreen ? "100vh" : 260;
  return (
    <div
      style={{
        position: "relative",
        height,
        minHeight: 260,
        borderRadius: fullscreen ? 0 : 8,
        overflow: "hidden",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <ShaderBackground style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      {fullscreen && onExitFullscreen && (
        <div style={{ position: "absolute", top: 10, right: 10, zIndex: 2 }}>
          <button
            onClick={onExitFullscreen}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none",
              cursor: "pointer",
              padding: "7px 10px",
              color: "#f4f4f4",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            Exit fullscreen
          </button>
        </div>
      )}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: dark ? "#ffffff" : "#000000",
          textAlign: "center",
          padding: 24,
        }}
      >
        <span
          style={{
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: 0.35,
            lineHeight: 1,
            opacity: visible ? 0.95 : 0,
            transform: visible ? "translateY(0px) scale(1)" : "translateY(8px) scale(0.985)",
            transition: "opacity 120ms ease, transform 120ms ease",
          }}
        >
          {word}
        </span>
      </div>
    </div>
  );
}

function EmptyView({ dark }: { dark: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 200,
        background: dark ? "#141414" : "#fff",
        borderRadius: 8,
        fontFamily: "system-ui, sans-serif",
        color: dark ? "#777" : "#888",
        fontSize: 13,
        textAlign: "center",
        padding: 16,
      }}
    >
      No video project data was returned. Check the tool output and call create_video again.
    </div>
  );
}

function HeaderBar({
  title,
  dark,
  isFullscreen,
  isAvailable,
  onToggleFullscreen,
}: {
  title: string;
  dark: boolean;
  isFullscreen: boolean;
  isAvailable: boolean;
  onToggleFullscreen: () => void;
}) {
  const fg = dark ? "#e0e0e0" : "#1a1a1a";
  const fg2 = dark ? "#777" : "#888";

  const fsIcon = isFullscreen ? (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 2 6 6 2 6" />
      <polyline points="10 14 10 10 14 10" />
      <line x1="2" y1="2" x2="6" y2="6" />
      <line x1="14" y1="14" x2="10" y2="10" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="10 2 14 2 14 6" />
      <polyline points="6 14 2 14 2 10" />
      <line x1="14" y1="2" x2="10" y2="6" />
      <line x1="2" y1="14" x2="6" y2="10" />
    </svg>
  );

  return (
    <div style={{ padding: "6px 10px 6px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
      <span style={{ color: fg, fontSize: 13, fontWeight: 500 }}>{title}</span>
      <button
        onClick={onToggleFullscreen}
        disabled={!isAvailable}
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        style={{
          background: "none",
          border: "none",
          cursor: isAvailable ? "pointer" : "not-allowed",
          padding: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: fg2,
          borderRadius: 4,
          opacity: isAvailable ? 0.7 : 0.35,
        }}
      >
        {fsIcon}
      </button>
    </div>
  );
}

function EditingOverlay({ word, visible }: { word: string; visible: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 10,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderRadius: "inherit",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          transition: "opacity 300ms ease",
        }}
      />
      <ShaderBackground
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.55,
          mixBlendMode: "screen",
        }}
      />
      <span
        style={{
          position: "relative",
          zIndex: 1,
          fontSize: 16,
          fontWeight: 500,
          letterSpacing: 0.35,
          lineHeight: 1,
          color: "#ffffff",
          textShadow: "0 1px 8px rgba(0,0,0,0.5)",
          opacity: visible ? 0.95 : 0,
          transform: visible ? "translateY(0px) scale(1)" : "translateY(8px) scale(0.985)",
          transition: "opacity 120ms ease, transform 120ms ease",
        }}
      >
        {word}
      </span>
    </div>
  );
}

function PlayerView({
  compiledProject,
  compileError,
  mergedProps,
  meta,
  dark,
  isBusy,
  isFullscreen,
  loadingWord,
  loadingVisible,
  onPlayerError,
}: {
  compiledProject: ReturnType<typeof compileBundle> | null;
  compileError: string | null;
  mergedProps: Record<string, unknown>;
  meta: VideoMeta;
  dark: boolean;
  isBusy: boolean;
  isFullscreen: boolean;
  loadingWord: string;
  loadingVisible: boolean;
  onPlayerError: (msg: string) => void;
}) {
  const ref = useRef<PlayerRef>(null);

  if (compileError) {
    return (
      <div
        style={{
          padding: 16,
          background: dark ? "#1c1c1c" : "#f5f5f5",
          borderRadius: 8,
          fontFamily: "system-ui, sans-serif",
          color: dark ? "#ff6b6b" : "#dc3545",
          fontSize: 13,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Compilation Error</div>
        <div style={{ opacity: 0.8, fontSize: 12, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
          {compileError}
        </div>
      </div>
    );
  }

  if (!compiledProject || "error" in compiledProject) {
    return null;
  }

  return (
    <PlayerErrorBoundary onError={onPlayerError} dark={dark}>
      <div style={{ position: "relative", width: "100%", maxWidth: isFullscreen ? "100%" : undefined, margin: isFullscreen ? "0 auto" : undefined }}>
        <Player
          ref={ref}
          component={compiledProject.component as React.ComponentType<Record<string, unknown>>}
          inputProps={mergedProps}
          durationInFrames={meta.durationInFrames}
          fps={meta.fps}
          compositionWidth={meta.width}
          compositionHeight={meta.height}
          controls
          autoPlay
          loop
          acknowledgeRemotionLicense
          style={{
            width: "100%",
            maxWidth: "100%",
            maxHeight: isFullscreen ? "calc(100vh - 56px)" : undefined,
            margin: "0 auto",
          }}
        />
        {isBusy && <EditingOverlay word={loadingWord} visible={loadingVisible} />}
      </div>
    </PlayerErrorBoundary>
  );
}

function inferTheme(): "light" | "dark" {
  if (window.openai?.theme === "light" || window.openai?.theme === "dark") {
    return window.openai.theme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readHostState(): HostState {
  return {
    toolOutput: isRecord(window.openai?.toolOutput) ? window.openai.toolOutput : null,
    theme: inferTheme(),
    displayMode: window.openai?.displayMode ?? "inline",
  };
}

async function postFollowUpMessage(prompt: string): Promise<void> {
  if (window.openai?.sendFollowUpMessage) {
    await window.openai.sendFollowUpMessage({ prompt, scrollToBottom: true });
    return;
  }

  window.parent.postMessage(
    {
      jsonrpc: "2.0",
      method: "ui/message",
      params: {
        role: "user",
        content: [{ type: "text", text: prompt }],
      },
    },
    "*",
  );
}

function useWidgetHost() {
  const [hostState, setHostState] = useState<HostState>(() => readHostState());
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    const updateFromGlobals = () => setHostState(readHostState());

    const onSetGlobals = () => {
      updateFromGlobals();
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      const message = event.data;
      if (!message || message.jsonrpc !== "2.0") return;

      if (message.method === "ui/notifications/tool-input") {
        setIsBusy(true);
        updateFromGlobals();
      }

      if (message.method === "ui/notifications/tool-result") {
        setIsBusy(false);
        const params = message.params as ToolResultEnvelope | undefined;
        setHostState((current) => ({
          ...current,
          toolOutput: isRecord(params?.structuredContent) ? params!.structuredContent! : readHostState().toolOutput,
          theme: inferTheme(),
          displayMode: window.openai?.displayMode ?? current.displayMode,
        }));
      }
    };

    window.addEventListener("openai:set_globals", onSetGlobals as EventListener, {
      passive: true,
    });
    window.addEventListener("message", onMessage, { passive: true });

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onThemeChange = () => updateFromGlobals();
    media.addEventListener?.("change", onThemeChange);

    return () => {
      window.removeEventListener("openai:set_globals", onSetGlobals as EventListener);
      window.removeEventListener("message", onMessage);
      media.removeEventListener?.("change", onThemeChange);
    };
  }, []);

  const requestDisplayMode = useCallback(async (mode: DisplayMode) => {
    if (!window.openai?.requestDisplayMode) return;
    await window.openai.requestDisplayMode({ mode });
  }, []);

  const setOpenInAppUrl = useCallback(async (href: string) => {
    if (!window.openai?.setOpenInAppUrl) return;
    await window.openai.setOpenInAppUrl({ href });
  }, []);

  return {
    ...hostState,
    isBusy,
    isFullscreenAvailable: typeof window.openai?.requestDisplayMode === "function",
    requestDisplayMode,
    setOpenInAppUrl,
    sendFollowUpMessage: postFollowUpMessage,
    notifyIntrinsicHeight: window.openai?.notifyIntrinsicHeight,
  };
}

function useAutoResize(
  rootRef: React.RefObject<HTMLDivElement | null>,
  notifyIntrinsicHeight: OpenAiBridge["notifyIntrinsicHeight"] | undefined,
) {
  useEffect(() => {
    if (!notifyIntrinsicHeight || !rootRef.current || typeof ResizeObserver === "undefined") {
      return;
    }

    const report = () => {
      const height = rootRef.current?.scrollHeight ?? document.documentElement.scrollHeight;
      try {
        if (typeof notifyIntrinsicHeight === "function") {
          try {
            (notifyIntrinsicHeight as (args: { height?: number }) => void)({ height });
          } catch {
            (notifyIntrinsicHeight as (value: number) => void)(height);
          }
        }
      } catch {
        // Ignore host-specific bridge errors.
      }
    };

    report();
    const observer = new ResizeObserver(report);
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [notifyIntrinsicHeight, rootRef]);
}

function RemotionPlayerWidgetInner() {
  const {
    toolOutput,
    theme,
    displayMode,
    isBusy,
    isFullscreenAvailable,
    sendFollowUpMessage,
    requestDisplayMode,
    setOpenInAppUrl,
    notifyIntrinsicHeight,
  } = useWidgetHost();

  const rootRef = useRef<HTMLDivElement>(null);
  useAutoResize(rootRef, notifyIntrinsicHeight);

  const prevRef = useRef<VideoProjectData | null>(null);
  const isFullscreen = displayMode === "fullscreen" && isFullscreenAvailable;
  const dark = theme === "dark";
  const bg = dark ? "#141414" : "#fff";

  const finalData = useMemo(() => parseVideoProject(toolOutput), [toolOutput]);

  useEffect(() => {
    if (finalData) {
      prevRef.current = finalData;
    }
  }, [finalData]);

  const previewUrl = useMemo(() => {
    const raw = toolOutput?.previewUrl;
    return typeof raw === "string" && raw.trim().length > 0 ? raw : null;
  }, [toolOutput]);

  useEffect(() => {
    if (!previewUrl) return;
    setOpenInAppUrl(previewUrl).catch((error) => {
      console.error("[remotion-player] Failed to set open-in-app URL", error);
    });
  }, [previewUrl, setOpenInAppUrl]);

  const data = finalData || (isBusy ? prevRef.current : null);
  const hasData = !!data;
  const isLoading = !hasData && isBusy;
  const { word: loadingWord, visible: loadingVisible } = useLoadingWord(isBusy);

  const compiled = useMemo(() => {
    if (!data || data.compileError) return null;
    return compileBundle(data.bundle);
  }, [data?.bundle, data?.compileError]);

  const compileError = data?.compileError ?? (compiled && "error" in compiled ? compiled.error : null);
  const compiledProject = compiled && !("error" in compiled) ? compiled : null;
  const mergedProps = useMemo(() => {
    if (!data) return {};
    return mergeProps(data.defaultProps, data.inputProps);
  }, [data]);
  const [resolvedMeta, setResolvedMeta] = useState<VideoMeta | null>(null);

  useEffect(() => {
    if (!data) {
      setResolvedMeta(null);
      return;
    }

    setResolvedMeta(data.meta);
  }, [data]);

  useEffect(() => {
    if (!data || !compiledProject?.calculateMetadata) return;
    const controller = new AbortController();
    Promise.resolve(
      compiledProject.calculateMetadata({
        props: mergedProps,
        defaultProps: data.defaultProps,
        compositionId: data.meta.compositionId,
        abortSignal: controller.signal,
      }),
    )
      .then((metadata) => {
        if (controller.signal.aborted || !isRecord(metadata)) return;
        setResolvedMeta((current) => readMetadataOverrides(metadata, current ?? data.meta));
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        sendFollowUpMessage(
          `calculateMetadata() failed:\n\n\`${(error as Error).message}\`\n\nPlease fix the project and call create_video again.`,
        ).catch(() => undefined);
      });

    return () => controller.abort();
  }, [compiledProject, data, mergedProps, sendFollowUpMessage]);

  useEffect(() => {
    if (!compileError || data?.compileError) return;
    sendFollowUpMessage(
      `The project had a compilation error:\n\n\`${compileError}\`\n\nPlease fix the files and call create_video again.`,
    ).catch(() => undefined);
  }, [compileError, data?.compileError, sendFollowUpMessage]);

  const toggleFullscreen = useCallback(() => {
    const nextMode: DisplayMode = isFullscreen ? "inline" : "fullscreen";
    requestDisplayMode(nextMode).catch((error) => {
      console.error(`[remotion-player] Failed to request display mode \"${nextMode}\"`, error);
    });
  }, [isFullscreen, requestDisplayMode]);

  const handlePlayerError = useCallback(
    (msg: string) => {
      sendFollowUpMessage(
        `The video had a runtime error:\n\n\`${msg}\`\n\nPlease fix the project and call create_video again.`,
      ).catch(() => undefined);
    },
    [sendFollowUpMessage],
  );

  const meta = resolvedMeta ?? data?.meta ?? DEFAULT_META;

  if (isLoading) {
    return (
      <LoadingView
        word={loadingWord}
        visible={loadingVisible}
        dark={dark}
        fullscreen={isFullscreen}
        onExitFullscreen={isFullscreen ? toggleFullscreen : undefined}
      />
    );
  }

  if (!hasData) {
    return <EmptyView dark={dark} />;
  }

  const playerEl = (
    <PlayerView
      compiledProject={compiledProject}
      compileError={compileError}
      mergedProps={mergedProps}
      meta={meta}
      dark={dark}
      isBusy={isBusy}
      isFullscreen={isFullscreen}
      loadingWord={loadingWord}
      loadingVisible={loadingVisible}
      onPlayerError={handlePlayerError}
    />
  );

  if (isFullscreen) {
    return (
      <div ref={rootRef} style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#000", fontFamily: "system-ui, sans-serif" }}>
        <HeaderBar
          title={meta.title}
          dark={dark}
          isFullscreen
          isAvailable={isFullscreenAvailable}
          onToggleFullscreen={toggleFullscreen}
        />
        <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "12px 16px 16px", boxSizing: "border-box" }}>
          <div style={{ width: "100%", maxWidth: 1680 }}>{playerEl}</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} style={{ borderRadius: 8, overflow: "hidden", background: bg, fontFamily: "system-ui, sans-serif" }}>
      <HeaderBar
        title={meta.title}
        dark={dark}
        isFullscreen={false}
        isAvailable={isFullscreenAvailable}
        onToggleFullscreen={toggleFullscreen}
      />
      {playerEl}
    </div>
  );
}

export default function RemotionPlayerWidget() {
  return (
    <WidgetErrorBoundary>
      <RemotionPlayerWidgetInner />
    </WidgetErrorBoundary>
  );
}