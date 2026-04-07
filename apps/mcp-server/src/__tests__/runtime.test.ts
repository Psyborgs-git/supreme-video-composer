import { describe, expect, it } from "vitest";
import { resolveTransportMode } from "../runtime";

describe("resolveTransportMode", () => {
  it("prefers explicit stdio transport", () => {
    expect(resolveTransportMode(["--transport=stdio"], {}, true)).toBe("stdio");
  });

  it("prefers explicit http transport", () => {
    expect(resolveTransportMode(["--transport=http"], {}, false)).toBe("http");
  });

  it("uses HTTP in auto mode when stdin is a TTY", () => {
    expect(resolveTransportMode([], {}, true)).toBe("http");
  });

  it("uses stdio in auto mode when stdin is not a TTY", () => {
    expect(resolveTransportMode([], {}, false)).toBe("stdio");
  });
});
