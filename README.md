<h1 align="center">Astro</h1>

<p align="center">
  A Chromium fork by Oxy with every Google service taken out and replaced, not merely switched off.
</p>

<p align="center">
  <img alt="Chromium 146" src="https://img.shields.io/badge/Chromium-146.0.7680.177-440151?style=flat-square&logo=googlechrome&logoColor=white">
  <img alt="168 patches" src="https://img.shields.io/badge/patches-112%20ungoogled%20%2B%2056%20Astro-440151?style=flat-square">
  <img alt="Platforms" src="https://img.shields.io/badge/Linux%20%C2%B7%20Android%20%C2%B7%20macOS%20%C2%B7%20Windows-440151?style=flat-square">
  <img alt="Bun" src="https://img.shields.io/badge/bun-webui-440151?style=flat-square&logo=bun&logoColor=white">
  <img alt="Rust" src="https://img.shields.io/badge/Rust-adblock%20engine-440151?style=flat-square&logo=rust&logoColor=white">
</p>

<p align="center">
  <b>This is a source tree, not a download.</b><br>
  Astro is the patch set, the C++ overlay and the build scripts that turn upstream Chromium<br>
  into the browser Oxy ships. Building it takes hours and about 120 GB.
</p>

---

<table>
<tr>
<td valign="top" width="50%">

### 🚫 Everything Google is gone

