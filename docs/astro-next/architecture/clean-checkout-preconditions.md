<!-- Hand-maintained. Design for issue #7. An ordered, checkable list: every row
     names the command that decides it and what a failure means, because a
     precondition nobody can evaluate is a wish. -->

# What must be true for a clean checkout to compile `//astro`

Ordered. Each row names the command that decides it, the expected result, and —
where the failure is silent — what makes the check non-vacuous. Rows are in
dependency order: a failure at row N makes rows after it meaningless, not merely
unrun.

The reason each row carries a vacuity note rather than just a command: findings §7
records `gn check` reporting `0 errors` against a directory with no build graph,
which reads exactly like "clean", and findings §12 records a detector whose
"absent" verdict and whose crash exited with the same status. A check whose pass
and whose nothing-was-measured look identical is not a check.

---

## Phase 0 — Inputs are declared and agree with each other

| # | Must be true | Decided by | Failure means |
|---|---|---|---|
| 0.1 | `browser.lock.json` validates against its schema | `python3 tools/lib/lock.py --validate browser.lock.json` | The lock is malformed. Nothing may act on it partially (`tools/sync-sources.sh:105`) |
| 0.2 | `chromium.commit`, `chromium_downstream.commit`, `chromium_downstream.upstream_base`, `astro.commit` and `depot_tools.commit` are each 40 lowercase hex | the same validation — `$defs/sha` in `browser.lock.schema.json` | A tag or abbreviated SHA is in the lock. The schema's own description says why this is fatal |
| 0.3 | **`chromium_downstream.upstream_base == chromium.commit`** | a new cross-field rule in `tools/lib/lock.py` | The lock disagrees with itself. Must fail before any network access |
| 0.4 | `tools/upstream.allowlist` parses and declares ≥1 entry | `tools/check-upstream-delta.sh --report` | An empty or unparseable allowlist. This is the vacuity floor — without it, a checker that failed to load its rules reports "no violations" |

## Phase 1 — Sources are present, at exactly the declared revisions

| # | Must be true | Decided by | Failure means / vacuity note |
|---|---|---|---|
| 1.1 | `depot_tools` is detached at `depot_tools.commit`, and `DEPOT_TOOLS_UPDATE=0` is exported | `tools/sync-sources.sh` (`:476`); the export is at `tools/lib/astro-common.sh` | findings §4: depot_tools self-updated to `origin/main` on every invocation, so the pin was decorative. depot_tools resolves every other revision, so this must be row 1 |
| 1.2 | `chromium/src` is a git work tree **whose top level is itself**, detached at `chromium_downstream.commit` | `astro::resolve_chromium_src` (`tools/lib/astro-common.sh:472`), then `sync_repository` (`tools/sync-sources.sh:318`) | A `chromium/src` holding only an overlay resolves to the Astro repository. `AGENTS.md` records that an unguarded `git reset --hard` aimed at "the Chromium checkout" then destroys the developer's own work |
| 1.3 | `git -C chromium/src merge-base --is-ancestor <chromium.commit> <chromium_downstream.commit>` | new check, `tools/sync-sources.sh` after 1.2 | **The most silent failure in the list.** A downstream branch based on the wrong upstream builds without complaint. *Vacuity note:* `ASTRO_FETCH_DEPTH` defaults to `1` (`tools/sync-sources.sh:246`), and a depth-1 fetch cannot reach the merge base — the check must fetch deep enough or **fail as unevaluable**, never pass by default |
| 1.4 | `chromium/.gclient` is byte-identical to the rendered `tools/gclient.template` | `tools/sync-sources.sh --verify-only` (`:526-541`) | The checkout is configured differently from what the repository says. With the Astro pin inside the template, this also gates the Astro revision |
| 1.5 | `gclient sync --revision src@<downstream>` completes, and does not move `chromium/src` off the locked commit | `tools/sync-sources.sh:557-567` | DEPS moved the tree. Already gated |
| 1.6 | `chromium/src/astro` exists and `git rev-parse HEAD` equals `astro.commit`, detached | new check, mirroring `:561-567` | This is #7's "a missing or wrong Astro revision fails before GN generation." *Measured:* a wrong SHA makes `gclient sync` exit 1 — see [`astro-checkout-mechanism.md`](astro-checkout-mechanism.md) §8, both directions |
| 1.7 | `build/reports/deps-revinfo.json` records `src/astro` at that revision | `gclient revinfo --output-json` (`tools/sync-sources.sh:576`) | Provenance cannot describe the build. Measured to include the entry |
| 1.8 | Every checkout is **detached**, not on a branch at the right commit | `tools/sync-sources.sh:400-423` | "A branch at the right commit can be advanced afterwards; that is how a pinned build stops being pinned" (`AGENTS.md`). Measured: gclient's own `custom_deps` checkout lands detached |
| 1.9 | Every vendored Rust crate the overlay depends on has a generated `BUILD.gn` in `chromium/src/third_party/rust/<crate>/<epoch>/` | `astro::require_vendored_rust_deps` (`tools/lib/astro-common.sh`), run by `tools/build.sh` and by `tools/vendor-adblock-rust.sh` after `gnrt gen` | These are sources like any other, but nothing in a Chromium checkout provides them and **everything `tools/vendor-adblock-rust.sh` writes is untracked**, so a reset-and-clean loses all of it while leaving a checkout that looks healthy. Unchecked it surfaces at row 3.2 as `Unable to load ".../third_party/rust/adblock/v0_9/BUILD.gn"` — a report about the overlay, for a step nobody ran. *Vacuity note:* the required set is derived by grepping the overlay's own `BUILD.gn` files, so a hard-coded list cannot go stale; the check passes trivially if that grep matches nothing, which is why `vendored-rust-is-declared-and-installed.sh` points the overlay at a crate nobody vendored and asserts the refusal follows |

