# Releasing

Releases are GitHub releases of `OxyHQ/Astro`, tagged `v<version>`, on two channels: **stable** (`0.2.37`, a full
release) and **nightly** (`0.2.37-nightly.1`, a GitHub prerelease: one fix, shipped the day it's made; "Channels" below).
Each has three assets, four when the engine changed:

- `Astro-<version>.dmg`: what people download (the app and an `/Applications` link, in a window with the
  site's poster behind them: `scripts/dmg`, where `render.sh` redraws the picture and `layout.sh` the layout).
- `Astro-<version>.zip`: the archive Sparkle installs updates from.
- `appcast.xml`: the Sparkle feed, both channels' items in one file. The latest stable release's appcast is the feed
  (a nightly rewrites that asset; "Channels" below). Builds after 0.2.13 poll
  `https://astro.oxy.so/appcast.xml` (`SUFeedURL`), which counts the check by version and day (and whether
  it's the copy's first) and redirects to
  `https://github.com/OxyHQ/Astro/releases/latest/download/appcast.xml`, the URL 0.2.13 and
  earlier poll directly. The count can't block an update: see `infra/site/nginx.conf` and `docs/growth.md`
  › Installs.
- `Astro-<version>-windows-x64-setup.exe` and `appcast-windows.xml`, when the release ships Windows (`--windows`;
  "Windows" below). A release without a Windows build still republishes `appcast-windows.xml` as it was, so the latest
  release always carries the Windows feed.
- `AstroCore-<engine tree>.tar.xz`, only when `engine/` changed since the last one: the release's engine (Chrome's
  framework, stripped), so the app builds without a Chromium tree. `packages/astrocore/prebuilt-engines.tsv` maps
  `engine/`'s git tree to the release and the archive's SHA-256; `packages/astrocore/scripts/fetch-engine.sh` downloads
  it (the app's build runs it when there's no local engine build).
- `AstroCore-<engine tree>-source.tar.xz`, with that archive when the engine is built on Helium (release.sh finds
  Helium's code in the framework): copies of the GitHub tags `engine/patches/build/env.sh` pins that aren't in this
  repo (`scripts/engine-source.sh`), and where Chromium's source is. See "Source and licenses" below.

Each version's notes are a file in the repo, `docs/release-notes/<version>.md` (how to write one:
`docs/release-notes/README.md`). The GitHub release, the update dialog and the website's
`https://astro.oxy.so/release-notes` all come from it. The first launch after an update opens
`/release-notes#<version>` in a new tab (`apps/browser/src/lib/releaseNotesPage.ts`), so the site has to be
deployed with the new entry by the time the update reaches people.

## Channels

Astro is one app with two Sparkle channels. A stable item in the appcast has no channel; a nightly item carries
`<sparkle:channel>nightly</sparkle:channel>` (`generate_appcast --channel nightly`). Sparkle skips items on a channel the
app doesn't allow, and allows none by default, so every shipped build (all on Sparkle 2.9.6, which has channels) and
every copy on Stable sees only stable items. A copy on Nightly allows `nightly` (`allowedChannels(for:)` in
`packages/shell/ios/Updater.swift`) and so gets the newest of both.

- **Which channel a copy is on.** Settings › General › "Update channel" (Stable / Nightly), kept in the defaults key
  `ACUpdateChannel`. Until the user picks, it's the channel of the build that first ran: the `ACUpdateChannel` key in
  `Info.plist`, which `release.sh --channel nightly` sets to `nightly` (the build setting `AC_UPDATE_CHANNEL`). It's
  written at the first launch, so a nightly copy stays on Nightly after it updates to a stable build. Switching to
  Stable never downgrades: Sparkle only offers a higher build number, so the copy waits for the next stable.
- **Versions.** Sparkle compares `sparkle:version`, the build number (`CURRENT_PROJECT_VERSION`), which goes up by one
  every release on either channel; the version string is only shown. A nightly is `<next stable>-nightly.<n>`, so
  0.2.36 (44) < 0.2.37-nightly.1 (45) < 0.2.37-nightly.2 (46) < 0.2.37 (47). Sparkle's comparator can't order the
  strings themselves (it reads `0.2.37-nightly.1` and `0.2.37-nightly.2` as equal), which is why it never sees them.
  `release.sh` refuses a build number that isn't above every build already in the feed, nightly or stable. About Astro
  and Settings show a nightly as "0.2.37 Nightly 1".
- **The feed.** It stays where every shipped build reads it: `https://astro.oxy.so/appcast.xml` redirects to
  `releases/latest/download/appcast.xml`, and GitHub's "latest" skips prereleases, so it's always the newest stable
  release's `appcast.xml`. A stable release publishes the merged feed as its own asset and becomes latest; a nightly
  re-uploads the merged feed onto that same latest stable release (`gh release upload … --clobber`). Nothing moved:
  no new URL, no nginx change for the feed, and the copies from 0.2.13 and earlier that poll GitHub directly read the
  same file. Both flows build on the published feed (`release.sh` fetches it and refuses to go on without it), and
  `appcast-merge.sh` puts the new item onto the feed as published at that moment, so a nightly that shipped while a
  stable was being tested isn't dropped. `generate_appcast` keeps 3 items per channel.
- **Downloads.** Stable keeps its versioned link (`releases/latest/download/Astro-<version>.dmg`, from
  `apps/site/src/data/release.ts`). Nightly has one fixed link, `https://astro.oxy.so/nightly` (`infra/site/nginx.conf`),
  which redirects to the `nightly` prerelease's `Astro-Nightly.dmg`; each nightly re-uploads that asset, so the site
  never redeploys for a nightly.
- **Proof.** `.claude/skills/release/scripts/channel-test.sh dist/<stable>/export/Astro.app` runs that build's own
  Sparkle against local feeds made by `generate_appcast`: on stable it isn't offered a nightly, and with a newer
  nightly in the feed it takes the stable; on nightly it takes the nightly, a newer stable, and the newest of both. It
  also checks the build-number order with Sparkle's comparator. `update-test.sh` does the stable-ignores-it half for
  every nightly's own item.

## Windows

Windows copies update themselves the way Sparkle updates the Mac app, from their own feed:
`https://github.com/OxyHQ/Astro/releases/latest/download/appcast-windows.xml` (the latest stable release's asset, like
`appcast.xml`; `ASTRO_WINDOWS_UPDATE_FEED` at `apps/webui` build time or `ASTRO_UPDATE_FEED_URL` at run time
overrides it). It's Sparkle's format: one item per release, `sparkle:version` the build number,
`sparkle:shortVersionString` the version, `<sparkle:channel>nightly</sparkle:channel>` on a nightly, and one enclosure
with `sparkle:os="windows"`, the installer's `length` and its `sparkle:edSignature`, made by Sparkle's `sign_update`
with the same EdDSA key as the Mac zip. It's a separate file because Sparkle reads one enclosure per item (the first,
when none has `xml:lang`, logging an error) and drops the whole item when that enclosure's `sparkle:os` isn't
`macos`, and because `generate_appcast` rewrites the items of `appcast.xml`: a Windows enclosure there would either
hide the Mac update or be lost. `scripts/windows-appcast.py` writes and merges it (3 items per channel).

