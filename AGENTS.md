# AGENTS.md

Astro is Oxy's Chromium browser: a sidebar instead of a toolbar, built on Chromium through AstroCore, our thin layer,
with an Expo + React Native shell. macOS today; Windows and Linux next.

## Commands

```bash
pnpm install
pnpm dev          # Metro for the browser app
pnpm macos        # run the macOS app
pnpm typecheck
pnpm test
pnpm build
pnpm shaders:check
scripts/agent/build-app --as <you>                      # build the app
scripts/agent/locked <pod|chromium> -- <command>        # pod install, pnpm install, Chromium builds
scripts/agent/await --pid <pid> -- <test>               # wait with a deadline
```

## Map

- `docs/agent-brief.md`: architecture and test tooling. Read it first.
- `apps/browser` (React Native macOS app), `apps/site` (website, built with the Astro web framework, unrelated to the
  browser's name), `apps/videos` (Remotion).
- `packages/*` native Expo modules and `packages/core` (omnibox logic); `engine/chromium` (`ac_*` C calls) and
  `engine/astrocore` (window and tab layer).

## Conventions

- No comments in code; put the why in the commit message. Only tool-read text stays (shebangs, license headers,
  directives, `--help` headers).
- Match parity with numbers: compare against a capture with the same crop and state. Update the row in
  `docs/dia-feature-parity.md` when you ship.
- Every wait has a deadline (`scripts/agent/await`); wrap screen captures in `timeout 20`.
- Give each agent its own files, derived-data dir and `ASTRO_DATA_DIR`, so concurrent agents do not collide.

## Boundaries

- Never touch the Chromium `out` directory, and never run `gclient sync` or `gn clean` without the owner's OK: a full
  rebuild costs hours. Engine changes are incremental builds under `scripts/agent/locked chromium`.
- Never steal focus: run builds only as hidden instances (`ASTRO_BACKGROUND=1`, see `docs/agent-rules.md`).
- Never click, type in, or read the user data of other browsers; they are read-only references.
- Never kill processes you did not start; quit your own test instances and background jobs.
- Ask first before a release, a site deploy or any other public action.
- `git checkout`, `restore`, `stash`, `reset --hard`, `clean` and `switch` in the shared checkout are blocked by
  `scripts/agent/guard-git`.

## Testing

- Run typecheck and the tests of the package you changed (`pnpm test` runs all via turbo).
- Done means: typecheck passes, the build passes, and you exercised the feature in a hidden instance (`docs/testing.md`).
  A JS-only change needs no app build; Metro reloads it.
- Timing measurements run one at a time, interleaved with their control.

## PR and commits

- Work on a branch and open a PR. Stage only your own hunks (`git add -p` or explicit paths) and check
  `git diff --cached`. Never stage with `git apply --unidiff-zero`.

## Secrets

- Signing needs Oxy's Apple team ID and the Sparkle key; neither is in the repo. Never print or commit them.

## Links

- [Agent rules in detail](docs/agent-rules.md), [Architecture and tools](docs/agent-brief.md),
  [Releasing](docs/releasing.md), [Engine build](docs/engine-build.md)
- Oxy-wide: [standards](https://github.com/OxyHQ/oxy/blob/main/docs/engineering/standards.md),
  [agent team](https://github.com/OxyHQ/oxy/blob/main/docs/engineering/agent-team-workflow.md)

Owner: Nate Isern (Oxy). Last reviewed: 2026-11-11.
