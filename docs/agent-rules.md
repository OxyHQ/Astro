# Agent rules

The detail behind the rules in `AGENTS.md`.

## How work gets done

- Move fast. There are no users to migrate yet. Ask only when the answer changes what you build.
- Parallelise independent work (builds, test instances, tool calls). Timing measurements run one at a time, interleaved
  with their control, because sharing the CPU skews them.
- Stage only your own hunks (`git add -p` or explicit paths) and check that `git diff --cached` reads as you meant.
  Never stage with `git apply --unidiff-zero`: it drops hunks in the wrong place.
- Give each agent its own files, derived-data dir and `ASTRO_DATA_DIR`.
- Clean up: quit your test instances, stop the servers and background jobs you started, and never kill processes you
  did not start.

## Code

- No comments in code. Name things so the code says what it does and put the why in the commit message. Only what a
  tool reads stays: shebangs, license headers, compiler, linter and type directives, and the header a script prints as
  its `--help`.

## Chromium build cache

The Chromium build cache (the `out` directory of the Chromium checkout, located in `docs/engine-build.md`) is never
touched by hand, and `gclient sync` and `gn clean` need the owner's OK: a full rebuild costs hours. Engine changes are
incremental builds holding the chromium lock (`scripts/agent/locked chromium`).

## Hidden instances

Builds run only as hidden instances, so they never steal focus:

```bash
open -g -n --env ASTRO_BACKGROUND=1 --env ASTRO_DATA_DIR=<throwaway dir> --env ASTRO_REMOTE_DEBUGGING_PORT=<port> <app>
```

Keep test data in a scratch dir. Other browsers are read-only references: take screenshots and read their app bundles,
never click or type in them, and never read their user data or any browser's real profile.

## Building features

- `docs/dia-feature-parity.md` is the checklist; update its row when you ship. `docs/dia-spec.md` has the measured
  reference values.
- Compare against a capture with the same crop and the same state; "looks close" is not enough. Parity includes
  behaviour: what each click does, what it remembers, animation timings, what keeps running.
- Verify before calling it done: typecheck, build, and exercise the feature in a hidden instance (dev harness, CDP,
  window snapshots; `docs/agent-brief.md`). A JS-only change needs no app build (Metro reloads it).
- Build the app with `scripts/agent/build-app --as <you>`. Run `pod install`/`pnpm install` and Chromium builds through
  `scripts/agent/locked <pod|chromium> -- <command>`.
- Every wait has a deadline and fails fast when the thing it waits on dies: `scripts/agent/await --pid <pid> -- <test>`.
  Wrap screen captures in `timeout 20`.

## Shipping

The release flow (notes in `docs/release-notes/`, version bump, `scripts/release.sh`, smoke test, GitHub release,
appcast, site) is in `.claude/skills/release/SKILL.md` and `docs/releasing.md`. Signing needs Oxy's Apple team ID (the
`XXXXXXXXXX` placeholder) and a new Sparkle key (`SUPublicEDKey` in `apps/browser/macos/Astro-macOS/Info.plist`).
