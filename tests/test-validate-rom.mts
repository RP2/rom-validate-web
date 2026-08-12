#!/usr/bin/env tsx
// Requires Node.js 20+ (uses global File constructor)

import { validateROM, type DATEntry } from "../src/utils/romValidator.js";

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

// ============================================================
console.log("\n📋 Exact MD5 Match");
// ============================================================

{
  const file = new File([new Uint8Array(0)], "Pokemon.gba", { type: "application/octet-stream" });
  const hashes = { md5: "abc123", sha1: "def456", crc32: "789abc" };
  const entries: DATEntry[] = [{ name: "Pokemon.gba", size: 0, md5: "abc123" }];
  const result = validateROM(file, hashes, entries);
  assertEqual(result.status, "valid", "MD5 match → valid");
  assert(result.matchedEntry !== undefined, "matchedEntry is set");
  assertEqual(result.matchedEntry?.name, "Pokemon.gba", "matched the right entry");
}

// ============================================================
console.log("\n📋 Exact SHA-1 Match");
// ============================================================

{
  const file = new File([new Uint8Array(0)], "Game.nds", { type: "application/octet-stream" });
  const hashes = { md5: "nomatch", sha1: "sha1value", crc32: "nomatch" };
  const entries: DATEntry[] = [{ name: "Game.nds", size: 0, sha1: "sha1value" }];
  const result = validateROM(file, hashes, entries);
  assertEqual(result.status, "valid", "SHA-1 match → valid");
  assert(result.matchedEntry !== undefined, "matchedEntry is set");
  assertEqual(result.matchedEntry?.name, "Game.nds", "matched the right entry");
}

// ============================================================
console.log("\n📋 Exact CRC32 Match");
// ============================================================

{
  const file = new File([new Uint8Array(0)], "Rom.smc", { type: "application/octet-stream" });
  const hashes = { md5: "nomatch", sha1: "nomatch", crc32: "AABBCCDD" };
  const entries: DATEntry[] = [{ name: "Rom.smc", size: 0, crc32: "AABBCCDD" }];
  const result = validateROM(file, hashes, entries);
  assertEqual(result.status, "valid", "CRC32 match → valid");
  assert(result.matchedEntry !== undefined, "matchedEntry is set");
  assertEqual(result.matchedEntry?.name, "Rom.smc", "matched the right entry");
}

// ============================================================
console.log("\n📋 No Match → Unknown");
// ============================================================

{
  const file = new File([new Uint8Array(64)], "Unknown.gba", { type: "application/octet-stream" });
  const entries = [{ name: "Other.gba", size: 999, md5: "nope" }];
  const result = validateROM(file, { md5: "abc", sha1: "def", crc32: "ghi" }, entries);
  assertEqual(result.status, "unknown", "status is unknown");
  assert(result.issues?.some(i => i.includes("No matching entries found")) ?? false, "issues mention no matching entries");
}

// ============================================================
console.log("\n📋 Match but Different Filename → Renamed");
// ============================================================

{
  const file = new File([new Uint8Array(0)], "Pokemon (USA).gba", { type: "application/octet-stream" });
  const hashes = { md5: "matchmd5", sha1: "x", crc32: "x" };
  const entries: DATEntry[] = [{ name: "Pokemon.gba", size: 0, md5: "matchmd5" }];
  const result = validateROM(file, hashes, entries);
  assertEqual(result.status, "renamed", "Different filename → renamed");
  assert(result.suggestedName !== undefined, "suggestedName is defined");
  assert(result.suggestedName?.toLowerCase().includes("pokemon") ?? false, "suggested name contains base name");
}

// ============================================================
console.log("\n📋 Match with Same Filename → Valid");
// ============================================================

{
  const file = new File([new Uint8Array(0)], "Pokemon.gba", { type: "application/octet-stream" });
  const hashes = { md5: "matchmd5", sha1: "x", crc32: "x" };
  const entries: DATEntry[] = [{ name: "Pokemon.gba", size: 0, md5: "matchmd5" }];
  const result = validateROM(file, hashes, entries);
  assertEqual(result.status, "valid", "Same filename → valid");
}

