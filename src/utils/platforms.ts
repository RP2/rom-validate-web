// Shared platform constants used by both datLoader and romValidator.
// Extracted here so both modules can import without importing each other.

export const PLATFORMS: Record<string, string> = {
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

export const EXTENSION_MAP: Record<string, string | string[]> = {
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
  ".iso": ["PlayStation 2", "Wii", "PSP", "GameCube"],
  ".cso": "PSP",
  ".pbp": "PSP",
  ".gcm": "GameCube",
  ".ciso": "GameCube",
  ".wbfs": "Wii",
  ".bin": ["PlayStation", "Dreamcast", "PlayStation 2"],
  ".md": "Sega Genesis",
  ".gen": "Sega Genesis",
  ".smd": "Sega Genesis",
  ".cdi": "Dreamcast",
  ".gdi": "Dreamcast",
};

export const ENCRYPTION_PRONE_EXTENSIONS = new Set([".nds", ".3ds"]);

export const BUNDLED_DATS: Record<string, string> = {
  "Nintendo DS Encrypted (Bundled)":
    "/dats/Nintendo - Nintendo DS (Encrypted).dat",
};
