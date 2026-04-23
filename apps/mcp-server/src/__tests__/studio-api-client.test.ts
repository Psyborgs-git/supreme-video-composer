import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { StudioApiClient, StudioApiError } from "../studio-api-client";

const envKey = "STUDIO_API_TIMEOUT_MS";
const initialTimeoutEnv = process.env[envKey];

afterEach(() => {
  if (initialTimeoutEnv === undefined) {
    delete process.env[envKey];
  } else {
    process.env[envKey] = initialTimeoutEnv;
  }
});

describe("StudioApiClient", () => {
  it("fails fast with a timeout error when the backend is too slow", async () => {
    process.env[envKey] = "10";

    const server = createServer((_req, res) => {
      setTimeout(() => {
        const body = JSON.stringify([]);
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        });
        res.end(body);
      }, 100);
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected test server to bind to a TCP address");
    }

    const client = new StudioApiClient(`http://127.0.0.1:${address.port}`);

    await expect(client.listProjects()).rejects.toMatchObject({
      status: 504,
    });

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });
});