- **The app** (`apps/webui/src/host/updater.ts`, `ac_updater.cc`): the leader page checks every
  `SUScheduledCheckInterval` (Info.plist) while Settings › General › "Check for updates automatically" is on, keeps the
  newest item for its channel (a stable copy only takes items without a channel, a nightly copy both; versions compare
  as semver, so `0.2.37-nightly.1` < `0.2.37-nightly.2` < `0.2.37`) and, with automatic downloads on, downloads it into
  `<User Data>\Astro Updates`. The engine checks the length and the EdDSA signature against `SUPublicEDKey` (read from
  Info.plist when `apps/webui` builds; empty means "Updates aren't set up for this build"). A verified installer runs
  when Astro quits, as Sparkle installs on quit; "Restart" on the toast, or the menu's "Restart and Update", installs it
  now and reopens Astro. Either way a hidden PowerShell waits for Astro's processes to exit, runs the installer only if
  its SHA-256 is still the one verified, deletes it, and (for Restart) starts Astro again. The installer keeps the
  engine's Chromium version, so it repairs the installed copy in place: `setup.exe` replaces the version folder
  (the interface is in its `resources.pak`) when anything in it changed. Only installed copies update (the version folder has
  `Installer\setup.exe`); a copy unzipped from `windows-package.sh` or started with `--user-data-dir` doesn't, unless
  `ASTRO_UPDATE_FEED_URL` is set.
