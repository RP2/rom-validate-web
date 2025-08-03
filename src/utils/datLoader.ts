// Pre-bundled DAT files for popular platforms
// These would be included in your project's public/dats/ directory

import { parseDAT } from "./romValidator";
import type { DATEntry } from "./romValidator";

// Configuration matching the CLI version
// Base URL for Libretro database
const LIBRETRO_BASE_URL =
  "https://raw.githubusercontent.com/libretro/libretro-database/master";

// Platform configurations with both No-Intro and Redump sources
export const PLATFORMS = {
  "Game Boy Advance": "metadat/no-intro/Nintendo - Game Boy Advance.dat",
  "Game Boy": "metadat/no-intro/Nintendo - Game Boy.dat",
  "Game Boy Color": "metadat/no-intro/Nintendo - Game Boy Color.dat",
  "Nintendo DS": "metadat/no-intro/Nintendo - Nintendo DS.dat",
  "Nintendo DS Download Play":
    "metadat/no-intro/Nintendo - Nintendo DS (Download Play).dat",
  "Nintendo DSi": "metadat/no-intro/Nintendo - Nintendo DSi.dat",
  "Nintendo 3DS": "metadat/no-intro/Nintendo - Nintendo 3DS.dat",
  "Nintendo 64": "metadat/no-intro/Nintendo - Nintendo 64.dat",
  "Super Nintendo":
    "metadat/no-intro/Nintendo - Super Nintendo Entertainment System.dat",
  "Nintendo Entertainment System":
    "metadat/no-intro/Nintendo - Nintendo Entertainment System.dat",
  PlayStation: "metadat/redump/Sony - PlayStation.dat",
  "PlayStation 2": "metadat/redump/Sony - PlayStation 2.dat",
  PSP: "metadat/no-intro/Sony - PlayStation Portable.dat",
  GameCube: "metadat/redump/Nintendo - GameCube.dat",
  Wii: "metadat/redump/Nintendo - Wii.dat",
  "Sega Genesis": "metadat/no-intro/Sega - Mega Drive - Genesis.dat",
  Dreamcast: "metadat/redump/Sega - Dreamcast.dat",
};

// Extension to platform mapping
export const EXTENSION_MAP = {
  ".gba": "Game Boy Advance",
  ".gb": "Game Boy",
  ".gbc": "Game Boy Color",
  // DS-based ROMs map to multiple DATs
  ".nds": ["Nintendo DS", "Nintendo DS Download Play", "Nintendo DSi"],
  ".3ds": "Nintendo 3DS",
  ".n64": "Nintendo 64",
  ".z64": "Nintendo 64",
  ".smc": "Super Nintendo",
  ".sfc": "Super Nintendo",
  ".nes": "Nintendo Entertainment System",
  // Disc images: PS2, Wii, PSP, GameCube (ordered by typical size ranges)
  ".iso": ["PlayStation 2", "Wii", "PSP", "GameCube"],
  ".cso": "PSP",
  ".pbp": "PSP",
  // GameCube image formats
  ".gcm": "GameCube",
  ".ciso": "GameCube",
  // Wii image format
  ".wbfs": "Wii",
  // CD-based: PS1, Dreamcast first (more common for CD format), then PS2 fallback
  ".bin": ["PlayStation", "Dreamcast", "PlayStation 2"],
  // Sega Genesis/Mega Drive formats
  ".md": "Sega Genesis",
  ".gen": "Sega Genesis",
  ".smd": "Sega Genesis",
  // Dreamcast formats
  ".cdi": "Dreamcast",
  ".gdi": "Dreamcast",
};

// Extensions that are prone to encryption
export const ENCRYPTION_PRONE_EXTENSIONS = new Set([".nds", ".3ds"]);

// Pre-bundled DAT files for platforms that require special access (encrypted versions)
export const BUNDLED_DATS = {
  "Nintendo DS Encrypted (Bundled)":
    "/dats/Nintendo - Nintendo DS (Encrypted).dat",
};

// Cache for parsed DAT entries with persistent storage
const datCache = new Map<string, DATEntry[]>();

// Persistent cache using localStorage with expiration
interface CachedDATData {
  entries: DATEntry[];
  timestamp: number;
  version: string;
}

const CACHE_EXPIRY_HOURS = 24; // Cache DATs for 24 hours
const CACHE_VERSION = "1.0"; // Increment to invalidate old caches

