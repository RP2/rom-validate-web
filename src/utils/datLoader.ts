// Pre-bundled DAT files for popular platforms
// These would be included in your project's public/dats/ directory

import { parseDAT } from "./romValidator";
import type { DATEntry } from "./romValidator";
import {
  PLATFORMS,
  EXTENSION_MAP,
  ENCRYPTION_PRONE_EXTENSIONS,
  BUNDLED_DATS,
} from "./platforms";

// Re-export for consumers that import from datLoader
export { PLATFORMS, EXTENSION_MAP };

// Configuration matching the CLI version
// Base URL for Libretro database
const LIBRETRO_BASE_URL =
  "https://raw.githubusercontent.com/libretro/libretro-database/master";

// Cache for parsed DAT entries with persistent storage
const datCache = new Map<string, DATEntry[]>();

type DATSource = "bundled" | "libretro" | "custom";

// Persistent cache using IndexedDB with expiration.
// The record shape matches the old localStorage payload so existing caches
// can be migrated in place.
interface CachedDATData {
  key: string;
  platform: string;
  source: DATSource;
  entries: DATEntry[];
  timestamp: number;
  version: string;
}

const CACHE_EXPIRY_HOURS = 24; // Cache DATs for 24 hours
const CACHE_VERSION = "1.0"; // Increment to invalidate old caches

const DB_NAME = "rom-validate-web";
const DB_VERSION = 1;
const STORE_NAME = "dat-cache";
const LEGACY_CACHE_PREFIX = "dat-cache-";

let dbPromise: Promise<IDBDatabase | null> | null = null;

// Get cache key for platform
function getCacheKey(platform: string, source: DATSource): string {
  return `dat-cache-${source}-${platform}`;
}

function openCacheDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  const opening = new Promise<IDBDatabase | null>((resolve) => {
    let request: IDBOpenDBRequest;
    let settled = false;

    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      console.warn("Failed to open DAT cache database:", error);
      settled = true;
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      if (settled) {
        // A blocked open eventually succeeded; keep this session memory-only.
        db.close();
        return;
      }
      settled = true;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      console.warn("Failed to open DAT cache database:", request.error);
      if (settled) return;
      settled = true;
      resolve(null);
    };
    request.onblocked = () => {
      console.warn(
        "DAT cache database upgrade is blocked by another tab; using memory cache only",
      );
      if (settled) return;
      settled = true;
      resolve(null);
    };
  });

  dbPromise = opening;
  // Allow a later call to retry after a failed or blocked open.
  void opening.then((db) => {
    if (!db && dbPromise === opening) dbPromise = null;
  });
  return opening;
}

// Run one object-store operation and wait for the transaction to complete.
// Returns null when IndexedDB is unavailable or the operation fails.
async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const db = await openCacheDB();
  if (!db) return null;

  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      let result: T;

      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => {
        reject(request.error ?? new Error("IndexedDB request failed"));
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => {
        reject(transaction.error ?? new Error("IndexedDB transaction failed"));
      };
      transaction.onabort = () => {
        reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
      };
    });
  } catch (error) {
    console.warn("DAT cache operation failed:", error);
    return null;
  }
}

function isCacheValid(data: CachedDATData, now = Date.now()): boolean {
  const hoursSinceCache = (now - data.timestamp) / (1000 * 60 * 60);
  return (
    data.version === CACHE_VERSION &&
    hoursSinceCache >= 0 &&
    hoursSinceCache <= CACHE_EXPIRY_HOURS
  );
}

async function getCachedRecord(
  cacheKey: string,
): Promise<CachedDATData | undefined> {
  const record = await withStore<CachedDATData | undefined>(
    "readonly",
    (store) => store.get(cacheKey),
  );
  return record ?? undefined;
}

async function putCachedRecord(data: CachedDATData): Promise<boolean> {
  const result = await withStore<IDBValidKey>("readwrite", (store) =>
    store.put(data),
  );
  return result !== null;
}

async function deleteCachedRecord(cacheKey: string): Promise<void> {
  await withStore<undefined>("readwrite", (store) => store.delete(cacheKey));
}

