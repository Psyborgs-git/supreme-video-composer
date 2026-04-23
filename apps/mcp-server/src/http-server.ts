import { createServer, type IncomingMessage, type Server as NodeServer, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createMcpServer } from "./create-server.js";
import type { HttpServerOptions, McpToolRuntime } from "./runtime.js";

interface Session {
  server: ReturnType<typeof createMcpServer>;
  transport: StreamableHTTPServerTransport;
}

export interface RunningHttpMcpServer {
  server: NodeServer;
  close: () => Promise<void>;
  sessions: Map<string, Session>;
  url: string;
}

export async function startHttpMcpServer(
  runtime: McpToolRuntime,
  options: HttpServerOptions,
): Promise<RunningHttpMcpServer> {
  const sessions = new Map<string, Session>();

  const server = createServer(async (req, res) => {
    try {
      await handleRequest(req, res, runtime, sessions);
    } catch (error) {
      console.error("[mcp-http] request failed", error);
      if (!res.headersSent) {
        writeJsonRpcError(res, 500, "Internal server error");
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  const resolvedPort =
    address && typeof address === "object" ? address.port : options.port;

  return {
    server,
    sessions,
    url: `http://${options.host}:${resolvedPort}`,
    close: async () => {
      for (const [sessionId, session] of sessions) {
        try {
          await session.transport.close();
          await session.server.close();
        } catch (error) {
          console.error(`[mcp-http] failed to close session ${sessionId}`, error);
        } finally {
          sessions.delete(sessionId);
        }
      }

      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  runtime: McpToolRuntime,
  sessions: Map<string, Session>,
): Promise<void> {
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (requestUrl.pathname === "/health" && req.method === "GET") {
    writeJson(res, 200, {
      ok: true,
      transport: "streamable-http",
      backend: runtime.studioApi ? "studio-api" : "local",
    });
    return;
  }

  if (requestUrl.pathname !== "/mcp") {
    writeJson(res, 404, { error: "Not found" });
    return;
  }

  let parsedBody: unknown;
  if (req.method === "POST") {
    try {
      parsedBody = await readJsonBody(req);
    } catch {
      writeJsonRpcError(res, 400, "Bad Request: Invalid JSON body");
      return;
    }
  }
  const sessionId = getHeader(req, "mcp-session-id");

  let session = sessionId ? sessions.get(sessionId) : undefined;

  if (!session) {
    if (req.method !== "POST" || !isInitializeRequest(parsedBody)) {
      writeJsonRpcError(res, 400, "Bad Request: No valid session ID provided");
      return;
    }

    let server = createMcpServer(runtime);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (nextSessionId) => {
        sessions.set(nextSessionId, { server, transport });
      },
    });

    transport.onclose = () => {
      const activeSessionId = transport.sessionId;
      if (activeSessionId) {
        sessions.delete(activeSessionId);
      }
    };

    await server.connect(transport);
    session = { server, transport };
  }

  await session.transport.handleRequest(req, res, parsedBody);

  if (req.method === "DELETE") {
    try {
      await session.transport.close();
    } finally {
      await session.server.close();
      const activeSessionId = session.transport.sessionId ?? sessionId;
      if (activeSessionId) {
        sessions.delete(activeSessionId);
      }
    }
  }
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw.trim()) {
    return undefined;
  }

  return JSON.parse(raw);
}

function getHeader(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function writeJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function writeJsonRpcError(res: ServerResponse, status: number, message: string): void {
  writeJson(res, status, {
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message,
    },
    id: null,
  });
}
