# 34 · Build and run

## Prerequisites
- Node 22 (`.nvmrc`), pnpm 10 (`corepack enable`).
- For the desktop app: Rust stable + Tauri 2 system dependencies — https://v2.tauri.app/start/prerequisites/ (Windows: WebView2 + MSVC build tools; macOS: Xcode CLT; Linux: `webkit2gtk-4.1`, `libayatana-appindicator3`, `librsvg2`).

## Commands
```bash
pnpm install
pnpm test            # unit + golden tests
pnpm typecheck
pnpm dev             # browser UI on http://localhost:1420 (export downloads the file)
pnpm tauri dev       # desktop window; export uses the native Save dialog
pnpm tauri build     # installers in apps/desktop/src-tauri/target/release/bundle/
pnpm tauri icon apps/desktop/src-tauri/icons/icon.png   # generate all icon sizes from the placeholder
```

## Notes
- The starter was verified with `pnpm test`, `tsc` and `vite build` + a headless browser screenshot. `tauri dev/build` was **not** run in the kit's build environment (no WebKitGTK there); first run on your machine may need `pnpm tauri icon` and Cargo will download crates.
- The app identifier is `pl.ksbd.arcflow` (`tauri.conf.json`); change before any public release.
- Windows is the likely shop OS: build installers there (`msi`/`nsis`).