112 [ungoogled-chromium](https://github.com/ungoogled-software/ungoogled-chromium) patches remove Google account and sync infrastructure, Safe Browsing pings, Google Update, the hard coded API keys and OAuth secrets, and the prefetches that reach Google domains before you type anything.

56 Astro patches finish the job: branding, the product menu, the settings surface, and the remaining `chrome://` strings.

</td>
<td valign="top" width="50%">

### 🪐 A real Oxy browser, not a skin

Sign in with Oxy is a browser level service, so the account you use for the web is the account the browser knows. Alia, the AI assistant, lives in the side panel rather than a tab.

The ad blocker is a Rust engine compiled into the browser and wired into the network stack, so there is no extension to install and nothing to disable it.

</td>
</tr>
</table>

## What is different from upstream

| Aspect | Astro |
|---|---|
| Base | Chromium 146.0.7680.177, pinned by commit in [`browser.lock.json`](browser.lock.json) |
| De-Google patches | 112, inherited from ungoogled-chromium |
| Oxy patches | 56, in `patches/astro/001` through `056` |
| URL scheme | `astro://`, aliased onto `chrome://` |
| Internal pages | 5, built as Vite and Tailwind apps rather than Polymer |
| Default search | DuckDuckGo, with Google, Bing, Brave Search and Startpage also available |
| Ad blocking | In process Rust engine, no extension |
| Account | Sign in with Oxy, no Google Sign In |
| Platforms | Linux, Android, macOS, Windows. No iOS |

All Astro C++ lives in a self contained overlay at `src/chrome/browser/oxy/`, the same way Brave keeps its code separate from upstream. `tools/sync-overlay.sh` copies it onto the Chromium tree before each build, writing only to destinations declared in `tools/overlay.allowlist`, so nothing Astro specific is scattered through Chromium's own directories and nothing upstream is removed.

## Internal pages

The five `astro://` pages are standalone Vite and Tailwind v4 apps that talk to the browser process over Mojo IPC, which means type safe calls in both directions and live pref updates pushed to the page.

| Page | Source | What it does |
|---|---|---|
| New Tab | [`webui/ntp/`](webui/ntp) | Clock, notes, quick links, weather, wallpaper, an Alia prompt, and a badge counting what the ad blocker stopped |
| Settings | [`webui/settings/`](webui/settings) | Reads and writes real Chromium prefs through a Mojo `PageHandler` |
| Alia | [`webui/alia/`](webui/alia) | The AI side panel |
| What's New | [`webui/whats-new/`](webui/whats-new) | Release notes |
| Error | [`webui/error/`](webui/error) | Network and navigation error pages |

```bash
cd webui/ntp && bun install && bun run dev
```

Each page is its own Bun workspace with its own dev server, so you can iterate on one without rebuilding the browser.

## Building

<details>
<summary><b>What it costs before you start</b></summary>

<br>

| Resource | Minimum | Recommended |
|---|---|---|
| Disk | 120 GB | 200 GB |
| RAM | 16 GB | 32 GB |
| CPU | 8 cores | 16 or more |
| Download | about 55 GB | |

Roughly two to four hours from nothing to a running binary, most of it the Chromium fetch and the first compile. Incremental builds are seconds to minutes.

You need a 64 bit Linux machine for Linux, Android and cross compiled Windows builds, or macOS for native macOS builds. Bun 1.0 or newer for the WebUI workspaces, plus the usual Chromium build dependencies. Full prerequisites are in [`docs/build.mdx`](docs/build.mdx).

</details>

A clean build is five commands:

```bash
tools/sync-sources.sh          # 1. check out every source at its locked commit
tools/sync-ungoogled.sh        # 2. stage the matching ungoogled-chromium patches
tools/apply-patches.sh         # 3. prune binaries, apply 168 patches in declared order
tools/sync-overlay.sh          # 4. copy the Astro overlay onto the tree
tools/build.sh                 # 5. build with autoninja
```

What gets compiled is declared in [`browser.lock.json`](browser.lock.json), by full commit SHA, for Chromium, depot_tools and the ungoogled patch set. Nothing asks a remote what "latest" means and nothing accepts whatever a cached runner happens to hold: the checkout is detached at the locked commit and verified before every build. `tools/build.sh` writes `build/reports/provenance.json` recording what the build was actually made from, and every release artifact ships it.

Then `tools/install-local.sh` to install it and run `astro`.

Every step is fail closed. A failure exits non zero and stops the pipeline, rather than printing a warning and carrying on. Add `--dry-run` to steps 3, 4 and 5 to validate every input and print every planned operation without touching a file.

Patches apply exactly or not at all: there is no fuzzy application and no automatic three way merge, because both produce a tree that is not the reviewed patch. The first patch that does not apply stops the run, and `build/reports/patch-report.json` names it.

The overlay copy writes only to destinations declared in [`tools/overlay.allowlist`](tools/overlay.allowlist) and never deletes. `tools/tests/run.sh` is the suite that proves it; the **Build safety** CI job runs it on every pull request.

> [!NOTE]
> Domain substitution does not currently run. The regex list ungoogled-chromium ships is Python syntax, the old implementation fed it to `sed`, and the resulting error was discarded — so no Astro build has ever had it applied. `tools/apply-patches.sh` now says so instead of reporting success; pass `--skip-domain-substitution` to reproduce what previous builds actually did. Tracked by [#8](https://github.com/OxyHQ/Astro/issues/8).

<details>
<summary><b>Every script in <code>tools/</code></b></summary>

<br>

Scripts marked **mutates** write into the Chromium checkout. Each of those verifies the destination is a real Chromium checkout before writing, and refuses to run against one carrying unrelated local changes unless `ASTRO_ALLOW_DIRTY_CHROMIUM=1` is passed by hand.

| Script | Mutates `chromium/src` | What it does |
|---|---|---|
| `tools/sync-sources.sh` | **mutates** | check out every source at its locked commit |
| `tools/fetch-chromium.sh` | **mutates** | deprecated wrapper; delegates to `sync-sources.sh` |
| `tools/sync-ungoogled.sh` | no | stage patches from the locked ungoogled checkout |
| `tools/generate-provenance.sh` | no | record what a build was made from |
| `tools/lib/lock.py` | no | validate and read `browser.lock.json` |
| `tools/apply-patches.sh` | **mutates** | pruning, then patches in declared series order |
| `tools/sync-overlay.sh` | **mutates** | allowlisted overlay copy; never deletes |
| `tools/build.sh` | **mutates** | `[Release\|Debug] [linux\|android\|macos\|windows]` |
| `tools/install-local.sh` | **mutates** | recompile and install to the system |
| `tools/apply-branding.sh` | **mutates** | regenerate branding from `branding/astro.conf` |
| `tools/vendor-adblock-rust.sh` | **mutates** | vendor the Rust adblock dependencies |
| `tools/fetch-cross-deps.sh` | **mutates** | sysroots; discards local modifications |
| `tools/update-chromium.sh VER` | **mutates** | rebase onto a new Chromium version |
| `tools/astro-launch.sh` | no | launch a local build |
| `tools/package-release.sh` | no | package for distribution |
| `tools/package-{linux,deb,android,macos,windows}.sh` | no | per platform packaging |
| `tools/tests/run.sh` | no | the build safety suite; synthetic fixtures only |

GN args per platform live in [`gn_args/`](gn_args): `linux.gn`, `linux_debug.gn`, `android.gn`, `macos.gn`, `windows.gn`, `windows_arm64.gn`.

</details>

<details>
<summary><b>Rebasing onto a new Chromium</b></summary>

<br>

```bash
tools/update-chromium.sh 147.0.XXXX.XX
```

That resolves the version to exactly one commit at the origin, checks the tag and commit agree, updates [`browser.lock.json`](browser.lock.json) and writes a change report. It is a proposal by default: an update changes what the whole project compiles, so it lands as a reviewable lock diff rather than as a side effect. Add `--apply` to sync straight away.

A version with no exact tag fails. Nothing nearby is substituted — the previous implementation fell back to the newest tag sharing a major version, then to `master`, printing a warning and exiting zero, so a "successful" update could build against a patch set written for a different Chromium.

Then `tools/apply-patches.sh` replays the Astro patches in the order their `series` file declares. When one fails to apply, the run stops at that patch, exits non zero and names it — in the console and in `build/reports/patch-report.json` — so you resolve the conflict by hand rather than discovering it at link time. Nothing is applied fuzzily to paper over the drift. [`docs/recovery.mdx`](docs/recovery.mdx) covers the rest.

</details>

<details>
<summary><b>Rebranding</b></summary>

<br>

Every user facing name, URL, icon and theme colour is declared once in [`branding/astro.conf`](branding/astro.conf). Edit it and run:

```bash
tools/apply-branding.sh
```

That rewrites the `.grd` resource strings and the `BRANDING` file Chromium's build system reads, and regenerates the icon sizes from the source SVG.

</details>

## Documentation

| Document | Covers |
|---|---|
| [`docs/index.mdx`](docs/index.mdx) | What Astro is and how it differs from Chromium |
| [`docs/build.mdx`](docs/build.mdx) | Prerequisites, the build workflow, cross compiling, packaging |
| [`docs/architecture.mdx`](docs/architecture.mdx) | The overlay, the patch system, Mojo |
| [`docs/oxy-integration.mdx`](docs/oxy-integration.mdx) | Auth, Alia, and the Oxy services behind them |
| [`docs/recovery.mdx`](docs/recovery.mdx) | Recovering from an interrupted or failed patch run |
| [`docs/reproducibility.mdx`](docs/reproducibility.mdx) | The source lock, deterministic sync, and build provenance |
| [`docs/astro-next/baseline/`](docs/astro-next/baseline) | The product, source, security and network baseline |

## License

Chromium is under the BSD license. Astro specific code is proprietary to Oxy.

<br>

<div align="center">
<sub>built by <a href="https://oxy.so">Oxy</a></sub>
</div>
