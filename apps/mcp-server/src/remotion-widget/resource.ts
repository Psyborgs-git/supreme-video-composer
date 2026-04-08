import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpToolRuntime } from "../runtime.js";

export const REMOTION_WIDGET_URI = "ui://widget/remotion-player.html";

let widgetHtmlPromise: Promise<string> | null = null;

function escapeInlineScript(script: string): string {
  return script.replace(/<\/script/gi, "<\\/script");
}

async function buildWidgetHtml(): Promise<string> {
  if (widgetHtmlPromise) {
    return widgetHtmlPromise;
  }

  widgetHtmlPromise = (async () => {
    const entryPoint = fileURLToPath(new URL("./mount.tsx", import.meta.url));
    const result = await build({
      entryPoints: [entryPoint],
      bundle: true,
      write: false,
      format: "iife",
      platform: "browser",
      target: ["es2020"],
      jsx: "automatic",
      logLevel: "silent",
      absWorkingDir: path.dirname(entryPoint),
    });

    const script = result.outputFiles[0]?.text;
    if (!script) {
      throw new Error("Widget bundle generation produced no output.");
    }

    return [
      "<!doctype html>",
      '<html lang="en">',
      "<head>",
      '<meta charset="utf-8" />',
      '<meta name="viewport" content="width=device-width, initial-scale=1" />',
      "<style>",
      "html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; }",
      "body { background: transparent; color-scheme: light dark; overflow: hidden; }",
      "* { box-sizing: border-box; }",
      "button, input, textarea, select { font: inherit; }",
      "</style>",
      "</head>",
      "<body>",
      '<div id="root"></div>',
      `<script>${escapeInlineScript(script)}</script>`,
      "</body>",
      "</html>",
    ].join("");
  })();

  return widgetHtmlPromise;
}

export function registerRemotionWidgetResource(server: McpServer, runtime: McpToolRuntime): void {
  server.registerResource(
    "remotion-player",
    REMOTION_WIDGET_URI,
    {
      title: "Remotion video player",
      description: "Inline preview widget for MCP-generated Remotion videos.",
      mimeType: "text/html;profile=mcp-app",
    },
    async () => {
      const previewOrigin = new URL(runtime.previewBaseUrl).origin;
      const html = await buildWidgetHtml();

      return {
        contents: [
          {
            uri: REMOTION_WIDGET_URI,
            mimeType: "text/html;profile=mcp-app",
            text: html,
            _meta: {
              ui: {
                prefersBorder: true,
                csp: {
                  connectDomains: [previewOrigin],
                  resourceDomains: [previewOrigin, "https://images.unsplash.com", "https://picsum.photos"],
                  scriptDirectives: ["'unsafe-eval'"],
                },
              },
              "openai/widgetDescription": "Renders a Remotion video",
              "openai/widgetPrefersBorder": true,
              "openai/widgetCSP": {
                connect_domains: [previewOrigin],
                resource_domains: [previewOrigin, "https://images.unsplash.com", "https://picsum.photos"],
                script_directives: ["'unsafe-eval'"],
              },
            },
          },
        ],
      };
    },
  );
}