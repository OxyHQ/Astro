# AGENTS.md

Astro is Oxy's Chromium browser: a sidebar instead of a toolbar, built on Chrome's own framework (Chromium 155) through
AstroCore, our thin layer, with an Expo + React Native shell. It runs on macOS today; Windows and Linux are the next
targets. For the architecture and the test tooling, read `docs/agent-brief.md`.

> Oxy-wide rules live in `~/Oxy/AGENTS.md` and `~/Oxy/docs/`. This file carries Astro's own rules.

## How work gets done
- **Move fast.** There are no users to migrate yet. Ask only when the answer changes what you build.
- **Parallelise independent work** (builds, test instances, tool calls). Only timing measurements run one at a time,
  interleaved with their control, because sharing the CPU skews them.
- **Work on a branch and open a PR.** Stage only your own hunks (`git add -p` or explicit paths), never someone else's
  work in progress, and check that `git diff --cached` reads as you meant. Never stage with
  `git apply --unidiff-zero`: it drops hunks in the wrong place.
- **Give each agent its own files, derived-data dir and `ASTRO_DATA_DIR`.**
- **Clean up.** Quit your test instances, stop the servers and background jobs you started, and never kill processes
  you didn't start.

## Hard rules
- **No comments in code.** Name things so the code says what it does, and put the why in the commit message. Only
  what a tool reads stays: shebangs, license headers, compiler, linter and type directives, and the header a script
  prints as its `--help`.
- **The Chromium build cache is sacred.** Never touch `~/chromium-build/chromium_git/chromium/src/out`, and never run
  `gclient sync` or `gn clean` without the owner's OK: a full rebuild costs hours. Engine changes are incremental
  builds holding the chromium lock (`scripts/agent/locked chromium`, `docs/engine-build.md`).
- **Never steal focus.** Run builds only as hidden instances:
  `open -g -n --env ASTRO_BACKGROUND=1 --env ASTRO_DATA_DIR=<throwaway dir> --env ASTRO_REMOTE_DEBUGGING_PORT=<port> <app>`.
  Keep test data in a scratch dir.
- **Other browsers are read-only references.** You may take screenshots and read their app bundles; never click or
  type in them, and never read their user data or any browser's real profile.

## Building features
- **Sources of truth.** `docs/dia-feature-parity.md` is the checklist; update its row when you ship.
  `docs/dia-spec.md` has the measured reference values.
- **Match with numbers.** Compare against a capture with the same crop and the same state; "looks close" isn't
  enough. Parity means behaviour too: what each click does, what it remembers, animation timings, what keeps running.
- **Verify before you call it done.** Typecheck, build, and exercise the feature in a hidden instance (dev harness,
  CDP, window snapshots; `docs/agent-brief.md`). Verify in proportion: a JS-only change needs no app build (Metro
  reloads it).
- **Build safely.** Build the app with `scripts/agent/build-app --as <you>`. Run `pod install`/`pnpm install` and
  Chromium builds through `scripts/agent/locked <pod|chromium> -- <command>`.
- **Never wait open-ended.** Every wait has a deadline and fails fast when the thing it waits on dies:
  `scripts/agent/await --pid <pid> -- <test>`. Wrap screen captures in `timeout 20`.

## Shipping
- Releases, site deploys and any other public action need the owner's OK first.
- The release flow (notes in `docs/release-notes/`, version bump, `scripts/release.sh`, smoke test, GitHub release,
  appcast, site) is in `.claude/skills/release/SKILL.md` and `docs/releasing.md`. Signing needs Oxy's Apple team ID
  (the `XXXXXXXXXX` placeholder) and a new Sparkle key (`SUPublicEDKey` in `apps/browser/macos/Astro-macOS/Info.plist`).

## Repo map
`apps/browser` is the React Native macOS app. The native Expo modules are in
`packages/{astrocore,shell,shaders,import,sync}`; `engine/chromium` is our Chrome-services code (the `ac_*` C calls)
and `engine/astrocore` AstroCore's window and tab layer. `packages/core` holds the omnibox logic and its tests.
`apps/site` is the website (built with the Astro web framework, unrelated to the browser's name) and `apps/videos`
holds Remotion videos. Licences: `NOTICE`.
