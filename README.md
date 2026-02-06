# Auto ROM Validator Web

Validate ROM files against No-Intro and Redump databases directly in your browser.

## Features

- **Private** — All processing happens locally. Your ROMs never leave your device.
- **Smart Detection** — Automatically identifies platforms from file size and filename.
- **Fast** — Sequential DAT loading with caching for repeated validations.
- **Cross-Platform** — Supports Nintendo, Sony, Sega, and more.

## Supported Platforms

| Platform           | Extensions             | Database |
| ------------------ | ---------------------- | -------- |
| Game Boy           | .gb                    | No-Intro |
| Game Boy Color     | .gbc                   | No-Intro |
| Game Boy Advance   | .gba                   | No-Intro |
| Nintendo DS        | .nds                   | No-Intro |
| Nintendo 3DS       | .3ds                   | No-Intro |
| NES                | .nes                   | No-Intro |
| SNES               | .smc, .sfc             | No-Intro |
| Nintendo 64        | .n64, .z64             | No-Intro |
| GameCube           | .iso, .gcm, .ciso      | Redump   |
| Wii                | .iso, .wbfs            | Redump   |
| PlayStation        | .bin, .cue             | Redump   |
| PlayStation 2      | .iso, .bin, .cue       | Redump   |
| PSP                | .iso, .cso, .pbp       | No-Intro |
| Genesis/Mega Drive | .md, .gen, .smd        | No-Intro |
| Dreamcast          | .bin, .cue, .cdi, .gdi | Redump   |

## Usage

1. Open the app in your browser
2. Drag and drop ROM files (or click to select)
3. View validation results

## Privacy

100% client-side. No files are uploaded to any server.

## Development Commands

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

## Contributing

Open issues or PRs on [GitHub](https://github.com/RP2/rom-validate-web).

## License

[MIT](LICENSE)

## Related

- [Auto ROM Validator CLI](https://github.com/RP2/auto-rom-validator) — Original Python version
- [No-Intro](https://no-intro.org/) — Cartridge ROM database
- [Redump](http://redump.org/) — Optical disc database
- [Libretro Database](https://github.com/libretro/libretro-database) — DAT file source
