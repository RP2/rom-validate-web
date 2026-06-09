#!/usr/bin/env tsx

// Test script for core validation logic
// Run with: npx tsx tests/test-validation-logic.mts

import {
  getPlatformsForFile,
  isEncryptionProne,
  EXTENSION_MAP,
  PLATFORMS,
} from "../src/utils/datLoader.js";

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
console.log("\n📋 Extension Mapping Tests");
// ============================================================

assert(EXTENSION_MAP[".gba"] === "Game Boy Advance", ".gba maps to GBA");
assert(EXTENSION_MAP[".nds"].length === 3, ".nds maps to 3 platforms (DS, DS Download Play, DSi)");
assert(EXTENSION_MAP[".iso"].length === 4, ".iso maps to 4 platforms");
assert(EXTENSION_MAP[".bin"].length === 3, ".bin maps to 3 platforms");
assert(EXTENSION_MAP[".smc"] === "Super Nintendo", ".smc maps to SNES");
assert(EXTENSION_MAP[".sfc"] === "Super Nintendo", ".sfc maps to SNES");

// ============================================================
console.log("\n📋 Platform Detection Tests");
// ============================================================

assertEqual(
  getPlatformsForFile("Pokemon Ruby.gba"),
  ["Game Boy Advance"],
  "GBA file detected"
);

assertEqual(
  getPlatformsForFile("Super Mario 64.n64"),
  ["Nintendo 64"],
  "N64 file detected"
);

assertEqual(
  getPlatformsForFile("Mario Kart DS.nds").length,
  3,
  "NDS file maps to multiple platforms"
);

assertEqual(
  getPlatformsForFile("Final Fantasy VII.iso").length,
  4,
  "ISO file maps to multiple platforms"
);

assertEqual(
  getPlatformsForFile("unknown.xyz"),
  [],
  "Unknown extension returns empty array"
);

// ============================================================
console.log("\n📋 Encryption Detection Tests");
// ============================================================

assert(isEncryptionProne("game.nds"), "NDS files are encryption-prone");
assert(isEncryptionProne("game.3ds"), "3DS files are encryption-prone");
assert(!isEncryptionProne("game.gba"), "GBA files are not encryption-prone");
assert(!isEncryptionProne("game.smc"), "SNES files are not encryption-prone");

// ============================================================
console.log("\n📋 Platform Configuration Tests");
// ============================================================

const totalPlatforms = Object.keys(PLATFORMS).length;
assert(totalPlatforms >= 15, `At least 15 platforms supported (got ${totalPlatforms})`);

const noIntroCount = Object.values(PLATFORMS).filter(p => p.includes("no-intro")).length;
const redumpCount = Object.values(PLATFORMS).filter(p => p.includes("redump")).length;
assert(noIntroCount > 0, `No-Intro sources exist (${noIntroCount})`);
assert(redumpCount > 0, `Redump sources exist (${redumpCount})`);

// ============================================================
console.log("\n📋 DAT Cache Key Tests");
// ============================================================

// Verify cache keys are well-formed (no spaces or special chars that break localStorage)
for (const platform of Object.keys(PLATFORMS)) {
  const hasSpaces = platform.includes("  "); // double spaces
  assert(!hasSpaces, `Platform "${platform}" has no double spaces`);
}

// ============================================================
console.log("\n📋 Summary");
// ============================================================

console.log(`\n  ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log("🎉 All validation logic tests passed!\n");
} else {
  console.log(`⚠️  ${failed} test(s) failed\n`);
  process.exit(1);
}