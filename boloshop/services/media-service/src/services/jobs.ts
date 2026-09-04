/**
 * Render job tracking.
 *
 * A 15-second promo takes seconds to minutes of CPU, which is far too long to
 * hold an HTTP request open on a Pakistani mobile connection. So the route
 * accepts the work, returns a job id, and the client polls.
 *
 * IN-MEMORY AND PER-PROCESS, like the OTP store in the gateway: a job created
 * on pod A cannot be polled from pod B, and a restart loses every job. This
 * wants a real queue (Redis, which the architecture already calls for) before
 * running more than one instance.
 */

import { randomUUID } from 'node:crypto';

export type JobStatus = 'queued' | 'rendering' | 'completed' | 'failed';

export interface RenderJob {
  id: string;
  status: JobStatus;
  sellerId: string;
  title: string;
  pricePkr: string;
  imageCount: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  /** Set once the render succeeds. */
  video?: {
    url: string;
    width: number;
    height: number;
    duration_seconds: number;
    bytes: number;
    render_ms: number;
  };
  /** Set once the render fails. */
  error?: { code: string; message: string };
}

const jobs = new Map<string, RenderJob>();

/** Finished jobs are dropped after this long so the map cannot grow forever. */
const JOB_RETENTION_MS = 60 * 60 * 1000;

function evictOld(): void {
  const cutoff = Date.now() - JOB_RETENTION_MS;
  for (const [id, job] of jobs) {
    if (job.finishedAt && Date.parse(job.finishedAt) < cutoff) jobs.delete(id);
  }
}

export function createJob(input: {
  sellerId: string;
  title: string;
  pricePkr: string;
  imageCount: number;
}): RenderJob {
  evictOld();

  const job: RenderJob = {
    id: randomUUID(),
    status: 'queued',
    sellerId: input.sellerId,
    title: input.title,
    pricePkr: input.pricePkr,
    imageCount: input.imageCount,
    createdAt: new Date().toISOString(),
  };

  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): RenderJob | undefined {
  return jobs.get(id);
}

export function markRendering(id: string): void {
  const job = jobs.get(id);
  if (!job) return;
  job.status = 'rendering';
  job.startedAt = new Date().toISOString();
}

export function markCompleted(id: string, video: NonNullable<RenderJob['video']>): void {
  const job = jobs.get(id);
  if (!job) return;
  job.status = 'completed';
  job.finishedAt = new Date().toISOString();
  job.video = video;
}

export function markFailed(id: string, error: { code: string; message: string }): void {
  const job = jobs.get(id);
  if (!job) return;
  job.status = 'failed';
  job.finishedAt = new Date().toISOString();
  job.error = error;
}

/** Test hook. */
export function resetJobs(): void {
  jobs.clear();
}