// Get cache key for platform
function getCacheKey(
  platform: string,
  source: "bundled" | "libretro" | "custom",
): string {
  return `dat-cache-${source}-${platform}`;
}

// Load from persistent cache
function loadFromPersistentCache(
  platform: string,
  source: "bundled" | "libretro" | "custom",
): DATEntry[] | null {
  try {
    const cacheKey = getCacheKey(platform, source);
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const data: CachedDATData = JSON.parse(cached);

    // Check version and expiry
    const now = Date.now();
    const hoursSinceCache = (now - data.timestamp) / (1000 * 60 * 60);

    if (
      data.version !== CACHE_VERSION ||
      hoursSinceCache > CACHE_EXPIRY_HOURS
    ) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    return data.entries;
  } catch (error) {
    console.warn("Failed to load from persistent cache:", error);
    return null;
  }
}

// Save to persistent cache
function saveToPersistentCache(
  platform: string,
  source: "bundled" | "libretro" | "custom",
  entries: DATEntry[],
): void {
  try {
    const cacheKey = getCacheKey(platform, source);
    const data: CachedDATData = {
      entries,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    };
    localStorage.setItem(cacheKey, JSON.stringify(data));
  } catch (error) {
    console.warn("Failed to save to persistent cache:", error);
  }
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
  const cachedEntries = loadFromPersistentCache(platform, "bundled");
  if (cachedEntries) {
    console.log(`📦 Using cached bundled DAT for ${platform} (localStorage)`);
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
    saveToPersistentCache(platform, "bundled", entries);

    return entries;
  } catch (error) {
    console.error(`Failed to load bundled DAT file for ${platform}:`, error);
    return [];
  }
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
  const cachedEntries = loadFromPersistentCache(platform, "libretro");
  if (cachedEntries) {
    console.log(`🌐 Using cached Libretro DAT for ${platform} (localStorage)`);
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
    const response = await fetch(datUrl);

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
    saveToPersistentCache(platform, "libretro", entries);

    return entries;
  } catch (error) {
    console.error(`Failed to load Libretro DAT file for ${platform}:`, error);
    return [];
  }
}

// Load DAT for a specific platform (tries encrypted bundled first for DS, then Libretro)
export async function loadPlatformDAT(platform: string): Promise<DATEntry[]> {
  // For Nintendo DS, try encrypted version first if available
  if (platform === "Nintendo DS") {
    const encryptedEntries = await loadBundledDAT(
      "Nintendo DS Encrypted (Bundled)",
    );
    if (encryptedEntries.length > 0) {
      return encryptedEntries;
    }
  }

  // Try Libretro database
  return await loadLibretroDAT(platform);
}

// Load DATs for multiple platforms
export async function loadMultiplePlatformDATs(
  platforms: string[],
): Promise<DATEntry[]> {
  const allEntries: DATEntry[] = [];

  for (const platform of platforms) {
    const entries = await loadPlatformDAT(platform);
    allEntries.push(...entries);
  }

  return allEntries;
}

// Load all available DATs (both bundled and Libretro)
export async function loadAllBundledDATs(): Promise<DATEntry[]> {
  const allEntries: DATEntry[] = [];

  // Load all bundled DATs
  for (const platform of Object.keys(BUNDLED_DATS)) {
    const entries = await loadBundledDAT(platform);
    allEntries.push(...entries);
  }

  // Load all Libretro DATs
  for (const platform of Object.keys(PLATFORMS)) {
    const entries = await loadLibretroDAT(platform);
    allEntries.push(...entries);
  }

  return allEntries;
}

// Get supported platforms (excludes bundled encrypted versions that are fallbacks)
export function getSupportedPlatforms(): string[] {
  // Only return the main platform names, not the encrypted bundled versions
  // The loadPlatformDAT function handles the fallback logic automatically
  return Object.keys(PLATFORMS);
}

// Clear all caches (useful for debugging or force refresh)
export function clearDATCache(): void {
  // Clear memory cache
  datCache.clear();

  // Clear persistent cache
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith("dat-cache-")) {
        localStorage.removeItem(key);
      }
    }
    console.log("🧹 DAT caches cleared");
  } catch (error) {
    console.warn("Failed to clear persistent cache:", error);
  }
}