// Move a legacy localStorage entry into IndexedDB. The legacy key is removed
// only after the write succeeds, so a failed migration can be retried.
async function migrateLegacyCache(
  platform: string,
  source: DATSource,
): Promise<DATEntry[] | null> {
  if (typeof localStorage === "undefined") return null;

  const cacheKey = getCacheKey(platform, source);
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;

    const legacy = JSON.parse(raw) as Partial<CachedDATData>;
    const entries = legacy.entries;
    if (
      !Array.isArray(entries) ||
      typeof legacy.timestamp !== "number" ||
      legacy.version !== CACHE_VERSION
    ) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    const migrated: CachedDATData = {
      key: cacheKey,
      platform,
      source,
      entries,
      timestamp: legacy.timestamp,
      version: legacy.version,
    };

    if (isCacheValid(migrated)) {
      if (await putCachedRecord(migrated)) {
        localStorage.removeItem(cacheKey);
      }
      return entries;
    }

    localStorage.removeItem(cacheKey);
    return null;
  } catch (error) {
    console.warn("Failed to migrate legacy DAT cache:", error);
    return null;
  }
}

// Move every legacy localStorage entry into IndexedDB. Runs before cache
// listings so an upgrade does not appear to lose the existing cache.
async function migrateAllLegacyCaches(): Promise<void> {
  if (typeof localStorage === "undefined") return;

  try {
    const keys = Object.keys(localStorage).filter((key) =>
      key.startsWith(LEGACY_CACHE_PREFIX),
    );
    for (const key of keys) {
      const [source, ...platformParts] = key
        .slice(LEGACY_CACHE_PREFIX.length)
        .split("-");
      if (
        source !== "bundled" &&
        source !== "libretro" &&
        source !== "custom"
      ) {
        localStorage.removeItem(key);
        continue;
      }
      await migrateLegacyCache(platformParts.join("-"), source);
    }
  } catch (error) {
    console.warn("Failed to migrate legacy DAT caches:", error);
  }
}

// Load from persistent cache
async function loadFromPersistentCache(
  platform: string,
  source: DATSource,
): Promise<DATEntry[] | null> {
  const cacheKey = getCacheKey(platform, source);
  const cached = await getCachedRecord(cacheKey);

  if (cached) {
    if (isCacheValid(cached)) return cached.entries;
    await deleteCachedRecord(cacheKey);
  }

  return migrateLegacyCache(platform, source);
}

// Save to persistent cache
async function saveToPersistentCache(
  platform: string,
  source: DATSource,
  entries: DATEntry[],
): Promise<void> {
  const cacheKey = getCacheKey(platform, source);
  await putCachedRecord({
    key: cacheKey,
    platform,
    source,
    entries,
    timestamp: Date.now(),
    version: CACHE_VERSION,
  });
}

// Get platform(s) from file extension
export function getPlatformsForFile(filename: string): string[] {
  const ext = filename
    .toLowerCase()
    .substring(filename.lastIndexOf(".")) as keyof typeof EXTENSION_MAP;
  const platforms = EXTENSION_MAP[ext];

  if (!platforms) {
    return [];
  }

  return Array.isArray(platforms) ? platforms : [platforms];
}

// Check if file extension is prone to encryption
export function isEncryptionProne(filename: string): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
  return ENCRYPTION_PRONE_EXTENSIONS.has(ext);
}

// Load bundled DAT file (for encrypted versions)
export async function loadBundledDAT(platform: string): Promise<DATEntry[]> {
  const memoryKey = `${platform}-bundled`;

  // Check memory cache first
  if (datCache.has(memoryKey)) {
    console.log(`📦 Using cached bundled DAT for ${platform} (memory)`);
    return datCache.get(memoryKey)!;
  }

  // Check persistent cache
  const cachedEntries = await loadFromPersistentCache(platform, "bundled");
  if (cachedEntries) {
    console.log(`📦 Using cached bundled DAT for ${platform} (IndexedDB)`);
    datCache.set(memoryKey, cachedEntries);
    return cachedEntries;
  }

  const datPath = BUNDLED_DATS[platform as keyof typeof BUNDLED_DATS];
  if (!datPath) {
    console.warn(`No bundled DAT file for platform: ${platform}`);
    return [];
  }

  try {
    const response = await fetch(datPath);
    const datContent = await response.text();

    const entries = parseDAT(datContent, platform);
    console.log(
      `📦 Loaded bundled DAT for ${platform}: ${entries.length} entries (fresh fetch)`,
    );

    // Cache in both memory and persistent storage
    datCache.set(memoryKey, entries);
    await saveToPersistentCache(platform, "bundled", entries);

    return entries;
  } catch (error) {
    console.error(`Failed to load bundled DAT file for ${platform}:`, error);
    return [];
  }
}

