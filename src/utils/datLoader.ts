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
  // Disc images: all platforms that use .iso
  ".iso": ["GameCube", "PSP", "PlayStation 2", "Wii"],
  ".cso": "PSP",
  ".pbp": "PSP",
  // GameCube image formats
  ".gcm": "GameCube",
  ".ciso": "GameCube",
  // Wii image format
  ".wbfs": "Wii",
  // CD-based: PS1 and PS2 may use .bin/.cue
  ".psx": "PlayStation",
  ".cue": ["PlayStation", "PlayStation 2"],
  ".bin": ["PlayStation", "PlayStation 2"],
};

// Extensions that are prone to encryption
export const ENCRYPTION_PRONE_EXTENSIONS = new Set([".nds", ".3ds"]);

// Pre-bundled DAT files for platforms that require special access (encrypted versions)
export const BUNDLED_DATS = {
  "Nintendo DS Encrypted": "/dats/Nintendo - Nintendo DS (Encrypted).dat",
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
function getCacheKey(platform: string, source: "bundled" | "libretro"): string {
  return `dat-cache-${source}-${platform}`;
}

// Load from persistent cache
function loadFromPersistentCache(
  platform: string,
  source: "bundled" | "libretro",
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
  source: "bundled" | "libretro",
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
  const memoryKey = `bundled-${platform}`;

  // Check memory cache first
  if (datCache.has(memoryKey)) {
    return datCache.get(memoryKey)!;
  }

  // Check persistent cache
  const cachedEntries = loadFromPersistentCache(platform, "bundled");
  if (cachedEntries) {
    datCache.set(memoryKey, cachedEntries);
    return cachedEntries;
  }

  const datPath = BUNDLED_DATS[platform as keyof typeof BUNDLED_DATS];
  if (!datPath) {
    console.warn(`No bundled DAT file for platform: ${platform}`);
    return [];
  }

  try {
    console.log(`📥 Loading bundled DAT for ${platform}...`);
    const response = await fetch(datPath);
    const datContent = await response.text();

    console.log(
      `📄 DAT format detection for ${platform}:`,
      datContent.trim().startsWith("<?xml") ? "XML" : "ClrMamePro",
    );

    const entries = parseDAT(datContent);

    // Cache in both memory and persistent storage
    datCache.set(memoryKey, entries);
    saveToPersistentCache(platform, "bundled", entries);

    console.log(`✅ Loaded ${entries.length} entries for ${platform}`);
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
    return datCache.get(memoryKey)!;
  }

  // Check persistent cache
  const cachedEntries = loadFromPersistentCache(platform, "libretro");
  if (cachedEntries) {
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
    console.log(`🌐 Fetching DAT for ${platform} from Libretro database...`);
    console.log(`🔗 Full URL: ${datUrl}`);

    const response = await fetch(datUrl);
    console.log(
      `📡 Response status: ${response.status} ${response.statusText}`,
    );
    console.log(
      `📡 Response headers:`,
      Object.fromEntries(response.headers.entries()),
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const datContent = await response.text();
    console.log(`📄 Response content length: ${datContent.length} characters`);
    console.log(
      `📄 Content preview (first 200 chars):`,
      datContent.substring(0, 200),
    );

    console.log(
      `📄 DAT format detection for ${platform}:`,
      datContent.trim().startsWith("<?xml") ? "XML" : "ClrMamePro",
    );

    const entries = parseDAT(datContent);

    // Cache in both memory and persistent storage
    datCache.set(memoryKey, entries);
    saveToPersistentCache(platform, "libretro", entries);

    console.log(`✅ Loaded ${entries.length} entries for ${platform}`);
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
    const encryptedEntries = await loadBundledDAT("Nintendo DS Encrypted");
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

// Get supported platforms
export function getSupportedPlatforms(): string[] {
  return [...Object.keys(BUNDLED_DATS), ...Object.keys(PLATFORMS)];
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
export function getCacheStatus(): {
  memory: number;
  persistent: number;
  totalSize: string;
} {
  const memoryCount = datCache.size;

  let persistentCount = 0;
  let totalSize = 0;

  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith("dat-cache-")) {
        persistentCount++;

        // Get the actual content size, not JSON string length
        const jsonString = localStorage.getItem(key);
        if (jsonString) {
          try {
            const cachedData = JSON.parse(jsonString);
            if (cachedData.content) {
              // Use the actual content length in bytes
              totalSize += new Blob([cachedData.content]).size;
            }
          } catch (parseError) {
            console.warn(
              "Failed to parse cached DAT for size calculation:",
              key,
              parseError,
            );
            // Fallback to JSON string length
            totalSize += jsonString.length;
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
    totalSize: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
  };
}