- **Releasing.** Bump the version first, then build the installer from that commit on the Windows build host:
  `AC_TARGET_PLATFORM=windows scripts/windows-installer.sh` writes `Astro-<version>-windows-x64-setup.exe` and a
  `.commit` file. Copy both to the Mac and pass the installer to `scripts/release.sh <version> --windows <setup.exe>`
  (or `WINDOWS_INSTALLER`). release.sh refuses an installer of another version or commit (an `--rc` takes any commit),
  signs it with `sign_update`, writes `appcast-windows.item.xml` and merges it onto the published Windows feed into
  `appcast-windows.xml` (a 404 starts a new feed). `appcast-merge.sh` merges it again onto the feed as published at
  publish time, as it does for `appcast.xml`, and `publish-nightly.sh` uploads the installer with the nightly and
  `appcast-windows.xml` onto the latest stable release.

## Intel Macs

Releases are Apple silicon only. An Intel build (x86_64, macOS 14 or later) comes from GitHub Actions instead:
`.github/workflows/macos-intel.yml` runs on every push to the `ci/macos-intel` branch (and by hand once the workflow is
on `main`). Nothing is published: the run's artifacts are the disk image (`Astro-macos-x86_64-dmg`, 30 days), the
smoke test's screenshot and logs (`smoke-test`) and the engine (`astrocore-macos-x64-<key>`). OxyHQ/Astro is public,
so the standard runners cost nothing, and the logs and artifacts are public too: never give the workflow a secret.

- **The engine** builds on `macos-15-intel` (4 vCPUs, 14 GB, about 100 GB free after
  `scripts/ci/macos-runner-prep.sh --free-disk`) with the engine's own steps and release args, `target_cpu="x64"`
  (`docs/engine-build.md` › "For Intel Macs"). Each job builds until 5 hours in, then packs `~/chromium-build`
  (`scripts/ci/macos-engine-state.sh`, about 14 GB of zstd parts) for the next; up to 12 jobs (a run that runs out resumes in the next one). A run whose `engine/`
  and offline game match an earlier run's reuses that engine (the artifact is keyed by their trees); one whose patch
  series matches resumes the newest packed tree, with its layers updated, instead of syncing Chromium again.
