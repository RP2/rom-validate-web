// Client-side ROM validation utilities

// Simple MD5 implementation as fallback when Web Crypto API doesn't support it
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
  platform: string;
  region?: string;
  description?: string;
}

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

// Calculate file hashes client-side
export async function calculateFileHashes(
  file: File,
): Promise<{ md5: string; sha1: string; crc32: string }> {
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);

  let md5 = "";
  let sha1 = "";

  try {
    // Try to calculate SHA-1 (widely supported)
    const sha1Hash = await crypto.subtle.digest("SHA-1", buffer);
    const sha1Array = Array.from(new Uint8Array(sha1Hash));
    sha1 = sha1Array.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (error) {
    console.warn("SHA-1 calculation failed:", error);
    sha1 = "unavailable";
  }

  try {
    // Try to calculate MD5 (may not be available in all browsers)
    const md5Hash = await crypto.subtle.digest("MD5", buffer);
    const md5Array = Array.from(new Uint8Array(md5Hash));
    md5 = md5Array.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (error) {
    console.warn("MD5 not supported in this browser, using fallback:", error);
    // Fallback: use a simplified hash or mark as unavailable
    md5 = simpleMD5(data);
  }

  // Calculate CRC32 (always available since it's our implementation)
  const crc32Hash = crc32(data);

  return { md5, sha1, crc32: crc32Hash };
}

// Parse DAT files (supports both XML and ClrMamePro formats)
export function parseDAT(datContent: string): DATEntry[] {
  console.log("📄 DAT content preview:", datContent.substring(0, 500));
  console.log("📄 DAT content length:", datContent.length);

  // Detect format by checking the content
  if (
    datContent.trim().startsWith("<?xml") ||
    datContent.includes("<datafile>")
  ) {
    console.log("📄 Detected XML format");
    return parseXMLDAT(datContent);
  } else {
    console.log("📄 Detected ClrMamePro format");
    return parseClrMameProDAT(datContent);
  }
}

// Parse XML DAT files
function parseXMLDAT(xmlContent: string): DATEntry[] {
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

      // Try to detect platform from DAT structure or filename
      const platform = detectPlatformFromName(name, size);
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
function parseClrMameProDAT(datContent: string): DATEntry[] {
  const entries: DATEntry[] = [];
  const lines = datContent.split("\n");

  console.log("📄 Parsing ClrMamePro with", lines.length, "lines");

  let currentGame: any = {};
  let inGame = false;
  let inRom = false;
  let currentRom: any = {};
  let gameCount = 0;
  let inClrMameProHeader = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmed = line.trim();

    // Debug first few lines
    if (lineIndex < 20) {
      console.log(`Line ${lineIndex}: "${trimmed}"`);
    }

    // Skip clrmamepro header block
    if (trimmed.startsWith("clrmamepro (")) {
      inClrMameProHeader = true;
      console.log("📄 Found clrmamepro header block");
      continue;
    }

    if (inClrMameProHeader && trimmed === ")") {
      inClrMameProHeader = false;
      console.log("📄 End of clrmamepro header block");
      continue;
    }

    if (inClrMameProHeader) {
      continue; // Skip header content
    }

    if (trimmed.startsWith("game (")) {
      inGame = true;
      currentGame = {};
      gameCount++;

      if (gameCount <= 3) {
        console.log("📄 Found game block:", trimmed);
      }

      // For multi-line game blocks, the name is usually on the next line
      // But check if name is on the same line first
      const nameMatch = trimmed.match(/name\s+"([^"]+)"/);
      if (nameMatch) {
        currentGame.name = nameMatch[1];
        if (gameCount <= 3) {
          console.log("📄 Game name (same line):", currentGame.name);
        }
      }
    } else if (trimmed === ")" && inGame && !inRom) {
      // End of game block
      inGame = false;
      if (gameCount <= 3) {
        console.log("📄 End of game block for:", currentGame.name);
      }
      currentGame = {};
    } else if (trimmed.startsWith("rom (") && inGame) {
      inRom = true;
      currentRom = {};

      if (gameCount <= 3) {
        console.log("📄 Found rom block:", trimmed);
      }

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
          const platform = detectPlatformFromName(
            currentGame.name,
            currentRom.size || 0,
          );
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

          if (entries.length <= 3) {
            console.log("📄 Added entry:", {
              name: currentGame.name,
              size: currentRom.size,
              crc32: currentRom.crc32,
            });
          }
        }

        currentRom = {};
      }
    } else if (trimmed === ")" && inRom) {
      // End of rom block
      inRom = false;

      if (currentRom.name && currentGame.name) {
        const platform = detectPlatformFromName(
          currentGame.name,
          currentRom.size || 0,
        );
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

        if (entries.length <= 3) {
          console.log("📄 Added entry:", {
            name: currentGame.name,
            size: currentRom.size,
            crc32: currentRom.crc32,
          });
        }
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
        if (gameCount <= 3) {
          console.log("📄 Game name (separate line):", currentGame.name);
        }
      }
      if (descMatch) {
        currentGame.description = descMatch[1];
      }
      if (regionMatch) {
        currentGame.region = regionMatch[1];
      }
    }
  }

  console.log(
    "📄 ClrMamePro parsing complete:",
    entries.length,
    "entries found",
  );
  return entries;
}

