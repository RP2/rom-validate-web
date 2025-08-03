# Auto ROM Validator Web Frontend

A modern web application for validating ROM files using No-Intro and Redump database DAT files. This frontend provides similar functionality as the [CLI version](https://github.com/RP2/auto-rom-validator) with a user-friendly web interface.

## ✨ Features

- **Complete Client-side Processing**: All files are processed locally in your browser for privacy
- **Smart Platform Detection**: Intelligent size-based and filename-based platform detection
- **Optimized Performance**: Sequential DAT loading with early exit on match detection
- **Multiple Platform Support**: Nintendo, Sony, Sega, and more
- **CLI-Compatible**: Uses the same configuration as the CLI version
- **Encrypted DAT Support**: Bundled encrypted Nintendo DS DATs for comprehensive validation
- **Cross-Platform Validation**: Automatic PlayStation format fallback for edge cases
- **Drag & Drop Interface**: Modern, responsive UI with shadcn/ui components
- **Manual Platform Selection**: Optional platform override for faster validation when you know the target system
- **Real-time Progress**: Live validation progress with detailed results
- **Hash Transparency**: View calculated MD5, SHA-1, and CRC32 hashes for all processed files
- **Detailed File Information**: Comprehensive file details including platform, region, and DAT source
- **DAT Source Links**: Clickable badges linking to No-Intro and Redump official websites
- **Mobile-Responsive Design**: Optimized interface for desktop and mobile devices
- **DAT Browser**: Browse and search cached DAT files with built-in viewer
- **Custom DAT Upload**: Upload and use your own DAT files alongside official databases
- **Advanced Cache Management**: Intelligent memory vs persistent storage with developer tools
- **Developer Tools**: Comprehensive cache status, browsing, and management interface

## 🎮 Supported Platforms

### Nintendo Handheld Platforms (No-Intro DATs)

- **Game Boy** (.gb)
- **Game Boy Color** (.gbc)
- **Game Boy Advance** (.gba)
- **Nintendo DS** (.nds)
- **Nintendo DS Download Play** (.nds)
- **Nintendo DSi** (.nds)
- **Nintendo 3DS** (.3ds)

### Nintendo Console Platforms (No-Intro DATs)

- **Nintendo Entertainment System** (.nes)
- **Super Nintendo Entertainment System** (.smc, .sfc)
- **Nintendo 64** (.n64, .z64)

### Nintendo Disc Platforms (Redump DATs)

- **GameCube** (.iso, .gcm, .ciso)
- **Wii** (.iso, .wbfs)

### Sony Platforms

- **PlayStation** (.bin/.cue) - Redump DATs
- **PlayStation 2** (.iso, .bin/.cue) - Redump DATs
- **PlayStation Portable (PSP)** (.iso, .cso, .pbp) - No-Intro DATs

### Sega Platforms

- **Sega Genesis / Mega Drive** (.md, .gen, .smd) - No-Intro DATs
- **Sega Dreamcast** (.bin/.cue, .cdi, .gdi) - Redump DATs

## 🔧 DAT File Configuration

This project uses the same configuration as the CLI version for maximum compatibility.

### DAT Sources

- **Public DATs**: No-Intro and Redump DATs fetched from Libretro's GitHub repository in ClrMamePro format (`https://raw.githubusercontent.com/libretro/libretro-database/master/`)
- **Encrypted DATs**: Bundled locally in XML format for special access content (Nintendo DS Encrypted) - only loaded when needed for performance
- **Custom DATs**: Upload your own DAT files in XML or ClrMamePro format for specialized collections
- **Format Support**: Automatic detection and parsing of both XML and ClrMamePro DAT formats

### Extension Mapping

The system automatically detects platforms based on file extensions with intelligent fallbacks:

```typescript
".nds": ["Nintendo DS", "Nintendo DS Download Play", "Nintendo DSi"]
".gba": "Game Boy Advance"
".gb": "Game Boy"
".gbc": "Game Boy Color"
".iso": ["PlayStation 2", "Wii", "PSP", "GameCube"]  // Smart size-based detection
".cue/.bin": ["PlayStation", "PlayStation 2"] // PlayStation format detection
```

### Smart Platform Detection

**Automatic Detection (Default)**: The system intelligently determines the most likely platform(s) for each file:

- **Size-based Detection**:
  - **ISO files**: PlayStation 2 (>4.5GB dual-layer) → Wii (800MB-4.5GB) → GameCube (200-800MB) → PSP (<200MB)
  - **CD formats**: Conservative PlayStation detection with PS2 fallback for large files
- **Filename Hints**: Platform keywords ("gc", "ps2", "wii", "psp") take priority over size detection
- **Sequential Validation**: Downloads and checks most likely platform first, stops on match
- **Cross-Platform Fallback**: PlayStation formats try both PS1 and PS2 DATs if needed

**Manual Platform Selection (Optional)**: Users can override automatic detection by selecting a specific platform:

- **Performance Boost**: Try the chosen platform first for maximum speed
- **Smart Fallback**: If no match is found, automatically falls back to intelligent detection
- **Accuracy Improvement**: Perfect for users who know their ROM collection's platform
- **Batch Processing**: Ideal for validating multiple files from the same system
- **Zero Risk**: Never miss a valid ROM due to wrong platform selection

**Historical Accuracy**:

- **PlayStation 1**: Never used ISO format - only CD-ROM (.cue/.bin pairs)
- **PlayStation 2**: Primarily DVD format (.iso), some early titles on CD (.cue/.bin)
- **Platform Specific**: Each console's actual capabilities and distribution methods reflected

### Special Handling

- **Nintendo DS**: Intelligent DAT selection with bundled encrypted DAT tried first, automatic fallback to unencrypted libretro version for comprehensive coverage
- **Unified Platform Selection**: Nintendo DS appears as single option in UI while maintaining separate encrypted/unencrypted DAT support in developer tools
- **Multi-platform files**: `.iso`, `.bin` & more files use intelligent size and filename-based platform detection
- **Performance Optimized**: Most files match on first platform attempt, avoiding unnecessary downloads
- **Smart Caching**: Multi-level caching system for optimal performance:
  - **Memory Cache**: Fast in-memory storage for current session (active DATs only)
  - **Persistent Cache**: localStorage with 24-hour expiry for repeated visits (downloaded DATs)
  - **Bundled DATs**: Only loaded when needed, not preloaded for better performance
  - **Custom DATs**: Uploaded files cached and persist across sessions
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
| `npm run test`            | Run all tests                                    |
| `npm run test:config`     | Test CLI-compatible configuration                |
| `npm run test:dat-urls`   | Test DAT URL accessibility                       |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |
| `npm run format`          | Format all project files with prettier           |

## 🛠️ Development

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

- **Complete Privacy**: All file processing happens locally in your browser - files never leave your computer
- **No File Upload**: ROM files are never sent to any server
- **Custom DATs Stay Local**: Uploaded custom DAT files are processed and cached entirely in your browser's local storage - never transmitted to any server
- **No Data Collection**: No user tracking, personal data storage, or cookies beyond essential DAT caching
- **Smart Caching**: DAT files cached locally with 24-hour expiry to minimize external requests
- **Cache Management**: Built-in cache status and cleanup tools in developer settings
- **Browser Compatibility**: Graceful fallback for browsers with limited crypto support
- **Open Source**: Full transparency with code available for review and local deployment

## 📋 Validation Process

1. **File Detection**: Platform detected from file extension with intelligent size/filename analysis
2. **Smart Platform Prioritization**: Most likely platform determined first to minimize DAT downloads
3. **Hash Calculation**: MD5, SHA-1, and CRC32 calculated client-side
4. **Sequential DAT Loading**: Loads and checks most likely platform first, stops on match
5. **Fallback Validation**: If no match, tries remaining platforms with cross-platform PlayStation support
6. **Results**: Detailed validation results with renaming suggestions and platform detection info

## 📱 User Interface Features

### File Upload & Platform Selection

- **Drag & Drop Interface**: Modern, intuitive file upload with visual feedback
- **Platform Override**: Optional dropdown to manually select target platform for faster validation
- **Auto-Detection Info**: Clear explanation of how automatic platform detection works
- **Smart Recommendations**: UI guides users on when to use manual vs automatic detection
- **Batch Optimization**: Perfect for validating collections from known platforms

### Validation Results Display

- **Status Filtering**: Filter results by validation status (Valid, Unknown, Renamed, All)
- **Interactive File Details**: Click the eye icon to view comprehensive file information including:
  - File size, modification date, and validation status
  - Platform and region information
  - Matched ROM database entry details
  - DAT source information with direct links to No-Intro/Redump websites
  - Suggested filename corrections
  - Issue reporting and troubleshooting hints

### Hash Information

- **Hash Transparency**: Click the hash icon to view all calculated hashes
- **Copy to Clipboard**: One-click copying of individual hash values (CRC32, MD5, SHA-1)
- **Mobile-Optimized**: Responsive design with touch-friendly buttons and proper text wrapping

### Export and Actions

- **Comprehensive Reports**: Download detailed validation reports in text format
- **Unknown ROM Lists**: Export lists of unidentified files with hashes for manual research
- **Batch Renaming**: Download files with corrected names based on database matches
- **Mobile-Responsive**: All action buttons adapt to mobile screens with appropriate sizing

### User Experience

- **Responsive Design**: Mobile-first design that works seamlessly on all device sizes
- **Modal Dialogs**: Clean, accessible dialogs for detailed information display
- **Touch-Friendly**: Optimized button sizes and interactions for mobile devices
- **Keyboard Accessible**: Full keyboard navigation support for accessibility

## 🗂️ DAT Management & Caching System

The application features a sophisticated DAT management system with performance-focused caching:

### Cache Architecture

1. **Memory Cache**: Active DATs loaded during current session for immediate validation
2. **Persistent Cache**: Downloaded DATs stored in localStorage (24-hour expiry)
3. **Bundled DATs**: Only loaded when specifically needed (e.g., DS file validation)
4. **Custom DATs**: User-uploaded files cached persistently across sessions

### Developer Tools & DAT Browser

Access comprehensive DAT management via the settings icon (⚙️) in the header:

#### Cache Status

- **Bundled**: Available bundled DATs (count from configuration, not storage-dependent)
- **Memory**: Currently loaded DATs (active in current session for immediate validation)
- **Cached**: Persistently stored DATs (downloaded libretro and custom uploads)
- **Cache Size**: Total storage usage with automatic cleanup and accurate size calculation

#### DAT Browser

- **Accordion Interface**: Clean, expandable list powered by shadcn/ui components with consistent hover effects and alignment
- **Source Identification**: Clear distinction between bundled, libretro, and custom DATs with consistent labeling
- **Nintendo DS Support**: Both encrypted and unencrypted DS DATs appear separately for browsing when available
- **Entry Counts**: Number of ROM entries in each DAT for reference and validation scope
- **Built-in Viewer**: Click any DAT to open in a new tab with formatted display for easy browsing
- **Search Support**: Use browser's Ctrl+F to find specific ROMs within DAT files
- **Consistent Browsing**: Bundled DATs appear in browse list when user has cached content for unified experience
- **Smart Display Logic**: Memory-first loading ensures optimal performance while maintaining UI consistency

#### Cache Management

- **Upload Custom DATs**: Add your own XML or ClrMamePro format DAT files
- **Clear Cache**: Remove all downloaded and custom DATs (bundled DATs unaffected)
- **Confirmation Dialogs**: Prevent accidental cache clearing with detailed warnings

### Performance Benefits

- **Lazy Loading**: Bundled encrypted DATs only loaded when DS files are validated, not preloaded
- **Memory-First Strategy**: Bundled DATs prioritize memory cache over localStorage for optimal speed
- **Smart Prioritization**: Most likely platform DATs loaded first with early exit on match
- **Session Persistence**: Memory cache maintains state during validation sessions without repeated loads
- **Consistent UX**: Bundled DATs appear in browse interface when user has other cached content
- **Storage Efficiency**: Automatic cleanup of expired data with version control and cache validation
- **Bandwidth Optimization**: Reduces repeated downloads by ~70% for common validations with intelligent caching

## 🤝 Contributing

This project maintains compatibility with the [CLI version](https://github.com/RP2/auto-rom-validator). When adding features:

1. Keep `datLoader.ts` configuration synchronized with CLI `config.py`
2. Test with the included `tests/test-config.mts` script
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
- For multi-platform formats (.iso), the system now prioritizes the most likely platform first

**Platform Detection Issues:**

- If platform appears as "unknown", check that the file extension is supported
- Size-based detection works best with uncompressed files
- Filename hints ("gc", "ps2", "psp") help improve detection accuracy
- PlayStation cross-platform fallback handles edge cases automatically

## 📄 License

[MIT](LICENSE)

## 🔗 Related Projects

- [CLI ROM Validator](https://github.com/RP2/auto-rom-validator) - Command-line version
- [No-Intro](https://no-intro.org/) - Cartridge-based ROM preservation database
- [Redump](http://redump.org/) - Optical disc preservation database
- [Libretro Database](https://github.com/libretro/libretro-database) - Repository hosting No-Intro and Redump DAT files
