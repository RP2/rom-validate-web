#!/usr/bin/env tsx
// Requires Node.js 20+ (uses File, Uint8Array)

import {
  detectDiscPlatform,
  getPlatformPriority,
  type DiscPlatform,
} from "../src/utils/discDetector.js";

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
    console.error(
      `  ❌ ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
    failed++;
  }
}

const encoder = new TextEncoder();

// ============================================================
console.log("\n📀 detectDiscPlatform: GameCube");
// ============================================================

{
  const buf = new Uint8Array(256);
  buf[0x1c] = 0xc2;
  buf[0x1d] = 0x33;
  buf[0x1e] = 0x9f;
  buf[0x1f] = 0x3d;
  const file = new File([buf], "gamecube.iso", {
    type: "application/octet-stream",
  });
  const result = await detectDiscPlatform(file);
  assertEqual(result, "GameCube", "GameCube disc detected from magic bytes");
}

// ============================================================
console.log("\n📀 detectDiscPlatform: Wii");
// ============================================================

{
  const buf = new Uint8Array(256);
  buf[0x18] = 0x5d;
  buf[0x19] = 0x1c;
  buf[0x1a] = 0x9e;
  buf[0x1b] = 0xa3;
  const file = new File([buf], "wii.iso", {
    type: "application/octet-stream",
  });
  const result = await detectDiscPlatform(file);
  assertEqual(result, "Wii", "Wii disc detected from magic bytes");
}

// ============================================================
console.log("\n📀 detectDiscPlatform: PSP");
// ============================================================

{
  const buf = new Uint8Array(32800);
  buf.set(encoder.encode("CD001"), 0x8001);
  buf.set(encoder.encode("PSP_GAME"), 0x1000);
  const file = new File([buf], "psp.iso", {
    type: "application/octet-stream",
  });
  const result = await detectDiscPlatform(file);
  assertEqual(result, "PSP", "PSP disc detected from ISO9660 + PSP_GAME");
}

// ============================================================
console.log("\n📀 detectDiscPlatform: PS2");
// ============================================================

{
  const buf = new Uint8Array(32800);
  buf.set(encoder.encode("CD001"), 0x8001);
  buf.set(encoder.encode("PLAYSTATION"), 0x1000);
  const file = new File([buf], "ps2.iso", {
    type: "application/octet-stream",
  });
  const result = await detectDiscPlatform(file);
  assertEqual(
    result,
    "PlayStation 2",
    "PS2 disc detected from ISO9660 + PLAYSTATION",
  );
}

// ============================================================
console.log("\n📀 detectDiscPlatform: Unknown");
// ============================================================

{
  const buf = new Uint8Array(256).fill(0);
  const file = new File([buf], "unknown.iso", {
    type: "application/octet-stream",
  });
  const result = await detectDiscPlatform(file);
  assertEqual(result, "unknown", "Unknown format returns 'unknown'");
}

// ============================================================
console.log("\n📀 detectDiscPlatform: Empty/small file");
// ============================================================

{
  const buf = new Uint8Array(16).fill(0);
  const file = new File([buf], "tiny.iso", {
    type: "application/octet-stream",
  });
  const result = await detectDiscPlatform(file);
  assertEqual(result, "unknown", "Small file (< 0x20 bytes) returns 'unknown'");
}

// ============================================================
console.log("\n📀 getPlatformPriority: Large file (>4.5GB)");
// ============================================================

{
  const size = 4.5 * 1024 * 1024 * 1024 + 1;
  const result = getPlatformPriority(size);
  assertEqual(
    result[0],
    "PlayStation 2",
    "Large file (>4.5GB) returns PS2 first",
  );
}

// ============================================================
console.log("\n📀 getPlatformPriority: Medium-large file (>800MB)");
// ============================================================

{
  const size = 900 * 1024 * 1024;
  const result = getPlatformPriority(size);
  assertEqual(result[0], "Wii", "Medium-large file (>800MB) returns Wii first");
}

// ============================================================
console.log("\n📀 getPlatformPriority: Medium file (>=200MB)");
// ============================================================

{
  const size = 200 * 1024 * 1024;
  const result = getPlatformPriority(size);
  assertEqual(
    result[0],
    "GameCube",
    "Medium file (>=200MB) returns GameCube first",
  );
}

// ============================================================
console.log("\n📀 getPlatformPriority: Small file (<200MB)");
// ============================================================

{
  const size = 100 * 1024 * 1024;
  const result = getPlatformPriority(size);
  assertEqual(result[0], "PSP", "Small file (<200MB) returns PSP first");
}

// ============================================================
console.log("\n📀 getPlatformPriority: All platforms present");
// ============================================================

{
  const allPlatforms: DiscPlatform[] = [
    "PlayStation 2",
    "Wii",
    "GameCube",
    "PSP",
  ];
  const sizes = [
    5 * 1024 * 1024 * 1024,
    900 * 1024 * 1024,
    300 * 1024 * 1024,
    50 * 1024 * 1024,
  ];
  for (const size of sizes) {
    const result = getPlatformPriority(size);
    const sortedResult = [...result].sort();
    const sortedExpected = [...allPlatforms].sort();
    assertEqual(
      sortedResult,
      sortedExpected,
      `Priority list for size ${size} contains all 4 platforms`,
    );
  }
}

// ============================================================
console.log("\n📋 Summary");
// ============================================================

console.log(`\n  ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log("🎉 All disc detection tests passed!\n");
} else {
  console.log(`⚠️  ${failed} test(s) failed\n`);
  process.exit(1);
}
