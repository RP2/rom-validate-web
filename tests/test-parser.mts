#!/usr/bin/env tsx
// Requires Node.js 20+

import { parseDAT, type DATEntry } from "../src/utils/romValidator.js";

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
console.log("\n📋 ClrMamePro: Single Game, Single ROM");
// ============================================================

{
  const dat = `clrmamepro (
\tname "No-Intro"
\tversion "2024"
)

game (
\tname "Pokemon Ruby (USA)"
\trom ( name "Pokemon Ruby (USA).gba" size 16777216 crc AABBCCDD md5 1234567890abcdef1234567890abcdef sha1 aabbccdd11223344aabbccdd11223344aabbccdd )
)`;

  const entries = parseDAT(dat);
  assertEqual(entries.length, 1, "1 entry returned");
  assertEqual(entries[0].name, "Pokemon Ruby (USA)", "name is game name");
  assertEqual(entries[0].size, 16777216, "size parsed correctly");
  assertEqual(entries[0].crc32, "AABBCCDD", "crc32 is uppercase");
  assertEqual(entries[0].md5, "1234567890abcdef1234567890abcdef", "md5 is lowercase");
  assertEqual(entries[0].sha1, "aabbccdd11223344aabbccdd11223344aabbccdd", "sha1 is lowercase");
  assertEqual(entries[0].region, "USA", "region detected as USA");
}

// ============================================================
console.log("\n📋 ClrMamePro: Multi-line ROM Block");
// ============================================================

{
  const dat = `clrmamepro (
\tname "Header"
)

game (
\tname "Mario Kart (Europe)"
\tdescription "Mario Kart Racing"
\trom (
\t\tname "Mario Kart (Europe).sfc"
\t\tsize 524288
\t\tcrc 1234ABCD
\t)
)`;

  const entries = parseDAT(dat);
  assertEqual(entries.length, 1, "1 entry returned");
  assertEqual(entries[0].name, "Mario Kart (Europe)", "name parsed correctly");
  assertEqual(entries[0].size, 524288, "size parsed correctly");
  assertEqual(entries[0].crc32, "1234ABCD", "crc parsed in multi-line rom block");
  assertEqual(entries[0].region, "Europe", "region detected as Europe");
}

// ============================================================
console.log("\n📋 ClrMamePro: Multiple Games in One File");
// ============================================================

{
  const dat = `clrmamepro (
\tname "Multi DAT"
)

game (
\tname "Game One (USA)"
\trom ( name "Game One (USA).gba" size 1000 crc AAAA1111 )
)

game (
\tname "Game Two (Japan)"
\trom ( name "Game Two (Japan).gba" size 2000 crc BBBB2222 )
)

game (
\tname "Game Three (Europe)"
\trom ( name "Game Three (Europe).gba" size 3000 crc CCCC3333 )
)`;

  const entries = parseDAT(dat);
  assertEqual(entries.length, 3, "3 entries returned");
  assertEqual(entries[0].name, "Game One (USA)", "first game name");
  assertEqual(entries[0].size, 1000, "first game size");
  assertEqual(entries[0].crc32, "AAAA1111", "first game crc");
  assertEqual(entries[0].region, "USA", "first game region");
  assertEqual(entries[1].name, "Game Two (Japan)", "second game name");
  assertEqual(entries[1].size, 2000, "second game size");
  assertEqual(entries[1].crc32, "BBBB2222", "second game crc");
  assertEqual(entries[1].region, "Japan", "second game region");
  assertEqual(entries[2].name, "Game Three (Europe)", "third game name");
  assertEqual(entries[2].size, 3000, "third game size");
  assertEqual(entries[2].crc32, "CCCC3333", "third game crc");
  assertEqual(entries[2].region, "Europe", "third game region");
}

// ============================================================
console.log("\n📋 ClrMamePro: Unknown Platform (No knownPlatform)");
// ============================================================

{
  const dat = `clrmamepro (
\tname "Header"
)

game (
\tname "Some Random Hack"
\trom ( name "Some Random Hack.xyz" size 500 crc DEADBEEF )
)`;

  const entries = parseDAT(dat);
  assertEqual(entries.length, 1, "1 entry returned");
  assertEqual(entries[0].platform, undefined, "platform is undefined for unknown extension");
}

