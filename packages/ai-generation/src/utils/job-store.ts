/**
 * In-memory generation job store and lifecycle helpers.
 *
 * Follows the same pattern as the render job store in the Studio API:
 * a simple Map<id, GenerationJob> that is queried/mutated by handlers.
 *
 * A clear upgrade path to disk-persistence exists: replace the Map with
 * a loader similar to loadProjectsFromDisk() in apps/studio/src/storage.ts.
 */

import type { GenerationJob, GenerationJobOutput } from "@studio/shared-types";

export const generationJobStore = new Map<string, GenerationJob>();

export function clearGenerationJobStore(): void {
  generationJobStore.clear();
}

/** Generate a pseudo-UUID compatible with the existing generateId() pattern */
export function generateJobId(): string {
  const hex = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0");
  return `gen-${hex()}${hex()}-${hex()}-4${hex().slice(1)}-a${hex().slice(1)}-${hex()}${hex()}${hex()}`;
}

export function createJobRecord(
  id: string,
  args: Omit<GenerationJob, "id" | "status" | "progress" | "outputs" | "assetIds" | "error" | "createdAt" | "startedAt" | "completedAt">,
): GenerationJob {
  const job: GenerationJob = {
    ...args,
    id,
    status: "queued",
    progress: null,
    outputs: [],
    assetIds: [],
    error: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
  };
  generationJobStore.set(id, job);
  return job;
}

export function updateJobStatus(
  id: string,
  status: GenerationJob["status"],
  extra: Partial<Pick<GenerationJob, "progress" | "error" | "completedAt">> = {},
): GenerationJob | undefined {
  const job = generationJobStore.get(id);
  if (!job) return undefined;
  const updated: GenerationJob = {
    ...job,
    status,
    startedAt: status === "running" && !job.startedAt ? new Date().toISOString() : job.startedAt,
    completedAt:
      (status === "completed" || status === "failed" || status === "cancelled")
        ? (extra.completedAt ?? new Date().toISOString())
        : job.completedAt,
    ...extra,
  };
  generationJobStore.set(id, updated);
  return updated;
}

export function addJobOutput(
  id: string,
  step: string,
  data: unknown,
): GenerationJob | undefined {
  const job = generationJobStore.get(id);
  if (!job) return undefined;
  const output: GenerationJobOutput = {
    step,
    data,
    completedAt: new Date().toISOString(),
  };
  const updated: GenerationJob = { ...job, outputs: [...job.outputs, output] };
  generationJobStore.set(id, updated);
  return updated;
}

export function addJobAsset(id: string, assetId: string): GenerationJob | undefined {
  const job = generationJobStore.get(id);
  if (!job) return undefined;
  if (job.assetIds.includes(assetId)) return job;
  const updated: GenerationJob = { ...job, assetIds: [...job.assetIds, assetId] };
  generationJobStore.set(id, updated);
  return updated;
}
