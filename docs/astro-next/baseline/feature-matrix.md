# Product behaviour baseline (feature matrix)

What Astro does today, scenario by scenario, so that a later change can be
classified as intentional or as a regression.

## Nothing in this document is captured yet

Every `Current` field below reads `not-captured`, and that is the honest
state rather than an oversight. There is no built Astro on the machine this
was written on and no Chromium checkout to build one from, so no behaviour
here has been observed. Nothing was inferred to fill the gap.

That matters more than it looks. Later issues are meant to cite this file as
their compatibility reference, so a plausible-looking invented result would
not be caught: it would be believed, and a real regression would be argued
against it. A matrix of honest gaps is a work list. A matrix of guesses is a
liability.

`Expected` is a different kind of claim and is populated where it is
defensible. It is stated only where the behaviour follows from upstream
Chromium (tab restore restores tabs) or from something declared in this
repository (patch 004 sets DuckDuckGo as the default search engine; patch
046 registers `oxy.adblock.enabled`). Where neither holds — most of the
Astro-specific surfaces, and everything ungoogled-chromium altered — the
field reads `to-be-recorded`, meaning the capture defines the baseline
rather than confirming a requirement.

### What unblocks it

A capture needs a built browser. From a clean checkout:

```sh
tools/sync-sources.sh                             # 1. locked revisions
tools/sync-ungoogled.sh                           # 2. stage ungoogled patches
tools/apply-patches.sh --skip-domain-substitution # 3. 168 patches, in order
tools/sync-overlay.sh                             # 4. copy the Astro overlay
tools/build.sh Release linux                      # 5. build
tools/baseline/smoke.sh                           # 6. automated portion
```

Steps 1, 5 and 6 are the load-bearing ones; 2 to 4 are what stands between
them. `--skip-domain-substitution` on step 3 is required today, not
optional: domain substitution has never run, `apply-patches.sh` now refuses
rather than pretending, and the flag reproduces what previous builds
actually did. See the known defects below.

Budget roughly 120 GB of disk and two to four hours for a first build.

**Do not capture through `tools/astro-launch.sh` without saying so.** It
launches with `--no-sandbox` and `--user-data-dir="$HOME/.config/astro"`.
The first changes process and sandbox behaviour, which several scenarios
here exist to measure; the second is a developer's real profile, which
scenarios needing a clean profile must not touch. Launch the binary
directly, with an explicit `--user-data-dir` pointing at a scratch or
fixture profile, and record the full command line with the result.

## Two known defects that change what a capture means

Both are declared in `AGENTS.md` rather than hidden, and both must be
recorded alongside any result, because a capture taken without noticing
either one measures a different browser than the reader will assume.

