# Academic CV Generator

A private desktop CV generator for academics. The app stores CV data as local JSON, lets you customize and reorder sections, and exports LaTeX or PDF.

## Download

The product website is designed for GitHub Pages:

https://nickpiccaro.github.io/cv-generator/

Installers are published through GitHub Releases:

https://github.com/nickpiccaro/cv-generator/releases/latest

Release builds produce:

- macOS Apple Silicon: `Academic-CV-Generator-<version>-mac-arm64.dmg`
- macOS Intel: `Academic-CV-Generator-<version>-mac-x64.dmg`
- Windows x64: `Academic-CV-Generator-<version>-win-x64.exe`
- Windows ARM64: `Academic-CV-Generator-<version>-win-arm64.exe`

## Privacy And Storage

CV data is local-only. The default `cv-data.json` file is created in Electron's per-user application data directory:

- macOS: `~/Library/Application Support/Academic CV Generator/cv-data.json`
- Windows: `%APPDATA%\\Academic CV Generator\\cv-data.json`

The app does not upload CV data, use analytics, or sync with a server. Update checks read public GitHub release and `main` branch metadata only.

## Security

The Electron app is configured with:

- context isolation enabled
- renderer Node.js integration disabled
- renderer sandboxing enabled
- restrictive content security policy
- blocked renderer permission requests
- external links opened outside the app
- validated IPC payloads for file and export operations
- signed release update support through GitHub Releases

For production distribution, configure code-signing secrets before publishing releases:

- macOS: `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
- Windows: `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`

Unsigned local builds are useful for development, but public downloads should be signed. macOS releases should also be notarized through Apple.

## Updates

On startup, the app checks GitHub periodically unless the user deferred update reminders. When an update is found, the prompt offers:

- update now
- remind me in 30 days
- skip

Packaged builds use `electron-updater` against GitHub Releases. Development builds fall back to checking the latest GitHub Release, `main` branch `package.json` version, and `main` commit metadata.

## Run Locally

```bash
npm install
npm run dev
```

The renderer runs at `http://localhost:5173/`, and Electron opens the desktop UI.

## Build

```bash
npm run build
npm run dist
```

Platform-specific builds:

```bash
npm run dist:mac
npm run dist:win
```

Release artifacts are written to `release/`.

## GitHub Pages

The static website lives in `docs/`. The workflow in `.github/workflows/pages.yml` deploys it from the `main` branch. Configure the repository Pages source to GitHub Actions.

## Publish A Release

1. Update `version` in `package.json`.
2. Commit the change.
3. Create and push a matching tag, for example `v0.1.1`.
4. The release workflow builds macOS and Windows installers and uploads them to GitHub Releases.

```bash
git tag v0.1.1
git push origin main --tags
```

## PDF Export

The app always exports `.tex`. PDF export requires one of:

- Tectonic
- XeLaTeX
- LuaLaTeX

The LaTeX template uses `fontspec` so it can request Times New Roman directly, with a TeX Gyre Termes fallback.

## Data Model

The CV is a single JSON document. Each section owns:

- `title`
- `kind`
- `hiddenWhenEmpty`
- `fields`
- `items`

Fields can be text, textarea, date, date range, authors, bullets, tags, URL, number, or select. Citation-style sections bold any author variant listed in `profile.ownerNames`.
