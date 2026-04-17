/**
 * Synthesia provider adapter — AI talking-head video generation.
 *
 * Env: SYNTHESIA_API_KEY
 *
 * Reference: https://docs.synthesia.io/reference/createvideo
 * Async: POST /videos → { id }  →  GET /videos/{id} → { status, download }
 */

import type {
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoProviderAdapter,
} from "./types.js";

const BASE = "https://api.synthesia.io/v2";
const POLL_INTERVAL_MS = 10_000;
const MAX_POLLS = 180; // ~30 min (Synthesia renders can be slow)

function getKey(): string {
  const key = process.env.SYNTHESIA_API_KEY;
  if (!key) throw new Error("SYNTHESIA_API_KEY is not set");
  return key;
}

async function synFetch<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: getKey(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Synthesia ${method} ${path} error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export class SynthesiaVideoProvider implements VideoProviderAdapter {
  readonly provider = "synthesia";

  /** avatarId defaults to the Synthesia free test avatar */
  constructor(
    private readonly avatarId = "anna_costume1_cameraA",
    private readonly voiceId = "en-US-JennyNeural",
  ) {}

  async generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResult> {
    type StartResponse = { id: string };
    type PollResponse = {
      status: "in_progress" | "complete" | "failed";
      download?: string;
    };

    const { id } = await synFetch<StartResponse>("POST", "/videos", {
      title: req.prompt.slice(0, 100),
      description: req.prompt,
      visibility: "private",
      test: false,
      scenes: [
        {
          avatar: this.avatarId,
          voice: this.voiceId,
          script: req.prompt,
          background: req.imageUrl ?? "#000000",
        },
      ],
    });

    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL_MS);
      const poll = await synFetch<PollResponse>("GET", `/videos/${id}`);
      if (poll.status === "complete" && poll.download) {
        return { url: poll.download, mimeType: "video/mp4" };
      }
      if (poll.status === "failed") {
        throw new Error("Synthesia video generation failed");
      }
    }
    throw new Error("Synthesia generation timed out");
  }
}
