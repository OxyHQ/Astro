# Astro Browser

A de-Googled Chromium browser by [Oxy](https://oxy.so). Astro strips all Google services from Chromium and replaces them with privacy-respecting Oxy platform equivalents.

## Features

- **De-Googled** — 112 ungoogled-chromium patches + 55 Astro patches (167 total)
- **Oxy Account** — Sign in with Oxy, cookie-based auth like Chrome/Google
- **Alia AI** — Built-in AI assistant sidebar (like Edge Copilot)
- **Ad Blocker** — Built-in ad and tracker blocking, no extensions needed
- **Custom NTP** — Widgets, wallpaper, weather, quick links, notes
- **`astro://` URLs** — 11 integration points (Brave-style scheme implementation)
- **Oxy Fuchsia Theme** — #c46ede default frame color, customizable
- **DuckDuckGo** — Default search engine, 5 engines available
- **Privacy-First** — Zero Google connections, all domains substituted/blocked
- **Cross-Platform** — Linux, Android, Windows, macOS (no iOS)
- **Extension Support** — Full Chrome Web Store compatibility

## System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **Disk** | 120 GB | 200 GB |
| **RAM** | 16 GB | 32 GB |
| **CPU** | 8 cores | 16+ cores |
| **Download** | ~55 GB (Chromium source + deps) | — |

## Build Times (approximate)

| Step | Time | Notes |
|------|------|-------|
| **Chromium fetch** | 30-90 min | ~55 GB download, depends on connection |
| **gclient sync + hooks** | 15-30 min | Third-party deps + toolchain |
| **Apply patches** | 2-5 min | 167 patches + domain substitution |
| **First build** | 1-3 hours | Depends on CPU cores (32 cores ≈ 1 hour) |
| **Incremental build** | 10 sec - 5 min | Only recompiles changed files |
| **Total first time** | ~2-4 hours | From scratch to working binary |

## Quick Start

```bash
# 1. Fetch Chromium source (~55 GB, takes 30-90 min)
tools/fetch-chromium.sh

# 2. Sync ungoogled-chromium patches
tools/sync-ungoogled.sh

# 3. Apply all patches (ungoogled + Astro)
tools/apply-patches.sh

# 4. Copy Astro source overlay
rsync -av src/ chromium/src/

# 5. Build (uses all available CPU cores)
tools/build.sh

# 6. Install locally
tools/install-local.sh

# 7. Run
astro --no-sandbox
```

## Development (WebUI Pages)

The internal pages (NTP, Settings, Alia, What's New) are built with Vite + Tailwind:

```bash
# Start dev servers (hot reload)
cd webui/ntp && bun run dev          # http://localhost:5173
cd webui/alia && bun run dev         # http://localhost:5174
cd webui/settings && bun run dev     # http://localhost:5175
cd webui/whats-new && bun run dev    # http://localhost:5176
```

## Project Structure

```
Astro/
├── patches/
│   ├── ungoogled/          # 112 de-Google patches
│   └── astro/              # 55 Astro-specific patches
├── src/chrome/browser/oxy/ # C++ Oxy integration
│   ├── oxy_auth_*          # Cookie-based auth + JWT
│   ├── oxy_alia_*          # Alia AI sidebar panel
│   ├── oxy_cookie_*        # Cookie observer for auto sign-in
│   ├── adblock/            # Built-in ad blocker
│   └── webui/              # WebUI controllers + handlers
├── webui/
│   ├── ntp/                # New Tab Page (Vite + Tailwind)
│   ├── alia/               # Alia AI Panel (Vite + Tailwind)
│   ├── settings/           # Settings Page (Vite + Tailwind)
│   └── whats-new/          # What's New Page (Vite + Tailwind)
├── branding/               # Logos, icons, .desktop file, astro.conf
├── gn_args/                # Build configs (linux, android, macos, windows)
└── tools/                  # Build, install, patch scripts
```

## Updating Chromium

```bash
# Update to a new Chromium version
tools/update-chromium.sh 147.0.XXXX.XX
```

This fetches the new version, syncs matching ungoogled patches, and attempts to apply all Astro patches. Patch conflicts may need manual resolution.

## Branding

All branding is centralized in `branding/astro.conf`. To rebrand:

```bash
# Edit branding/astro.conf, then:
tools/apply-branding.sh
```

## License

Chromium is licensed under the BSD license. Astro-specific code is proprietary to Oxy.

Made with ❤️ in the 🌎 by Oxy.
