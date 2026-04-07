// Client-side ROM validation utilities

import {
  initializePool,
  hashFileWithPool,
  terminatePool,
  type PooledHashResult,
} from "../workers/workerPoolManager";

// Web Worker singleton for hash calculation
let hashWorker: Worker | null = null;
let workerMessageId = 0;
let currentWorkerCount = 0;
const pendingOperations = new Map<
  string,
  {
    resolve: (value: { md5: string; sha1: string; crc32: string }) => void;
    reject: (error: Error) => void;
    onProgress?: (progress: number) => void;
  }
>();

function getHashWorker(): Worker {
  if (!hashWorker) {
    // Create worker from the worker file
    hashWorker = new Worker(
      new URL("../workers/hashWorker.ts", import.meta.url),
      {
        type: "module",
      },
    );

    hashWorker.onmessage = (event: MessageEvent) => {
      const data = event.data;
      const operation = pendingOperations.get(data.fileId);

      if (!operation) {
        console.warn("Received message for unknown operation:", data.fileId);
        return;
      }

      switch (data.type) {
        case "PROGRESS":
          operation.onProgress?.(data.progress);
          break;
        case "COMPLETE":
          pendingOperations.delete(data.fileId);
          operation.resolve(data.hashes);
          break;
        case "ERROR":
          pendingOperations.delete(data.fileId);
          const error = new Error(data.error);
          if (data.fatal) {
            error.name = "OutOfMemoryError";
          }
          operation.reject(error);
          break;
      }
    };

    hashWorker.onerror = (error) => {
      console.error("Hash worker error:", error);
    };
  }

  return hashWorker;
}

// Simple MD5 implementation as fallback when Web Crypto API
function simpleMD5(data: Uint8Array): string {
  // This is a simplified version - in production you might want to use a library like crypto-js
  // For now, we'll return a hash based on the data content
  let hash = 0;
  for (let i = 0; i < Math.min(data.length, 1024); i++) {
    hash = (hash * 31 + data[i]) % 0xffffffff;
  }

  // Convert to hex string (not a real MD5, but deterministic)
  return hash.toString(16).padStart(8, "0").repeat(4); // Make it 32 chars like MD5
}

export interface DATEntry {
  name: string;
  size: number;
  md5?: string;
  sha1?: string;
  crc32?: string;
  platform?: string;
  region?: string;
  description?: string;
  datSource?: string; // e.g., "No-Intro", "Redump"
}

import { detectDiscPlatform, getPlatformPriority } from "./discDetector";
import type { DiscPlatform } from "./discDetector";

export interface ValidationResult {
  filename: string;
  originalName: string;
  status: "valid" | "invalid" | "unknown" | "renamed";
  platform?: string;
  region?: string;
  size: number;
  hashes: {
    md5: string;
    sha1: string;
    crc32: string;
  };
  matchedEntry?: DATEntry;
  suggestedName?: string;
  issues?: string[];
  file?: File; // Store original file for download functionality
  datSource?: string; // Which DAT database matched (e.g., "No-Intro", "Redump")
}