| Defect | Effect on this matrix | Owner |
|---|---|---|
| Domain substitution has never run | Every endpoint scenario measures unsubstituted hosts. A Google host still contacted may be a live feature, not a leak past a substitution that never happened. | [#8](https://github.com/OxyHQ/Astro/issues/8) |
| An overlay copy of `chrome_web_ui_configs.cc` reverts four patches | In a checkout carrying that file, `054-adblock-webui-register`, `055-ntp-webui-register`, `disable-ai` and `first-run-page` are all silently undone. Scenarios FL-02, TAB-01, SCH-02, SCH-03, ADB-10 and WEBUI-01 therefore have two possible baselines. | [#7](https://github.com/OxyHQ/Astro/issues/7) |

The overlay collision is declared in `tools/overlay.allowlist`, so a
checkout carrying the file behaves loudly rather than silently. Record which
of the two states the capture was taken in — the file is currently untracked
working-tree content, not committed state, so two people on the same commit
can legitimately measure different things.

## How to read a row

Each scenario is one block:

- **Steps** — what to do, precisely enough that two people do the same
  thing. Where a fixture profile is needed it is named; fixtures live in
  `test/astro-next/fixtures/`.
- **Expected** — a requirement, or `to-be-recorded` where the capture is
  what defines the answer.
- **Current** — `not-captured`, everywhere, today.
- **Class** — `contractual` or `incidental`, then `astro`, `inherited` or
  `mixed`.

**Contractual** means Astro Next must preserve the behaviour; a change is a
regression unless somebody decided otherwise and wrote it down.
**Incidental** means the behaviour is simply what happens today; it may
change without that being a fault, but it is recorded so that the change is
noticed and chosen rather than discovered by a user.

**`astro`** marks behaviour Astro added or altered — Alia, Oxy identity,
adblock, the `astro://` scheme, the five WebUI pages. **`inherited`** marks
upstream Chromium behaviour Astro must not break. **`mixed`** marks upstream
behaviour that an Astro or ungoogled patch already changes, which is where
regressions hide most comfortably.

### Recording a result

Replace `not-captured` with what was observed, and cite the build. A result
with no provenance cannot be reproduced or contested:

```
Current — <date>, chromium <sha>, astro <sha>, <platform> <build type>,
          overlay-collision: <present|absent>. <what was observed>
```

That is the format, not a result. No row in this file has been filled in.

`build/reports/provenance.json` carries every field that citation needs, and
`tools/generate-provenance.sh --require-match` refuses to certify a build
made from a tree that drifted from the lock.

## Groups

| ID | Group | Scenarios | Origin |
|---|---|---|---|
| `FL` | First launch | 6 | mixed |
| `WIN` | Windows and incognito | 5 | mixed |
| `TAB` | Tabs | 7 | mixed |
| `OMN` | Omnibox | 8 | mixed |
| `SCH` | `astro://` scheme and internal URLs | 7 | astro |
| `HB` | History and bookmarks | 6 | inherited |
| `SR` | Startup and session restore | 5 | mixed |
| `PRF` | Profiles, guest mode and separation | 6 | mixed |
| `DL` | Downloads | 6 | mixed |
| `PWD` | Passwords, autofill, payments | 6 | mixed |
| `PRM` | Permissions | 6 | mixed |
| `EXT` | Extensions | 5 | mixed |
| `DEV` | DevTools | 4 | inherited |
| `PIP` | Picture-in-Picture and media | 5 | inherited |
| `PDF` | Printing and PDF viewing | 5 | inherited |
| `PWA` | Web apps and PWA install | 4 | mixed |
| `PH` | Protocol handlers | 4 | mixed |
| `A11Y` | Accessibility and keyboard navigation | 6 | mixed |
| `TM` | Task manager | 3 | inherited |
| `ALIA` | Alia side panel | 6 | astro |
| `OXY` | Oxy sign-in, sign-out, restart | 8 | astro |
| `ADB` | Adblock | 10 | astro |
| `WEBUI` | Astro WebUI pages | 10 | astro |
| `PKG` | Packaging and install per platform | 7 | mixed |

145 scenarios. 41 are Astro-specific (`SCH`, `ALIA`, `OXY`, `ADB`,
`WEBUI`), which is the split later issues will care about: an Astro-specific
scenario is a product decision Astro Next may revisit deliberately, while an
inherited one changing is almost always a fault in the port.

---

## FL — First launch

The state a user meets before any preference exists. It is also the state
every other capture starts from, so getting it recorded first makes the rest
attributable.

**FL-01 — a clean profile produces a usable window**

- Steps — point `--user-data-dir` at an empty directory, launch, wait for
  the first window, then leave the browser idle for sixty seconds.
- Expected — exactly one window; a renderable new-tab surface; no crash
  dialogue; the browser process alive at the end of the idle period.
- Current — `not-captured`
- Class — contractual · inherited

**FL-02 — what the first run actually shows**

- Steps — same clean profile; record every surface shown before the user
  acts: welcome or first-run page, default-browser prompt, What's New.
- Expected — `to-be-recorded`. `first-run-page.patch` is one of the four
  patches the overlay collision reverts, so this has two baselines and both
  must be recorded (see the defects table).
- Current — `not-captured`
- Class — contractual · mixed

**FL-03 — the default search engine is DuckDuckGo**

- Steps — clean profile; open the search-engine settings; record the
  default and the full list of prepopulated engines.
- Expected — DuckDuckGo is the default. Patch
  `004-default-search-duckduckgo.patch` sets it, and the README states
  Google, Bing, Brave Search and Startpage are also available.
- Current — `not-captured`
- Class — contractual · astro

**FL-04 — what a first launch writes to the profile directory**

- Steps — clean profile; launch; quit cleanly; list the directory tree and
  record the `oxy.*` keys present in `Default/Preferences` with their
  values.
- Expected — `oxy.access_token`, `oxy.refresh_token`, `oxy.session_id`,
  `oxy.user_id`, `oxy.username`, `oxy.user_avatar` and `oxy.token_expiry`
  registered as empty strings; `oxy.adblock.enabled` true;
  `oxy.adblock.site_overrides` empty; `oxy.adblock.custom_rules` empty;
  `oxy.adblock.lifetime_blocked_count` zero. Patches 020 and 046 declare
  these defaults.
- Current — `not-captured`
- Class — contractual · astro

**FL-05 — first launch with no network**

- Steps — clean profile with outbound traffic blocked at the interface;
  launch; wait sixty seconds.
- Expected — a window appears and the browser stays usable. Nothing on the
  startup path may block on a remote host.
- Current — `not-captured`
- Class — contractual · mixed

**FL-06 — launching onto a profile written by an older Astro**

- Steps — restore an archived fixture profile from a previous Astro version
  and launch against it.
- Expected — `to-be-recorded`. This is the migration case every later issue
  will need; the answer is the fixture set in `test/astro-next/fixtures/`.
- Current — `not-captured`
- Class — contractual · mixed

---

## WIN — Windows and incognito

Incognito is where Astro's three added services need an answer that upstream
does not supply: identity, the assistant panel and the blocker each have to
decide what they do in a window that is meant to leave no trace.

**WIN-01 — a new normal window**

- Steps — `Ctrl+N`; then the same from the menu.
- Expected — a second window with its own tab strip, sharing the profile.
- Current — `not-captured`
- Class — contractual · inherited

**WIN-02 — a new incognito window**

- Steps — `Ctrl+Shift+N`; record which Astro surfaces appear: the new-tab
  surface, the Alia toolbar action, the adblock shield.
- Expected — `to-be-recorded`.
- Current — `not-captured`
- Class — contractual · mixed

**WIN-03 — incognito and the Oxy session**

- Steps — sign in (OXY-01), open an incognito window, and record whether
  the profile menu, Alia and any Astro page treat the window as signed in.
- Expected — `to-be-recorded`. Whatever the answer, it is a privacy
  contract and belongs in the security baseline as well as here.
- Current — `not-captured`
- Class — contractual · astro

**WIN-04 — closing the last window ends the process**

- Steps — close every window; watch the process table for thirty seconds.
- Expected — no browser process survives on Linux and Windows. macOS keeps
  the application running by platform convention; record which applies.
- Current — `not-captured`
- Class — contractual · inherited

**WIN-05 — window geometry survives a restart**

- Steps — resize and reposition a window, quit cleanly, relaunch.
- Expected — the window reopens at the same size and position.
- Current — `not-captured`
- Class — incidental · inherited

---

## TAB — Tabs

The tab strip is the surface a user touches most, so nothing here is
optional. Two rows are Astro-specific: what a new tab opens, and how an
internal URL is displayed in a hover card.

**TAB-01 — a new tab opens the Astro new-tab surface**

- Steps — `Ctrl+T`; record the URL the omnibox shows and the URL the page
  actually has.
- Expected — the Astro NTP. Patch `056-ntp-redirect-to-astro.patch`
  redirects the new-tab URL, and `055-ntp-webui-register.patch` registers
  `chrome://astro-ntp`; the latter is reverted by the overlay collision, so
  record which state the build is in.
- Current — `not-captured`
- Class — contractual · astro

**TAB-02 — close and reopen**

- Steps — close a tab with `Ctrl+W`, reopen with `Ctrl+Shift+T`; repeat for
  three closed tabs and check the order.
- Expected — tabs reopen in reverse close order with their history intact.
- Current — `not-captured`
- Class — contractual · inherited

**TAB-03 — pinning survives a restart**

- Steps — pin two tabs, quit cleanly, relaunch.
- Expected — both tabs return pinned and in their pinned positions.
- Current — `not-captured`
- Class — contractual · inherited

**TAB-04 — tab groups**

- Steps — group three tabs, name and colour the group, collapse and expand
  it, quit cleanly, relaunch.
- Expected — the group returns with its name, colour, membership and
  collapsed state.
- Current — `not-captured`
- Class — contractual · inherited

**TAB-05 — dragging a tab out and back**

- Steps — drag a tab out to form a new window; drag it back into the
  original strip; drag one between two existing windows.
- Expected — the tab moves with its session history; neither window
  crashes.
- Current — `not-captured`
- Class — contractual · inherited

**TAB-06 — the hover card on an internal page**

- Steps — open `astro://settings`, hover its tab, record the URL text in
  the hover card.
- Expected — the `astro://` form. Patch
  `040-tab-hover-astro-scheme.patch` exists to make the hover card agree
  with the omnibox.
- Current — `not-captured`
- Class — contractual · astro

**TAB-07 — many tabs**

- Steps — open sixty tabs in one window; record strip behaviour, memory and
  whether the browser stays responsive.
- Expected — `to-be-recorded`.
- Current — `not-captured`
- Class — incidental · inherited

---

## OMN — Omnibox

Astro rewrites how internal URLs are typed, matched, classified and
displayed across at least eight patches (021 to 029, 037). That is a lot of
surface area for a component users type into constantly.

**OMN-01 — searching from the omnibox**

- Steps — type a plain term and press Enter on a clean profile.
- Expected — a DuckDuckGo results page, per FL-03.
- Current — `not-captured`
- Class — contractual · astro

**OMN-02 — typing a URL**

- Steps — type a bare host, a full `https://` URL, and a host with a path
  and query.
- Expected — each navigates rather than searching.
- Current — `not-captured`
- Class — contractual · inherited

**OMN-03 — autocomplete from history and bookmarks**

- Steps — using the seeded fixture profile, type a prefix matching a
  history entry and one matching a bookmark; record the ranking of the
  suggestions.
- Expected — both appear; the inline autocompletion completes the
  most-visited match.
- Current — `not-captured`
- Class — contractual · inherited

**OMN-04 — paste-and-go**

- Steps — copy a URL, right-click the omnibox, choose paste-and-go; repeat
  with a search phrase.
- Expected — the URL navigates; the phrase searches.
- Current — `not-captured`
- Class — contractual · inherited

**OMN-05 — typing an `astro://` URL**

- Steps — type `astro://settings`, `astro://newtab`, `astro://alia`,
  `astro://whats-new` and `astro://error`; record what loads and what the
  omnibox displays afterwards.
- Expected — each resolves to its page and the omnibox continues to show
  the `astro://` form. Patches 021 to 028 and 037 cover display,
  autocomplete, URL fixing, scheme classification and the built-in
  provider.
- Current — `not-captured`
- Class — contractual · astro

**OMN-06 — typing the `chrome://` form**

- Steps — type `chrome://settings` and `chrome://astro-ntp`; record what
  loads and what the omnibox shows.
- Expected — `to-be-recorded`. Whether the `chrome://` form is reachable
  and whether it is rewritten for display are both product decisions worth
  pinning before they change.
- Current — `not-captured`
- Class — contractual · astro

**OMN-07 — search suggestions**

- Steps — with `search.suggest_enabled` on and then off, type slowly and
  record both the suggestions and the outbound requests.
- Expected — `to-be-recorded`; cross-reference `network-inventory.yaml`,
  since this is one of the few paths that sends keystrokes off-device.
- Current — `not-captured`
- Class — contractual · mixed

**OMN-08 — copying an internal URL**

- Steps — on `astro://settings`, copy the URL from the omnibox and paste it
  into a text field.
- Expected — the `astro://` form. Patch `029-copy-url-astro.patch` exists
  for this.
- Current — `not-captured`
- Class — contractual · astro

---

## SCH — `astro://` scheme and internal URLs

The scheme is an alias: `HandleChromeAboutAndChromeSyncRewrite` rewrites
`astro://` to `chrome://` before anything else sees it (patch 011). Aliases
are cheap to add and expensive to get wrong, because every security decision
downstream is made on the rewritten URL.

**SCH-01 — every `astro://` page resolves**

- Steps — navigate to each of `astro://newtab`, `astro://settings`,
  `astro://alia`, `astro://whats-new`, `astro://error`.
- Expected — each loads its page.
- Current — `not-captured`
- Class — contractual · astro

**SCH-02 — the `chrome://` hosts resolve directly**

- Steps — navigate to `chrome://astro-ntp`, `chrome://astro-error`,
  `chrome://settings`, `chrome://alia`, `chrome://whats-new`.
- Expected — `to-be-recorded`. `chrome://astro-ntp` depends on patch 055,
  which the overlay collision reverts.
- Current — `not-captured`
- Class — contractual · astro

**SCH-03 — `chrome://adblock`**

- Steps — navigate to `chrome://adblock` and `astro://adblock`.
- Expected — `to-be-recorded`. The controller and its message handler exist
  in the overlay (`src/chrome/browser/oxy/adblock/webui/`) and patch 054
  registers `AstroAdBlockUIConfig`, but the overlay copy of
  `chrome_web_ui_configs.cc` reverts that registration. Both states must be
  recorded.
- Current — `not-captured`
- Class — contractual · astro

**SCH-04 — a web page linking to an internal URL**

- Steps — from an ordinary `https://` page, click a link to
  `astro://settings`, and separately to `chrome://settings`.
- Expected — web content cannot navigate the browser to a WebUI page. This
  is an upstream security invariant and the alias must not create a way
  around it.
- Current — `not-captured`
- Class — contractual · astro

**SCH-05 — internal URLs in a subframe or `window.open`**

- Steps — from a web page, attempt an `astro://` iframe and a
  `window.open('astro://settings')`.
- Expected — both refused, for the same reason as SCH-04.
- Current — `not-captured`
- Class — contractual · astro

**SCH-06 — internal URLs stored in a profile**

- Steps — bookmark `astro://settings`, visit it so it enters history, quit
  cleanly, relaunch, and open both the bookmark and the history entry.
- Expected — both still resolve. This is the row that decides how much
  migration work a scheme change in Astro Next implies.
- Current — `not-captured`
- Class — contractual · astro

**SCH-07 — an unknown `astro://` host**

- Steps — navigate to `astro://does-not-exist`.
- Expected — `to-be-recorded`; record whether the error surface is the
  Astro error page (`astro://error`) or Chromium's own.
- Current — `not-captured`
- Class — incidental · astro

---

## HB — History and bookmarks

Inherited wholesale, but they are the two stores a user notices losing, so
they are the first thing a migration has to prove it kept.

**HB-01 — a navigation is recorded**

- Steps — visit three HTTPS pages; open the history page; check each entry
  with its title and timestamp.
- Expected — all three present, most recent first.
- Current — `not-captured`
- Class — contractual · inherited

**HB-02 — history search**

- Steps — on the seeded fixture profile, search history by title fragment
  and by host.
- Expected — both match.
- Current — `not-captured`
- Class — contractual · inherited

**HB-03 — clearing browsing data**

- Steps — clear browsing data from `astro://settings`, which calls the Mojo
  `ClearBrowsingData()`; check history, cookies, cache and downloads
  afterwards; repeat for each time range the UI offers.
- Expected — what the UI says it will clear is cleared, and nothing else
  is. An over-broad clear is as much a fault as a no-op.
- Current — `not-captured`
- Class — contractual · astro

**HB-04 — bookmark creation and editing**

- Steps — bookmark a page with `Ctrl+D`, create a folder, move the
  bookmark into it, rename both, delete the bookmark, undo the deletion.
- Expected — every step takes effect and survives a restart.
- Current — `not-captured`
- Class — contractual · inherited

**HB-05 — the bookmark manager**

- Steps — open the bookmark manager; import and export an HTML file.
- Expected — the manager loads and round-trips the file.
- Current — `not-captured`
- Class — contractual · inherited

**HB-06 — the bookmarks bar toggle**

- Steps — toggle the bookmarks bar from `astro://settings` and with
  `Ctrl+Shift+B`; check `bookmark_bar.show_on_all_tabs` and that the two
  controls agree live.
- Expected — both paths set the same pref and the settings page updates
  without a reload, via `Page::OnPrefChanged()`.
- Current — `not-captured`
- Class — contractual · astro

---

## SR — Startup and session restore

Restore is the single most visible thing a browser can get wrong, and Astro
patches it (042) to handle its own scheme.

**SR-01 — the startup-page setting**

- Steps — set each startup option in turn — new tab, continue where you
  left off, a specific set of pages — quit cleanly and relaunch after each.
- Expected — each behaves as labelled.
- Current — `not-captured`
- Class — contractual · inherited

**SR-02 — restore after a clean exit**

- Steps — open six tabs across two windows, quit from the menu, relaunch
  with "continue where you left off".
- Expected — both windows, all six tabs, scroll positions and per-tab back
  history restored.
- Current — `not-captured`
- Class — contractual · inherited

**SR-03 — restore after a kill**

- Steps — same layout; `kill -9` the browser process; relaunch.
- Expected — the restore prompt or automatic restore, per the startup
  setting; no profile corruption.
- Current — `not-captured`
- Class — contractual · inherited

**SR-04 — pinned tabs and groups through a restore**

- Steps — combine TAB-03 and TAB-04 with SR-02.
- Expected — pinning, group membership, names and colours all survive.
- Current — `not-captured`
- Class — contractual · inherited

**SR-05 — restoring a tab holding an internal URL**

- Steps — leave `astro://settings` and `astro://alia` open; quit cleanly;
  relaunch and restore.
- Expected — both tabs return to their `astro://` URLs rather than to a
  rewritten `chrome://` form or an error page. Patch
  `042-session-restore-astro.patch` exists for this.
- Current — `not-captured`
- Class — contractual · astro

---

## PRF — Profiles, guest mode and separation

Astro adds an identity to the profile menu (patches 014, 015) and stores
Oxy tokens outside the profile, in the OS credential store. That asymmetry —
profile-scoped preferences, machine-scoped secrets — is exactly what PRF-04
exists to measure.

**PRF-01 — creating a second profile**

- Steps — create a profile from the profile menu; give it a name and an
  avatar.
- Expected — a separate window with its own profile directory.
- Current — `not-captured`
- Class — contractual · inherited

**PRF-02 — the profile menu**

- Steps — open the profile menu signed out and signed in; record every
  entry and the header.
- Expected — `to-be-recorded`. Patches 014 and 015 replace the header with
  an Oxy one and patch 034 rewrites the profile strings.
- Current — `not-captured`
- Class — contractual · astro

**PRF-03 — separation between profiles**

- Steps — in profile A set a cookie, visit a site, save a bookmark and
  change a setting; check each from profile B.
- Expected — nothing crosses. Cookies, history, bookmarks and preferences
  are all per-profile.
- Current — `not-captured`
- Class — contractual · inherited

**PRF-04 — the Oxy session across profiles**

- Steps — sign in as one Oxy account in profile A; open profile B and
  record whether it is signed in, and as whom. Then sign out of A and
  recheck B.
- Expected — `to-be-recorded`. `oxy.session_id`, `oxy.user_id` and
  `oxy.username` are profile preferences, while `OxyAuthTokenStore` writes
  to the OS credential store, so the two halves of a session may not be
  scoped alike. Whatever is measured belongs in the security baseline too.
- Current — `not-captured`
- Class — contractual · astro

**PRF-05 — guest mode**

- Steps — open a guest window; browse; close it; check that no history,
  cookies or downloads persist, and record whether Oxy, Alia and adblock
  are present.
- Expected — nothing persists from a guest session.
- Current — `not-captured`
- Class — contractual · mixed

**PRF-06 — deleting a profile**

- Steps — delete a profile from the profile manager; check the directory
  is gone and any Oxy credential it owned is no longer usable.
- Expected — the profile directory is removed. Whether the OS-stored token
  is also removed is `to-be-recorded`, and is the same asymmetry as PRF-04.
- Current — `not-captured`
- Class — contractual · mixed

---

## DL — Downloads

Downloads carry the one security surface ungoogled-chromium changes most
sharply: Safe Browsing is removed, but the settings page still exposes a
`download-warnings` toggle mapped to `safebrowsing.enabled`. What that
toggle now does is a question, not an assumption.

**DL-01 — a benign download**

- Steps — download a small file over HTTPS; record the shelf or bubble, the
  downloads page entry, and where the file lands.
- Expected — the file downloads to the configured directory and appears in
  the downloads list.
- Current — `not-captured`
- Class — contractual · inherited

**DL-02 — the dangerous-download UI**

- Steps — download an executable and an EICAR-style test file over HTTP and
  HTTPS; record every warning, prompt or block, and the outbound requests
  made while deciding.
- Expected — `to-be-recorded`. With Safe Browsing removed, the interesting
  answer is whether the UI still warns from local heuristics, warns
  falsely, or is silent.
- Current — `not-captured`
- Class — contractual · mixed

**DL-03 — quarantine metadata**

- Steps — after DL-02, inspect the platform quarantine marking: the
  `user.xdg.origin.url` extended attribute on Linux, `com.apple.quarantine`
  on macOS, the mark-of-the-web alternate data stream on Windows.
- Expected — `to-be-recorded` per platform. This is a real security
  property that a rewrite can drop without any visible symptom.
- Current — `not-captured`
- Class — contractual · mixed

**DL-04 — pause, resume and cancel**

- Steps — start a large download; pause; resume; cancel another; retry a
  cancelled one.
- Expected — each control does what it says, including across a restart
  for a paused download.
- Current — `not-captured`
- Class — contractual · inherited

**DL-05 — download history persists**

- Steps — download two files, quit cleanly, relaunch, open the downloads
  page.
- Expected — both entries present with their paths intact.
- Current — `not-captured`
- Class — contractual · inherited

**DL-06 — opening and revealing a downloaded file**

- Steps — use "show in folder" and "open" from the downloads page.
- Expected — the platform file manager opens at the file; the file opens in
  its default application.
- Current — `not-captured`
- Class — incidental · inherited

---

## PWD — Passwords, autofill and payments

Four settings toggles map straight onto Chromium preferences
(`credentials_enable_service`, `credentials_enable_autosignin`,
`autofill.profile_enabled`, `autofill.credit_card_enabled`), so this group
tests both the underlying feature and the Mojo mapping that exposes it.

Use test credentials only. Nothing captured here may involve a real
account — see `screenshots.md` for the same rule applied to images.

**PWD-01 — the save-password prompt**

- Steps — submit a login form with test credentials on a local test server;
  accept the save prompt.
- Expected — the prompt appears and the credential is stored.
- Current — `not-captured`
- Class — contractual · inherited

**PWD-02 — autofill on return**

- Steps — revisit the same form in the same profile.
- Expected — the credential fills, and auto sign-in behaves per
  `credentials_enable_autosignin`.
- Current — `not-captured`
- Class — contractual · inherited

**PWD-03 — the password manager**

- Steps — list, view, edit, delete and export the stored credential;
  record the OS authentication prompt if one appears.
- Expected — every operation works and export requires OS authentication.
- Current — `not-captured`
- Class — contractual · mixed

**PWD-04 — address autofill**

- Steps — save a synthetic address; fill it into a checkout-shaped form;
  edit and delete it from settings.
- Expected — save, fill, edit and delete all work.
- Current — `not-captured`
- Class — contractual · inherited

**PWD-05 — payment methods**

- Steps — save a test card number; fill it; delete it. Record whether any
  network request accompanies the save, and to where.
- Expected — local save and fill work; no Google payments integration
  remains. The second half is `to-be-recorded`.
- Current — `not-captured`
- Class — contractual · mixed

**PWD-06 — the four toggles round-trip**

- Steps — flip each of `save-passwords`, `auto-sign-in`, `save-addresses`
  and `save-payment-methods` in `astro://settings`; read the underlying
  pref; change the pref from a second window and watch the first update.
- Expected — the mapping in `kProfilePrefMappings[]` holds in both
  directions, with the live push arriving over `Page::OnPrefChanged()`.
- Current — `not-captured`
- Class — contractual · astro

---

## PRM — Permissions

Every permission prompt is a security decision surfaced to the user, and
three of these features had their Google service backends removed upstream,
so "the prompt appears" and "the feature works" are separate questions.

**PRM-01 — camera**

- Steps — request the camera from a local HTTPS test page; deny; reload and
  request again; grant; check the site-settings entry and the address-bar
  indicator; revoke.
- Expected — prompt, persistence of the decision, a visible in-use
  indicator, and revocation taking effect.
- Current — `not-captured`
- Class — contractual · inherited

**PRM-02 — microphone**

- Steps — as PRM-01 for `getUserMedia({audio:true})`.
- Expected — as PRM-01.
- Current — `not-captured`
- Class — contractual · inherited

**PRM-03 — geolocation**

- Steps — request `navigator.geolocation`; grant; record whether a position
  is returned, how long it takes, and every outbound request made.
- Expected — `to-be-recorded`. The Google geolocation API key is removed
  upstream, so a granted permission that then fails is a plausible and
  important baseline fact.
- Current — `not-captured`
- Class — contractual · mixed

**PRM-04 — notifications**

- Steps — request permission; grant; post a notification; check it appears
  in the platform notification centre; revoke.
- Expected — local notifications work. Push notifications depend on a
  removed Google service; record separately.
- Current — `not-captured`
- Class — contractual · mixed

**PRM-05 — popups**

- Steps — trigger a popup without a user gesture; record the block and the
  bubble; allow the site and retry.
- Expected — blocked by default, with a bubble offering an exception that
  persists.
- Current — `not-captured`
- Class — contractual · inherited

**PRM-06 — site settings**

- Steps — open site settings; confirm every decision above is listed,
  editable and revocable, both per-site and globally.
- Expected — each grant appears and can be reset.
- Current — `not-captured`
- Class — contractual · inherited

---

## EXT — Extensions

Astro ships an in-process blocker, so extensions are not the ad-blocking
path — but they remain a compatibility surface, and the Web Store
integration is one of the things ungoogled-chromium removes.

**EXT-01 — the extensions page loads**

- Steps — open `chrome://extensions`.
- Expected — the page loads and lists installed extensions.
- Current — `not-captured`
- Class — contractual · inherited

**EXT-02 — developer mode and load-unpacked**

- Steps — enable developer mode; load a minimal unpacked extension; check
  it runs, its background service worker starts, and it survives a restart.
- Expected — all four.
- Current — `not-captured`
- Class — contractual · inherited

**EXT-03 — installing a packaged extension**

- Steps — install from a `.crx`; then attempt an install from the Chrome
  Web Store; record every outbound request in both cases.
- Expected — `to-be-recorded`. Whether the store path works, fails, or is
  absent is a product fact worth pinning before it changes.
- Current — `not-captured`
- Class — contractual · mixed

**EXT-04 — enable, disable, remove**

- Steps — toggle an extension off and on; remove it; confirm across a
  restart.
- Expected — each takes effect and persists.
- Current — `not-captured`
- Class — contractual · inherited

**EXT-05 — update checks**

- Steps — leave an installed extension idle past the update-check interval
  with a network recorder running.
- Expected — `to-be-recorded`; cross-reference `network-inventory.yaml`.
  This is one of the periodic services the network baseline exists to
  enumerate.
- Current — `not-captured`
- Class — contractual · mixed

---

## DEV — DevTools

DevTools is developer-facing but it is also how everything else here gets
diagnosed, and DEV-04 is a prerequisite for the automated smoke run.

**DEV-01 — opening DevTools**

- Steps — `F12` and `Ctrl+Shift+I`; dock right, dock bottom, undock.
- Expected — DevTools opens in each configuration and inspects the page.
- Current — `not-captured`
- Class — contractual · inherited

**DEV-02 — DevTools on an Astro WebUI page**

- Steps — open DevTools on `astro://settings`; inspect the DOM, read the
  console, and confirm the Mojo-generated bindings are present.
- Expected — the page inspects like any other, with no CSP violations
  logged.
- Current — `not-captured`
- Class — contractual · astro

**DEV-03 — emulation and throttling**

- Steps — apply device emulation and offline throttling to an ordinary
  page.
- Expected — both take effect.
- Current — `not-captured`
- Class — incidental · inherited

**DEV-04 — remote debugging**

- Steps — launch with `--remote-debugging-port` against a scratch profile;
  connect over the DevTools protocol; list targets.
- Expected — the endpoint responds and enumerates targets. The smoke
  harness depends on this, so a regression here blocks the automation
  rather than just a workflow.
- Current — `not-captured`
- Class — contractual · inherited

---

## PIP — Picture-in-Picture and media controls

**PIP-01 — video Picture-in-Picture**

- Steps — play a local video; enter PiP from the context menu and from the
  page API; move and resize the PiP window; return.
- Expected — the PiP window appears, stays on top, and returns the video to
  the tab.
- Current — `not-captured`
- Class — contractual · inherited

**PIP-02 — document Picture-in-Picture**

- Steps — call `documentPictureInPicture.requestWindow()`.
- Expected — `to-be-recorded`; record whether the feature is enabled in
  this build.
- Current — `not-captured`
- Class — incidental · inherited

**PIP-03 — the global media controls**

- Steps — play media in a background tab; open the media control in the
  toolbar; pause, seek and switch tracks from it.
- Expected — the control appears and drives the media element.
- Current — `not-captured`
- Class — contractual · inherited

**PIP-04 — hardware media keys**

- Steps — use the keyboard's play/pause and track keys while media plays.
- Expected — `to-be-recorded` per platform.
- Current — `not-captured`
- Class — incidental · inherited

**PIP-05 — the autoplay policy**

- Steps — load a page that autoplays with and without sound, without a
  prior user gesture.
- Expected — muted autoplay allowed, unmuted blocked until a gesture,
  matching upstream.
- Current — `not-captured`
- Class — incidental · inherited

---

## PDF — Printing and PDF viewing

**PDF-01 — print preview**

- Steps — `Ctrl+P` on an ordinary page; check the preview renders; change
  layout, margins and scale; print to a PDF file.
- Expected — the preview renders, the options apply, the output file is
  correct.
- Current — `not-captured`
- Class — contractual · inherited

**PDF-02 — printing to a system printer**

- Steps — print to a CUPS printer or a virtual one; record whether the
  system print dialogue is reachable.
- Expected — the job reaches the queue.
- Current — `not-captured`
- Class — contractual · inherited

**PDF-03 — the PDF viewer**

- Steps — open a PDF from `file://`, from HTTPS, and as a download; check
  rendering, page navigation, zoom, search and text selection.
- Expected — the built-in viewer renders all three.
- Current — `not-captured`
- Class — contractual · inherited

**PDF-04 — PDF forms and saving**

- Steps — fill a form field, annotate, save a copy, reopen it.
- Expected — the saved copy carries the changes.
- Current — `not-captured`
- Class — incidental · inherited

**PDF-05 — printing from the viewer**

- Steps — print a PDF from within the viewer.
- Expected — the output matches the source.
- Current — `not-captured`
- Class — contractual · inherited

---

## PWA — Web apps and installation

Patch `043-web-app-astro-scheme.patch` touches this path, and Linux desktop
integration is renamed by patches 031 and 032, so what an installed app
looks like on disk is Astro-specific.

**PWA-01 — the install prompt**

- Steps — visit an installable site; record whether an install affordance
  appears in the omnibox or menu.
- Expected — `to-be-recorded`.
- Current — `not-captured`
- Class — contractual · mixed

**PWA-02 — an installed app**

- Steps — install; launch from the desktop environment; record the window
  shape, the `.desktop` file name and contents, and the icon used.
- Expected — an app window with no tab strip; a desktop entry named per
  patches 031 and 032 rather than Chromium's.
- Current — `not-captured`
- Class — contractual · astro

**PWA-03 — uninstalling**

- Steps — uninstall from the app menu and from the browser.
- Expected — the window shortcut and desktop entry are removed.
- Current — `not-captured`
- Class — contractual · mixed

**PWA-04 — internal pages are not installable**

- Steps — attempt to install `astro://settings` as an app; open an
  `astro://` URL from an installed app window.
- Expected — `to-be-recorded`; patch 043 exists in this area and its effect
  should be pinned.
- Current — `not-captured`
- Class — contractual · astro

---

## PH — Protocol handlers

**PH-01 — the `astro` scheme as an OS handler**

- Steps — after a packaged install, ask the desktop environment which
  application handles `astro://`; open an `astro://` URL from outside the
  browser.
- Expected — `to-be-recorded`. Patch
  `030-protocol-handler-astro.patch` is in this area, and an externally
  reachable internal-page scheme is a security question as well as a
  product one.
- Current — `not-captured`
- Class — contractual · astro

**PH-02 — `registerProtocolHandler`**

- Steps — from a test page, register a `web+test` handler; accept; then
  open a `web+test:` link.
- Expected — the prompt appears and the handler is used.
- Current — `not-captured`
- Class — contractual · inherited

**PH-03 — external protocols**

- Steps — click `mailto:`, `tel:` and `magnet:` links.
- Expected — the external-protocol confirmation appears and the platform
  handler launches on approval.
- Current — `not-captured`
- Class — contractual · inherited

**PH-04 — default browser**

- Steps — set Astro as the system default; open an `http` link from another
  application; check the default-browser prompt inside Astro.
- Expected — the link opens in Astro.
- Current — `not-captured`
- Class — contractual · mixed

---

## A11Y — Accessibility and keyboard navigation

Six accessibility preferences are exposed through the Astro settings page,
so this group tests Chromium's accessibility and Astro's mapping of it at
the same time.

**A11Y-01 — keyboard navigation of the browser chrome**

- Steps — with no mouse, cycle panes with `F6`, reach the tab strip, the
  omnibox, the bookmarks bar, the toolbar buttons and the page; open and
  dismiss a menu; move between tabs with `Ctrl+Tab` and `Ctrl+1..9`.
- Expected — every control is reachable and the focus ring is visible at
  each stop.
- Current — `not-captured`
- Class — contractual · inherited

**A11Y-02 — keyboard navigation of the Astro pages**

- Steps — tab through the NTP, settings, Alia, What's New and error pages;
  operate every control from the keyboard; check focus order matches
  reading order and no focus trap exists.
- Expected — full keyboard operation with a visible focus indicator. These
  are hand-written Vite pages rather than Chromium's own, so nothing here
  comes for free.
- Current — `not-captured`
- Class — contractual · astro

**A11Y-03 — screen reader**

- Steps — with Orca running on Linux, navigate the tab strip, the omnibox,
  a web page and each Astro page; record what is announced.
- Expected — `to-be-recorded`; a named-and-role-correct reading of each
  control is the target.
- Current — `not-captured`
- Class — contractual · mixed

**A11Y-04 — the accessibility preferences take effect**

- Steps — toggle each of `high-contrast`, `reduced-motion`,
  `focus-highlight`, `min-font-size`, `force-text-contrast` and
  `live-captions` from `astro://settings`; observe the rendered effect and
  read back the underlying pref.
- Expected — each maps to the pref named in `kProfilePrefMappings[]` and
  visibly changes rendering.
- Current — `not-captured`
- Class — contractual · astro

**A11Y-05 — zoom**

- Steps — `Ctrl` `+`/`-`/`0` on a page; set a default zoom and font size in
  settings; check both apply and persist per-origin.
- Expected — page zoom persists per origin; the defaults apply to new
  origins.
- Current — `not-captured`
- Class — contractual · mixed

**A11Y-06 — find-in-page and caret browsing**

- Steps — `Ctrl+F` with next/previous and match count; `F7` for caret
  browsing.
- Expected — both behave as upstream.
- Current — `not-captured`
- Class — contractual · inherited

---

## TM — Task manager

**TM-01 — the task manager opens and lists processes**

- Steps — `Shift+Esc` with several tabs, an extension and a WebUI page
  open; sort by memory and by CPU.
- Expected — a row per tab, per extension and for the GPU and network
  services, with live figures.
- Current — `not-captured`
- Class — contractual · inherited

**TM-02 — ending a process**

- Steps — end a tab's process from the task manager.
- Expected — that tab shows the crash page; the rest of the browser is
  unaffected.
- Current — `not-captured`
- Class — contractual · inherited

**TM-03 — how Astro components appear**

- Steps — record the rows present with Alia open and while the blocker is
  active.
- Expected — `to-be-recorded`. The blocker runs in-process, so it should
  not add a row; the Alia panel's naming is worth pinning because a rename
  is a user-visible change.
- Current — `not-captured`
- Class — incidental · astro

---

## ALIA — Alia side panel

Astro-specific throughout. Registration spans patches 047 to 051, and the
page's CSP permits `connect-src https://api.alia.oxy.so`, so the panel has a
network dependency that most of its states are defined by.

**ALIA-01 — opening the panel**

- Steps — click the Alia toolbar action; then open it from the side-panel
  menu; then close it.
- Expected — the panel opens beside the page rather than in a tab, and the
  action reflects its state.
- Current — `not-captured`
- Class — contractual · astro

**ALIA-02 — the side-panel entry**

- Steps — open the side-panel selector and record every entry.
- Expected — an Alia entry with its icon, from patches 047, 048 and 051.
- Current — `not-captured`
- Class — contractual · astro

**ALIA-03 — signed out**

- Steps — with no Oxy session, open Alia and attempt to use it.
- Expected — `to-be-recorded`. Record whether it prompts to sign in, fails
  silently, or works anonymously.
- Current — `not-captured`
- Class — contractual · astro

**ALIA-04 — the service unreachable**

- Steps — block `api.alia.oxy.so` at the network layer; open Alia; attempt
  a request.
- Expected — `to-be-recorded`; a clear failure rather than a hang is the
  target.
- Current — `not-captured`
- Class — contractual · astro

**ALIA-05 — persistence**

- Steps — open Alia, switch tabs, open a new window, quit cleanly and
  relaunch.
- Expected — `to-be-recorded`: whether the panel is per-tab, per-window or
  per-profile, and whether its state survives a restart.
- Current — `not-captured`
- Class — contractual · astro

**ALIA-06 — incognito and guest**

- Steps — open Alia in an incognito window and in a guest window.
- Expected — `to-be-recorded`; the answer is a privacy contract, so it
  belongs in the security baseline too.
- Current — `not-captured`
- Class — contractual · astro

---

## OXY — Oxy sign-in, sign-out and restart

Astro-specific and the most security-sensitive group here. The callback is
handled in `browser_about_handler.cc` (patch 011): it parses the callback
URL, writes `oxy.session_id`, `oxy.user_id`, `oxy.username`,
`oxy.user_avatar` and `oxy.token_expiry` into profile preferences, hands the
access and refresh tokens to `OxyAuthTokenStore`, logs the username at
`LOG(INFO)`, and rewrites the URL to `chrome://newtab`.

**OXY-01 — signing in**

- Steps — start sign-in from the profile menu on a clean profile; complete
  it with a dedicated non-production test account; record every navigation.
- Expected — the flow completes and returns to the browser signed in.
- Current — `not-captured`
- Class — contractual · astro

**OXY-02 — the callback is handled**

- Steps — record the callback URL that reaches the browser, in both the
  `https://auth.oxy.so/redirect/astro` and `astro://` forms.
- Expected — the callback is consumed and the user lands on the new-tab
  page rather than seeing the callback URL or an error.
- Current — `not-captured`
- Class — contractual · astro

**OXY-03 — the signed-in profile menu**

- Steps — open the profile menu while signed in; record the identity shown
  and every action offered.
- Expected — `to-be-recorded`, and to be screenshotted per
  `screenshots.md`.
- Current — `not-captured`
- Class — contractual · astro

**OXY-04 — signing out**

- Steps — sign out; then read back every `oxy.*` preference and query the
  OS credential store for the stored tokens.
- Expected — `to-be-recorded`, and this is the row most worth getting
  right: a sign-out that clears the preferences but leaves the tokens in
  the credential store looks complete and is not.
- Current — `not-captured`
- Class — contractual · astro

**OXY-05 — the session survives a restart**

- Steps — sign in, quit cleanly, relaunch; check the session without any
  further interaction and with the network blocked.
- Expected — the session is restored from the token store; `to-be-recorded`
  for the offline case.
- Current — `not-captured`
- Class — contractual · astro

**OXY-06 — token expiry and refresh**

- Steps — with a short-lived test token, wait past `oxy.token_expiry` and
  use a signed-in surface; record the refresh request and what happens if
  it fails.
- Expected — `to-be-recorded`.
- Current — `not-captured`
- Class — contractual · astro

**OXY-07 — cookie-driven sign-in detection**

- Steps — sign in to an Oxy web property in a tab and record whether
  `oxy_cookie_signin_observer` picks the session up without an explicit
  browser sign-in.
- Expected — `to-be-recorded`. Automatic adoption of a web session by the
  browser is a consent question, so record the exact trigger.
- Current — `not-captured`
- Class — contractual · astro

**OXY-08 — where the credentials end up**

- Steps — after OXY-01, search the profile's history database, the session
  files, `chrome://net-export` output and any log file for the access
  token, the refresh token, the session id and the username. Include the
  callback URL itself, which carries tokens in its parameters before it is
  rewritten.
- Expected — no token in history, session data, logs or referrers. Note
  that the sign-in path currently emits `LOG(INFO) << "Oxy: Signed in as "`
  with the username, so at least the username is expected in a log; record
  precisely what else is.
- Current — `not-captured`
- Class — contractual · astro

---

## ADB — Adblock

Astro-specific: an in-process Rust engine wired into the network stack, with
four preferences (patch 046) and a filter-list catalogue pointing at
`easylist.to`, `easylist-downloads.adblockplus.org` and `pgl.yoyo.org`.

**ADB-01 — network filtering**

- Steps — load a page with known ad requests from a local fixture that
  reproduces the request shapes; record which requests are blocked and
  which reach the network.
- Expected — requests matching the loaded lists are blocked before leaving
  the browser.
- Current — `not-captured`
- Class — contractual · astro

**ADB-02 — cosmetic filtering**

- Steps — load a fixture page carrying elements matched by cosmetic rules;
  record what is hidden and whether hiding happens before first paint.
- Expected — matched elements hidden without a visible flash.
- Current — `not-captured`
- Class — contractual · astro

**ADB-03 — the toolbar shield and its bubble**

- Steps — load a page with blocked requests; read the per-tab count on the
  shield; open the bubble and record every control.
- Expected — a count matching ADB-01 and a bubble offering the per-site
  control used in ADB-04.
- Current — `not-captured`
- Class — contractual · astro

**ADB-04 — a per-site override**

- Steps — disable blocking for one site from the bubble; reload; check
  requests now pass; check `oxy.adblock.site_overrides`; quit cleanly,
  relaunch and confirm the override survives; then remove it.
- Expected — the override applies to that site only, persists, and is
  removable.
- Current — `not-captured`
- Class — contractual · astro

**ADB-05 — the global switch**

- Steps — set `oxy.adblock.enabled` false through the UI; reload ADB-01's
  page; re-enable.
- Expected — blocking stops entirely and resumes, without a restart.
- Current — `not-captured`
- Class — contractual · astro

**ADB-06 — filter-list updates**

- Steps — with a recorder running, leave the browser idle past the update
  interval; then repeat with the catalogue hosts blocked.
- Expected — `to-be-recorded`: which lists are fetched, from where, how
  often, and what happens when a fetch fails. Cross-reference
  `network-inventory.yaml`.
- Current — `not-captured`
- Class — contractual · astro

**ADB-07 — custom rules**

- Steps — add a rule to `oxy.adblock.custom_rules` through the UI; verify
  it blocks; add a malformed rule and record the failure mode.
- Expected — valid rules apply; an invalid rule does not disable the rest.
- Current — `not-captured`
- Class — contractual · astro

**ADB-08 — the lifetime counter and the NTP badge**

- Steps — record `oxy.adblock.lifetime_blocked_count` before and after
  ADB-01; check the figure the NTP shows.
- Expected — the counter increases by the number blocked and the NTP badge
  agrees with the pref.
- Current — `not-captured`
- Class — contractual · astro

**ADB-09 — incognito**

- Steps — repeat ADB-01 in an incognito window; check whether overrides
  from the normal profile apply and whether the lifetime counter advances.
- Expected — `to-be-recorded`; blocking should apply, but leaking counters
  or overrides across the boundary is the thing to look for.
- Current — `not-captured`
- Class — contractual · astro

**ADB-10 — the adblock management page**

- Steps — open `chrome://adblock`; exercise its handlers: read state,
  remove a site override, save custom rules.
- Expected — `to-be-recorded`, and expected to be unreachable in a checkout
  carrying the overlay copy, per SCH-03 and issue #7.
- Current — `not-captured`
- Class — contractual · astro

---

## WEBUI — Astro WebUI pages

Five Vite-built pages, one of them Mojo-bound. They are Astro's own code
rather than Chromium's, so nothing here is covered by upstream tests.

**WEBUI-01 — the new tab page renders**

- Steps — open the NTP; record every widget that renders, the console
  output, and any request the page makes.
- Expected — no console errors and no CSP violations. The page's CSP
  permits `https://fonts.googleapis.com` and `https://fonts.gstatic.com`,
  so a remote font fetch is expected; record it rather than treating it as
  a surprise.
- Current — `not-captured`
- Class — contractual · astro

**WEBUI-02 — settings loads every mapped control**

- Steps — open `astro://settings`; confirm each `data-toggle-id`,
  `data-select-id` and `data-slider-id` receives a value from
  `GetAllPrefs()`; list any control that stays at its HTML default.
- Expected — every id in `kProfilePrefMappings[]` and
  `kLocalStatePrefMappings[]` is populated. A control with no mapping is a
  control that silently does nothing.
- Current — `not-captured`
- Class — contractual · astro

**WEBUI-03 — settings writes and live updates**

- Steps — change a control; read the pref; change the same pref from a
  second window and watch the first update without a reload.
- Expected — `SetPref()` writes and `Page::OnPrefChanged()` pushes back.
- Current — `not-captured`
- Class — contractual · astro

**WEBUI-04 — theme switching**

- Steps — set light, dark and system through `SetTheme()`; change the OS
  theme while set to system.
- Expected — browser chrome and every Astro page follow, immediately and
  across a restart.
- Current — `not-captured`
- Class — contractual · astro

**WEBUI-05 — clear browsing data**

- Steps — as HB-03, from the settings page.
- Expected — as HB-03.
- Current — `not-captured`
- Class — contractual · astro

**WEBUI-06 — links out of settings**

- Steps — follow every link the settings page offers through `OpenPage()`.
- Expected — each opens its target; none dead-ends.
- Current — `not-captured`
- Class — contractual · astro

**WEBUI-07 — What's New**

- Steps — open `astro://whats-new`; record the content and how it is
  reached without typing the URL.
- Expected — `to-be-recorded`.
- Current — `not-captured`
- Class — incidental · astro

**WEBUI-08 — the error page**

- Steps — trigger a DNS failure, a connection refused, an HTTPS
  certificate error and a navigation to an unknown internal host; record
  which surface each produces.
- Expected — `to-be-recorded`: which errors reach `astro://error` and which
  keep Chromium's own page.
- Current — `not-captured`
- Class — contractual · astro

**WEBUI-09 — CSP and remote resources**

- Steps — with a recorder running, load each of the five pages and record
  every outbound request and every CSP violation.
- Expected — requests limited to what each controller's CSP permits.
  Cross-reference `security-baseline.md`, which reads the same directives
  statically from the controller sources.
- Current — `not-captured`
- Class — contractual · astro

**WEBUI-10 — each page in each theme**

- Steps — load all five pages in light, dark and system themes at both
  scale factors.
- Expected — legible in all combinations, with no unstyled flash. This is
  the same set `screenshots.md` captures.
- Current — `not-captured`
- Class — contractual · astro

---

## PKG — Packaging and installation

Astro claims Linux, Android, macOS and Windows, with six GN configurations
(`linux`, `linux_debug`, `android`, `macos`, `windows`, `windows_arm64`).
A claimed platform with no capture is a claim, not a fact, so every row here
carries the platform in its own right.

**PKG-01 — the Linux archive**

- Steps — `tools/package-linux.sh`; extract the archive somewhere other
  than the build directory; run the binary; check the sandbox binary, the
  `.pak` resources and the ICU data are present.
- Expected — it runs from an arbitrary directory with the sandbox enabled.
- Current — `not-captured`
- Class — contractual · mixed

**PKG-02 — the Debian package**

- Steps — `tools/package-deb.sh`; install with `dpkg -i` on a clean
  container; launch from the desktop entry; check the icon and entry names
  against patches 031 and 032; then remove the package and confirm nothing
  is left behind.
- Expected — clean install, launch, and removal.
- Current — `not-captured`
- Class — contractual · mixed

**PKG-03 — macOS**

- Steps — `tools/package-macos.sh`; open the bundle on a machine that has
  never seen it; record the Gatekeeper behaviour and whether the bundle is
  signed and notarised.
- Expected — `to-be-recorded`.
- Current — `not-captured`
- Class — contractual · mixed

**PKG-04 — Windows x64**

- Steps — `tools/package-windows.sh`; run the installer if
  `mini_installer.exe` was produced, otherwise the portable zip; launch;
  uninstall.
- Expected — `to-be-recorded`; note which of the two artefacts the build
  actually produced, since the script falls back to a zip.
- Current — `not-captured`
- Class — contractual · mixed

**PKG-05 — Windows arm64**

- Steps — as PKG-04 using `gn_args/windows_arm64.gn`, on arm64 hardware or
  an arm64 VM.
- Expected — `to-be-recorded`. This configuration is claimed by a GN args
  file; whether it has ever been built and run is exactly what needs
  recording.
- Current — `not-captured`
- Class — contractual · mixed

**PKG-06 — Android**

- Steps — `tools/package-android.sh`; install the APK on a device or
  emulator; launch; open an Astro page; record which of the desktop
  surfaces exist at all.
- Expected — `to-be-recorded`.
- Current — `not-captured`
- Class — contractual · mixed

**PKG-07 — provenance ships inside the artefact**

- Steps — for each artefact produced above, extract it and check for
  `provenance.json`; compare its recorded revisions against
  `browser.lock.json`.
- Expected — every artefact carries provenance, and a release build
  produced with `--require-match` records no drift and no dirty worktree.
- Current — `not-captured`
- Class — contractual · astro

---

## Coverage against the issue

Every scenario group listed in issue #6 appears above: first launch;
normal and incognito windows; tab creation, closing, pinning, grouping,
dragging and restore; omnibox search, URL input, autocomplete, paste-and-go
and internal URLs; `astro://` and `chrome://astro-*`; history and bookmarks;
startup page and session restore; profiles, guest mode and separation;
downloads with dangerous-download UI and quarantine; passwords, autofill and
payment/address settings; camera, microphone, location, notification and
popup permissions; extension install, enable/disable and developer mode;
DevTools; Picture-in-Picture and media controls; printing and PDF viewing;
PWA installation; protocol handlers; accessibility and keyboard navigation;
the task manager; the Alia side panel; Oxy sign-in, sign-out and restart;
adblock network filtering, cosmetic filtering, per-site override and
updates; every Astro WebUI page; and packaging on each claimed platform.

The issue's acceptance criteria name omnibox, tabs, PiP, profiles,
downloads, passwords, extensions and session restore explicitly: `OMN`,
`TAB`, `PIP`, `PRF`, `DL`, `PWD`, `EXT` and `SR`.

## Related documents

| Document | What it holds |
|---|---|
| [`README.md`](README.md) | Index of this directory and what is generated |
| [`screenshots.md`](screenshots.md) | The UI reference set and its capture conditions |
| [`patch-inventory.md`](patch-inventory.md) | Every patch, its files and its disposition |
| [`source-inventory.md`](source-inventory.md) | What this baseline was taken from |
| [`platform-matrix.md`](platform-matrix.md) | GN args per platform and their inconsistencies |
| [`security-baseline.md`](security-baseline.md) | WebUI CSP, Trusted Types and remote content |
| [`network-inventory.yaml`](network-inventory.yaml) | Endpoints, static today and measured later |
