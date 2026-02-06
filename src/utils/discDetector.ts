// Disc platform detection using file headers and magic numbers
// Provides more accurate detection than size-based heuristics

export type DiscPlatform =
  | "PlayStation 2"
  | "Wii"
  | "GameCube"
  | "PSP"
  | "unknown";

// Size of header to read (64KB is enough for all disc formats)
const HEADER_SIZE = 64 * 1024;

/**
 * Detect disc platform by reading file headers
 * Reads only first 64KB for efficiency
 */
export async function detectDiscPlatform(file: File): Promise<DiscPlatform> {
  try {
    // Read first 64KB which contains all relevant headers
    const headerChunk = file.slice(0, Math.min(HEADER_SIZE, file.size));
    const buffer = await headerChunk.arrayBuffer();
    const data = new Uint8Array(buffer);

    // Check each platform in order of detection reliability
    // GameCube and Wii have very reliable magic numbers
    if (isGameCubeDisc(data)) {
      return "GameCube";
    }

    if (isWiiDisc(data)) {
      return "Wii";
    }

    if (isPSPDisc(data)) {
      return "PSP";
    }

    if (isPS2Disc(data)) {
      return "PlayStation 2";
    }

    return "unknown";
  } catch (error) {
    console.warn("Failed to detect disc platform:", error);
    return "unknown";
  }
}

/**
 * Check for GameCube disc format
 * GameCube uses a unique magic number at offset 0x1C
 * Magic: 0xC2339F3D (byteswapped)
 */
function isGameCubeDisc(data: Uint8Array): boolean {
  if (data.length < 0x20) return false;

  // GameCube magic number at offset 0x1C (byteswapped)
  const magic =
    (data[0x1c] << 24) | (data[0x1d] << 16) | (data[0x1e] << 8) | data[0x1f];

  return magic === 0xc2339f3d;
}

/**
 * Check for Wii disc format
 * Wii uses a unique magic number at offset 0x18
 * Magic: 0x5D1C9EA3
 */
function isWiiDisc(data: Uint8Array): boolean {
  if (data.length < 0x20) return false;

  // Wii magic number at offset 0x18
  const magic =
    (data[0x18] << 24) | (data[0x19] << 16) | (data[0x1a] << 8) | data[0x1b];

  return magic === 0x5d1c9ea3;
}

/**
 * Check for PSP UMD disc format
 * PSP uses ISO9660 with a PSP_GAME directory
 * We check for "PSP_GAME" string in the root directory
 */
function isPSPDisc(data: Uint8Array): boolean {
  // PSP uses standard ISO9660 format
  // Check for ISO9660 signature first
  if (!isISO9660(data)) {
    return false;
  }

  // Look for "PSP_GAME" string in the volume descriptor or root directory
  // This is a simplified check - look for the string in the first 32KB
  const searchString = "PSP_GAME";
  const searchLength = Math.min(data.length, 32 * 1024);

  for (let i = 0; i <= searchLength - searchString.length; i++) {
    let match = true;
    for (let j = 0; j < searchString.length; j++) {
      if (data[i + j] !== searchString.charCodeAt(j)) {
        match = false;
        break;
      }
    }
    if (match) {
      return true;
    }
  }

  return false;
}

/**
 * Check for PlayStation 2 disc format
 * PS2 uses ISO9660 with specific markers
 * Checks for "PLAYSTATION" marker or specific file references
 */
function isPS2Disc(data: Uint8Array): boolean {
  // Check for ISO9660 format
  if (!isISO9660(data)) {
    return false;
  }

  // Look for PlayStation-specific markers
  // Check for "PLAYSTATION" string (case insensitive)
  const markers = ["PLAYSTATION", "PS2DVD", "CD001"];
  const searchLength = Math.min(data.length, 32 * 1024);

  for (const marker of markers) {
    for (let i = 0; i <= searchLength - marker.length; i++) {
      let match = true;
      for (let j = 0; j < marker.length; j++) {
        const charCode = data[i + j];
        const expectedChar = marker.charCodeAt(j);
        // Case-insensitive comparison
        if (
          charCode !== expectedChar &&
          charCode !== expectedChar + 32 &&
          charCode !== expectedChar - 32
        ) {
          match = false;
          break;
        }
      }
      if (match) {
        return true;
      }
    }
  }

  // Check for SYSTEM.CNF reference (common in PS2 discs)
  const cnfString = "SYSTEM.CNF";
  for (let i = 0; i <= searchLength - cnfString.length; i++) {
    let match = true;
    for (let j = 0; j < cnfString.length; j++) {
      const charCode = data[i + j];
      const expectedChar = cnfString.charCodeAt(j);
      // Case-insensitive
      if (
        charCode !== expectedChar &&
        charCode !== expectedChar + 32 &&
        charCode !== expectedChar - 32
      ) {
        match = false;
        break;
      }
    }
    if (match) {
      return true;
    }
  }

  return false;
}

/**
 * Check if data is in ISO9660 format
 * ISO9660 has specific signatures at specific offsets
 */
function isISO9660(data: Uint8Array): boolean {
  if (data.length < 0x8000) return false;

  // Check for ISO9660 primary volume descriptor at offset 0x8000
  // Should start with '\x01CD001\x01' or similar
  const isoOffset = 0x8000;

  // Check for CD001 signature (ISO9660 identifier)
  if (
    data[isoOffset + 1] === 0x43 && // C
    data[isoOffset + 2] === 0x44 && // D
    data[isoOffset + 3] === 0x30 && // 0
    data[isoOffset + 4] === 0x30 && // 0
    data[isoOffset + 5] === 0x31 // 1
  ) {
    return true;
  }

  // Alternative: Check at 0x800 (some formats use this offset)
  const altOffset = 0x800;
  if (
    data[altOffset + 1] === 0x43 &&
    data[altOffset + 2] === 0x44 &&
    data[altOffset + 3] === 0x30 &&
    data[altOffset + 4] === 0x30 &&
    data[altOffset + 5] === 0x31
  ) {
    return true;
  }

  return false;
}

/**
 * Get platform priority for fallback ordering
 * Returns platforms in order of likelihood when detection fails
 */
export function getPlatformPriority(fileSize: number): DiscPlatform[] {
  const sizeMB = fileSize / (1024 * 1024);

  // Size-based fallback ordering
  if (sizeMB > 4500) {
    // Large files are most likely PS2 (dual-layer DVDs)
    return ["PlayStation 2", "Wii", "PSP", "GameCube"];
  } else if (sizeMB > 800) {
    // Medium-large files: Wii or PS2
    return ["Wii", "PlayStation 2", "GameCube", "PSP"];
  } else if (sizeMB >= 200) {
    // Medium files: GameCube or Wii
    return ["GameCube", "Wii", "PlayStation 2", "PSP"];
  } else {
    // Small files: PSP or GameCube
    return ["PSP", "GameCube", "PlayStation 2", "Wii"];
  }
}

/**
 * Validate that a detected platform matches expected platforms
 * Useful for filtering when multiple platform DATs are loaded
 */
export function isPlatformMatch(
  detected: DiscPlatform,
  expected: string[],
): boolean {
  if (detected === "unknown") return true; // Accept unknown
  return expected.includes(detected);
}
