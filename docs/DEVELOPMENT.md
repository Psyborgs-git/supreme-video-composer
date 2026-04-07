# Development Guide

Learn how to extend the platform, add new templates, and contribute.

## Project Conventions

### File Structure

- Components: `src/components/` (React)
- Pages: `src/pages/` (routes)
- Utils: `src/utils/` (helpers)
- Types: `src/types.ts` (TypeScript)
- Tests: `src/__tests__/` (Vitest)
- Styles: `src/styles/` (Tailwind)

### Naming

- **Files**: kebab-case (`my-component.tsx`)
- **React components**: PascalCase (`MyComponent`)
- **Functions**: camelCase (`myFunction`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_SIZE`)
- **Interfaces**: PascalCase (`MyInterface`)

### TypeScript

- Strict mode enabled everywhere
- No `any` types (use `unknown` with type guards)
- Zod for runtime validation
- All exports typed

### Code Quality

```bash
# Type check before committing
bun run type-check

# Run tests
bun run test

# Fix linting (future)
bun run lint --fix
```

---

## Creating a Custom Template

### Step 1: Define Schema

Create file `packages/remotion-compositions/src/templates/MyTemplate.tsx`:

```typescript
import { z } from "zod";

export const MyTemplateSchema = z.object({
  title: z.string().default("My Title"),
  backgroundColor: z.string().regex(/^#[0-9A-F]{6}$/i).default("#FFFFFF"),
  duration: z.number().min(1).max(300).default(10),
});

export type MyTemplateInputProps = z.infer<typeof MyTemplateSchema>;
```

### Step 2: Build Component

```typescript
import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate,
} from "remotion";

interface MyTemplateProps {
  title: string;
  backgroundColor: string;
  duration: number;
}

export const MyTemplate: React.FC<MyTemplateProps> = ({
  title,
  backgroundColor,
  duration,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const opacity = interpolate(
    frame,
    [0, fps], // First second
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ backgroundColor, justifyContent: "center", alignItems: "center" }}>
      <h1 style={{ fontSize: 80, opacity, color: "white" }}>{title}</h1>
    </AbsoluteFill>
  );
};
```

### Step 3: Create Manifest

Add to `packages/template-registry/src/templates.ts`:

```typescript
import { TemplateManifest } from "@studio/shared-types";
import { MyTemplate, MyTemplateSchema } from "@studio/remotion-compositions/templates/MyTemplate";

export const myTemplateManifest: TemplateManifest = {
  id: "my-template",
  name: "My Template",
  description: "My custom template",
  category: "custom",
  tags: ["simple", "text"],
  supportedAspectRatios: ["16:9", "9:16", "1:1"],
  defaultProps: {
    title: "Hello",
    backgroundColor: "#FFFFFF",
    duration: 10,
  },
  defaultFps: 30,
  defaultDurationInFrames: 300, // 10 seconds @ 30fps
  component: MyTemplate,
  schema: MyTemplateSchema,
};
```

### Step 4: Register in Registry

In `packages/template-registry/src/templates.ts`, add to export:

```typescript
export function registerTemplates(): TemplateManifest[] {
  return [
    // ... existing
    myTemplateManifest, // ← Add here
  ];
}
```

### Step 5: Register in Root.tsx

Add to `packages/remotion-compositions/src/Root.tsx`:

```typescript
templates.forEach(({ id, manifest, component }) => {
  <Composition
    id={id}
    component={component}
    durationInFrames={manifest.defaultDurationInFrames}
    fps={manifest.defaultFps}
    width={1920}
    height={1080}
    defaultProps={manifest.defaultProps}
  />;
});
// Root.tsx will automatically pick it up from registry
```

### Step 6: Test

```bash
# Start dev server
bun run dev

# Visit http://localhost:5173
# Navigate to Dashboard
# Your template should appear in the grid!
```

---

## Adding New Features

### New MCP Tool

1. **Logic** → `apps/mcp-server/src/handlers.ts` for local tools, or `apps/mcp-server/src/create-server.ts` for runtime-backed Studio API wrappers:
```typescript
export async function handleMyTool(args: { input: string }): Promise<ToolResult> {
  // Your logic
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
}
```

2. **Register** → `apps/mcp-server/src/create-server.ts`:
```typescript
server.tool(
  "my_tool",
  "Description of my tool",
  { input: z.string().describe("Input") },
  handleMyTool
);
```

3. **Test** → `apps/mcp-server/src/__tests__/tools.test.ts`:
```typescript
it("my_tool works", async () => {
  const result = await handleMyTool({ input: "test" });
  expect(result.isError).toBeUndefined();
});
```

### New UI Component

1. **Create** → `apps/studio/src/components/MyComponent.tsx`:
```typescript
interface MyComponentProps {
  value: string;
  onChange: (value: string) => void;
}

