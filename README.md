# Astro Browser

A de-Googled Chromium browser by [Oxy](https://oxy.so). Astro strips all Google services from Chromium and replaces them with privacy-respecting Oxy platform equivalents.

## Features

- All Google service calls removed (based on ungoogled-chromium patches)
- Oxy account sync (bookmarks, history, settings, passwords)
- Oxy search as default engine
- Built-in ad and tracker blocking
- Custom `astro://` protocol for internal pages
- Native integration with the Oxy ecosystem (Mention, Allo, Alia)
- Standard Chromium extension support

## Building

Requires ~60 GB disk space and 16+ GB RAM. First build takes 4-6 hours.

```bash
# Fetch Chromium source (~30 GB download)
tools/fetch-chromium.sh

# Sync ungoogled-chromium patches for this Chromium version
tools/sync-ungoogled.sh

# Apply all patches (ungoogled + Astro)
tools/apply-patches.sh

# Build (Release by default)
tools/build.sh

# Or build in Debug mode
tools/build.sh Debug
```

## Local Install

After building, install locally for testing without full packaging:

```bash
tools/install-local.sh
```

This places the binary at `~/.local/share/astro/`, adds a desktop entry, installs the icon, and creates an `astro` symlink in `~/.local/bin/`.

## Packaging

```bash
tools/package-release.sh
```

## Project Structure

| Path | Description |
|------|-------------|
| `patches/ungoogled/` | Inherited de-Google patches |
| `patches/astro/` | Astro-specific patches (branding, Oxy hooks) |
| `src/chrome/browser/oxy/` | Oxy integration C++ code |
| `gn_args/` | GN build configs per platform |
| `branding/` | Icons, logos, desktop entry |
| `tools/` | Build, install, and maintenance scripts |
| `services/` | Oxy service integration configs |

## Updating Chromium

```bash
tools/update-chromium.sh 137.0.XXXX.XX
```

Fetches the new Chromium version, syncs matching ungoogled patches, and attempts to apply all Astro patches.

## License

Chromium is licensed under the BSD license. Astro-specific code is proprietary to Oxy.
