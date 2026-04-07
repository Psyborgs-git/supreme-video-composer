import process from "node:process";
import { StudioApiClient } from "./studio-api-client.js";

export interface McpToolRuntime {
  studioApi?: StudioApiClient;
  previewBaseUrl: string;
}

export type TransportMode = "stdio" | "http";

export interface HttpServerOptions {
  host: string;
  port: number;
}

export function createRuntimeFromEnv(): McpToolRuntime {
  const studioApiBaseUrl = normalizeUrl(process.env.STUDIO_API_BASE_URL);
  const previewBaseUrl =
    normalizeUrl(process.env.STUDIO_PUBLIC_URL) ?? "http://localhost:3000";

  return {
    studioApi: studioApiBaseUrl ? new StudioApiClient(studioApiBaseUrl) : undefined,
    previewBaseUrl,
  };
}

export function resolveTransportMode(
  argv = process.argv.slice(2),
  env = process.env,
  stdinIsTTY = process.stdin.isTTY ?? false,
): TransportMode {
  const configured = (getArgValue(argv, "--transport") ?? env.MCP_TRANSPORT ?? "auto").toLowerCase();

  switch (configured) {
    case "stdio":
      return "stdio";
    case "http":
      return "http";
    case "auto":
      return stdinIsTTY ? "http" : "stdio";
    default:
      throw new Error(
        `Unsupported MCP transport "${configured}". Expected "auto", "stdio", or "http".`,
      );
  }
}

export function getHttpServerOptionsFromEnv(env = process.env): HttpServerOptions {
  const port = Number(env.MCP_PORT ?? 9090);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid MCP_PORT value "${env.MCP_PORT}"`);
  }

  return {
    host: env.MCP_HOST ?? (env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1"),
    port,
  };
}

function getArgValue(argv: string[], name: string): string | undefined {
  const direct = argv.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);

  const index = argv.indexOf(name);
  if (index !== -1 && argv[index + 1]) return argv[index + 1];

  return undefined;
}

function normalizeUrl(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  return value.replace(/\/+$/, "");
}
