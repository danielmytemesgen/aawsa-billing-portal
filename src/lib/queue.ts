import { resolve as pathResolve } from 'path';
import { promises as fsPromises } from 'fs';
import { Queue as BullQueue, Job as BullJob, Worker as BullWorker } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL || '';

// ---------- Redis (bullmq) implementation ----------
let redisQueue: BullQueue | null = null;
if (REDIS_URL) {
  redisQueue = new BullQueue('billJobs', { connection: { url: REDIS_URL } });
}

// ---------- File‑based fallback implementation ----------
const QUEUE_FILE = pathResolve(__dirname, '../../queue.json');

/** Ensure queue file exists */
async function ensureQueueFile() {
  try {
    await fsPromises.access(QUEUE_FILE);
  } catch {
    await fsPromises.writeFile(QUEUE_FILE, JSON.stringify([]), 'utf8');
  }
}

/** Push a job ID onto the queue */
export async function enqueueJob(jobId: string): Promise<void> {
  if (redisQueue) {
    await redisQueue.add('job', { jobId });
    return;
  }
  await ensureQueueFile();
  const data = JSON.parse(await fsPromises.readFile(QUEUE_FILE, 'utf8')) as string[];
  data.push(jobId);
  await fsPromises.writeFile(QUEUE_FILE, JSON.stringify(data), 'utf8');
}

/** Pop the next job ID from the queue */
export async function dequeueJob(): Promise<string | null> {
  if (redisQueue) {
    const job = await (redisQueue as any).getNextJob();
    if (!job) return null;
    const { jobId } = job.data as { jobId: string };
    await job.remove();
    return jobId;
  }
  await ensureQueueFile();
  const data = JSON.parse(await fsPromises.readFile(QUEUE_FILE, 'utf8')) as string[];
  if (data.length === 0) return null;
  const jobId = data.shift() as string;
  await fsPromises.writeFile(QUEUE_FILE, JSON.stringify(data), 'utf8');
  return jobId;
}

/** Optional helper to clear the queue (useful for tests) */
export async function clearQueue(): Promise<void> {
  if (redisQueue) {
    await (redisQueue as any).empty();
    return;
  }
  await fsPromises.writeFile(QUEUE_FILE, JSON.stringify([]), 'utf8');
}
