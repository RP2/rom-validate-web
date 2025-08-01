#!/usr/bin/env tsx

// Test script to verify CLI-compatible configuration
// Run with: npx tsx tests/test-config.mts

import {
  getPlatformsForFile,
  PLATFORMS,
  EXTENSION_MAP,
} from "../src/utils/datLoader.js";

console.log("🔍 Testing ROM Validator Configuration\n");

// Test extension mapping
const testFiles = [
  "Super Mario 64.n64",
  "Pokemon Ruby.gba",
  "Mario Kart DS.nds",
  "Final Fantasy VII.iso",
  "Metroid Prime.gcm",
  "unknown_file.xyz",
];

let detectedCount = 0;
testFiles.forEach((filename) => {
  const platforms = getPlatformsForFile(filename);
  if (platforms.length > 0) {
    detectedCount++;
    console.log(`✅ ${filename.padEnd(25)} → ${platforms.join(", ")}`);
  } else {
    console.log(`❌ ${filename.padEnd(25)} → Unknown format`);
  }
});

const totalPlatforms = Object.keys(PLATFORMS).length;
const totalExtensions = Object.keys(EXTENSION_MAP).length;
const noIntroCount = Object.values(PLATFORMS).filter((p) =>
  p.includes("no-intro"),
).length;
const redumpCount = Object.values(PLATFORMS).filter((p) =>
  p.includes("redump"),
).length;

console.log(`\n� Configuration Summary:`);
console.log(`  🎮 ${totalPlatforms} platforms supported`);
console.log(
  `  🔧 ${noIntroCount} No-Intro sources, ${redumpCount} Redump sources`,
);
console.log(`  📁 ${totalExtensions} file extensions mapped`);
console.log(
  `  ✅ ${detectedCount}/${testFiles.length} test files detected correctly`,
);

if (detectedCount === testFiles.length - 1) {
  // -1 because unknown_file.xyz should fail
  console.log("\n🎉 All configuration tests passed!");
} else {
  console.log("\n⚠️  Some configuration issues detected");
}