## Phase 2 — The tree is describable

| # | Must be true | Decided by | Failure means / vacuity note |
|---|---|---|---|
| 2.1 | Every modification in `chromium/src` is attributable to Astro | `astro::require_attributable_chromium` (`tools/lib/astro-common.sh:625`) | A tree nobody can describe. *Note:* `chromium/src/astro` is a nested git checkout and is therefore **opaque** to `git -C chromium/src status` — it needs its own explicit dirty check or it is silently exempt |
| 2.2 | No **untracked** `.rej` / `.orig` / `.porig` under `chromium/src` | `tools/sync-sources.sh:170-176` | *Vacuity note:* only untracked files count. Chromium ships 181 tracked `.orig` files (`cargo vendor` writes one per crate), so a `find`-based check condemns a pristine tree on sight (`AGENTS.md`) |
| 2.3 | No legacy patch is applied, and `patches/` is not consulted | absence of `tools/apply-patches.sh` from the build path | #7: "Verify no legacy `patches/` directory is needed for this build" |
| 2.4 | No overlay copy runs — `tools/sync-overlay.sh` is not in the build path | build script inspection | #7: "Add a check that no file is copied into Chromium by the build scripts" |
| 2.5 | No global domain substitution runs | absence of the substitution step | #7, and `AGENTS.md`'s declared defect. It has never worked; it must now be absent rather than broken |
| 2.6 | The downstream delta is within `tools/upstream.allowlist` | `tools/check-upstream-delta.sh` | *Vacuity note:* the diff must be non-empty. An empty diff is findings §1's state — Chromium with no Astro hooks — and must fail, not pass |
| 2.7 | `ASTRO_ALLOW_DIRTY_CHROMIUM`, `ASTRO_ALLOW_DIRTY_OVERLAY` and `ASTRO_ALLOW_DIRTY_ASTRO` are unset | CI assertion, as already done for the first two (findings §13) | "A gate an env var can wave through is not a gate" (`AGENTS.md`) |

## Phase 3 — GN can see `//astro`