// ============================================================
console.log("\n📋 ClrMamePro: knownPlatform Override");
// ============================================================

{
  const dat = `clrmamepro (
\tname "Header"
)

game (
\tname "Custom Game (USA)"
\trom ( name "Custom Game (USA).bin" size 4000 crc 11112222 )
)`;

  const entries = parseDAT(dat, "Game Boy Advance");
  assertEqual(entries.length, 1, "1 entry returned");
  assertEqual(entries[0].platform, "Game Boy Advance", "platform set from knownPlatform param");
}

// ============================================================
console.log("\n📋 ClrMamePro: Empty Input");
// ============================================================

{
  const entries = parseDAT("");
  assertEqual(entries.length, 0, "empty string → 0 entries");
}

// ============================================================
console.log("\n📋 ClrMamePro: Header Block Skipped");
// ============================================================

{
  const dat = `clrmamepro (
\tname "No-Intro"
\tdescription "Nintendo - Game Boy Advance"
\tversion "2024"
)

game (
\tname "Real Game (USA)"
\trom ( name "Real Game (USA).gba" size 8000 crc ABCD1234 )
)`;

  const entries = parseDAT(dat);
  assertEqual(entries.length, 1, "only 1 entry (header not counted)");
  assertEqual(entries[0].name, "Real Game (USA)", "entry is from game block, not header");
  assert(entries[0].name !== "No-Intro", "header name did not leak into entries");
}

// ============================================================
console.log("\n📋 XML: Simple DAT");
// ============================================================

{
  try {
    const dat = `<?xml version="1.0"?>
<datafile>
  <game name="Test Game (USA)">
    <rom name="Test Game (USA).nes" size="4096" crc="DEADBEEF" md5="aaaa" sha1="bbbb"/>
  </game>
</datafile>`;

    const entries = parseDAT(dat);
    assertEqual(entries.length, 1, "1 entry returned");
    assertEqual(entries[0].name, "Test Game (USA)", "name from game attribute");
    assertEqual(entries[0].size, 4096, "size parsed correctly");
    assertEqual(entries[0].crc32, "DEADBEEF", "crc parsed correctly");
    assertEqual(entries[0].md5, "aaaa", "md5 parsed correctly");
    assertEqual(entries[0].sha1, "bbbb", "sha1 parsed correctly");
  } catch (e) {
    if (e instanceof ReferenceError && e.message.includes("DOMParser")) {
      console.log("  ⚠️  XML tests skipped (DOMParser not available in this environment)");
    } else {
      throw e;
    }
  }
}

// ============================================================
console.log("\n📋 XML: Multiple ROMs Per Game");
// ============================================================

{
  try {
    const dat = `<?xml version="1.0"?>
<datafile>
  <game name="Multi">
    <rom name="disc1.iso" size="1000" crc="1111"/>
    <rom name="disc2.iso" size="2000" crc="2222"/>
  </game>
</datafile>`;

    const entries = parseDAT(dat);
    assertEqual(entries.length, 2, "2 entries from 1 game with 2 ROMs");
    assertEqual(entries[0].name, "Multi", "first entry name is game name");
    assertEqual(entries[0].size, 1000, "first entry size");
    assertEqual(entries[0].crc32, "1111", "first entry crc");
    assertEqual(entries[1].name, "Multi", "second entry name is game name");
    assertEqual(entries[1].size, 2000, "second entry size");
    assertEqual(entries[1].crc32, "2222", "second entry crc");
  } catch (e) {
    if (e instanceof ReferenceError && e.message.includes("DOMParser")) {
      console.log("  ⚠️  XML tests skipped (DOMParser not available in this environment)");
    } else {
      throw e;
    }
  }
}

// ============================================================
console.log("\n📋 Summary");
// ============================================================

console.log(`\n  ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log("🎉 All parser tests passed!\n");
} else {
  console.log(`⚠️  ${failed} test(s) failed\n`);
  process.exit(1);
}