// CRC32 implementation for client-side hash calculation
function crc32(data: Uint8Array): string {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }

  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }

  return ((crc ^ 0xffffffff) >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

// Calculate file hashes client-side with progress tracking using Web Worker
// Uses streaming with 1MB chunks to handle files of any size without OOM
// Can use parallel worker pool for batch processing multiple files concurrently
export async function calculateFileHashes(
  file: File,
  onProgress?: (progress: number) => void,
  parallelWorkers?: number,
): Promise<{ md5: string; sha1: string; crc32: string }> {
  if (parallelWorkers && parallelWorkers > 1) {
    return calculateFileHashesParallel(file, onProgress, parallelWorkers);
  }

  const worker = getHashWorker();
  const fileId = `hash-${++workerMessageId}-${file.name}`;

  return new Promise((resolve, reject) => {
    pendingOperations.set(fileId, {
      resolve,
      reject,
      onProgress,
    });

    worker.postMessage({
      type: "HASH_FILE",
      file,
      fileId,
    });
  });
}

async function calculateFileHashesParallel(
  file: File,
  onProgress?: (progress: number) => void,
  parallelWorkers?: number,
): Promise<{ md5: string; sha1: string; crc32: string }> {
  try {
    const result: PooledHashResult = await hashFileWithPool(file, onProgress);
    return {
      md5: result.md5,
      sha1: result.sha1,
      crc32: result.crc32,
    };
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}

// Legacy synchronous hash calculation (kept for compatibility/fallback)
// Note: This loads the entire file into memory and should not be used for large files
async function calculateFileHashesLegacy(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<{ md5: string; sha1: string; crc32: string }> {
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);

  let md5 = "";
  let sha1 = "";

  onProgress?.(10); // Starting hash calculation

  try {
    // Try to calculate SHA-1 (widely supported)
    const sha1Hash = await crypto.subtle.digest("SHA-1", buffer);
    const sha1Array = Array.from(new Uint8Array(sha1Hash));
    sha1 = sha1Array.map((b) => b.toString(16).padStart(2, "0")).join("");
    onProgress?.(40); // SHA-1 complete
  } catch (error) {
    console.warn("SHA-1 calculation failed:", error);
    sha1 = "unavailable";
    onProgress?.(40);
  }

  try {
    // Try to calculate MD5 (may not be available in all browsers)
    const md5Hash = await crypto.subtle.digest("MD5", buffer);
    const md5Array = Array.from(new Uint8Array(md5Hash));
    md5 = md5Array.map((b) => b.toString(16).padStart(2, "0")).join("");
    onProgress?.(70); // MD5 complete
  } catch (error) {
    console.warn("MD5 not supported in this browser, using fallback:", error);
    // Fallback: use a simplified hash or mark as unavailable
    md5 = simpleMD5(data);
    onProgress?.(70);
  }

  // Calculate CRC32 (always available since it's our implementation)
  const crc32Hash = crc32(data);
  onProgress?.(90); // CRC32 complete

  return { md5, sha1, crc32: crc32Hash };
}

// Parse DAT files (supports both XML and ClrMamePro formats)
export function parseDAT(
  datContent: string,
  knownPlatform?: string,
): DATEntry[] {
  // Detect format by checking the content
  if (
    datContent.trim().startsWith("<?xml") ||
    datContent.includes("<datafile>")
  ) {
    return parseXMLDAT(datContent, knownPlatform);
  } else {
    return parseClrMameProDAT(datContent, knownPlatform);
  }
}

// Parse XML DAT files
function parseXMLDAT(xmlContent: string, knownPlatform?: string): DATEntry[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, "text/xml");
  const games = doc.querySelectorAll("game");
  const entries: DATEntry[] = [];

  games.forEach((game) => {
    const name = game.getAttribute("name") || "";
    const roms = game.querySelectorAll("rom");

    roms.forEach((rom) => {
      const size = parseInt(rom.getAttribute("size") || "0");
      const md5 = rom.getAttribute("md5") || undefined;
      const sha1 = rom.getAttribute("sha1") || undefined;
      const crc32 = rom.getAttribute("crc") || undefined;

      // Use known platform if available, otherwise try to detect from filename
      const platform =
        knownPlatform ||
        (() => {
          const detectedPlatform = detectPlatformFromName(name, size);
          return detectedPlatform !== "unknown" ? detectedPlatform : undefined;
        })();
      const region = detectRegion(name);

      entries.push({
        name,
        size,
        md5,
        sha1,
        crc32,
        platform,
        region,
        description:
          game.querySelector("description")?.textContent || undefined,
      });
    });
  });

  return entries;
}

// Parse ClrMamePro DAT files
function parseClrMameProDAT(
  datContent: string,
  knownPlatform?: string,
): DATEntry[] {
  const entries: DATEntry[] = [];
  const lines = datContent.split("\n");

  let currentGame: any = {};
  let inGame = false;
  let inRom = false;
  let currentRom: any = {};
  let gameCount = 0;
  let inClrMameProHeader = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmed = line.trim();

    // Skip clrmamepro header block
    if (trimmed.startsWith("clrmamepro (")) {
      inClrMameProHeader = true;
      continue;
    }

    if (inClrMameProHeader && trimmed === ")") {
      inClrMameProHeader = false;
      continue;
    }

    if (inClrMameProHeader) {
      continue; // Skip header content
    }

    if (trimmed.startsWith("game (")) {
      inGame = true;
      currentGame = {};
      gameCount++;

      // For multi-line game blocks, the name is usually on the next line
      // But check if name is on the same line first
      const nameMatch = trimmed.match(/name\s+"([^"]+)"/);
      if (nameMatch) {
        currentGame.name = nameMatch[1];
      }
    } else if (trimmed === ")" && inGame && !inRom) {
      // End of game block
      inGame = false;
      currentGame = {};
    } else if (trimmed.startsWith("rom (") && inGame) {
      inRom = true;
      currentRom = {};

      // Parse rom attributes from the same line
      const nameMatch = trimmed.match(/name\s+"([^"]+)"/);
      const sizeMatch = trimmed.match(/size\s+(\d+)/);
      const crcMatch = trimmed.match(/crc\s+([a-fA-F0-9]+)/);
      const md5Match = trimmed.match(/md5\s+([a-fA-F0-9]+)/);
      const sha1Match = trimmed.match(/sha1\s+([a-fA-F0-9]+)/);

      if (nameMatch) currentRom.name = nameMatch[1];
      if (sizeMatch) currentRom.size = parseInt(sizeMatch[1]);
      if (crcMatch) currentRom.crc32 = crcMatch[1].toUpperCase();
      if (md5Match) currentRom.md5 = md5Match[1].toLowerCase();
      if (sha1Match) currentRom.sha1 = sha1Match[1].toLowerCase();

      // Check if this is a single-line ROM entry (ends with ` )`)
      if (trimmed.endsWith(" )")) {
        inRom = false;

        if (currentRom.name && currentGame.name) {
          const platform =
            knownPlatform ||
            (() => {
              const detectedPlatform = detectPlatformFromName(
                currentGame.name,
                currentRom.size || 0,
              );
              return detectedPlatform !== "unknown"
                ? detectedPlatform
                : undefined;
            })();
          const region = detectRegion(currentGame.name);

          entries.push({
            name: currentGame.name,
            size: currentRom.size || 0,
            md5: currentRom.md5,
            sha1: currentRom.sha1,
            crc32: currentRom.crc32,
            platform,
            region,
          });
        }

        currentRom = {};
      }
    } else if (trimmed === ")" && inRom) {
      // End of rom block
      inRom = false;

      if (currentRom.name && currentGame.name) {
        const platform =
          knownPlatform ||
          (() => {
            const detectedPlatform = detectPlatformFromName(
              currentGame.name,
              currentRom.size || 0,
            );
            return detectedPlatform !== "unknown"
              ? detectedPlatform
              : undefined;
          })();
        const region = detectRegion(currentGame.name);

        entries.push({
          name: currentGame.name,
          size: currentRom.size || 0,
          md5: currentRom.md5,
          sha1: currentRom.sha1,
          crc32: currentRom.crc32,
          platform,
          region,
        });
      }

      currentRom = {};
    } else if (inRom && trimmed) {
      // Parse individual attributes on separate lines
      const nameMatch = trimmed.match(/name\s+"([^"]+)"/);
      const sizeMatch = trimmed.match(/size\s+(\d+)/);
      const crcMatch = trimmed.match(/crc\s+([a-fA-F0-9]+)/);
      const md5Match = trimmed.match(/md5\s+([a-fA-F0-9]+)/);
      const sha1Match = trimmed.match(/sha1\s+([a-fA-F0-9]+)/);

      if (nameMatch) currentRom.name = nameMatch[1];
      if (sizeMatch) currentRom.size = parseInt(sizeMatch[1]);
      if (crcMatch) currentRom.crc32 = crcMatch[1].toUpperCase();
      if (md5Match) currentRom.md5 = md5Match[1].toLowerCase();
      if (sha1Match) currentRom.sha1 = sha1Match[1].toLowerCase();
    } else if (inGame && trimmed) {
      // Parse game-level attributes on separate lines
      const nameMatch = trimmed.match(/name\s+"([^"]+)"/);
      const descMatch = trimmed.match(/description\s+"([^"]+)"/);
      const regionMatch = trimmed.match(/region\s+"([^"]+)"/);

      if (nameMatch && !currentGame.name) {
        currentGame.name = nameMatch[1];
      }
      if (descMatch) {
        currentGame.description = descMatch[1];
      }
      if (regionMatch) {
        currentGame.region = regionMatch[1];
      }
    }
  }

  return entries;
}