// ============================================================
console.log("\n📋 Unavailable Hashes Skipped");
// ============================================================

{
  const file = new File([new Uint8Array(0)], "Test.gba", { type: "application/octet-stream" });
  const entries = [{ name: "Test.gba", size: 0, md5: "dat_md5_value", sha1: "sha1match" }];
  const result = validateROM(file, { md5: "unavailable", sha1: "sha1match", crc32: "" }, entries);
  assertEqual(result.status, "valid", "matches via SHA-1 when MD5 is unavailable");
  assert(result.matchedEntry?.sha1 === "sha1match", "matched on SHA-1, not MD5");
}

// ============================================================
console.log("\n📋 Case-Insensitive Hash Matching");
// ============================================================

{
  const file = new File([new Uint8Array(0)], "Case.gba", { type: "application/octet-stream" });
  const hashes = { md5: "abcdef1234567890", sha1: "x", crc32: "x" };
  const entries: DATEntry[] = [{ name: "Case.gba", size: 0, md5: "ABCDEF1234567890" }];
  const result = validateROM(file, hashes, entries);
  assertEqual(result.status, "valid", "Uppercase DAT hash vs lowercase input → valid");
}

// ============================================================
console.log("\n📋 Size-Only Match (No Hash Match)");
// ============================================================

{
  const file = new File([new Uint8Array(1024)], "test.iso", { type: "application/octet-stream" });
  const hashes = { md5: "nomatch", sha1: "nomatch", crc32: "nomatch" };
  const entries: DATEntry[] = [{ name: "test.iso", size: 1024, md5: "different" }];
  const result = validateROM(file, hashes, entries);
  assertEqual(result.status, "unknown", "Size matches but hashes don't → unknown");
  const hasSizeIssue = result.issues?.some((i) => i.toLowerCase().includes("size matches")) ?? false;
  assert(hasSizeIssue, "Issues mention size matches");
}

// ============================================================
console.log("\n📋 Multiple DAT Entries, Second Matches");
// ============================================================

{
  const file = new File([new Uint8Array(0)], "Target.gba", { type: "application/octet-stream" });
  const hashes = { md5: "second_md5", sha1: "x", crc32: "x" };
  const entries: DATEntry[] = [
    { name: "First.gba", size: 0, md5: "first_md5" },
    { name: "Target.gba", size: 0, md5: "second_md5" },
    { name: "Third.gba", size: 0, md5: "third_md5" },
  ];
  const result = validateROM(file, hashes, entries);
  assertEqual(result.status, "valid", "Second entry matches → valid");
  assertEqual(result.matchedEntry?.name, "Target.gba", "Matched the second entry");
}

// ============================================================
console.log("\n📋 datSource Passthrough");
// ============================================================

{
  const file = new File([new Uint8Array(0)], "Game.gba", { type: "application/octet-stream" });
  const hashes = { md5: "mymd5", sha1: "x", crc32: "x" };
  const entries: DATEntry[] = [{ name: "Game.gba", size: 0, md5: "mymd5" }];
  const result = validateROM(file, hashes, entries, "Redump");
  assertEqual(result.status, "valid", "datSource scenario resolves to valid");
  assertEqual(result.datSource, "Redump", "datSource passed through to result");
}

// ============================================================
console.log("\n📋 Empty DAT Entries");
// ============================================================

{
  const file = new File([new Uint8Array(0)], "Empty.gba", { type: "application/octet-stream" });
  const hashes = { md5: "x", sha1: "x", crc32: "x" };
  const result = validateROM(file, hashes, []);
  assertEqual(result.status, "unknown", "Empty DAT entries → unknown");
  assert((result.issues?.length ?? 0) > 0, "issues populated for empty DAT");
}

// ============================================================
console.log("\n📋 Summary");
// ============================================================

console.log(`\n  ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log("🎉 All validateROM tests passed!\n");
} else {
  console.log(`⚠️  ${failed} test(s) failed\n`);
  process.exit(1);
}
