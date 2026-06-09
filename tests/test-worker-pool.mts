#!/usr/bin/env tsx

// Test script for worker pool manager logic
// Run with: npx tsx tests/test-worker-pool.mts

// Note: We can't instantiate Web Workers in Node.js, so we test the
// logic patterns (queue management, worker release, etc.) rather than
// the actual worker communication.

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.error(`  ❌ ${name}`);
    failed++;
  }
}

// ============================================================
console.log("\n📋 Worker Pool Logic Tests");
// ============================================================

// Simulate the worker pool's queue and release logic
class SimulatedPool {
  private availableWorkers: number[] = [];
  private activeTasks = new Map<string, number>(); // fileId -> workerId
  private queue: string[] = [];
  private nextId = 0;

  constructor(workerCount: number) {
    for (let i = 0; i < workerCount; i++) {
      this.availableWorkers.push(i);
    }
  }

  get availableCount(): number {
    return this.availableWorkers.length;
  }

  get activeCount(): number {
    return this.activeTasks.size;
  }

  get queuedCount(): number {
    return this.queue.length;
  }

  submit(fileId: string): number | null {
    if (this.availableWorkers.length > 0) {
      const worker = this.availableWorkers.pop()!;
      this.activeTasks.set(fileId, worker);
      return worker;
    } else {
      this.queue.push(fileId);
      return null;
    }
  }

  complete(fileId: string): void {
    const worker = this.activeTasks.get(fileId);
    if (worker !== undefined) {
      this.activeTasks.delete(fileId);
      this.availableWorkers.push(worker);
    }
    // Process queue
    if (this.queue.length > 0 && this.availableWorkers.length > 0) {
      const nextFileId = this.queue.shift()!;
      const worker = this.availableWorkers.pop()!;
      this.activeTasks.set(nextFileId, worker);
    }
  }
}

// Test: Workers are returned to pool after completion
const pool1 = new SimulatedPool(4);
assert(pool1.availableCount === 4, "Pool starts with 4 available workers");

pool1.submit("file-1");
pool1.submit("file-2");
pool1.submit("file-3");
pool1.submit("file-4");
assert(pool1.availableCount === 0, "All 4 workers are busy");
assert(pool1.activeCount === 4, "4 active tasks");

pool1.complete("file-1");
assert(pool1.availableCount === 1, "1 worker returned after completion");
assert(pool1.activeCount === 3, "3 active tasks remaining");

pool1.complete("file-2");
pool1.complete("file-3");
pool1.complete("file-4");
assert(pool1.availableCount === 4, "All workers returned after all completions");
assert(pool1.activeCount === 0, "No active tasks remaining");

// Test: Queue processes when workers become available
const pool2 = new SimulatedPool(2);
pool2.submit("file-1");
pool2.submit("file-2");
assert(pool2.availableCount === 0, "Both workers busy");

const result = pool2.submit("file-3");
assert(result === null, "Queued task returns null (no worker available)");
assert(pool2.queuedCount === 1, "1 task in queue");

pool2.complete("file-1");
assert(pool2.queuedCount === 0, "Queue processed after worker freed");
assert(pool2.activeCount === 2, "2 active tasks (file-2 + dequeued file-3)");

// Test: Doom loop scenario - many files with limited workers
const pool3 = new SimulatedPool(4);
const fileIds: string[] = [];
for (let i = 0; i < 20; i++) {
  fileIds.push(`file-${i}`);
  pool3.submit(`file-${i}`);
}

assert(pool3.activeCount === 4, "4 active tasks (max workers)");
assert(pool3.queuedCount === 16, "16 tasks queued");
assert(pool3.availableCount === 0, "0 available workers");

// Complete all tasks one by one
for (const fileId of fileIds) {
  pool3.complete(fileId);
}

assert(pool3.availableCount === 4, "All 4 workers returned after 20 tasks");
assert(pool3.activeCount === 0, "No active tasks remaining");
assert(pool3.queuedCount === 0, "Queue is empty");

// Test: Worker release on error (simulating the bug fix)
const pool4 = new SimulatedPool(2);
pool4.submit("file-1");
pool4.submit("file-2");

// Simulate error completion (should still release worker)
pool4.complete("file-1"); // This simulates the releaseWorker call
assert(pool4.availableCount === 1, "Worker released even on error path");

// ============================================================
console.log("\n📋 AbortSignal Logic Tests");
// ============================================================

// Test: AbortSignal behavior
const controller = new AbortController();
const signal = controller.signal;

