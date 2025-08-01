#!/usr/bin/env tsx

// Test script to validate DAT URLs
// Run with: npx tsx tests/test-dat-urls.mts

const LIBRETRO_BASE_URL =
  "https://raw.githubusercontent.com/libretro/libretro-database/master";

const testPlatforms: Record<string, string> = {
  "Game Boy Advance": "metadat/no-intro/Nintendo - Game Boy Advance.dat",
  "Nintendo DS": "metadat/no-intro/Nintendo - Nintendo DS.dat",
};

// Test the URLs
console.log("🌐 Testing DAT File Accessibility\n");

let successCount = 0;
let totalCount = 0;

for (const [platform, path] of Object.entries(testPlatforms)) {
  totalCount++;
  try {
    const url = `${LIBRETRO_BASE_URL}/${path}`;
    const response = await fetch(url);

    if (response.ok) {
      const text = await response.text();
      const sizeKB = Math.round(text.length / 1024);
      console.log(`✅ ${platform}: ${sizeKB}KB DAT file loaded successfully`);
      successCount++;
    } else {
      console.error(
        `❌ ${platform}: HTTP ${response.status} - ${response.statusText}`,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${platform}: Network error - ${errorMessage}`);
  }
}

console.log(`\n📊 Results: ${successCount}/${totalCount} DAT files accessible`);
if (successCount === totalCount) {
  console.log("🎉 All DAT files are accessible!");
} else {
  console.log("⚠️  Some DAT files are inaccessible - check network or URLs");
}
