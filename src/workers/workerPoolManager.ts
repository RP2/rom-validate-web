// Web Worker Pool Manager for parallel file hashing
// Manages a pool of workers to process multiple files concurrently

export interface PooledHashResult {
  md5: string;
  sha1: string;
  crc32: string;
}

export interface PoolOptions {
  workerCount: number;
  onProgress?: (fileId: string, progress: number) => void;
  onComplete?: (fileId: string, hashes: PooledHashResult) => void;
  onError?: (fileId: string, error: Error) => void;
}

interface PendingOperation {
  resolve: (value: PooledHashResult) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: number) => void;
}

class WorkerPool {
  private workers: Worker[] = [];
  private pendingOperations = new Map<string, PendingOperation>();
  private availableWorkers: Worker[] = [];
  private queue: Array<{ file: File; fileId: string }> = [];
  private messageId = 0;
  private workerCount: number;
  private onProgress?: (fileId: string, progress: number) => void;
  private onComplete?: (fileId: string, hashes: PooledHashResult) => void;
  private onError?: (fileId: string, error: Error) => void;

  constructor(options: PoolOptions) {
    this.workerCount = options.workerCount;
    this.onProgress = options.onProgress;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
  }

  async initialize(): Promise<void> {
    for (let i = 0; i < this.workerCount; i++) {
      const worker = new Worker(new URL("./hashWorker.ts", import.meta.url), {
        type: "module",
      });

      worker.onmessage = this.handleMessage.bind(this);
      worker.onerror = (error) => {
        console.error(`Worker ${i} error:`, error);
      };

      this.workers.push(worker);
      this.availableWorkers.push(worker);
    }
  }

  private handleMessage(event: MessageEvent): void {
    const data = event.data;
    const operation = this.pendingOperations.get(data.fileId);

    if (!operation) {
      return;
    }

    switch (data.type) {
      case "PROGRESS":
        this.onProgress?.(data.fileId, data.progress);
        operation.onProgress?.(data.progress);
        break;
      case "COMPLETE":
        this.pendingOperations.delete(data.fileId);
        operation.resolve(data.hashes);
        this.onComplete?.(data.fileId, data.hashes);
        this.processQueue();
        break;
      case "ERROR":
        this.pendingOperations.delete(data.fileId);
        const error = new Error(data.error);
        if (data.fatal) {
          error.name = "OutOfMemoryError";
        }
        operation.reject(error);
        this.onError?.(data.fileId, error);
        this.processQueue();
        break;
    }
  }

  private processQueue(): void {
    while (this.availableWorkers.length > 0 && this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) break;

      const worker = this.availableWorkers.pop();
      if (!worker) break;

      this.runTask(worker, next.file, next.fileId);
    }
  }

  private runTask(worker: Worker, file: File, fileId: string): void {
    worker.postMessage({
      type: "HASH_FILE",
      file,
      fileId,
    });
  }

  hashFile(
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<PooledHashResult> {
    const fileId = `hash-${++this.messageId}-${file.name}`;

    return new Promise((resolve, reject) => {
      this.pendingOperations.set(fileId, { resolve, reject, onProgress });

      if (this.availableWorkers.length > 0) {
        const worker = this.availableWorkers.pop()!;
        this.runTask(worker, file, fileId);
      } else {
        this.queue.push({ file, fileId });
      }
    });
  }

  async terminate(): Promise<void> {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.availableWorkers = [];
    this.pendingOperations.clear();
    this.queue = [];
  }
  getWorkerCount(): number {
    return this.workers.length;
  }
}

let pool: WorkerPool | null = null;

export async function initializePool(options: PoolOptions): Promise<void> {
  if (pool) {
    await pool.terminate();
  }
  pool = new WorkerPool(options);
  await pool.initialize();
}

export async function hashFileWithPool(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<PooledHashResult> {
  if (!pool) {
    throw new Error("Worker pool not initialized. Call initializePool first.");
  }
  return pool.hashFile(file, onProgress);
}

export async function terminatePool(): Promise<void> {
  if (pool) {
    await pool.terminate();
    pool = null;
  }
}

export function getPoolSize(): number {
  return pool ? pool.getWorkerCount() : 0;
}
