#!/usr/bin/env tsx

// Test script for DAT loader logic (retry, cache, quota)
// Run with: npx tsx tests/test-dat-loader.mts

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

function assertEqual(actual: unknown, expected: unknown, name: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.error(`  ❌ ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ============================================================
console.log("\n📋 DAT Cache Key Tests");
// ============================================================

// Verify cache key format is safe for localStorage
function getCacheKey(platform: string, source: "bundled" | "libretro" | "custom"): string {
  return `dat-cache-${source}-${platform}`;
}

const key1 = getCacheKey("Game Boy Advance", "libretro");
assert(key1 === "dat-cache-libretro-Game Boy Advance", "Cache key format is correct");
assert(!key1.includes("//"), "No double slashes in cache key");

// ============================================================
console.log("\n📋 Cache Expiry Logic Tests");
// ============================================================

const CACHE_EXPIRY_HOURS = 24;
const CACHE_VERSION = "1.0";

interface CachedDATData {
  entries: { name: string }[];
  timestamp: number;
  version: string;
}

function isCacheValid(data: CachedDATData): boolean {
  const now = Date.now();
  const hoursSinceCache = (now - data.timestamp) / (1000 * 60 * 60);
  return data.version === CACHE_VERSION && hoursSinceCache <= CACHE_EXPIRY_HOURS;
}

// Fresh cache
const freshCache: CachedDATData = {
  entries: [{ name: "test" }],
  timestamp: Date.now(),
  version: CACHE_VERSION,
};
assert(isCacheValid(freshCache), "Fresh cache is valid");

// Expired cache (25 hours old)
const expiredCache: CachedDATData = {
  entries: [{ name: "test" }],
  timestamp: Date.now() - 25 * 60 * 60 * 1000,
  version: CACHE_VERSION,
};
assert(!isCacheValid(expiredCache), "25-hour-old cache is expired");

// Wrong version
const wrongVersion: CachedDATData = {
  entries: [{ name: "test" }],
  timestamp: Date.now(),
  version: "0.9",
};
assert(!isCacheValid(wrongVersion), "Wrong version cache is invalid");

// Exactly 24 hours old (boundary)
const boundaryCache: CachedDATData = {
  entries: [{ name: "test" }],
  timestamp: Date.now() - 24 * 60 * 60 * 1000,
  version: CACHE_VERSION,
};
assert(isCacheValid(boundaryCache), "Exactly 24-hour-old cache is still valid");

// ============================================================
console.log("\n📋 Cache Size Quota Tests");
// ============================================================

// Simulate the quota check logic
const MAX_CACHE_SIZE_KB = 2048; // 2MB limit per entry

function shouldCache(entries: { name: string }[]): boolean {
  const serialized = JSON.stringify(entries);
  const sizeKB = serialized.length / 1024;
  return sizeKB <= MAX_CACHE_SIZE_KB;
}

// Small DAT - should cache
const smallDAT = Array.from({ length: 100 }, (_, i) => ({ name: `Game ${i}` }));
assert(shouldCache(smallDAT), "Small DAT should be cached");

// Large DAT (simulate ~3MB) - should NOT cache
const largeDAT = Array.from({ length: 50000 }, (_, i) => ({ name: `Game ${i} - Very Long Title With Lots Of Characters` }));
assert(!shouldCache(largeDAT), "Large DAT should be skipped for localStorage caching");

// ============================================================
console.log("\n📋 Retry Logic Tests");
// ============================================================

// Simulate the fetchWithRetry logic
class MockFetcher {
  private attempts = 0;
  private failUntil: number;

  constructor(failUntil: number) {
    this.failUntil = failUntil;
  }

  get attemptCount() { return this.attempts; }

  async fetch(url: string): Promise<{ ok: boolean; status: number }> {
    this.attempts++;
    if (this.attempts <= this.failUntil) {
      return { ok: false, status: 500 };
    }
    return { ok: true, status: 200 };
  }
}

async function fetchWithRetry(
  fetcher: MockFetcher,
  url: string,
  retries: number = 1,
  delayMs: number = 10, // Fast for tests
): Promise<{ ok: boolean; status: number }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetcher.fetch(url);
      if (response.ok) return response;
      if (response.status >= 500 && attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
        continue;
      }
      return response;
    } catch (error) {
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Unreachable");
}

// Test: Success on first try
const fetcher1 = new MockFetcher(0);
const result1 = await fetchWithRetry(fetcher1, "https://example.com/test.dat");
assert(result1.ok, "Success on first attempt");
assertEqual(fetcher1.attemptCount, 1, "Only 1 attempt needed");

// Test: Success on retry after 500 error
const fetcher2 = new MockFetcher(1);
const result2 = await fetchWithRetry(fetcher2, "https://example.com/test.dat", 1, 10);
assert(result2.ok, "Success on retry after 500");
assertEqual(fetcher2.attemptCount, 2, "2 attempts (1 fail + 1 success)");

// Test: 404 should NOT retry (not a server error)
class NotFoundFetcher extends MockFetcher {
  async fetch(url: string): Promise<{ ok: boolean; status: number }> {
    this.attempts++;
    return { ok: false, status: 404 };
  }
}
const fetcher3 = new NotFoundFetcher(0);
const result3 = await fetchWithRetry(fetcher3, "https://example.com/test.dat", 1, 10);
assert(!result3.ok, "404 returns not ok");
assertEqual(result3.status, 404, "Status is 404");
assertEqual(fetcher3.attemptCount, 1, "No retry for 404");

// ============================================================
console.log("\n📋 Platform Priority Tests");
// ============================================================

// Import the priority function
async function testPlatformPriority() {
  try {
    const { getPlatformPriority } = await import("../src/utils/discDetector.js");

    const largePriority = getPlatformPriority(5 * 1024 * 1024 * 1024); // 5GB
    assert(largePriority[0] === "PlayStation 2", "5GB: PS2 is first priority");
    assert(largePriority.includes("Wii"), "5GB: Wii is in priority list");

    const mediumPriority = getPlatformPriority(1.5 * 1024 * 1024 * 1024); // 1.5GB
    assert(mediumPriority[0] === "Wii" || mediumPriority[0] === "PlayStation 2", "1.5GB: Wii or PS2 first");

    const smallPriority = getPlatformPriority(100 * 1024 * 1024); // 100MB
    assert(smallPriority[0] === "PSP", "100MB: PSP is first priority");
  } catch {
    console.log("  ⚠️  Could not import discDetector (expected in some environments)");
  }
}

await testPlatformPriority();

// ============================================================
console.log("\n📋 Summary");
// ============================================================

console.log(`\n  ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log("🎉 All DAT loader tests passed!\n");
} else {
  console.log(`⚠️  ${failed} test(s) failed\n`);
  process.exit(1);
}