// Load DAT file from Libretro database with retry
async function fetchWithRetry(
  url: string,
  retries: number = 1,
  delayMs: number = 1000,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      // Only retry on server errors (5xx) or network issues, not 404s
      if (response.status >= 500 && attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, delayMs * (attempt + 1)),
        );
        continue;
      }
      return response; // Return the error response for the caller to handle
    } catch (error) {
      // Network error — retry if we have attempts left
      if (attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, delayMs * (attempt + 1)),
        );
        continue;
      }
      throw error;
    }
  }
  throw new Error("Unreachable");
}

// Load DAT file from Libretro database
export async function loadLibretroDAT(platform: string): Promise<DATEntry[]> {
  const memoryKey = `libretro-${platform}`;

  // Check memory cache first
  if (datCache.has(memoryKey)) {
    console.log(`🌐 Using cached Libretro DAT for ${platform} (memory)`);
    return datCache.get(memoryKey)!;
  }

  // Check persistent cache
  const cachedEntries = await loadFromPersistentCache(platform, "libretro");
  if (cachedEntries) {
    console.log(`🌐 Using cached Libretro DAT for ${platform} (IndexedDB)`);
    datCache.set(memoryKey, cachedEntries);
    return cachedEntries;
  }

  const datPath = PLATFORMS[platform as keyof typeof PLATFORMS];
  if (!datPath) {
    console.warn(`No Libretro DAT path for platform: ${platform}`);
    return [];
  }

  // Properly encode the path parts to handle spaces in filenames
  const pathParts = datPath.split("/");
  const encodedPath = pathParts
    .map((part) => encodeURIComponent(part))
    .join("/");
  const datUrl = `${LIBRETRO_BASE_URL}/${encodedPath}`;

  try {
    const response = await fetchWithRetry(datUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const datContent = await response.text();
    const entries = parseDAT(datContent, platform);
    console.log(
      `🌐 Downloaded Libretro DAT for ${platform}: ${entries.length} entries (fresh download)`,
    );

    // Cache in both memory and persistent storage
    datCache.set(memoryKey, entries);
    await saveToPersistentCache(platform, "libretro", entries);

    return entries;
  } catch (error) {
    console.error(`Failed to load Libretro DAT file for ${platform}:`, error);
    return [];
  }
}

// Share one in-flight load per platform so parallel files do not refetch.
const inFlightPlatformDATs = new Map<string, Promise<DATEntry[]>>();

// Load DAT for a specific platform (loads both encrypted and decrypted for DS)
export function loadPlatformDAT(platform: string): Promise<DATEntry[]> {
  const inFlight = inFlightPlatformDATs.get(platform);
  if (inFlight) return inFlight;

  const load = loadPlatformDATUncached(platform).finally(() => {
    inFlightPlatformDATs.delete(platform);
  });
  inFlightPlatformDATs.set(platform, load);
  return load;
}

async function loadPlatformDATUncached(platform: string): Promise<DATEntry[]> {
  const allEntries: DATEntry[] = [];

  // For Nintendo DS, load both encrypted (bundled) and decrypted (libretro)
  if (platform === "Nintendo DS") {
    const encryptedEntries = await loadBundledDAT(
      "Nintendo DS Encrypted (Bundled)",
    );
    allEntries.push(...encryptedEntries);

    const decryptedEntries = await loadLibretroDAT("Nintendo DS");
    allEntries.push(...decryptedEntries);

    if (allEntries.length > 0) {
      return allEntries;
    }
  }

  // Try Libretro database for other platforms
  return await loadLibretroDAT(platform);
}

// Run async jobs with a bounded number in flight. Results keep input order.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  if (limit <= 0) {
    throw new RangeError("Concurrency limit must be greater than zero");
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const run = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  };

  const runners = Array.from({ length: Math.min(limit, items.length) }, () =>
    run(),
  );
  await Promise.all(runners);
  return results;
}

