# Screenshot and UI reference set

What Astro looks like today, captured under conditions precise enough that
two people produce comparable images.

## No screenshots are committed yet

The directory this document describes, `docs/astro-next/baseline/shots/`,
does not exist. There is no built Astro on the machine this was written on
and no Chromium checkout to build one from, so nothing has been captured and
nothing has been approximated. A mock-up filed as a baseline screenshot
would be worse than an empty set: later issues are meant to diff against
these images, and a diff against an invented reference reports a regression
that never happened, or hides one that did.

Building is the prerequisite; `feature-matrix.md` carries the command
sequence. Once a build exists, this document is the capture list.

## Conditions

Two people must be able to capture the same surface and get images that
differ only where the product differs. That means fixing the conditions
first and recording them per image, because most of what makes two
screenshots differ is not the product.

| Condition | Value | Why it is fixed here |
|---|---|---|
| OS | Debian 13 (trixie), x86_64 | The platform the project builds and tests on first; every other platform is a separate, labelled set |
| Session | X11, single monitor | Wayland fractional scaling and multi-monitor DPI both change rendered geometry without changing the product |
| Window size | 1280 × 800 logical, via `--window-size=1280,800` | Fits a laptop screen, wide enough that settings and the side panel are not in a collapsed layout |
| Scale factor | 1× and 2×, via `--force-device-scale-factor` | 1× is what most reviewers see; 2× is where icon and font hinting problems become visible |
| Theme | light, dark and system, each captured | Astro switches theme through `SetTheme()`; a page that only works in one is a real defect |
| OS theme when Astro is set to "system" | captured twice, once with the desktop light and once dark | "System" is the default for many users and it has two appearances |
| UI language | `en-GB`, via `--lang=en-GB` | Fixes string lengths, which decide whether a control wraps |
| Fonts | `fonts-dejavu-core`, `fonts-liberation2` and `fonts-noto-color-emoji` installed; no other family | A font present on one machine and absent on another changes every line box in the image |
| Remote fonts | reachable, and recorded per image | See below |
| Zoom | 100 %, default font size, no accessibility preference set | Unless the image exists to show that preference |
| Profile | a fixture profile from `test/astro-next/fixtures/`, never a real one | See the data rules below |
| Extensions | none installed | Unless the image exists to show an extension |
| Cursor | not in frame | A hover state captured accidentally reads as a styling change |
| Format | PNG, lossless, no cropping beyond the browser window | |

Capture the browser window, not the whole desktop: a window-manager
decoration or a desktop wallpaper in frame makes every image
machine-specific.

**Remote fonts are a real determinism hazard, and the honest handling is to
record rather than to suppress.** The new-tab page's CSP permits
`https://fonts.googleapis.com` and `https://fonts.gstatic.com`, and the Alia
panel's permits `https://fonts.gstatic.com`, so both pages can render in a
downloaded font when the network is available and in a local fallback when
it is not — the same build, two appearances, no error either way. Capture
with the network available, and record in the manifest whether the remote
font actually loaded for that image. An image whose typography silently
changed between captures is worse than one that is labelled.

Record the exact command line with every image, including
`--user-data-dir`. `tools/astro-launch.sh` is not suitable for captures: it
passes `--no-sandbox` and points at `~/.config/astro`, a developer's real
profile.

## Only non-sensitive test data

Committed screenshots are published artefacts. They are read by everyone
working on Astro Next, they live in git for as long as the repository does,
and an image cannot be redacted after the fact — the earlier commit still
carries it.

Concretely, that rules out:

- **A real Oxy account.** Every signed-in capture uses a dedicated
  non-production test account whose display name, handle and avatar are
  obviously synthetic. No colleague's name, photograph or email address
  appears in the profile menu, in Alia or in settings.
- **Real bookmarks and real history.** Both are captured from the seeded
  fixture profile. A personal bookmarks bar or history list discloses
  employer, projects and habits in a single image, and both surfaces are
  captured wide.
- **Real credentials of any kind.** Password-manager and autofill captures
  use fixture entries with obviously fake values. No token, session id or
  cookie value may be legible anywhere, including in a DevTools panel left
  open behind the surface being captured.
- **The capturing machine's identity.** No home directory path containing a
  real username — which rules out capturing the downloads page or
  `chrome://version` from a normal profile — no hostname, no device name, no
  serial number, no local IP address.
- **Third-party content that is not ours to redistribute.** Adblock and
  cosmetic-filtering captures use local fixture pages that reproduce the
  request and element shapes, not a live commercial site.

If a surface cannot be captured without one of the above, capture it with a
fixture that stands in for it and say so in the manifest. Redacting by
drawing a box over the image is acceptable only where the layout is the
point; a blurred region is not evidence.

## Naming and manifest

```
docs/astro-next/baseline/shots/
  <surface>__<state>__<theme>__<scale>x.png
```

`surface` is the identifier from the tables below, `state` is `default`
where the surface has only one. For example:

```
ntp__default__dark__2x.png
profile-menu__signed-in__light__1x.png
adblock-bubble__site-override__system-dark__1x.png
```