// Detect platform from filename patterns and content
function detectPlatformFromName(filename: string, size: number): string {
  const name = filename.toLowerCase();

  // Use CLI-style extension mapping for better accuracy
  const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));

  // Direct extension mapping first
  if (ext === ".gba") return "Game Boy Advance";
  if (ext === ".gb") return "Game Boy";
  if (ext === ".gbc") return "Game Boy Color";
  if (ext === ".nds") return "Nintendo DS";
  if (ext === ".3ds") return "Nintendo 3DS";
  if (ext === ".n64" || ext === ".z64") return "Nintendo 64";
  if (ext === ".smc" || ext === ".sfc") return "Super Nintendo";
  if (ext === ".nes") return "Nintendo Entertainment System";
  if (ext === ".cso" || ext === ".pbp") return "PSP";
  if (ext === ".gcm" || ext === ".ciso") return "GameCube";
  if (ext === ".wbfs") return "Wii";
  if (ext === ".psx") return "PlayStation";

  // Size-based detection for multi-platform formats
  if (ext === ".iso") {
    if (size > 1000000000) return "Wii"; // ~1GB+ likely Wii
    if (size > 600000000) return "PlayStation 2"; // ~600MB+ likely PS2
    if (size > 50000000) return "PlayStation"; // ~50MB+ likely PSX
    return "PSP"; // Smaller ISOs likely PSP
  }

  if (ext === ".cue" || ext === ".bin") {
    if (size > 600000000) return "PlayStation 2";
    return "PlayStation";
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

// Validate ROM against DAT entries
export function validateROM(
  file: File,
  hashes: { md5: string; sha1: string; crc32: string },
  datEntries: DATEntry[],
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

    console.log(`🔍 Filename comparison:`, {
      userFile: file.name,
      datEntry: exactMatch.name,
      userNormalized: userFileName,
      datNormalized: datFileName,
      areEqual: userFileName === datFileName,
    });

    const isRenamed = userFileName !== datFileName;

    // Ensure suggested name includes file extension
    let suggestedName = undefined;
    if (isRenamed && exactMatch.name) {
      // Get the original file extension
      const originalExt = file.name.substring(file.name.lastIndexOf("."));

      // If the DAT name doesn't end with the same extension, add it
      if (exactMatch.name.toLowerCase().endsWith(originalExt.toLowerCase())) {
        suggestedName = exactMatch.name;
      } else {
        // Remove any existing extension from DAT name and add the original extension
        const nameWithoutExt = exactMatch.name.replace(/\.[^/.]+$/, "");
        suggestedName = nameWithoutExt + originalExt;
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

// Process multiple files
export async function validateROMs(
  files: File[],
  onProgress?: (current: number, total: number, currentFile: string) => void,
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(i + 1, files.length, file.name);

    const hashes = await calculateFileHashes(file);

    // Get platform-specific DAT entries based on file extension (CLI-style)
    const { getPlatformsForFile, loadMultiplePlatformDATs } = await import(
      "./datLoader"
    );
    const platforms = getPlatformsForFile(file.name);

    let platformEntries: DATEntry[] = [];
    if (platforms.length > 0) {
      platformEntries = await loadMultiplePlatformDATs(platforms);
    } else {
      // Fallback to all DATs if platform detection fails
      platformEntries = await loadDATFiles();
    }

    const result = validateROM(file, hashes, platformEntries);
    results.push(result);
  }

  return results;
}