// Load DATs for multiple platforms
export async function loadMultiplePlatformDATs(
  platforms: string[],
): Promise<DATEntry[]> {
  const groups = await mapWithConcurrency(platforms, 4, loadPlatformDAT);
  return groups.flat();
}

// Load all available DATs (both bundled and Libretro)
export async function loadAllBundledDATs(): Promise<DATEntry[]> {
  const jobs = [
    ...Object.keys(BUNDLED_DATS).map(
      (platform) => () => loadBundledDAT(platform),
    ),
    ...Object.keys(PLATFORMS).map(
      (platform) => () => loadLibretroDAT(platform),
    ),
  ];

  const groups = await mapWithConcurrency(jobs, 4, (job) => job());
  return groups.flat();
}

// Get supported platforms (excludes bundled encrypted versions that are fallbacks)
export function getSupportedPlatforms(): string[] {
  // Only return the main platform names, not the encrypted bundled versions
  // The loadPlatformDAT function handles the fallback logic automatically
  return Object.keys(PLATFORMS);
}

// Clear all caches (useful for debugging or force refresh)
export async function clearDATCache(): Promise<void> {
  // Clear memory cache
  datCache.clear();
  inFlightPlatformDATs.clear();

  // Clear IndexedDB and any legacy localStorage entries
  await withStore<undefined>("readwrite", (store) => store.clear());
  clearLegacyCacheKeys();
  console.log("🧹 DAT caches cleared");
}