export function MyComponent({ value, onChange }: MyComponentProps) {
  return (
    <div>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
```

2. **Use** → In pages:
```typescript
import { MyComponent } from "../components/MyComponent";

export function MyPage() {
  return <MyComponent value="test" onChange={console.log} />;
}
```

3. **Style** → Use Tailwind CSS classes:
```typescript
<div className="flex items-center justify-center p-4 bg-gray-100 rounded">
  {/* Content */}
</div>
```

### New Export Format

1. **Add codec** → `packages/shared-types/src/index.ts`:
```typescript
export type VideoCodec = 
  | "h264" 
  | "h265" 
  | "vp8" 
  | "av1"
  | "mycodec"; // ← Add here
```

2. **Update renderer** → `packages/renderer/src/render.ts`:
```typescript
const renderOptions = {
  ...baseOptions,
  codec: "mycodec", // ← Handle
  // ... codec config
};
```

3. **Add UI** → `apps/studio/src/components/ExportPanel.tsx`:
```typescript
<option value="mycodec">My Codec</option>
```

---

## Debugging

### Console Logs

```typescript
// React component
console.log("Value:", value);

// TypeScript
const x: unknown = value;
if (typeof x === "string") {
  console.log(x);
}
```

### Debugger

```bash
# Chrome DevTools
open http://localhost:5173
# F12 → Sources tab → Set breakpoints
```

### Test Debugging

```bash
bun run test --watch
# Vitest UI opens in browser
```

### Node Debugger

```bash
node --inspect-brk /path/to/script.ts
# Chrome: chrome://inspect
```

---

## Package Command Reference

### Monorepo Commands

All commands via Bun workspaces:

```bash
# Run script in specific package
bun run --filter '@studio/shared-types' test

# Run in all packages
bun run --filter '*' build

# Package names:
# @studio/shared-types
# @studio/remotion-compositions
# @studio/template-registry
# @studio/renderer
# @studio/mcp-server
# @studio/studio
```

### Local Development

```bash
# Start dev with auto-reload
bun run dev

# Type check (no emit)
bun run type-check

# Full compilation
bun run build

# Run tests (watch mode)
bun run test

# Run tests (single run)
bun run test --run
```

---

## Adding Third-Party Dependencies

### Template Dependencies

For a specific package:

```bash
cd packages/renderer
bun add some-package
```

### Workspace Dependencies

Reference other packages:

```bash
bun add -D @studio/shared-types@workspace:*
```

### Peer Dependencies

Define in `package.json`:

```json
{
  "peerDependencies": {
    "react": ">=19.0"
  }
}
```

---

## Code Patterns

### Zod Validation

```typescript
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  age: z.number().min(0).max(150),
});

const data = { name: "John", age: 30 };
const result = schema.safeParse(data);

if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error);
}
```

### Zustand State

```typescript
import { create } from "zustand";

interface Store {
  projects: Project[];
  addProject: (project: Project) => void;
}

export const useStore = create<Store>((set) => ({
  projects: [],
  addProject: (project) => set(state => ({ 
    projects: [...state.projects, project] 
  })),
}));

// Usage
const projects = useStore(state => state.projects);
const addProject = useStore(state => state.addProject);
```

### React Hooks

```typescript
import { useState, useCallback } from "react";

export function MyComponent() {
  const [value, setValue] = useState("");

  const handleChange = useCallback((newValue: string) => {
    setValue(newValue);
  }, []);

  return (
    <input value={value} onChange={(e) => handleChange(e.target.value)} />
  );
}
```

---

## Performance Tips

### Memoization

```typescript
import { useMemo, useCallback } from "react";

const expensiveValue = useMemo(() => {
  return complexCalculation(data);
}, [data]);

const handleClick = useCallback(() => {
  // Handler won't recreate on every render
}, []);
```

### Code Splitting

```typescript
import { lazy, Suspense } from "react";

const HeavyComponent = lazy(() => import("./HeavyComponent"));

export function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HeavyComponent />
    </Suspense>
  );
}
```

### Template Performance

- **Ken Burns**: Use `interpolate` for smooth zooms (not CSS)
- **Audio sync**: Cache `useAudioData()` results
- **Preload**: Load next asset during current sequence
- **Simplify**: Fewer DOM nodes = faster rendering

---

## Common Gotchas

### No CSS Animations in Remotion

❌ Bad:
```typescript
<div style={{ animation: "slideIn 1s ease" }}>Content</div>
```

✅ Good:
```typescript
const frame = useCurrentFrame();
const opacity = interpolate(frame, [0, 30], [0, 1]);
<div style={{ opacity }}>Content</div>
```

### Circular Dependencies

❌ Bad:
```
compositionstemplate-registry → compositions (circular!)
```

✅ Good:
```
compositions ← template-registry
```

### Missing Type Exports

❌ Bad:
```typescript
export interface MyType { /* ... */ }
export const value: MyType = {}; // Type hidden in export
```

✅ Good:
```typescript
// types.ts
export interface MyType { /* ... */ }

// index.ts
export type { MyType };
export { value };
```

---

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes, commit
git add .
git commit -m "feat: add my feature"

# Type check before push
bun run type-check

# Run tests
bun run test --run

# Push to PR
git push origin feature/my-feature
```

---

## Documentation

When adding features, update:
- **Code comments**: Explain why, not what
- **README**: Overview and quick start
- **ARCHITECTURE.md**: System changes
- **TEMPLATES.md**: Template docs
- **MCP_API.md**: New MCP tools
- **README in package**: Per-package docs

---

## See Also

- [ARCHITECTURE.md](ARCHITECTURE.md) — System design
- [TESTING.md](TESTING.md) — Testing strategy
- [TEMPLATES.md](TEMPLATES.md) — Template reference
