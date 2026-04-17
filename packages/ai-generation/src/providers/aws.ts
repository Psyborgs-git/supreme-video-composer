/**
 * AWS provider adapter — image (Bedrock Titan Image Generator) + video (Nova Reel).
 *
 * Env:
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   AWS_REGION  (default: "us-east-1")
 *
 * This implementation uses the Bedrock runtime REST API directly (no SDK dependency).
 * For production use, the AWS SDK v3 can be swapped in for proper SigV4 signing.
 *
 * Note: SigV4 signing is handled inline using the Web Crypto API.
 */

import crypto from "node:crypto";
import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProviderAdapter,
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoProviderAdapter,
} from "./types.js";

const POLL_INTERVAL_MS = 8_000;
const MAX_POLLS = 75; // ~10 min for Nova Reel

function getConfig() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION ?? "us-east-1";
  if (!accessKeyId) throw new Error("AWS_ACCESS_KEY_ID is not set");
  if (!secretAccessKey) throw new Error("AWS_SECRET_ACCESS_KEY is not set");
  return { accessKeyId, secretAccessKey, region };
}

// ─── SigV4 signing ────────────────────────────────────────────────────────────

function hmac(key: Buffer, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function getSigningKey(secretKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac(Buffer.from(`AWS4${secretKey}`), dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

async function bedrockPost<T>(
  region: string,
  accessKeyId: string,
  secretAccessKey: string,
  modelId: string,
  body: unknown,
): Promise<T> {
  const service = "bedrock";
  const host = `bedrock-runtime.${region}.amazonaws.com`;
  const path = `/model/${encodeURIComponent(modelId)}/invoke`;
  const payload = JSON.stringify(body);
  const payloadHash = crypto.createHash("sha256").update(payload).digest("hex");

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);

  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-date";
  const canonicalRequest = `POST\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${crypto.createHash("sha256").update(canonicalRequest).digest("hex")}`;

  const signingKey = getSigningKey(secretAccessKey, dateStamp, region, service);
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `https://${host}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Host: host,
      "X-Amz-Date": amzDate,
      Authorization: authorization,
    },
    body: payload,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`AWS Bedrock error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ─── Image provider (Titan Image Generator) ───────────────────────────────────

export class AWSImageProvider implements ImageProviderAdapter {
  readonly provider = "aws";

  constructor(private readonly modelId = "amazon.titan-image-generator-v2:0") {}

  async generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const { accessKeyId, secretAccessKey, region } = getConfig();

    type TitanResponse = {
      images: string[];
      error?: string;
    };

    const numberOfImages = Math.min(req.count ?? 1, 5);
    const resp = await bedrockPost<TitanResponse>(
      region,
      accessKeyId,
      secretAccessKey,
      this.modelId,
      {
        taskType: "TEXT_IMAGE",
        textToImageParams: {
          text: req.prompt,
          negativeText: req.negativePrompt ?? "",
        },
        imageGenerationConfig: {
          numberOfImages,
          width: req.width ?? 1024,
          height: req.height ?? 1024,
          cfgScale: 8.0,
        },
      },
    );

    if (resp.error) throw new Error(`Titan Image: ${resp.error}`);
    const urls = (resp.images ?? []).map((b64) => `data:image/png;base64,${b64}`);
    return { urls };
  }
}

// ─── Video provider (Amazon Nova Reel) ────────────────────────────────────────

export class AWSVideoProvider implements VideoProviderAdapter {
  readonly provider = "aws";

  constructor(private readonly modelId = "amazon.nova-reel-v1:0") {}

  async generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResult> {
    const { accessKeyId, secretAccessKey, region } = getConfig();

    // Nova Reel uses async invocation via bedrock-runtime StartAsyncInvoke
    const host = `bedrock-runtime.${region}.amazonaws.com`;
    const path = "/async-invoke";
    const outputBucket = process.env.AWS_S3_OUTPUT_BUCKET ?? "";

    if (!outputBucket) {
      throw new Error("AWS_S3_OUTPUT_BUCKET is required for Nova Reel video generation");
    }

    const payload = JSON.stringify({
      modelId: this.modelId,
      modelInput: {
        taskType: "TEXT_VIDEO",
        textToVideoParams: {
          text: req.prompt,
          ...(req.imageUrl && {
            // Nova Reel requires base64-encoded image bytes, not a URL.
            // If the URL is a data URI, strip the prefix; otherwise fetch and encode.
            images: [
              {
                format: "jpeg",
                source: {
                  bytes: req.imageUrl.startsWith("data:")
                    ? req.imageUrl.replace(/^data:[^;]+;base64,/, "")
                    : req.imageUrl, // URL-based references are not supported by the API; caller should pre-fetch
                },
              },
            ],
          }),
        },
        videoGenerationConfig: {
          durationSeconds: req.durationSeconds ?? 6,
          fps: 24,
          dimension: `${req.width ?? 1280}x${req.height ?? 720}`,
        },
      },
      outputDataConfig: { s3OutputDataConfig: { s3Uri: `s3://${outputBucket}/nova-reel/` } },
    });

    const payloadHash = crypto.createHash("sha256").update(payload).digest("hex");
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
    const dateStamp = amzDate.slice(0, 8);

    const credentialScope = `${dateStamp}/${region}/bedrock/aws4_request`;
    const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "content-type;host;x-amz-date";
    const canonicalRequest = `POST\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${crypto.createHash("sha256").update(canonicalRequest).digest("hex")}`;
    const signingKey = getSigningKey(secretAccessKey, dateStamp, region, "bedrock");
    const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");

    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const startRes = await fetch(`https://${host}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Host: host,
        "X-Amz-Date": amzDate,
        Authorization: authorization,
      },
      body: payload,
    });

    if (!startRes.ok) {
      const text = await startRes.text().catch(() => startRes.statusText);
      throw new Error(`Nova Reel start error ${startRes.status}: ${text}`);
    }

    type StartResponse = { invocationArn: string };
    const { invocationArn } = (await startRes.json()) as StartResponse;

    // Poll for completion via ListAsyncInvokes or GetAsyncInvoke
    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL_MS);
      const getPath = `/async-invoke/${encodeURIComponent(invocationArn)}`;
      const now2 = new Date();
      const amzDate2 = now2.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
      const dateStamp2 = amzDate2.slice(0, 8);
      const credScope2 = `${dateStamp2}/${region}/bedrock/aws4_request`;
      const getHash = crypto.createHash("sha256").update("").digest("hex");
      const getHeaders = `host:${host}\nx-amz-date:${amzDate2}\n`;
      const getSignedH = "host;x-amz-date";
      const getCanon = `GET\n${getPath}\n\n${getHeaders}\n${getSignedH}\n${getHash}`;
      const getSts = `AWS4-HMAC-SHA256\n${amzDate2}\n${credScope2}\n${crypto.createHash("sha256").update(getCanon).digest("hex")}`;
      const getSK = getSigningKey(secretAccessKey, dateStamp2, region, "bedrock");
      const getSig = crypto.createHmac("sha256", getSK).update(getSts).digest("hex");
      const getAuth = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credScope2}, SignedHeaders=${getSignedH}, Signature=${getSig}`;

      const pollRes = await fetch(`https://${host}${getPath}`, {
        headers: { Host: host, "X-Amz-Date": amzDate2, Authorization: getAuth },
      });
      if (!pollRes.ok) continue;

      type PollResponse = {
        status: "InProgress" | "Completed" | "Failed";
        outputDataConfig?: { s3OutputDataConfig?: { s3Uri?: string } };
        failureMessage?: string;
      };
      const poll = (await pollRes.json()) as PollResponse;
      if (poll.status === "Completed") {
        const s3Uri = poll.outputDataConfig?.s3OutputDataConfig?.s3Uri ?? "";
        return { url: s3Uri, mimeType: "video/mp4" };
      }
      if (poll.status === "Failed") {
        throw new Error(`Nova Reel failed: ${poll.failureMessage ?? "unknown"}`);
      }
    }
    throw new Error("Nova Reel generation timed out");
  }
}