- **The app** builds on `xcode-27` (Apple silicon: it needs the macOS 27 SDK, and Xcode 27 doesn't run on Intel) with
  `ARCHS=x86_64` and `AdHoc.xcconfig`, and `scripts/ci/macos-app-build.sh` packages it as `release.sh` does: licences,
  stripped and pruned engine, the same disk image. It's signed ad hoc, without the hardened runtime or entitlements:
  no Developer ID, notarization, keychain groups (passkeys in iCloud Keychain, unexportable keys), or updates (the
  Sparkle key isn't in the build, so Settings says updates aren't set up; install a newer build by hand).
- **The smoke test** installs the disk image into `/Applications` on a fresh `macos-15-intel` runner, starts Astro on a
  scratch profile with DevTools on, and keeps a screenshot, the app's stderr, the system log and any crash report
  (`scripts/ci/macos-smoke-test.sh`).
- **Installing it.** Download the artifact, open the disk image and drag Astro to Applications. macOS refuses to open
  it the first time ("Apple could not verify…"): click Done, then System Settings › Privacy & Security › Open Anyway
  (macOS 15 dropped the right-click › Open bypass), or run `xattr -dr com.apple.quarantine /Applications/Astro.app`.
  Each build has a new ad hoc signature, so the first launch after replacing it may ask once more for the "Astro Safe
  Storage" keychain item: Always Allow.

## Source and licenses

Every binary we publish (DMG, zip, engine archive) has its source next to it, and keeps it for as long as the binary
stays up. That's GPL-3.0 §6(d) for the GPL parts (uBlock Origin today), and it's how we work anyway.

- Every release's notes end with a Source section (`release.sh` writes it). It links the tag's tree: the app, the
  engine's patches, `gn_defines.sh`, the step scripts and this release flow. Once the engine is built on Helium, it
  also links the `AstroCore-<tree>-source.tar.xz` asset of the release that first shipped that engine
  (`packages/astrocore/prebuilt-engines.tsv`); `release.sh` refuses such an engine when it can't name that release.
- The `nightly` release's body names the nightly its `Astro-Nightly.dmg` is and links that release
  (`publish-nightly.sh` rewrites it each time).
- Never delete or move a `v*` tag, or a release's source asset, while its release is up. A release can come down;
  its tag stays.
- About Astro and Settings › Advanced › "Source and licenses" link the running version's tag. The app carries
  `LICENSE*` and `NOTICE` in `Contents/Resources/Licenses`.

## Once per machine

- The **Developer ID Application: Oxy (XXXXXXXXXX)** identity in the login keychain, and Xcode
  signed in to the team: the export fetches the Developer ID provisioning profile
  (`-allowProvisioningUpdates`) that the keychain-group entitlements need.
- The **Sparkle EdDSA key**, a login keychain item (service `https://sparkle-project.org`, account
  `astro`, or the app's old name in lower case on the Mac that made it before the rename: `LegacyName.appName`;
  release.sh finds either, `SPARKLE_ACCOUNT` overrides). Its public half is `SUPublicEDKey` in
  `apps/browser/macos/Astro-macOS/Info.plist`. Every update must be signed with it, so keep a backup:
  `apps/browser/macos/Pods/Sparkle/bin/generate_keys --account <account> -x <file>` exports it, and `-f <file>`
  imports it on another machine.
- For notarization, an App Store Connect API key (Team Keys, Developer role). Keep `AuthKey_<id>.p8`
  outside the repo (e.g. `~/.private_keys/`, mode 600) and point `scripts/.notary.env` (untracked) at it:
  `NOTARY_KEY=<path>`, `NOTARY_KEY_ID=<id>`, `NOTARY_ISSUER=<issuer id>`. release.sh prefers it to the
  keychain profile below, which notarytool keeps in the data-protection keychain: that reads as
  missing while the screen is locked. Otherwise, a notarytool profile named `astro`:
  `xcrun notarytool store-credentials astro --apple-id <id> --team-id XXXXXXXXXX` (it asks for an
  app-specific password). Without it, the script still builds and signs, but the release is unnotarized and
  Gatekeeper blocks the first launch.
- The engine: AstroCore's `Chromium Framework.framework` built in `~/chromium-build` (`scripts/agent/engine-build`;
  `docs/engine-build.md`), and `pod install` in `apps/browser/macos`. A framework built elsewhere goes in through
  `ASTROCORE_FRAMEWORK`. That skips the tree checks and ships no engine archive, unless `ASTROCORE_FRAMEWORK_ENGINE`
  names the `engine/` git tree it was built from (`git rev-parse HEAD:engine`, checked against HEAD). Then the
  release packs that engine, and its source when it's Helium, as a build from the tree would.

## Cutting a release

1. Bump `MARKETING_VERSION` (the version) and `CURRENT_PROJECT_VERSION` (the build number, which Sparkle
   compares: it must go up every release) in both configurations of the `Astro-macOS` target in
   `apps/browser/macos/Astro.xcodeproj`. The helpers and the Dock tile plug-in take the same values.
2. Write `docs/release-notes/<version>.md` from `git log v<previous>..HEAD` (`docs/release-notes/README.md`)
   and check it on the site: `pnpm -C apps/site build && pnpm -C apps/site preview`, then
   `http://localhost:4321/release-notes#<version>`.