// Detect platform from filename patterns and content
function detectPlatformFromName(filename: string, size: number): string {
  const name = filename.toLowerCase();
  const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));

  // Use the centralized extension mapping from datLoader
  // Import dynamically to avoid circular dependencies
  const extensionMap = {
    ".gba": "Game Boy Advance",
    ".gb": "Game Boy",
    ".gbc": "Game Boy Color",
    ".nds": ["Nintendo DS", "Nintendo DS Download Play", "Nintendo DSi"],
    ".3ds": "Nintendo 3DS",
    ".n64": "Nintendo 64",
    ".z64": "Nintendo 64",
    ".smc": "Super Nintendo",
    ".sfc": "Super Nintendo",
    ".nes": "Nintendo Entertainment System",
    ".cso": "PSP",
    ".pbp": "PSP",
    ".gcm": "GameCube",
    ".ciso": "GameCube",
    ".wbfs": "Wii",
    ".md": "Sega Genesis",
    ".gen": "Sega Genesis",
    ".smd": "Sega Genesis",
    ".cdi": "Dreamcast",
    ".gdi": "Dreamcast",
  };

  // Direct extension mapping first
  const mappedPlatform = extensionMap[ext as keyof typeof extensionMap];
  if (mappedPlatform) {
    // If it's an array (multi-platform), use size-based detection to pick the best one
    if (Array.isArray(mappedPlatform)) {
      // For DS family, prefer based on typical file sizes and naming
      if (ext === ".nds") {
        if (name.includes("dsi")) return "Nintendo DSi";
        if (name.includes("download") || name.includes("demo"))
          return "Nintendo DS Download Play";
        return "Nintendo DS"; // Default to regular DS
      }
    } else {
      return mappedPlatform;
    }
  }

  // Size-based detection for multi-platform formats
  if (ext === ".iso") {
    const sizeMB = size / (1024 * 1024);

    // Check filename for explicit platform hints first (most reliable)
    if (name.includes("gc") || name.includes("gamecube")) return "GameCube";
    if (name.includes("ps2") || name.includes("playstation 2"))
      return "PlayStation 2";
    if (name.includes("wii") || name.includes("nintendo wii")) return "Wii";
    if (name.includes("psp")) return "PSP";

    // Size-based heuristics - PS1 never used ISO format, only PS2/Wii/PSP/GameCube
    // PlayStation 2 DVDs are typically larger (650MB-4.7GB single layer, up to 8.5GB dual layer)
    // PS2 is the most common for larger ISOs (especially dual-layer)
    if (sizeMB > 4500) {
      return "PlayStation 2";
    }
    // Wii games are typically around 4.37GB (single-layer DVD), some up to 8.5GB dual-layer
    // Medium-large ISOs in the 1-4.5GB range are likely Wii
    else if (sizeMB > 800) {
      return "Wii";
    }
    // GameCube mini-DVDs are typically smaller (< 800MB, max ~1.4GB)
    // Medium-sized ISOs in the 200-800MB range are likely GameCube
    else if (sizeMB >= 200) {
      return "GameCube";
    }
    // PSP ISOs are typically smallest (< 200MB for UMD, but can be up to 1.8GB)
    // Only very small ISOs are likely PSP
    else {
      return "PSP";
    }
  }

  if (ext === ".bin") {
    // Check filename for explicit platform hints first (most reliable)
    if (name.includes("ps2") || name.includes("playstation 2"))
      return "PlayStation 2";
    if (
      name.includes("ps1") ||
      name.includes("psx") ||
      name.includes("playstation")
    )
      return "PlayStation";
    if (name.includes("dreamcast") || name.includes("dc")) return "Dreamcast";

    // Size-based detection for .bin files - PS1 first (more common for CD format)
    const sizeMB = size / (1024 * 1024);
    // Very large files are likely PS2 (some PS2 games used CD format)
    if (sizeMB > 900) return "PlayStation 2";

    // Default to PS1 for .bin files - PS1 exclusively used CD format, PS2 mostly used DVD
    // Dreamcast also used CD format but less common than PS1
    // This ensures PS1 DAT is checked first for most .bin files
    return "PlayStation";
  }

  // .cue files are just metadata pointing to .bin files, ignore them
  if (ext === ".cue") {
    return "unknown"; // .cue files should not be validated, only .bin files contain the actual data
  }

  // Fallback to name-based detection
  if (name.includes("nintendo ds")) return "Nintendo DS";
  if (name.includes("nintendo 3ds")) return "Nintendo 3DS";
  if (name.includes("game boy advance")) return "Game Boy Advance";
  if (name.includes("game boy color")) return "Game Boy Color";
  if (name.includes("game boy")) return "Game Boy";
  if (name.includes("nintendo 64")) return "Nintendo 64";
  if (name.includes("super nintendo")) return "Super Nintendo";
  if (name.includes("nintendo entertainment"))
    return "Nintendo Entertainment System";
  if (name.includes("playstation 2")) return "PlayStation 2";
  if (name.includes("playstation")) return "PlayStation";
  if (name.includes("gamecube")) return "GameCube";
  if (name.includes("wii")) return "Wii";
  if (name.includes("psp")) return "PSP";
  if (name.includes("sega genesis") || name.includes("mega drive"))
    return "Sega Genesis";
  if (name.includes("dreamcast")) return "Dreamcast";

  return "unknown";
}