Every image has a row in `shots/manifest.json` recording: the file name,
the surface and state, theme, scale factor, the capture date, the Chromium
and Astro commits, the build type, whether the overlay collision described
in `feature-matrix.md` was present in that build, the full command line, the
fixture profile used, and whether the remote font loaded. An image without
that row is not a baseline — nobody can tell later what it was a picture of.

`build/reports/provenance.json` carries the revision fields; copy them
rather than retyping them.

## Astro-owned surfaces

These are Astro's own code. There is no upstream reference for any of them,
so an unreviewed change here is invisible without these images.

| Surface | Where | States to capture |
|---|---|---|
| `ntp` | `astro://newtab` | `default`; `blocked-count-zero`; `blocked-count-nonzero` |
| `ntp-widgets` | `astro://newtab` | one image per widget in its configured and unconfigured state |
| `settings-index` | `astro://settings` | `default` |
| `settings-section` | `astro://settings` | one image per section, so a moved control is attributable |
| `settings-clear-data` | `astro://settings` | `dialog-open` |
| `alia-panel` | side panel | see the Alia table below |
| `whats-new` | `astro://whats-new` | `default` |
| `error-page` | `astro://error` | `dns-failure`; `connection-refused`; `certificate-error` |
| `adblock-page` | `chrome://adblock` | `default`; `unregistered` — the second is what a checkout carrying the overlay copy shows, per issue #7 |

## Modified Chromium surfaces

Upstream surfaces that an Astro or ungoogled patch changes. These are where
a regression is easiest to introduce and hardest to notice, because the
surface looks familiar.

| Surface | Changed by | States to capture |
|---|---|---|
| `profile-menu` | patches 014, 015, 034 | `signed-out`; `signed-in`; `guest`; `multiple-profiles` |
| `omnibox-internal-url` | patches 021, 028 | `astro-url-displayed`; `dropdown-astro-suggestion` |
| `omnibox-search` | patch 004 | `default-engine-duckduckgo` |
| `toolbar` | patches 049, 053 | `default`; `alia-action-visible`; `adblock-shield-visible` |
| `adblock-bubble` | overlay | see the adblock table below |
| `tab-hover-card` | patch 040 | `internal-url` |
| `settings-strings` | patches 009, 013, 033 | every settings surface carrying a rebranded string |
| `first-run` | `first-run-page.patch` | `default`; and the state produced when the overlay collision reverts it |
| `dino-game` | patch 038 | `default` |
| `about-page` | branding | `chrome://version`, captured from a fixture profile only |
| `app-window` | patches 031, 032, 043 | an installed web app window, and its desktop entry |

## Theme states

Every surface above is captured in each theme. That is three images per
surface at 1×, plus the same at 2× where the surface has a dense layout —
the toolbar, the tab strip, the profile menu, the adblock bubble and the
Alia panel at minimum.

| Theme setting | Desktop theme | Label |
|---|---|---|
| Light | either | `light` |
| Dark | either | `dark` |
| System | light | `system-light` |
| System | dark | `system-dark` |

The two `system` rows exist because "follow the system" is a single setting
with two appearances, and a page that reads the setting but not the OS
signal looks correct in exactly one of them.

## Profile menu states

| State | How to reach it | Note |
|---|---|---|
| `signed-out` | fixture profile, never signed in | The default a new user sees |
| `signed-in` | after OXY-01, test account only | Records the identity treatment: name, handle, avatar |
| `signed-in-expired` | after `oxy.token_expiry` has passed | Whether an expired session still looks signed in is a real question |
| `guest` | guest window | |
| `multiple-profiles` | two fixture profiles | The switcher, not the header |

## Adblock states

| State | How to reach it |
|---|---|
| `enabled-no-blocks` | fixture page with nothing matched |
| `enabled-with-blocks` | fixture page reproducing blocked request shapes |
| `bubble-open` | shield clicked on the page above |
| `site-override` | blocking disabled for that site from the bubble |
| `globally-disabled` | `oxy.adblock.enabled` false |
| `lists-updating` | during a filter-list fetch |
| `lists-unreachable` | catalogue hosts blocked at the network layer |
| `custom-rules` | a custom rule saved and matching |

## Alia states

| State | How to reach it |
|---|---|
| `closed` | toolbar action, panel not open |
| `open-signed-out` | panel opened with no Oxy session |
| `open-signed-in` | panel opened with the test account signed in |
| `open-offline` | `api.alia.oxy.so` blocked at the network layer |
| `open-narrow-window` | browser window narrowed until the panel reflows |
| `incognito` | panel opened, or not available, in an incognito window |

## Other platforms

The tables above are the Linux set. macOS, Windows and Android each get
their own directory and their own condition rows — window chrome, default
fonts and scale factors all differ, so cross-platform images are not
comparable to each other and must never be diffed as though they were.

Capture at least the Astro-owned surfaces and the profile menu on each
platform Astro claims to support. Everything else can follow once the
platform's packaging row in `feature-matrix.md` (`PKG-01` to `PKG-06`) has a
result.

## Related documents

| Document | What it holds |
|---|---|
| [`README.md`](README.md) | Index of this directory and what is generated |
| [`feature-matrix.md`](feature-matrix.md) | The behaviour scenarios these images illustrate |
| [`security-baseline.md`](security-baseline.md) | The CSP directives behind the remote-font hazard |
