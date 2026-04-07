# Copilot instructions for Remotion Studio

## Commands

- Install: `bun install`
- Dev: `bun run dev` starts the Studio app; `bun run dev:all` starts shared-types, renderer, and the app; `bun run dev:mcp` starts the MCP server in auto transport mode
- MCP stdio: `bun run mcp:stdio`
- MCP HTTP: `bun run mcp:http`
- Remotion studio: `bun run studio`
- Build: `bun run build`
- Type check: `bun run type-check`
- Test: `bun run test`
- Package tests: `bun run test:types`, `bun run test:registry`, `bun run test:renderer`, `bun run test:mcp`
- Single test: run Vitest inside the package, for example `cd apps/studio && bun run test src/__tests__/api.test.ts -t "returns 200 with all registered templates"`
- Lint: no repo lint script is defined

## Architecture

- `apps/studio` is the Vite + React UI. Pages live in `src/pages`, shared UI in `src/components`, state in `src/stores`, and helper code in `src/services`, `src/api.ts`, and `src/storage.ts`
- `apps/studio/src/api.ts` builds a testable Hono app with `createApp(renderQueue)`, so tests should inject a mock queue and temporary storage instead of starting a real server
- `apps/mcp-server` supports stdio and Streamable HTTP transports. `src/index.ts` bootstraps transport selection, `src/create-server.ts` registers tools, `src/http-server.ts` serves `/mcp` + `/health`, and `src/handlers.ts` contains the local tool logic
- `packages/shared-types` is the source of truth for aspect ratios, export formats, render statuses, project shape, asset shape, and template manifests
- `packages/template-registry` owns template registration and validation. Use `getTemplate`, `getAllTemplates`, `getTemplateManifests`, and `validateInputProps` rather than duplicating template metadata
- `packages/remotion-compositions` contains the actual Remotion compositions in `src/templates`, with the composition registry in `src/Root.tsx`
- `packages/renderer` wraps Remotion bundling/rendering and exposes the sequential `RenderQueue`

## Conventions

- Prefer the types and enums from `packages/shared-types`; do not duplicate codec, aspect-ratio, or render-status unions elsewhere
- Template registry IDs are kebab-case, while Remotion composition IDs are PascalCase. Keep both in sync, and use the Remotion composition ID when calling `selectComposition`
- Template props must be Zod schemas, and `defaultProps` should parse successfully against that schema
- Adding or changing a template usually requires updates in `packages/remotion-compositions/src/templates/`, `packages/remotion-compositions/src/templates/index.ts`, `packages/template-registry/src/templates.ts`, and `packages/remotion-compositions/src/Root.tsx`
- Render jobs are sequential, not parallel. Keep status transitions aligned with `RenderStatus`
- When working in the Studio app, preserve the existing file layout (`src/pages`, `src/components`, `src/stores`, `src/services`) and the theme bootstrap in `src/main.tsx`