// Get cache status for debugging
export async function getCacheStatus(): Promise<{
  memory: number;
  persistent: number;
  bundled: number;
  totalSize: string;
}> {
  // Only count items actually in memory cache
  const memoryCount = datCache.size;

  let persistentCount = 0;
  let totalSize = 0;

  // Count bundled DATs that are available (from BUNDLED_DATS config)
  const bundledCount = Object.keys(BUNDLED_DATS).length;

  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith("dat-cache-")) {
        const jsonString = localStorage.getItem(key);
        if (jsonString) {
          try {
            const cachedData: CachedDATData = JSON.parse(jsonString);

            // Extract platform and source from cache key
            const keyParts = key.replace("dat-cache-", "").split("-");
            const source = keyParts[0];

            // Only count non-bundled DATs in persistent storage
            if (source !== "bundled") {
              persistentCount++;

              if (cachedData.entries) {
                // Calculate size based on the entries data structure
                const entriesSize = JSON.stringify(cachedData.entries).length;
                totalSize += entriesSize;
              } else {
                // Fallback to total JSON string length
                totalSize += jsonString.length;
              }
            }
          } catch (parseError) {
            console.warn(
              "Failed to parse cached DAT for size calculation:",
              key,
              parseError,
            );
            // Fallback to JSON string length for non-bundled DATs
            const keyParts = key.replace("dat-cache-", "").split("-");
            const source = keyParts[0];
            if (source !== "bundled") {
              persistentCount++;
              totalSize += jsonString.length;
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn("Failed to get cache status:", error);
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

  // First check localStorage for non-bundled cached DATs (libretro and custom)
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith("dat-cache-")) {
        const jsonString = localStorage.getItem(key);
        if (jsonString) {
          try {
            const cachedData: CachedDATData = JSON.parse(jsonString);

            // Check if cache is still valid
            const now = Date.now();
            const isExpired =
              now - cachedData.timestamp > CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
            const isValidVersion = cachedData.version === CACHE_VERSION;

            if (!isExpired && isValidVersion && cachedData.entries) {
              // Extract platform and source from cache key
              // Format: "dat-cache-{source}-{platform}"
              const keyParts = key.replace("dat-cache-", "").split("-");
              const source = keyParts[0];
              const platform = keyParts.slice(1).join("-");

              // Skip bundled DATs since we handle them separately
              if (source !== "bundled") {
                cachedDATs.push({
                  platform,
                  source,
                  entryCount: cachedData.entries.length,
                });
              }
            }
          } catch (parseError) {
            console.warn("Failed to parse cached DAT:", key, parseError);
          }
        }
      }
    }
  } catch (error) {
    console.warn("Failed to get cached DATs:", error);
  }

  // Now check bundled DATs - show them if in memory OR if user has other cached DATs
  const hasOtherCachedDATs = cachedDATs.length > 0;

  for (const platform of Object.keys(BUNDLED_DATS)) {
    const memoryKey = `${platform}-bundled`;

    // Use cleaner display name for Nintendo DS encrypted version
    const displayName =
      platform === "Nintendo DS Encrypted (Bundled)"
        ? "Nintendo DS (Encrypted)"
        : platform;

    // Always show if in memory, or show if user has other cached DATs for consistency
    if (datCache.has(memoryKey)) {
      const entries = datCache.get(memoryKey)!;
      cachedDATs.push({
        platform: displayName,
        source: "bundled",
        entryCount: entries.length,
      });
    } else if (hasOtherCachedDATs) {
      // Also check localStorage for bundled DATs when user has other cached content
      const cachedData = loadFromPersistentCache(platform, "bundled");
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
  const cacheKey = getCacheKey(
    platform,
    source as "bundled" | "libretro" | "custom",
  );
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
    saveToPersistentCache(platform, "custom", entries);

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

    // For other sources (libretro, custom), check localStorage cache
    // Also handle bundled DATs that might be cached with original name
    let actualPlatformForCache = platform;
    if (source === "bundled" && platform === "Nintendo DS (Encrypted)") {
      actualPlatformForCache = "Nintendo DS Encrypted (Bundled)";
    }

    const cacheKey = getCacheKey(
      actualPlatformForCache,
      source as "bundled" | "libretro" | "custom",
    );
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const data: CachedDATData = JSON.parse(cached);

    // Check if cache is still valid
    const now = Date.now();
    const isExpired =
      now - data.timestamp > CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
    const isValidVersion = data.version === CACHE_VERSION;

    if (isExpired || !isValidVersion) {
      return null;
    }

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
