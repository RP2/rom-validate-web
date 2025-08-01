# ROM Validator Web Frontend

A modern web application for validating ROM files using No-Intro and Libretro database DAT files. This frontend provides similar functionality as the [CLI version](https://github.com/RP2/auto-rom-validator) with a user-friendly web interface.

## ✨ Features

- **Client-side Processing**: Files are processed locally when possible for privacy
- **Multiple Platform Support**: Nintendo, Sony, Sega, and more
- **CLI-Compatible**: Uses the same configuration as the CLI version
- **Encrypted DAT Support**: Bundled encrypted Nintendo DS DATs for comprehensive validation
- **Drag & Drop Interface**: Modern, responsive UI with shadcn/ui components
- **Real-time Progress**: Live validation progress with detailed results

## 🎮 Supported Platforms

### Nintendo Platforms (No-Intro DATs)

- Game Boy / Game Boy Color / Game Boy Advance
- Nintendo DS / Nintendo DSi / Nintendo 3DS
- Nintendo 64 / Super Nintendo / Nintendo Entertainment System

### Sony Platforms (Redump DATs)

- PlayStation / PlayStation 2
- PlayStation Portable (PSP)

### Nintendo Disc Platforms (Redump DATs)

- GameCube / Wii

## 🔧 DAT File Configuration

This project uses the same configuration as the CLI version for maximum compatibility.

### DAT Sources

- **Public DATs**: Fetched from Libretro database in ClrMamePro format (`https://raw.githubusercontent.com/libretro/libretro-database/master/`)
- **Encrypted DATs**: Bundled locally in XML format for special access content (Nintendo DS Encrypted)
- **Format Support**: Automatic detection and parsing of both XML and ClrMamePro DAT formats

### Extension Mapping

The system automatically detects platforms based on file extensions:

```typescript
".nds": ["Nintendo DS", "Nintendo DS Download Play", "Nintendo DSi"]
".gba": "Game Boy Advance"
".gb": "Game Boy"
".gbc": "Game Boy Color"
".iso": ["GameCube", "PSP", "PlayStation 2", "Wii"]  // Size-based detection
".cue/.bin": ["PlayStation", "PlayStation 2"]        // Size-based detection
```

### Special Handling

- **Nintendo DS**: Tries encrypted DAT first, falls back to regular DAT
- **Multi-platform files**: `.iso`, `.cue`, `.bin` files use size-based platform detection
- **Smart Caching**: Multi-level caching system for optimal performance:
  - **Memory Cache**: Fast in-memory storage for current session
  - **Persistent Cache**: localStorage with 24-hour expiry for repeated visits
  - **Automatic Cleanup**: Cache versioning prevents stale data issues

## 🚀 Project Structure

```text
/
├── public/
│   ├── dats/                           # Bundled encrypted DAT files
│   │   └── Nintendo - Nintendo DS (Encrypted).dat
│   └── favicon.svg
├── src/
│   ├── components/                    # React components
│   │   ├── ui/                        # shadcn/ui components
│   │   ├── FileUpload.tsx             # Main file upload interface
│   │   ├── ValidationResults.tsx      # Results display
│   │   ├── ValidationProgress.tsx     # Progress tracking
│   │   └── Header.tsx                 # Navigation header
│   ├── layouts/
│   │   └── Layout.astro              # Base layout
│   ├── pages/
│   │   ├── index.astro               # Main validation page
│   │   ├── about.astro               # About page
│   │   └── robots.txt.ts             # SEO robots.txt
│   └── utils/
│       ├── romValidator.ts           # Core validation logic
│       └── datLoader.ts              # DAT file management (CLI-compatible)
└── package.json
```

## 🧞 Commands

All commands are run from the root of the project:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `node test-config.mjs`    | Test CLI-compatible configuration                |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |
| `npm run format`          | Format all project files with prettier           |

## �️ Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
git clone https://github.com/RP2/rom-validate-web.git
cd rom-validate-web
npm install
npm run dev
```

### Adding New Platforms

To add support for new platforms, update the `PLATFORMS` and `EXTENSION_MAP` in `src/utils/datLoader.ts`:

```typescript
// Add new platform
PLATFORMS = {
  ...existing,
  "New Platform": "metadat/no-intro/New - Platform.dat",
};

// Add extension mapping
EXTENSION_MAP = {
  ...existing,
  ".ext": "New Platform",
};
```

## 🔒 Privacy & Security

- **Client-side Processing**: File hashes are calculated locally using Web Crypto API
- **No File Upload**: ROM files never leave your browser
- **Metadata Only**: Only file metadata and hashes are used for validation
- **Smart Caching**: DAT files cached locally with 24-hour expiry to minimize external requests
- **Cache Management**: Built-in cache status and cleanup tools in developer settings
- **Browser Compatibility**: Graceful fallback for browsers with limited crypto support

## 📋 Validation Process

1. **File Detection**: Platform detected from file extension
2. **Hash Calculation**: MD5, SHA-1, and CRC32 calculated client-side
3. **DAT Loading**: Relevant DAT files loaded (encrypted first for DS, then public)
4. **Validation**: Hashes compared against DAT entries
5. **Results**: Detailed validation results with renaming suggestions

## 🗂️ Caching System

The application uses a sophisticated multi-level caching system for optimal performance:

### Cache Levels

1. **Memory Cache**: Fast in-memory storage for the current browser session
2. **Persistent Cache**: localStorage-based storage that survives browser restarts
3. **Cache Expiry**: 24-hour automatic expiration to ensure DAT freshness
4. **Version Control**: Cache versioning prevents issues with application updates

### Developer Tools

Access cache management tools via the settings icon (⚙️) in the header:

- **Cache Status**: View current cache statistics and storage usage
- **Clear Cache**: Force refresh all cached DAT files

### Benefits

- **Performance**: Subsequent validations are near-instantaneous
- **Bandwidth**: Reduces repeated downloads of large DAT files
- **Reliability**: Graceful fallback if cache fails
- **Storage Efficiency**: Automatic cleanup of expired data

## 🤝 Contributing

This project maintains compatibility with the [CLI version](https://github.com/RP2/auto-rom-validator). When adding features:

1. Keep `datLoader.ts` configuration synchronized with CLI `config.py`
2. Test with the included `test-config.mjs` script
3. Follow existing TypeScript patterns and component structure

## 🔧 Troubleshooting

### Common Issues

**Drag and Drop Not Working:**

- Ensure you're dragging files directly over the upload area (should show visual feedback)
- Try dragging from different file managers (Explorer, Finder, Nautilus)
- Some browsers may require explicit permissions for file access
- Check browser console for "Drag enter detected" and "Files dropped" messages
- Try using the "Select Files" button as an alternative
- Ensure JavaScript is enabled in your browser

**Validation Errors:**

- Check browser console for detailed error messages
- Some browsers have limited Web Crypto API support
- Clear DAT cache using developer tools (⚙️ icon) if validation fails repeatedly
- "XML Parsing Error": Automatically handled - app supports both XML and ClrMamePro DAT formats

**Performance Issues:**

- Large ROM files (>1GB) may take time to process
- Close other browser tabs to free up memory
- Check cache status in developer tools to monitor storage usage

## 📄 License

[MIT](LICENSE)

## 🔗 Related Projects

- [CLI ROM Validator](https://github.com/RP2/auto-rom-validator) - Command-line version
- [Libretro Database](https://github.com/libretro/libretro-database) - DAT file source
