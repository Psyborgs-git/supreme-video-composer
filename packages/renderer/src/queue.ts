import { EventEmitter } from "node:events";
import type { RenderJob, RenderProgress, RenderStatus, ExportFormat, AspectRatioConfig } from "@studio/shared-types";

interface QueueItem {
  job: RenderJob;
  resolve: (job: RenderJob) => void;
  reject: (error: Error) => void;
}

export class RenderQueue extends EventEmitter {
  private queue: QueueItem[] = [];
  private activeJob: QueueItem | null = null;
  private jobs = new Map<string, RenderJob>();
  private renderFn: ((job: RenderJob, onProgress: (progress: RenderProgress) => void) => Promise<string>) | null = null;

  setRenderFunction(
    fn: (job: RenderJob, onProgress: (progress: RenderProgress) => void) => Promise<string>,
  ) {
    this.renderFn = fn;
  }

  enqueue(job: RenderJob): Promise<RenderJob> {
    this.jobs.set(job.id, job);
    this.emit("job:queued", job);

    return new Promise<RenderJob>((resolve, reject) => {
      this.queue.push({ job, resolve, reject });
      this.processNext();
    });
  }

  getJob(id: string): RenderJob | undefined {
    return this.jobs.get(id);
  }

  getAllJobs(): RenderJob[] {
    return Array.from(this.jobs.values());
  }

  cancelJob(id: string): boolean {
    // Remove from queue if not yet started
    const idx = this.queue.findIndex((item) => item.job.id === id);
    if (idx !== -1) {
      const [removed] = this.queue.splice(idx, 1);
      removed.job.status = "cancelled";
      this.jobs.set(id, removed.job);
      removed.resolve(removed.job);
      this.emit("job:cancelled", removed.job);
      return true;
    }
    // Cancel active job via status flag (renderer checks this)
    if (this.activeJob?.job.id === id) {
      this.activeJob.job.status = "cancelled";
      this.jobs.set(id, this.activeJob.job);
      this.emit("job:cancelled", this.activeJob.job);
      return true;
    }
    return false;
  }

  private async processNext(): Promise<void> {
    if (this.activeJob || this.queue.length === 0 || !this.renderFn) {
      return;
    }

    const item = this.queue.shift()!;
    this.activeJob = item;

    const job = item.job;
    job.status = "bundling";
    job.startedAt = new Date().toISOString();
    this.jobs.set(job.id, job);
    this.emit("job:started", job);

    try {
      const onProgress = (progress: RenderProgress) => {
        job.progress = progress;
        job.status = progress.stage;
        this.jobs.set(job.id, job);
        this.emit("job:progress", job);

        // Check for cancellation
        if ((job as any).__cancelRequested) {
          throw new Error("Render cancelled");
        }
      };

      const outputPath = await this.renderFn(job, onProgress);

      if (job.status === ("cancelled" as RenderStatus)) {
        item.resolve(job);
      } else {
        job.status = "complete";
        job.outputPath = outputPath;
        job.completedAt = new Date().toISOString();
        this.jobs.set(job.id, job);
        this.emit("job:complete", job);
        item.resolve(job);
      }
    } catch (error) {
      job.status = "error";
      job.error = error instanceof Error ? error.message : String(error);
      job.completedAt = new Date().toISOString();
      this.jobs.set(job.id, job);
      this.emit("job:error", job);
      item.reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.activeJob = null;
      this.processNext();
    }
  }
}