3. `scripts/release.sh <version>` (`--channel nightly` for a nightly). It stops right away if the notes file is missing or lacks its `date` and
   `headline`, if the tree under `apps/browser`, `packages`, `engine` or `scripts/dmg` has uncommitted changes, or if the engine
   framework is older than the tree's AstroCore sources or the Chromium tree differs from `engine/astrocore`
   (`apply.sh --check`), if the version doesn't fit the channel or the notes' `channel`, if it can't read the published
   appcast, or if the build number isn't above every build in it. It writes `dist/<version>/`:
   - archives the Release configuration of `apps/browser/macos` (arm64 only), staging the engine into its own
     derived data so a development build restaging can't change it mid-build, and exports it with Developer ID,
   - leaves out what Astro never loads (`packages/astrocore/scripts/prune-bundle.sh`, after `strip-engine.sh`): Chrome's
     locales other than English and the app's own languages (Chrome takes its locale from the app bundle's
     localizations, and Astro has none, so it runs in en-US whatever the Mac's language), SwiftShader and its Vulkan
     loader (WebGL and WebGPU run on Metal; Chrome dropped SwiftShader's WebGL fallback), Chrome's first-run sounds
     and pictures inside `resources.pak` (blanked by hash, `first-run-resources.sha256`; Astro always passes
     `--no-first-run`), uBlock Origin's other locales, React Native's `@3x` images (Macs draw at 1x or 2x) and hermes's
     local symbols. Each step has a kill switch: `ASTRO_PRUNE_LOCALES`, `ASTRO_PRUNE_SWIFTSHADER`,
     `ASTRO_PRUNE_FIRST_RUN`, `ASTRO_PRUNE_UBO_LOCALES`, `ASTRO_PRUNE_RN_3X`, `ASTRO_STRIP_HERMES` (or `ASTRO_PRUNE` for
     all) set to `off`. Chrome's opt-in software GPU modes are unsupported in a release build: with
     `--use-angle=swiftshader`, `--enable-unsafe-swiftshader --disable-gpu` or WebGPU's
     `requestAdapter({forceFallbackAdapter: true})` under `--enable-unsafe-webgpu`, WebGL and WebGPU are unavailable
     (chrome://gpu says Disabled, the adapter is null) while pages, video and the GPU process carry on, with no crash or
     restart. The prebuilt engine archive is packed from a copy taken before pruning, so a checkout that fetches it
     gets every locale, SwiftShader and the first-run resources, and the kill switches work there too,
   - signs Chrome's framework inside out as Chrome signs its own (`chrome/installer/mac/signing/parts.py`): the
     helpers under the hardened runtime with library validation, except the renderer and GPU ones (Aperitif's too),
     which get `allow-jit` (`packages/astrocore/scripts/signing`) instead; then the framework, then the app again with
     the entitlements the export gave it,
   - checks what an in-place update depends on: bundle id `so.oxy.Astro`, executable `Astro`, the
     designated requirement (our team), the keychain groups, Sparkle's feed and key and the usage strings in
     `Info.plist`; that every piece of code is Developer ID with a timestamp and no `get-task-allow`; and that the app
     isn't signed with `com.apple.developer.web-browser.public-key-credential` (Apple hasn't granted it yet;
     `Astro-ICloudPasskeys.entitlements` is the future entitlements file),
   - launches the app once in the background (throwaway data dir), waits for uBlock's rulesets to be indexed,
     quits it and checks the signature again: the app must never write into its own bundle,
   - notarizes and staples the app and the DMG,
   - packages the DMG (lzma in 4 MB chunks, `udif-chunk-size=8192`, hdiutil's largest; `ASTRO_DMG_CHUNK=off` goes back
     to its 1 MB default) and the zip, and signs `appcast.xml` with the Sparkle key. It starts from the
     published appcast, so earlier versions and the other channel's items stay listed; a nightly's item gets
     `<sparkle:channel>nightly</sparkle:channel>`. The new item embeds the notes' headline and body
     (Markdown, shown in Sparkle's update dialog) and links the page as its full release notes
     (`sparkle:fullReleaseNotesLink`: "You're up to date" › Version History opens it in a tab),
   - copies `LICENSE*` and `NOTICE` into `Contents/Resources/Licenses` before signing, and checks they're there,
   - writes `release-notes.md` (the notes' body, then the standard Install and Source sections) and
     `provenance.txt` (the commit and the engine build it shipped).

   `scripts/release.sh <version> --rc` builds a candidate into `dist/<version>-rc/` from the working tree, as
   `<version>` with the next build number, notarized but never published: no notes file or clean tree needed (it
   lists the uncommitted files it included).
4. Commit (the notes file with the version bump), tag and publish. A nightly publishes with
   `.claude/skills/release/scripts/publish-nightly.sh <version>` after the tag is pushed (`--dry-run` prints what it would
   do): a prerelease, the merged feed onto the latest stable release, and `Astro-Nightly.dmg` on the `nightly` release.
   A stable release:

   ```bash
   git tag v<version> && git push origin main v<version>
   .claude/skills/release/scripts/appcast-merge.sh <version>
   gh release create v<version> -R OxyHQ/Astro --title "Astro <version>" \
     --notes-file dist/<version>/release-notes.md \
     dist/<version>/Astro-<version>.dmg dist/<version>/Astro-<version>.zip dist/<version>/appcast.xml \
     $(ls dist/<version>/AstroCore-*.tar.xz dist/<version>/Astro-*-windows-x64-setup.exe dist/<version>/appcast-windows.xml 2>/dev/null)
   ```
   With a new engine, then append `dist/<version>/prebuilt-engine.tsv` to `packages/astrocore/prebuilt-engines.tsv` and
   commit it.
5. Deploy the site so `/release-notes` shows the new version (for a nightly too: the updated app opens its entry) (the updated app opens it on its first launch):
   `pnpm -C apps/site run deploy` builds `apps/site` with `SITE_URL=https://astro.oxy.so` and ships it
   (`infra/site/hexclave.deploy.ts`). Also bump `VERSION` and `DMG_SIZE` in `apps/site/src/data/release.ts`
   first so the download button points at the new DMG. The owner has authorized releases to go all the way
   through, so an agent cutting a release deploys too; a site deploy outside a release needs the owner's OK.

Before publishing, run the smoke test: `.claude/skills/release/scripts/smoke.sh <version> <previous> [--rc]` (the
`release` skill runs the whole flow). Besides the hidden launch over CDP, it checks the update itself against
`dist/<previous>/export`: the identity Sparkle, the keychain and TCC compare (bundle id, executable, feed, key, the
previous build's designated requirement, a higher build number), the appcast's EdDSA signature of the zip, Gatekeeper
on the app and the DMG, Sparkle actually updating a copy of the previous build (`update-test.sh`) and the previous
build's data opening in the new one (`carryover.sh`). By hand, check the build the way the script can't: launch
`dist/<version>/export/Astro.app` with `ASTRO_BACKGROUND=1`, a throwaway `ASTRO_DATA_DIR` and
`ASTRO_REMOTE_DEBUGGING_PORT`, and load a page over CDP. Afterwards `codesign --verify --deep --strict` must still
pass on it.

To check the after-update tab too: in that data dir, set `lastVersion` in `release-notes.json` to the
previous version (`{"version":1,"lastVersion":"<previous>","pending":null}`) and relaunch with
`ASTRO_RELEASE_NOTES=1` added (test instances skip the tab without it). `curl localhost:<port>/json` must
list one `…/release-notes#<version>` page; a second launch opens none.

## The engine switch (0.2.21 → 0.2.22)

0.2.22 is the first release on AstroCore; 0.2.21 and earlier ran on CEF. It's the same app to macOS and Sparkle (bundle
id, executable, Developer ID team, designated requirement, feed and key), so Sparkle updates a CEF copy in place and
macOS keeps its permissions, keychain items and passkeys.

Nothing is migrated. A release build without `ASTRO_DATA_DIR` opens the CEF build's data where it is
(`InstalledDataDirectory` in `packages/astrocore/ios/AstroCoreHost.mm`): Chrome's user data dir
`~/Library/Application Support/so.oxy.Astro/Chromium` (profiles `Default` and `Profile <id>`), with the app's
own documents (session, settings) in the folder above. Both engines are Chromium 154.0.8037.58, so every store keeps its
format, and both read the same "Astro Safe Storage" keychain item, which trusts the app by its designated
requirement. Only Developer ID builds use the login keychain; test instances (`ASTRO_DATA_DIR` or
`ASTRO_BACKGROUND`) and ad hoc builds use Chrome's mock keychain. `carryover.sh` checks it: the previous build makes
two profiles with tabs, persistent and session cookies, localStorage, saved passwords, bookmarks, history, an address,
a site permission, a zoom level and an unpacked extension, and the new build, started without `ASTRO_DATA_DIR`,
must find and read all of it. Both run as test copies (bundle id `so.oxy.Astro.carryover`, signed ad hoc) in
a fake home (`HOME` and `CFFIXED_USER_HOME`), so the real app's data, defaults and keychain are never touched.
`rollback.sh <previous app> <new app>` (not part of smoke.sh) checks going back on the same setup: the previous build,
then the new one adding a second session, then the previous one again must show both sessions' data without crashing
or resetting the profile. 0.2.21 → 0.2.22 → 0.2.21 keeps everything but session cookies, which 0.2.21 drops at every
launch anyway.

`update-test.sh` runs Sparkle itself: the previous build's `Sparkle.framework` (through `sparkle-host.swift`) reads a
local feed made of the release appcast's own item, downloads the zip, checks its EdDSA signature, extracts it and runs
Sparkle's installer, which swaps a scratch copy of the previous build for the new one, silently and without
relaunching it. The copies get a test bundle id and a throwaway key, so neither the real defaults nor the release key
are involved; the real identity and signature are what smoke.sh's other update checks compare.

The framework and its helpers keep Chrome's names (`Chromium Framework`, `Chromium Helper (Renderer)`): they are
compiled in from the branding file, so renaming them is a full engine rebuild. Their bundle ids and team are ours,
and the keychain and macOS permissions belong to the app itself, so only Activity Monitor shows the names. Their
icon is Astro's (the Alerts helpers' shows on every notification): `engine/chromium` replaces Chromium's logo.

## The rename (0.2.32 → 0.2.33)

Netnyahoo became Astro. 0.2.32 and earlier are `com.netnyahoo.browser`, executable `Netnyahoo`, polling
`https://netnyahoo.com/appcast.xml`; 0.2.33 is `so.oxy.Astro`, `Astro` and `https://astro.oxy.so/appcast.xml`. What
Sparkle still needs stays: the EdDSA key, the Developer ID team and certificate, and a higher build number. The update
zip's top folder keeps the installed name (`Netnyahoo.app`: Sparkle finds the new app only under it), and at its first
launch the app renames itself to `Astro.app` and moves its data, keychain items and settings across
(`packages/sync/ios/Core/LegacyMigration.swift`, the only Swift file that spells the old names). A Dock tile pinned under the old name is pointed at Astro.app in place (or dropped when Astro is pinned too) and the Dock restarted, once, by the installed copy only (`LegacyDockTile.swift` beside it; 0.2.35). `smoke.sh` checks both
feeds lead to the same appcast and the designated requirement holds under the new id; `update-test.sh` keeps the
bundle ids apart; `carryover.mjs` drives the old build in its own names. netnyahoo.com stays attached to the site for
good (`infra/site/hexclave.deploy.ts`).

## Unnotarized builds

Releases are notarized since 0.2.1 (the `astro` profile holds an App Store Connect API key; with an
Apple ID it's `--apple-id … --team-id …` and an app-specific password, which also works but locks the
Apple ID after repeated failures). If a build ever ships unnotarized, Gatekeeper refuses to open the download. Either open it once from System Settings › Privacy &
Security › Open Anyway, or run `xattr -dr com.apple.quarantine /Applications/Astro.app`.
