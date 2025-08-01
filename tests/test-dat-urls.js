// Test script to validate DAT URLs
const LIBRETRO_BASE_URL = "https://raw.githubusercontent.com/libretro/libretro-database/master";

const testPlatforms = {
  "Game Boy Advance": "metadat/no-intro/Nintendo - Game Boy Advance.dat",
  "Nintendo DS": "metadat/no-intro/Nintendo - Nintendo DS.dat"
};

async function testURL(platform, path) {
  const url = `${LIBRETRO_BASE_URL}/${path}`;
  console.log(`Testing ${platform}: ${url}`);
  
  try {
    const response = await fetch(url);
    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
      const text = await response.text();
      console.log(`Length: ${text.length}`);
      console.log(`Preview: ${text.substring(0, 100)}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
  console.log('---');
}

// Test the URLs
for (const [platform, path] of Object.entries(testPlatforms)) {
  await testURL(platform, path);
}