| # | Must be true | Decided by | Failure means / vacuity note |
|---|---|---|---|
| 3.1 | The GN args in use are the committed ones, or every difference is reported | `tools/lib/gn_args_drift.py`, run by `tools/build.sh:215` | findings §2: one uncommitted character (`safe_browsing_mode = 1`) produced a `gn gen` failure that was very nearly published as a defect in upstream ungoogled-chromium |
| 3.2 | `gn gen` succeeds **and reports a plausible target count** | `gn gen out/<dir> --args=…` (`tools/build.sh:226`) | *Vacuity note, and the sharpest one here:* a failed `gn gen` writes no build graph, and `gn check` against no build graph reports `0 errors` (findings §7). The target count is the floor. The committed args on the legacy stack produced `Done. Made 29803 targets from 4348 files`, measured with the overlay outside the graph. With the overlay's build edge in place, the vendored Rust crates present (row 1.9) and `patches/astro/059-itertools-shipping-group.patch` applied, the same args produce `Done. Made 29928 targets from 4409 files`, exit 0. **Between those two figures sat one word.** adblock's dependency `itertools` is `group = 'test'` in Chromium's `gnrt_config.toml`, which makes the generated crate `testonly`, which a browser-process target may not link — so a build edge that works and crates that are all present still fail here, and the failure names a GN target rather than a classification |
| 3.3 | `//astro` is in the graph | `gn desc out/<dir> //chrome/browser:browser deps \| grep '^//astro'` — non-empty | The exact failure findings §1 measured, where `grep -rl 'browser/oxy' … --include='BUILD.gn'` returned 0. *This row is the one that most needs a positive control:* the same command against a known-present dep (e.g. `//chrome/browser/profiles`) must return non-empty, or the grep is measuring nothing |
| 3.4 | `gn check` covers `//astro` and passes for its edges | `gn check out/<dir> //astro/*` | `chromium/src/.gn` sets `no_check_targets` (`.gn:84`) and no `check_targets`, so coverage is automatic; the pass is not. `tools/gn-check-baseline.json` already exists for the surrounding machinery |
| 3.5 | `checkdeps` accepts the `#include "astro/..."` lines, and Astro's internal layering | `python3 buildtools/checkdeps/checkdeps.py --root <chromium/src> chrome/browser astro` | An independent gate from 3.4 that nothing currently runs. Needs `+astro` in `chrome/browser/DEPS` and `include_rules` in `astro/DEPS` |
| 3.6 | `enable_astro = false` also configures cleanly | `gn gen` with that arg | Makes the delta bisectable: "is this regression ours" becomes one GN arg instead of a revert |

## Phase 4 — It compiles, links, and is actually in the binary

| # | Must be true | Decided by | Failure means / vacuity note |
|---|---|---|---|
| 4.1 | `autoninja -C out/<dir> chrome` completes | `tools/build.sh:250` | — |
| 4.2 | The binary **contains** the Astro overlay | `astro::require_astro_overlay` / `tools/lib/overlay_in_binary.py` (`tools/lib/astro-common.sh:257`) | findings §10: a 465 MB ELF containing no Astro code was packaged as `astro-0.1.0-linux-x64.tar.gz`. *Vacuity note:* the detector has three verdicts, and `unmeasurable` refuses just as `absent` does — including when `ASTRO_ALLOW_OVERLAYLESS_PACKAGE=1` is set (findings §12) |
| 4.3 | The overlay probe has a **positive control** | the control column already in findings §10's table | "We found nothing" is meaningful only if the search works. findings §10 records a `grep -icE 'OxyAuth'` returning 22 matches that were all `ProxyAuth`, caught only by printing matched lines instead of a count |
| 4.4 | The Astro hook actually ran at startup | a log line or `astro://`-independent marker emitted from `astro::AddExtraParts` | Linking is not running. `//astro/browser` should be a target whose objects are unconditionally linked, but "compiled and linked" and "reached" are different claims and #7 asks for the second |

## Phase 5 — It is still a browser

#7's initial build proof. These are behavioural and cannot be asserted from a
build log.

| # | Must be true | Decided by |
|---|---|---|
| 5.1 | Launches against a temporary user-data directory and renders | `tools/baseline/smoke.sh`, extended |
| 5.2 | Normal Chromium window, tab strip, omnibox, settings work | manual or automated smoke, against `docs/astro-next/baseline/feature-matrix.md` |
| 5.3 | Picture-in-Picture is available | same; #7 calls it out by name |
| 5.4 | `chrome --version` reports the expected Chromium version | `chrome --version` — findings §10 used exactly this |

*Standing caveat, from findings §10:* a headless `--dump-dom` probe of a WebUI host
reported `chrome://version` as absent, which is false in every Chromium ever
built. Runtime WebUI-origin claims need a browser this harness cannot currently
drive; until it can, they are **not-captured**, not "confirmed absent".

---

## The order matters, and here is where

Three orderings are load-bearing rather than tidy:

- **0.3 before 1.x.** A lock that disagrees with itself must fail before any
  network access, or a 30 GB fetch happens for a build that cannot be valid.
- **1.3 before everything in Phase 3.** A downstream branch on the wrong upstream
  produces a *working* build graph, a *successful* compile and a *wrong browser*.
  It is the only failure in this list that every later row passes.
- **2.6 before 4.2.** The delta check is cheap and reads the source; the
  overlay-in-binary check is expensive and reads a 465 MB artifact. They answer
  different questions — "is the hook declared" and "did the code arrive" — and
  running the cheap one first means the expensive one is only ever spent on a tree
  that could have worked.