function clearLegacyCacheKeys(): void {
  try {
    if (typeof localStorage === "undefined") return;
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(LEGACY_CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.warn("Failed to clear legacy DAT cache:", error);
  }
}

async function scanCachedDATs(): Promise<CachedDATData[]> {
  await migrateAllLegacyCaches();
  const records = await withStore<CachedDATData[]>("readonly", (store) =>
    store.getAll(),
  );
  return records ?? [];
}

// Get cache status for debugging
export async function getCacheStatus(): Promise<{
  memory: number;
  persistent: number;
  bundled: number;
  totalSize: string;
}> {
  const memoryCount = datCache.size;
  const bundledCount = Object.keys(BUNDLED_DATS).length;

  let persistentCount = 0;
  let totalSize = 0;

  const scanned = await scanCachedDATs();
  for (const item of scanned) {
    if (item.source !== "bundled") {
      persistentCount++;
      totalSize += JSON.stringify(item.entries).length;
    }
  }

  return {
    memory: memoryCount,
    persistent: persistentCount,
    bundled: bundledCount,
    totalSize: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
  };
}

// Get list of cached DATs for browsing
export async function getCachedDATs(): Promise<
  Array<{
    platform: string;
    source: string;
    entryCount: number;
  }>
> {
  const cachedDATs: Array<{
    platform: string;
    source: string;
    entryCount: number;
  }> = [];

  const scanned = await scanCachedDATs();
  for (const item of scanned) {
    if (item.source === "bundled") continue;
    if (isCacheValid(item)) {
      cachedDATs.push({
        platform: item.platform,
        source: item.source,
        entryCount: item.entries.length,
      });
    }
  }

  // Now check bundled DATs - always show them since they're built into the app
  for (const platform of Object.keys(BUNDLED_DATS)) {
    const memoryKey = `${platform}-bundled`;

    // Use cleaner display name for Nintendo DS encrypted version
    const displayName =
      platform === "Nintendo DS Encrypted (Bundled)"
        ? "Nintendo DS (Encrypted)"
        : platform;

    // Show bundled DATs if in memory or the persistent cache
    if (datCache.has(memoryKey)) {
      const entries = datCache.get(memoryKey)!;
      cachedDATs.push({
        platform: displayName,
        source: "bundled",
        entryCount: entries.length,
      });
    } else {
      const cachedData = await loadFromPersistentCache(platform, "bundled");
      if (cachedData) {
        cachedDATs.push({
          platform: displayName,
          source: "bundled",
          entryCount: cachedData.length,
        });
      }
    }
  }

  // Sort by source (bundled first, then custom, then libretro, then alphabetically by platform)
  return cachedDATs.sort((a, b) => {
    if (a.source === "bundled" && b.source !== "bundled") return -1;
    if (a.source !== "bundled" && b.source === "bundled") return 1;
    if (a.source === "custom" && b.source !== "custom") return -1;
    if (a.source !== "custom" && b.source === "custom") return 1;
    return a.platform.localeCompare(b.platform);
  });
}

// Browse cached DAT entries
export async function browseCachedDAT(
  platform: string,
  source: string,
): Promise<DATEntry[] | null> {
  // For bundled DATs, load directly since they're always available
  if (source === "bundled") {
    try {
      return await loadBundledDAT(platform);
    } catch (error) {
      console.error(`Failed to load bundled DAT for ${platform}:`, error);
      return null;
    }
  }

  // For other sources (libretro, custom), check persistent cache
  return loadFromPersistentCache(
    platform,
    source as "bundled" | "libretro" | "custom",
  );
}

// Upload and cache custom DAT file
export async function uploadCustomDAT(file: File): Promise<{
  success: boolean;
  platform: string;
  entryCount: number;
  error?: string;
}> {
  try {
    const datContent = await file.text();
    const platform = `Custom - ${file.name.replace(/\.(dat|xml)$/i, "")}`;

    // Parse the DAT content
    const entries = parseDAT(datContent, platform);

    if (entries.length === 0) {
      return {
        success: false,
        platform,
        entryCount: 0,
        error: "No valid entries found in DAT file",
      };
    }

    // Cache the custom DAT
    const memoryKey = `custom-${platform}`;
    datCache.set(memoryKey, entries);
    await saveToPersistentCache(platform, "custom", entries);

    console.log(
      `📁 Uploaded custom DAT: ${platform} with ${entries.length} entries`,
    );

    return {
      success: true,
      platform,
      entryCount: entries.length,
    };
  } catch (error) {
    console.error("Failed to upload custom DAT:", error);
    return {
      success: false,
      platform: "",
      entryCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Get raw DAT content for browsing
export async function getRawDATContent(
  platform: string,
  source: string,
): Promise<string | null> {
  try {
    // For bundled DATs, fetch the raw content directly
    if (source === "bundled") {
      // Map cleaned display name back to original platform key
      let actualPlatform = platform;
      if (platform === "Nintendo DS (Encrypted)") {
        actualPlatform = "Nintendo DS Encrypted (Bundled)";
      }

      const datPath = BUNDLED_DATS[actualPlatform as keyof typeof BUNDLED_DATS];
      if (!datPath) {
        console.warn(`No bundled DAT file for platform: ${actualPlatform}`);
        return null;
      }

      try {
        const response = await fetch(datPath);
        const rawContent = await response.text();

        const header =
          `# DAT File: ${platform} (${source})\n` +
          `# Source: Bundled with application\n` +
          `# Generated: ${new Date().toLocaleString()}\n\n`;

        return header + rawContent;
      } catch (error) {
        console.error(
          `Failed to fetch bundled DAT content for ${actualPlatform}:`,
          error,
        );
        return null;
      }
    }

    // For other sources (libretro, custom), check the persistent cache
    const cacheKey = getCacheKey(platform, source as DATSource);
    const data = await getCachedRecord(cacheKey);
    if (!data || !isCacheValid(data)) return null;

    // Convert entries back to a readable format
    const header =
      `# DAT File: ${platform} (${source})\n` +
      `# Cached: ${new Date(data.timestamp).toLocaleString()}\n` +
      `# Total Entries: ${data.entries.length}\n` +
      `# Version: ${data.version}\n\n`;

    const entriesText = data.entries
      .map(
        (entry, index) =>
          `Entry ${index + 1}:\n` +
          `  Name: ${entry.name}\n` +
          `  Size: ${entry.size} bytes\n` +
          `  CRC32: ${entry.crc32}\n` +
          `  MD5: ${entry.md5}\n` +
          `  SHA1: ${entry.sha1}\n`,
      )
      .join("\n");

    return header + entriesText;
  } catch (error) {
    console.error("Failed to get raw DAT content:", error);
    return null;
  }
}
