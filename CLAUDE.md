# Astro - De-Googled Chromium Browser by Oxy

## Overview
Astro is a Chromium fork that removes all Google services and replaces them with Oxy platform equivalents.

## Architecture
- **Base:** ungoogled-chromium patches for de-Googling
- **Overlays:** Brave-style separate source files for Oxy integrations
- **Build:** GN + Ninja (standard Chromium build system)

## Key Paths
- `patches/ungoogled/` - Inherited de-Google patches
- `patches/astro/` - Our custom patches (branding, Oxy hooks)
- `src/chrome/browser/oxy/` - All Oxy integration C++ code
- `gn_args/` - Build configurations per platform
- `tools/` - Build and maintenance scripts

## Build Commands
```bash
tools/fetch-chromium.sh      # First time: fetch Chromium source (~30GB)
tools/sync-ungoogled.sh      # Get matching ungoogled-chromium patches
tools/apply-patches.sh       # Apply all patches
tools/build.sh               # Build (4-6 hours first time)
tools/build.sh Debug         # Debug build
tools/package-release.sh     # Package for distribution
```

## Updating Chromium Version
```bash
tools/update-chromium.sh 137.0.XXXX.XX
```
This fetches the new version, syncs ungoogled patches, and attempts to apply all patches.

## Package Manager
Uses bun for any Node.js tooling (update server, etc.).

## Quality Standards
- Production-grade code. No hacks.
- C++ code follows Chromium style guide (Google C++ style with Chromium extensions)
- All Oxy integrations in self-contained files under `src/chrome/browser/oxy/`
- Minimal patches to existing Chromium files (<20 surgical patches)
