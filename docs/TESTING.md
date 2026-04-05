# Testing Guide

How to write, run, and debug tests across the stack.

## Test Framework: Vitest

All tests use [Vitest](https://vitest.dev/) (Jest-compatible, faster).

```bash
# Run all tests (watch mode)
bun run test

# Run specific file
bun run test src/__tests__/my.test.ts

# Run single test
bun run test src/__tests__/my.test.ts -t "should do something"

# UI mode (browser)
bun run test --ui

# Single run (CI mode)
bun run test --run

# Coverage report
bun run test --coverage
```

---

## Unit Tests

Test individual functions, components, utilities.

### Writing Unit Tests

File: `src/__tests__/utils.test.ts`

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { myFunction } from "../utils";

describe("myFunction", () => {
  it("should return expected result", () => {
    const result = myFunction("input");
    expect(result).toBe("expected");
  });

  it("should handle edge cases", () => {
    expect(() => myFunction("")).toThrow("Cannot be empty");
  });

  it("should return array", () => {
    const result = myFunction("test");
    expect(result).toEqual([1, 2, 3]);
    expect(result).toHaveLength(3);
  });

  it("should call handler", () => {
    const handler = vi.fn();
    myFunction("test", handler);
    expect(handler).toHaveBeenCalledWith("test");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
```

### Testing Zod Schemas

```typescript
import { describe, it, expect } from "vitest";
import { MySchema } from "../schemas";

describe("MySchema validation", () => {
  it("should validate valid data", () => {
    const result = MySchema.safeParse({
      name: "John",
      age: 30,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("John");
    }
  });

  it("should reject invalid data", () => {
    const result = MySchema.safeParse({
      name: "John",
      age: "not a number",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].code).toBe("invalid_type");
    }
  });
});
```

### Testing React Components

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MyComponent } from "../components/MyComponent";

describe("MyComponent", () => {
  it("should render text", () => {
    render(<MyComponent value="test" onChange={() => {}} />);
    expect(screen.getByText("test")).toBeInTheDocument();
  });

  it("should call onChange", async () => {
    const onChange = vi.fn();
    const { user } = render(<MyComponent value="" onChange={onChange} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "hello");

    expect(onChange).toHaveBeenCalledWith("hello");
  });

  it("should have correct class", () => {
    render(<MyComponent value="test" onChange={() => {}} className="my-class" />);
    const element = screen.getByText("test");
    expect(element).toHaveClass("my-class");
  });
});
```

---

## Integration Tests

Test how components work together.

### Testing API Responses

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse, setupServer } from "msw";
import { fetchProjects } from "../api";

const server = setupServer(
  http.get("/api/projects", () => {
    return HttpResponse.json([
      { id: "1", name: "Project 1" },
      { id: "2", name: "Project 2" },
    ]);
  })
);

describe("fetchProjects", () => {
  beforeEach(() => server.listen());

  it("should fetch projects", async () => {
    const projects = await fetchProjects();
    expect(projects).toHaveLength(2);
    expect(projects[0].name).toBe("Project 1");
  });

  it("should handle errors", async () => {
    server.use(
      http.get("/api/projects", () => {
        return HttpResponse.json({ error: "Not found" }, { status: 404 });
      })
    );

    await expect(fetchProjects()).rejects.toThrow("Not found");
  });
});
```

### Testing State Management

```typescript
import { describe, it, expect } from "vitest";
import { useStore } from "../store";

describe("useStore", () => {
  it("should initialize with default state", () => {
    const state = useStore.getState();
    expect(state.projects).toEqual([]);
  });

  it("should add project", () => {
    const { addProject } = useStore.getState();
    addProject({ id: "1", name: "Test" });

    const { projects } = useStore.getState();
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("Test");
  });
});
```

---

## Templating Tests

Test Remotion templates specifically.

### Testing Template Rendering

```typescript
import { describe, it, expect } from "vitest";
import { render } from "@remotion/renderer";
import { MyTemplate } from "../templates/MyTemplate";

describe("MyTemplate", () => {
  it("should render frame without error", async () => {
    const frame = await render({
      component: MyTemplate,
      durationInFrames: 300,
      fps: 30,
      frameToRender: 0,
      outputPath: "/tmp/frame.png",
      inputProps: { title: "Test", backgroundColor: "#000000" },
    });

    expect(frame).toBe("/tmp/frame.png");
  });

  it("should validate schema", () => {
    const result = MyTemplateSchema.safeParse({
      title: "Test",
      backgroundColor: "invalid",
    });

    expect(result.success).toBe(false);
  });

  it("should use default props", () => {
    const result = MyTemplateSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("My Title");
      expect(result.data.backgroundColor).toBe("#FFFFFF");
    }
  });
});
```

---

## MCP Server Tests

Test MCP tool handlers.

### Testing Tool Handlers

File: `apps/mcp-server/src/__tests__/tools.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { handleRenderProject, handleGetRenderStatus } from "../handlers";

describe("MCP render_project tool", () => {
  it("should queue render job", async () => {
    const result = await handleRenderProject({
      projectId: "test-id",
      codec: "h264",
      quality: "standard",
    });

    expect(result.content[0].type).toBe("text");
    const text = JSON.parse(result.content[0].text);
    expect(text.jobId).toBeDefined();
    expect(text.status).toBe("queued");
  });

  it("should validate inputs", async () => {
    const result = await handleRenderProject({
      projectId: "",
      codec: "invalid" as any,
      quality: "standard",
    });

    expect(result.isError).toBe(true);
  });
});

describe("MCP get_render_status tool", () => {
  it("should return job status", async () => {
    const render = await handleRenderProject({
      projectId: "test",
      codec: "h264",
      quality: "standard",
    });

    const jobId = JSON.parse(render.content[0].text).jobId;

    const status = await handleGetRenderStatus({ jobId });
    expect(status.content[0].type).toBe("text");

    const statusData = JSON.parse(status.content[0].text);
    expect(["queued", "bundling", "rendering", "encoding", "complete", "error"]).toContain(
      statusData.status
    );
  });
});
```

---

## Mocking

### Mock Functions

```typescript
import { describe, it, expect, vi } from "vitest";

describe("mocking", () => {
  it("should mock function", () => {
    const mockFn = vi.fn();
    mockFn("test");

    expect(mockFn).toHaveBeenCalledWith("test");
  });

  it("should mock return value", () => {
    const mockFn = vi.fn().mockReturnValue("result");
    const value = mockFn();

    expect(value).toBe("result");
  });

  it("should mock implementation", () => {
    const mockFn = vi.fn().mockImplementation((x: number) => x * 2);
    expect(mockFn(5)).toBe(10);
  });
});
```

### Mock Modules

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("../api", () => ({
  fetchProjects: vi.fn(() => Promise.resolve([])),
}));

describe("with mocked module", () => {
  it("should use mocked API", async () => {
    const { fetchProjects } = await import("../api");
    const projects = await fetchProjects();
    expect(projects).toEqual([]);
  });
});
```

---

## Debugging Tests

### Watch Mode

```bash
bun run test --watch
# Re-runs tests as you edit
# Fast feedback loop
```

### Debug Single Test

```bash
bun run test src/__tests__/my.test.ts -t "specific test name"
```

### UI Mode

```bash
bun run test --ui
# Opens browser at http://localhost:51204
# Click test to see details
# Real-time updates
```

### Console Output

```typescript
it("should log debug info", () => {
  console.log("Debug value:", myFunction());
  expect(true).toBe(true);
});

// Run with:
// bun run test --reporter=verbose
```

---

## Snapshot Testing

Capture expected output for regression detection.

```typescript
import { describe, it, expect } from "vitest";

describe("snapshot", () => {
  it("should match template output", () => {
    const output = generateTemplateMetadata({
      name: "My Template",
      version: "1.0.0",
    });

    expect(output).toMatchSnapshot();
  });
});
```

**First run**: Creates `__snapshots__/my.test.ts.snap`

**Subsequent runs**: Compares actual vs snapshot

**Update snapshots**:
```bash
bun run test -- -u
```

---

## Coverage Reports

Measure test coverage.

```bash
# Generate coverage
bun run test --coverage

# View report
open coverage/index.html
```

Coverage categories:
- **Line**: % of lines executed
- **Branch**: % of if/else paths
- **Function**: % of functions called
- **Statement**: % of statements executed

Target: **80%+** coverage for critical paths.

---

## Performance Testing

Test for performance regressions.

```typescript
import { describe, it, expect } from "vitest";

describe("performance", () => {
  it("should render fast", () => {
    const start = performance.now();

    // Test operation
    const result = myExpensiveFunction();

    const end = performance.now();
    const duration = end - start;

    // Should complete in < 100ms
    expect(duration).toBeLessThan(100);
    expect(result).toBeDefined();
  });
});
```

---

## Best Practices

### ✅ Do

1. **Test behavior**, not implementation
   ```typescript
   // ✅ Good: Tests what user sees
   expect(screen.getByText("Hello")).toBeInTheDocument();

   // ❌ Bad: Tests internal state
   expect(component.state.name).toBe("Hello");
   ```

2. **Use descriptive test names**
   ```typescript
   // ✅ Good
   it("should show error message when email is invalid", () => {});

   // ❌ Bad
   it("should work", () => {});
   ```

3. **Setup and teardown**
   ```typescript
   beforeEach(() => {
     // Setup
   });

   afterEach(() => {
     // Cleanup
   });
   ```

4. **Mock external dependencies**
   ```typescript
   // ✅ Good: Tests in isolation
   vi.mock("../api");

   // ❌ Bad: Tests depend on network
   const result = await realApi.fetch();
   ```

5. **Test error cases**
   ```typescript
   it("should handle errors gracefully", () => {
     expect(() => myFunction(null)).toThrow();
   });
   ```

### ❌ Don't

1. **Don't test implementation details**
   - Test public API, not private methods
   - Don't check internal state

2. **Don't write brittle tests**
   - Avoid testing exact timers
   - Don't test CSS classes (fragile)

3. **Don't skip tests**
   - Use `.only` for debugging, remove before commit
   - Don't ignore failing tests

4. **Don't test libraries**
   - Assume React works
   - Focus on your code

---

## CI/CD Integration

Tests run automatically:

```yaml
# .github/workflows/test.yml
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run test --run
      - run: bun run type-check
```

---

## Test Organization

```
src/
├── __tests__/
│   ├── components/
│   │   └── MyComponent.test.tsx
│   ├── utils/
│   │   └── myFunction.test.ts
│   ├── templates/
│   │   └── MyTemplate.test.ts
│   └── api/
│       └── fetchProjects.test.ts
├── components/
├── utils/
├── templates/
└── api/
```

---

## Common Assertions

```typescript
// Equality
expect(value).toBe("exact");
expect(value).toEqual({ deep: "equal" });
expect(value).toStrictEqual(value);

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();

// Numbers
expect(value).toBeGreaterThan(5);
expect(value).toBeLessThan(10);
expect(value).toBeCloseTo(3.14159, 2);

// Arrays
expect(array).toHaveLength(3);
expect(array).toContainEqual({ id: 1 });
expect(array).toEqual(expect.arrayContaining([1, 2]));

// Strings
expect(str).toMatch(/regex/);
expect(str).toContain("substring");
expect(str).toHaveLength(5);

// Functions
expect(fn).toHaveBeenCalled();
expect(fn).toHaveBeenCalledWith("arg");
expect(fn).toHaveBeenCalledTimes(1);
expect(fn).toReturn();

// Errors
expect(() => fn()).toThrow();
expect(() => fn()).toThrow("message");
expect(promise).rejects.toThrow();

// DOM
expect(element).toBeInTheDocument();
expect(element).toHaveClass("class");
expect(element).toHaveAttribute("attr", "value");
expect(element).toBeVisible();
```

---

## See Also

- [DEVELOPMENT.md](DEVELOPMENT.md) — Development workflow
- [ARCHITECTURE.md](ARCHITECTURE.md) — Project architecture
- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Docs](https://testing-library.com/)