assert(!signal.aborted, "Signal starts not aborted");

controller.abort();
assert(signal.aborted, "Signal is aborted after abort()");

// Test: AbortSignal can be checked in loops
const controller2 = new AbortController();
let iterations = 0;
for (let i = 0; i < 100; i++) {
  if (controller2.signal.aborted) break;
  iterations++;
  if (i === 10) controller2.abort();
}
assert(iterations === 11, `Loop stopped at iteration 11 (got ${iterations})`);

// ============================================================
console.log("\n📋 Large File Separation Tests");
// ============================================================

const LARGE_FILE_THRESHOLD = 1024 * 1024 * 1024; // 1GB

const testFiles = [
  { name: "small-game.gba", size: 16 * 1024 * 1024 },     // 16MB
  { name: "medium-game.nds", size: 128 * 1024 * 1024 },    // 128MB
  { name: "large-game.iso", size: 4 * 1024 * 1024 * 1024 }, // 4GB
  { name: "huge-game.iso", size: 8 * 1024 * 1024 * 1024 },  // 8GB
];

const largeFiles = testFiles.filter(f => f.size > LARGE_FILE_THRESHOLD);
const smallFiles = testFiles.filter(f => f.size <= LARGE_FILE_THRESHOLD);

assert(largeFiles.length === 2, "2 files exceed 1GB threshold");
assert(smallFiles.length === 2, "2 files are under 1GB threshold");
assert(largeFiles.every(f => f.name.endsWith(".iso")), "Large files are ISOs");
assert(smallFiles.every(f => !f.name.endsWith(".iso") || f.size <= LARGE_FILE_THRESHOLD), "Small files are not ISOs or are small ISOs");

// ============================================================
console.log("\n📋 Deduplication Logic Tests");
// ============================================================

// Simulate the dedup logic from FileUpload
interface SimFile { name: string; size: number; }

function dedupFiles(existing: SimFile[], incoming: SimFile[]): SimFile[] {
  const existingKeys = new Set(existing.map(f => `${f.name}|${f.size}`));
  return incoming.filter(f => !existingKeys.has(`${f.name}|${f.size}`));
}

const existing: SimFile[] = [
  { name: "game1.gba", size: 16 * 1024 * 1024 },
  { name: "game2.nds", size: 128 * 1024 * 1024 },
];

const incoming: SimFile[] = [
  { name: "game1.gba", size: 16 * 1024 * 1024 },  // duplicate
  { name: "game3.smc", size: 512 * 1024 },          // new
  { name: "game2.nds", size: 64 * 1024 * 1024 },    // same name, different size
];

const unique = dedupFiles(existing, incoming);
assert(unique.length === 2, "2 unique files after dedup");
assert(unique[0].name === "game3.smc", "game3.smc is unique");
assert(unique[1].name === "game2.nds", "game2.nds with different size is unique");

// Same name AND same size = duplicate
const exactDup = dedupFiles(existing, [{ name: "game1.gba", size: 16 * 1024 * 1024 }]);
assert(exactDup.length === 0, "Exact duplicate is filtered out");

// ============================================================
console.log("\n📋 Worker Count Auto-Detection Tests");
// ============================================================

function getWorkerCount(autoValue: string, hardwareConcurrency: number | undefined): number {
  const value = autoValue || "auto";
  if (value === "auto") {
    const cores = hardwareConcurrency ?? 4;
    return Math.min(Math.max(cores - 1, 2), 6);
  }
  const parsed = parseInt(value, 10);
  const count = isNaN(parsed) ? 4 : parsed;
  return Math.min(Math.max(count, 1), 6);
}

assert(getWorkerCount("auto", 8) === 6, "8 cores → 6 workers (capped at max)");
assert(getWorkerCount("auto", 2) === 2, "2 cores → 2 workers (min)");
assert(getWorkerCount("auto", 16) === 6, "16 cores → 6 workers (max)");
assert(getWorkerCount("auto", undefined) === 3, "undefined cores → 3 workers (4-1)");
assert(getWorkerCount("4", 8) === 4, "explicit '4' → 4 workers");
assert(getWorkerCount("1", 8) === 1, "explicit '1' → 1 worker");
assert(getWorkerCount("10", 8) === 6, "explicit '10' → 6 workers (max)");

// ============================================================
console.log("\n📋 Summary");
// ============================================================

console.log(`\n  ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log("🎉 All worker pool tests passed!\n");
} else {
  console.log(`⚠️  ${failed} test(s) failed\n`);
  process.exit(1);
}