// Detect region from filename
function detectRegion(filename: string): string | undefined {
  const name = filename.toUpperCase();

  if (name.includes("(USA)") || name.includes("(US)")) return "USA";
  if (name.includes("(EUROPE)") || name.includes("(EUR)")) return "Europe";
  if (name.includes("(JAPAN)") || name.includes("(JPN)")) return "Japan";
  if (name.includes("(WORLD)")) return "World";

  return undefined;
}

// Helper function to determine DAT source from platform
function getDATSource(platform: string): string | undefined {
  // Import the PLATFORMS configuration to determine the source
  // This is a synchronous operation since PLATFORMS is just a constant object
  const PLATFORMS: Record<string, string> = {
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

  const platformPath = PLATFORMS[platform];
  if (!platformPath) return undefined;

  if (platformPath.includes("/no-intro/")) {
    return "No-Intro";
  } else if (platformPath.includes("/redump/")) {
    return "Redump";
  }

  return undefined;
}

// Validate ROM against DAT entries
export function validateROM(
  file: File,
  hashes: { md5: string; sha1: string; crc32: string },
  datEntries: DATEntry[],
  datSource?: string,
): ValidationResult {
  // Look for exact hash matches (skip unavailable hashes)
  const exactMatch = datEntries.find((entry) => {
    // Try MD5 match if both are available (including fallback hash)
    if (
      entry.md5 &&
      hashes.md5 !== "unavailable" &&
      entry.md5.toLowerCase() === hashes.md5.toLowerCase()
    ) {
      return true;
    }

    // Try SHA-1 match if both are available
    if (
      entry.sha1 &&
      hashes.sha1 !== "unavailable" &&
      entry.sha1.toLowerCase() === hashes.sha1.toLowerCase()
    ) {
      return true;
    }

    // Try CRC32 match if both are available
    if (
      entry.crc32 &&
      hashes.crc32 !== "unavailable" &&
      entry.crc32.toLowerCase() === hashes.crc32.toLowerCase()
    ) {
      return true;
    }

    return false;
  });

  if (exactMatch) {
    // More intelligent filename comparison
    // Normalize both names for comparison (handle case differences, spacing, etc.)
    const normalizeFilename = (name: string) => {
      return name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ") // Normalize multiple spaces to single space
        .replace(/[^\w\s\-\.()[\]]/g, "") // Remove special chars except common ones
        .replace(/\.[^/.]+$/, ""); // Remove file extension for comparison
    };

    const userFileName = normalizeFilename(file.name);
    const datFileName = normalizeFilename(exactMatch.name);

    const isRenamed = userFileName !== datFileName;

    // Ensure suggested name includes file extension
    let suggestedName = undefined;
    if (isRenamed && exactMatch.name) {
      // Extract DAT base name (without extension)
      const datBaseName = exactMatch.name.replace(/\.[^/.]+$/, "");

      // Find the base name position in user's filename (case insensitive)
      const userLower = file.name.toLowerCase();
      const datBaseLower = datBaseName.toLowerCase();
      const baseEndPos = userLower.indexOf(datBaseLower);

      if (baseEndPos !== -1) {
        // Base name found - preserve everything after it (extensions)
        const userExtensions = file.name.substring(
          baseEndPos + datBaseName.length,
        );
        // Normalize extensions to lowercase for consistency
        const normalizedExt = userExtensions.toLowerCase();
        // Combine DAT base name + normalized user extensions
        suggestedName = datBaseName + normalizedExt;
      } else {
        // Base name not found in user's filename (shouldn't happen, but safety first)
        // Don't suggest rename as we can't determine the extensions
        suggestedName = undefined;
      }
    }

    return {
      filename: file.name,
      originalName: file.name,
      status: isRenamed ? "renamed" : "valid",
      platform: exactMatch.platform,
      region: exactMatch.region,
      size: file.size,
      hashes,
      matchedEntry: exactMatch,
      suggestedName,
      datSource, // Include the DAT source
      file, // Include original file for download functionality
    };
  }

  // Check for size matches (might be different version/region)
  const sizeMatches = datEntries.filter((entry) => entry.size === file.size);

  const issues: string[] = [];
  if (sizeMatches.length > 0) {
    issues.push("File size matches known ROMs but hashes differ");
    issues.push("May be a ROM hack, translation, or different version");
  } else {
    issues.push("No matching entries found in DAT files");
    issues.push("File may be a ROM hack, homebrew, or unknown dump");
  }

  // Try to detect platform anyway
  const platform = detectPlatformFromName(file.name, file.size);

  return {
    filename: file.name,
    originalName: file.name,
    status: "unknown",
    platform: platform !== "unknown" ? platform : undefined,
    region: detectRegion(file.name),
    size: file.size,
    hashes,
    issues,
    file, // Include original file for download functionality
  };
}

// Download and cache popular DAT files
export async function loadDATFiles(): Promise<DATEntry[]> {
  // Import the DAT loader for bundled files
  const { loadAllBundledDATs } = await import("./datLoader");
  return await loadAllBundledDATs();
}

/**
 * Determine which platforms to check for a file
 * Uses disc header detection for ISO files when auto-detecting
 * Respects forced platform selection
 */
async function determinePlatforms(
  file: File,
  forcePlatform?: string,
): Promise<string[]> {
  // If user forced a platform, only check that one
  if (forcePlatform) {
    return [forcePlatform];
  }

  const ext = file.name.toLowerCase().substring(file.name.lastIndexOf("."));

  // For ISO files, use disc header detection
  if (ext === ".iso") {
    const detected = await detectDiscPlatform(file);
    if (detected !== "unknown") {
      return [detected];
    }
    // Fallback: return all possible platforms in priority order
    return getPlatformPriority(file.size) as string[];
  }

  // For other files, use the extension map from datLoader
  const { getPlatformsForFile } = await import("./datLoader");
  const platforms = getPlatformsForFile(file.name);

  if (platforms.length > 0) {
    return platforms;
  }

  // Ultimate fallback: try to detect from filename
  const detected = detectPlatformFromName(file.name, file.size);
  if (detected !== "unknown") {
    return [detected];
  }

  return [];
}

// Process multiple files
export async function validateROMs(
  files: File[],
  onProgress?: (
    current: number,
    total: number,
    currentFile: string,
    stage: "hashing" | "loading-dats" | "validating",
    fileProgress?: number,
  ) => void,
  forcePlatform?: string,
  parallelWorkers?: number,
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Filter out .cue files before processing
  const validFiles = files.filter((file) => {
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
    return ext !== ".cue";
  });

  // Initialize worker pool if parallel processing is enabled
  const useParallel = parallelWorkers && parallelWorkers > 1;
  if (useParallel) {
    await initializePool({
      workerCount: parallelWorkers,
    });
  }

  try {
    // Process files - either parallel or sequential
    if (useParallel) {
      await processFilesParallel(
        validFiles,
        results,
        onProgress,
        forcePlatform,
        parallelWorkers,
      );
    } else {
      await processFilesSequential(
        validFiles,
        results,
        onProgress,
        forcePlatform,
      );
    }
  } finally {
    // Clean up worker pool
    if (useParallel) {
      await terminatePool();
    }
  }

  return results;
}

async function processFilesSequential(
  validFiles: File[],
  results: ValidationResult[],
  onProgress?: (
    current: number,
    total: number,
    currentFile: string,
    stage: "hashing" | "loading-dats" | "validating",
    fileProgress?: number,
  ) => void,
  forcePlatform?: string,
): Promise<void> {
  for (let i = 0; i < validFiles.length; i++) {
    const file = validFiles[i];

    // Start hashing stage
    onProgress?.(i + 1, validFiles.length, file.name, "hashing", 0);

    const hashes = await calculateFileHashes(file, (hashProgress) => {
      onProgress?.(
        i + 1,
        validFiles.length,
        file.name,
        "hashing",
        hashProgress,
      );
    });

    const result = await processSingleFileValidation(
      file,
      hashes,
      onProgress,
      i,
      validFiles.length,
      forcePlatform,
    );
    results.push(result);
  }
}

async function processFilesParallel(
  validFiles: File[],
  results: ValidationResult[],
  onProgress?: (
    current: number,
    total: number,
    currentFile: string,
    stage: "hashing" | "loading-dats" | "validating",
    fileProgress?: number,
  ) => void,
  forcePlatform?: string,
  workerCount: number = 4,
): Promise<void> {
  const batchSize = Math.min(validFiles.length, workerCount);
  let processedCount = 0;

  while (processedCount < validFiles.length) {
    const batch = validFiles.slice(processedCount, processedCount + batchSize);

    const batchPromises = batch.map(async (file, batchIndex) => {
      const globalIndex = processedCount + batchIndex;

      onProgress?.(globalIndex + 1, validFiles.length, file.name, "hashing", 0);

      const hashes = await calculateFileHashes(
        file,
        (hashProgress) => {
          onProgress?.(
            globalIndex + 1,
            validFiles.length,
            file.name,
            "hashing",
            hashProgress,
          );
        },
        workerCount,
      );

      onProgress?.(
        globalIndex + 1,
        validFiles.length,
        file.name,
        "loading-dats",
        100,
      );

      const result = await processSingleFileValidation(
        file,
        hashes,
        onProgress,
        globalIndex,
        validFiles.length,
        forcePlatform,
      );
      return result;
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    processedCount += batch.length;
  }
}

async function processSingleFileValidation(
  file: File,
  hashes: { md5: string; sha1: string; crc32: string },
  onProgress?: (
    current: number,
    total: number,
    currentFile: string,
    stage: "hashing" | "loading-dats" | "validating",
    fileProgress?: number,
  ) => void,
  currentIndex: number = 0,
  totalFiles: number = 1,
  forcePlatform?: string,
): Promise<ValidationResult> {
  // Loading DATs stage
  onProgress?.(currentIndex + 1, totalFiles, file.name, "loading-dats", 100);

  const { loadPlatformDAT } = await import("./datLoader");

  // Determine which platforms to check (uses disc detection for ISO files)
  const platforms = await determinePlatforms(file, forcePlatform);

  // Validation stage
  onProgress?.(currentIndex + 1, totalFiles, file.name, "validating", 0);

  let result: ValidationResult;

  if (forcePlatform) {
    try {
      const platformEntries = await loadPlatformDAT(forcePlatform);
      const datSource = getDATSource(forcePlatform);
      result = validateROM(file, hashes, platformEntries, datSource);
    } catch (error) {
      console.error(`Error loading forced platform ${forcePlatform}:`, error);
      result = {
        filename: file.name,
        originalName: file.name,
        status: "unknown",
        size: file.size,
        hashes,
        issues: [
          `Failed to load DAT for forced platform: ${forcePlatform}`,
          error instanceof Error ? error.message : String(error),
        ],
        file,
      };
    }
  } else if (platforms.length > 0) {
    if (platforms.length > 1) {
      const mostLikelyPlatform = detectPlatformFromName(file.name, file.size);

      const orderedPlatforms = platforms.includes(mostLikelyPlatform)
        ? [
            mostLikelyPlatform,
            ...platforms.filter((p) => p !== mostLikelyPlatform),
          ]
        : platforms;

      let resultVal: ValidationResult = {
        status: "unknown",
      } as ValidationResult;

      for (const platform of orderedPlatforms) {
        const platformEntries = await loadPlatformDAT(platform);
        const datSource = getDATSource(platform);
        const platformResult = validateROM(
          file,
          hashes,
          platformEntries,
          datSource,
        );

        if (platformResult.status !== "unknown") {
          resultVal = platformResult;
          break;
        }
      }

      if (resultVal.status === "unknown") {
        const ext = file.name
          .toLowerCase()
          .substring(file.name.lastIndexOf("."));

        let fallbackPlatforms: string[] = [];

        if (ext === ".iso") {
          fallbackPlatforms = ["PlayStation 2", "PSP", "GameCube"];
        } else if (ext === ".bin") {
          fallbackPlatforms = ["PlayStation", "Dreamcast", "PlayStation 2"];
        }

        if (fallbackPlatforms.length > 0) {
          const uncheckedPlatforms = fallbackPlatforms.filter(
            (p) => !orderedPlatforms.includes(p),
          );

          for (const platform of uncheckedPlatforms) {
            const fallbackEntries = await loadPlatformDAT(platform);
            const datSource = getDATSource(platform);
            const fallbackResult = validateROM(
              file,
              hashes,
              fallbackEntries,
              datSource,
            );

            if (fallbackResult.status !== "unknown") {
              resultVal = fallbackResult;
              break;
            }
          }
        }
      }

      if (resultVal.status === "unknown") {
        const fallbackEntries = await loadPlatformDAT(orderedPlatforms[0]);
        const datSource = getDATSource(orderedPlatforms[0]);
        resultVal = validateROM(file, hashes, fallbackEntries, datSource);
      }

      result = resultVal;
    } else {
      const platformEntries = await loadPlatformDAT(platforms[0]);
      const datSource = getDATSource(platforms[0]);
      result = validateROM(file, hashes, platformEntries, datSource);
    }
  } else {
    const platformEntries = await loadDATFiles();
    result = validateROM(file, hashes, platformEntries, "Mixed");
  }

  onProgress?.(currentIndex + 1, totalFiles, file.name, "validating", 100);
  return result;
}
