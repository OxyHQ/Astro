# Astro — De-Googled Chromium Browser by Oxy

Astro is a Chromium fork that removes all Google services and replaces them with Oxy platform equivalents. Built on 112 ungoogled-chromium patches plus 65 Astro-specific patches. All Oxy code lives in a self-contained overlay (`src/chrome/browser/oxy/`), following the Brave-style approach.

## Build Commands

```bash
tools/sync-sources.sh            # Check out every source at its locked commit
tools/sync-ungoogled.sh          # Stage patches from the locked ungoogled checkout
tools/apply-patches.sh           # Apply all patches (ungoogled + Astro)
tools/sync-overlay.sh            # Copy Astro overlay into the Chromium tree
tools/build.sh                   # Release build (uses all CPU cores)
tools/build.sh Debug             # Debug build
tools/install-local.sh           # Install to system
tools/package-release.sh         # Package for distribution
tools/update-chromium.sh VER     # Propose a Chromium revision update
tools/apply-branding.sh          # Apply branding from branding/astro.conf
tools/vendor-adblock-rust.sh     # Vendor Rust adblock engine dependencies
tools/generate-provenance.sh     # Record what a build was made from
tools/baseline/generate-all.sh   # Regenerate the Astro Next baseline documents
tools/tests/run.sh               # Build-safety suite (no Chromium checkout needed)
tools/verify-clean-head.sh       # Run that suite against ONLY what HEAD tracks
```

`--dry-run` works on `sync-sources.sh`, `apply-patches.sh`, `sync-overlay.sh`
and `build.sh`: it
validates every required input and prints every planned operation without
touching a file.

## Build pipeline rules (non-negotiable)

These are enforced by `tools/tests/run.sh` and the **Build safety** CI job, not
just by convention. Do not work around them; if one blocks you, that is the
signal to stop and report it on the issue.

- **Never `rsync --delete` into the Chromium tree**, and never reintroduce a
  delete path in `tools/sync-overlay.sh`. The old overlay copy removed every
  upstream file the overlay did not provide, `gclient`-fetched `third_party`
  trees included.
- **Never apply a patch fuzzily (`patch -F*`) or through `git apply --3way`.**
  Both produce a tree that is not the reviewed patch, and both did so silently.
  A patch applies exactly or the run stops.
- **Never swallow a failure.** No `|| true`, no `2>/dev/null` on a required
  step. A genuinely optional step is declared with `astro::optional <reason>`,
  which prints a structured `WARN [optional:<reason>]` and continues, so
  `grep -rn astro::optional tools/` is the complete list of tolerated failures.
- **Never pipe `find` into `head`.** Once `head` has its N lines it closes the
  pipe, `find` takes SIGPIPE, and `set -o pipefail` surfaces exit 141 — killing
  the run with a stack trace instead of a verdict. It never fired on the
  synthetic fixtures because `find` always finished first; it fires reliably
  against a real checkout's 400,000 files. Bound the producer instead, or ask
  git, which is usually both exact and cheaper. No scanner rule catches this
  shape, which is why it is written down here.
- **Only *untracked* `.rej` / `.orig` files are patch artifacts.** Chromium
  ships 181 tracked `.orig` files — `cargo vendor` writes a `Cargo.toml.orig`
  for every vendored Rust crate — so a `find`-based artifact check condemns a
  pristine upstream checkout on sight. Measured on the real tree: 181 tracked
  `.orig`, 0 tracked `.rej`, 0 untracked of either. Both checks ask git for
  untracked files only: the pristine-tree guard before a run, the
  post-application scan after the series is applied.
- **Before blaming a patch for a `gn` failure, prove the GN args are the
  committed ones.** The build reads its args from a file in the working tree, so
  a one-character local edit is indistinguishable from the repository's own
  configuration. Measured: an uncommitted `safe_browsing_mode = 1` in
  `gn_args/linux.gn` produced `ERROR at //chrome/browser/safe_browsing/BUILD.gn:114:5:
  Undefined identifier`, which was very nearly published as a composition defect
  in two upstream ungoogled patches — with a temporary Astro-owned correction
  written to repair a defect that does not exist. The committed value is `0`, and
  at `0` the same tree generates 29,803 targets. `tools/build.sh` now reports
  every key that differs from `HEAD` before configuring; read that block before
  attributing a configuration failure to anything in `patches/`.
- **A `gn gen` that fails writes no build graph, and `gn check` against no build
  graph reports `0 errors`.** That reads exactly like "clean". Any check whose
  pass and whose *nothing-was-measured* look identical needs a vacuity floor —
  here, the target count `gn gen` prints. Related: the committed GN args and the
  patch stack are coupled, so there is no same-configuration unpatched baseline
  to difference against (the pristine tree fails at
  `components/optimization_guide/core/inference/BUILD.gn:8:1: Assertion failed`).
- **Never write into `chromium/src` without resolving it first** through
  `astro::resolve_chromium_src`. It requires the path to be a git work tree
  *whose top level is the path itself* — a `chromium/src` holding only the
  overlay resolves to the Astro repository, so an unguarded `git reset --hard`
  aimed at "the Chromium checkout" destroys the developer's own work.
- **That rule guards the scripts. Nothing guards a bare `git` you type
  yourself, so use `git -C /home/nate/Oxy/Astro` for every one of them.**
  `gn gen` and `ninja` want `chromium/src` as the working directory, the shell
  keeps that directory between commands, and a later `git` then runs against
  the Chromium checkout while looking exactly like a repository command. It has
  happened twice, to two agents, presenting differently each time: a
  `tools/baseline/generate-all.sh --check` dying with "No such file or
  directory", and a `git commit` executing inside `chromium/src`. Both were
  harmless — the commit had an empty index, so git printed status and exited
  non-zero — and that is the whole problem, because **`chromium/src` carries
  4,253 dirty paths** from binary pruning and vendoring. There is no
  empty-index reprieve for `git add -A` or `git commit -a`: either one puts
  those 4,253 files onto the pinned revision, breaking "checkouts are detached
  at the locked commit" and every pristine-tree guard downstream. Prefer
  `git -C <path>` over `cd` for the build commands too, so the directory never
  drifts in the first place.
- **To prove nothing was committed there, read the REFLOG, not `HEAD`.** A
  `HEAD` matching `browser.lock.json` is consistent with a commit that was made
  and then reset away, which is the case you actually care about. The intact
  state is a reflog holding exactly one entry — the original detached checkout —
  alongside an empty index.
- **Preserve developer work by default.** Mutating scripts refuse a checkout
  carrying changes Astro did not write. `ASTRO_ALLOW_DIRTY_CHROMIUM=1` is a
  developer-only override; CI asserts it is never set.
- **Never ask git whether a Chromium checkout is clean without descending into
  submodules.** `gclient` writes `diff.ignoreSubmodules = dirty` into
  `chromium/src/.git/config`, so a plain `git status --porcelain` prints
  NOTHING for a submodule carrying modified or untracked content. Measured
  2026-08-09: a reset that satisfied both the dirty-checkout guard and
  `tools/check-upstream-delta.sh` then died at ungoogled patch 12 of 112 on a
  `prepopulated_engines.json` that was already patched — two independent
  pristine assertions agreeing, both wrong. Both guards now descend, via
  `tools/lib/dirty_paths.py` and `submodule_scan` in
  `tools/lib/upstream_delta.py`, and `docs/recovery.mdx` §3 carries the reset
  procedure. Three things about the fix are worth keeping:
  - **`--ignore-submodules=none` alone is not enough.** It reports one line
    per submodule — `third_party/devtools-frontend/src` — and says nothing
    about which file changed, and no declaration in this repository is
    written in that vocabulary. Both guards descend to FILE level and re-root
    onto the superproject, which is why neither carries a list of "submodule
    paths the series may write": the patch report and `pruning.list` that
    attribute the other paths attribute these too.
  - **The numbers grow by more than the patch series suggests.** 13 files in
    2 submodules are PATCHED (`devtools-frontend/src` 12,
    `search_engines_data/resources` 1, the same 13 the patch replay reads from
    DEPS sub-repositories) — but 9,171 of the 12,392 files binary pruning
    deletes also live inside submodules, across 52 of them. Measured on the
    built tree: the dirty-path count went 5,804 → 14,988, and the delta gate's
    deletions 3,220 → 12,391, all still declared. That is why
    `ASTRO_MAX_MODIFIED_UPSTREAM_PATHS` is 20,000 rather than 6,000.
  - **Attribution has to read `pruning.list`, not just the report.** Pruning
    is idempotent, so a file already gone is not recorded again, and a
    checkout produced before the reset learned about submodules carries 9,147
    deletions no report claims. Before that input was added the guard refused
    the tree saying "Astro did not write" about files Astro's own pruning step
    is what removed. `upstream_delta.py` had always attributed deletions from
    that declaration; `astro::unattributable_paths` now does too.
  - **A new blind call cannot come back silently.** The `blind-git-status`
    rule in `tools/tests/lib/scan-shell-patterns.py` refuses any
    machine-read `git status` (`--porcelain`, `--short`, `-s`) in
    `tools/*.sh` that does not spell `--ignore-submodules`. It found the two
    that were left — `generate-provenance.sh`, which would have written
    `worktree: clean` into the permanent record of what a build was made
    from, and `fetch-cross-deps.sh`, whose `find -maxdepth 4` also missed 62
    of the 260 submodules it claims to reset.
- **A patch applied by hand, or written since the last full run, is invisible
  to the guards.** `astro::unattributable_paths` attributes a dirty path from
  the overlay allowlist, the pruning declaration, or a MANIFEST an earlier
  pipeline step emitted — and the manifest `sync-overlay.sh` passes is
  `build/reports/patch-report.json`, which only `tools/apply-patches.sh`
  writes. Any patch the report predates therefore has its own legitimate
  output reported as "modified path(s) Astro did not write". The cure is a
  real pipeline run, not an override.

  **Do not read this entry for a pair of numbers — read it for the
  discriminator.** It used to say `applied_count: 168` against a tree carrying
  176, and by 2026-08-09 the report read 177 against a series of 178, so two
  agents in one evening hit exactly this and neither recognised the entry as
  describing them; both reached for `ASTRO_ALLOW_DIRTY_CHROMIUM=1`. The
  discriminator does not go stale: compare the patch NAMES the report records
  against `patches/astro/series`. On that day exactly ONE name was missing —
  the report recorded `069` but not `070`, 177 entries against the series'
  178 — and that one patch is the whole flag: the single path the guard named
  was patch 070's own output, provable in one command,
  `git apply --check -R patches/astro/070-*.patch` against the tree. Note how
  small the gap that produces a refusal is: one patch written after the last
  full run is enough, so "the report looks about right" is not a reading.

  **What this cost, which is the reason it is worth this many words.** A
  genuinely foreign 113 KB file — `chrome/browser/resources/
  new_tab_page_third_party/new_tab_page_third_party.html`, left by the deleted
  `webui/ntp/merge-for-chromium.ts` — sat in the shared checkout across
  multiple sessions with this guard pointing straight at it, waved through
  every time alongside the false positive. It then went into a user's binary,
  because `tools/install-local.sh` recompiles and its log shows
  `new_tab_page_third_party:preprocess_static_files` and
  `chrome:packed_resources_extra` re-running: the file carried `wttr.in` and
  `source.unsplash.com`, two hosts `docs/astro-next/policy/endpoints.json` had
  just stopped declaring on the grounds that nothing references them. A gate
  that cries wolf gets waved through, and the thing it was right about goes
  through with it.
- **Every overlay destination is declared** in `tools/overlay.allowlist`. An
  undeclared path, or an undeclared overwrite of an upstream-tracked file,
  fails the sync.
- Shared helpers live in `tools/lib/astro-common.sh`; every script sources it
  rather than re-implementing strict mode, logging or the guards.
- Run `tools/tests/run.sh` before touching anything under `tools/`.
- **A green suite run against a working tree says nothing about the commit.**
  An untracked file on disk satisfies every test that needs it, so a coupled
  unit committed by halves stays green locally and breaks a clean checkout.
  Four times here already, in both directions — `tools/setup-win-sdk.sh` and
  two `.pyc` files swept IN, `tools/verify-build-outcome.sh` and
  `tools/policy/manifest.py` left OUT while the committed scripts requiring
  them went in. `tools/verify-clean-head.sh` materialises the commit on its
  own, runs the suite there, and fails when the verdicts differ from the
  working tree's; the static converse — every path a committed script names is
  tracked at that commit — is `tools/tests/cases/committed-inputs-are-tracked.sh`
  and its `NOT_TRACKED` table is where a legitimately-absent path is declared.
  Run the gate before pushing anything under `tools/`.
- **`verify-clean-head.sh` verifies whatever `HEAD` is when you invoke it,
  which in this checkout is often not your commit.** Several agents land
  commits here in the same hour, so a gate run started late reports on a
  `HEAD` that has moved past you — and if somebody else has already repaired
  what you left broken, it comes back green ABOUT THEIR FIX and you read it
  as clearing yours. That happened with 067: the suite was green before the
  commit, went red at the commit, and the clean-head run that should have
  caught it was started after 79a296a had already corrected the literal.
  Observed directly twice in one session, two different SHAs printed on the
  `Verifying commit ...` line. Pass `--commit <your-sha>` to pin it to the
  commit you actually wrote.
- **The assertion-count table that same gate prints is noise, and every case
  already states in words what the table gestures at.** Six rows print on every
  run, and they printed byte-identically across five different commits and
  across both dirty and clean working trees — so they track nothing about your
  change. The clean tree is by construction the tracked repository alone, so it
  can never hold `chromium/src`, an installed `node_modules`, or an untracked
  file, and three unrelated mechanisms turn that absence into a count
  difference: a list built from the filesystem and counted once per path
  (`shell-static-analysis.sh:27`; `harness::assert_script_list` at
  `harness.sh:392` for `build-outcome-is-the-builds-own` and
  `real-checkout-hazards`), an existence gate on the checkout
  (`module-layering-is-enforced.sh:429`,
  `webui-configs-use-the-scheme-constant.sh:145`), and two arms of a `case`
  differing by one assertion (`color-tokens-are-generated-from-bloom.sh:428`,
  4 against 3). Read the `NOT EXERCISED:` line each case prints instead: it
  names the exact path it could not reach.

  The attribution history is why this is written down rather than left to be
  re-derived. Two agents produced six mechanism stories for those six rows and
  got the mechanism wrong all six times, while the conclusion came out right
  all six times. **A conclusion surviving is therefore not weak evidence for
  the mechanism behind it, it is none.** Every row was settled the same way and
  only that way — reading the line that increments `HARNESS_ASSERTIONS` and the
  scope it sits in. Both classic misses are in the record: citing a nearby line
  that looks like the counter (`shell-static-analysis.sh:129`, whose increment
  is at :108, above the loop), and citing the right counter without checking
  its scope (`harness::assert_no_lines_matching`, `harness.sh:359`, which sits
  outside its own `grep` and so fires once per call, never once per file).
- **A generated document read from `HEAD` cannot fail before you commit.**
  `tools/baseline/inventory_patches.py` reads every byte from `HEAD`, so the
  hand-maintained `astro N` literal in
  `tools/tests/cases/baseline-inventories.sh` agrees with the old count right
  up until the commit that adds a patch, and only then disagrees. A pre-commit
  suite run is structurally incapable of catching it: it is green BECAUSE the
  patch is uncommitted. Bump the literal in the same commit as the patch, and
  re-run the suite AFTER committing and before regenerating the baseline —
  that window is where this class of miss lives.
- **Commit with `git commit --only <paths>`. The index is shared, so anything
  that commits "what is staged" takes somebody else's work.** Several agents
  routinely work this one checkout at once, and `AGENTS.md`,
  `patches/astro/series` and `patch-dispositions.json` are the files two waves
  reach for simultaneously — all three have carried another agent's
  uncommitted hunks mid-session.

  **`git add <path>` followed by `git commit` is NOT sufficient**, which is
  what the earlier wording ("stage by explicit path") got wrong: adding your
  path does not clear what somebody else added. It happened exactly that way —
  a `git status` showed a file as unstaged, another agent staged it in the
  seconds before the commit, and the commit carried their 36 lines under a
  stranger's name and message. `--only` names what to commit and leaves every
  other staged entry untouched; a temporary index built from `HEAD` plus
  explicit blobs is equivalent. `git add -A` is never correct here.

  Recovering from it is `git reset --soft HEAD~1` — but check first that HEAD
  is still your commit, or the reset eats whatever landed on top. It restores
  the index exactly as it was, so the other agent's staging survives.
- **Nobody here can be identified by git, so attribute by mtime, task title and
  content — never by `git log`.** Every commit on this branch carries the same
  author, so `--format=%an` separates nothing and any guess built on it lands
  on whoever was active nearby. Five wrong attributions happened in one
  session. The two that mattered were not naming quibbles: one nearly took
  authorship of another agent's unfinished analysis, and one routed "please
  bump this red gate" to an agent that knew nothing about the change the gate
  certifies — twice. An uncommitted hunk in a shared file has no queryable
  owner at all: call it unclaimed and leave it, rather than handing it to a
  name.
- **Two builds must not share one output directory, and the dirty-tree
  override is not what makes that safe.** `ASTRO_ALLOW_DIRTY_CHROMIUM=1` exists
  so somebody looks at the dirty state and vouches for it; it governs the
  overlay sync and nothing else. It does not stop a file changing under a
  running compile, and it does not stop two `ninja` runs interleaving in one
  `out/`. When two agents have complementary changes, land both sources first
  and build ONCE — a relink here is 20-40 minutes, so serialising two is an
  hour thrown away and racing them is worse.
- **`pkill -f <your own scratchpad path>` kills other agents' processes.** The
  scratchpad is per SESSION, not per agent, so several agents share that
  directory string and a pattern meant to match only your browsers matches
  theirs. Measured: one agent's cleanup killed another's browser mid-run, and
  the X window id was then REUSED by a later process — which is how the two of
  them ended up recording the same window id for different pids, and why a
  screenshot can be of somebody else's browser. Kill by pid you captured at
  launch, and resolve a window with `wmctrl -lp` matching that pid exactly,
  refusing to proceed unless exactly one row matches. `wmctrl -l | grep Astro`
  and `xdotool search --pid` both misidentify windows here — the latter
  returned eight windows, from three processes, for a pid that had one.
  Better still, drive the browser through CDP against a named target: it is
  focus-independent, so another agent stealing focus cannot corrupt the run.
- **Two browsers can hold "the same" debugging port, and your CDP client then
  drives somebody else's.** The port binds per stack, so one process on IPv4
  and another on IPv6 both succeed on 9333 and neither reports a conflict.
  That is how one agent came to read one browser's log while driving another,
  and reported a control as inert — a conclusion that happened to be wrong for
  a reason that had nothing to do with the control.

  Do not pick a port and hope: launch with `--remote-debugging-port=0` and
  read the port out of `<your-user-data-dir>/DevToolsActivePort`, whose two
  lines are the port and that browser's unique WebSocket path. The file is
  inside YOUR profile, so both values are your browser's by construction and
  no collision can point you at somebody else's. Measured. And do NOT try to
  confirm identity from `/json/version` — an earlier revision of this entry
  suggested it and was wrong: it returns Browser, Protocol-Version,
  User-Agent, V8-Version, WebKit-Version and webSocketDebuggerUrl, and no
  process id.
- **`import -window ""` writes a plausible screenshot of something you never
  identified**, so a window lookup that returns nothing still produces a PNG
  and the run looks like it worked. It happened: `pgrep -f
  "remote-debugging-port=9340"` matched the BASH WRAPPER whose own command
  line contains the pattern rather than the browser, `wmctrl -lp` then matched
  no window, and the capture succeeded anyway — with three Astro windows from
  three different agents on the display, one of them titled "Customize Astro"
  and not the author's. Guard the lookup (`test -n "$WIN"`) rather than
  trusting that a failed resolution produces a failed capture.
- **The side panel is per TAB, so CDP reporting it `visible` is not the same
  as it being on screen.** A capture taken while another tab is in front shows
  no panel while every programmatic check says it opened. Bring the owning
  target to the front before capturing.
- **Count from the DOM, not from the pixels.** Two people, twice, miscounted
  the picker's swatches off a screenshot and nearly reported a working gate
  filter as broken: the picker draws Default, Grey and Custom on top of the
  dynamic list, so a correct filter shows 19 elements for 16 presets. Query
  the elements and compare the NAMED SETS — the honest assertion is that
  `faircoin` and `mono` are absent from both surfaces, not that a total
  matches.
- **`git commit --dry-run -- <paths>` does not disturb the index — but read
  the exit status before believing a test that says so.** It was claimed as a
  hazard, and the first round of testing could not have caught it either way:
  every shape staged files the pathspec did NOT match, so git printed "no
  changes added to commit" and exited 1 before it ever built the
  partial-commit tree. A check whose machinery never runs cannot fail. The
  case that carries the verdict stages files both inside and outside the
  pathspec, exits 0, and still leaves every index entry intact.

  What makes anyone believe otherwise is the DISPLAY, not the index.
  `--dry-run --short` renders out-of-pathspec staged entries as though they
  were not staged, with the real index unchanged either side of it:

      real index:    M mine.txt   D oldfile.txt   A theirnew.txt   M theirs.txt
      dry run shows: M  mine.txt
                     D  oldfile.txt
                      M theirs.txt      <- staged, shown as unstaged
                     ?? theirnew.txt    <- staged, shown as untracked

  On screen that is indistinguishable from somebody having reset the index.
  Trust `git diff --cached`; never a dry run's own status output. What had
  actually emptied the index was another agent's commits landing first and
  consuming their own entries, which git then rendered as a rename.
- **Every agent commits as the same git user, so `git log` cannot tell you
  whose work something is — and adjacency in time is not evidence.** Six
  attributions were made wrongly in one session, in both directions: an
  uncommitted hunk handed back to an agent who had never written it, and
  commits credited to an agent who had not made them. Twice that would have
  led to work being discarded or committed twice by someone repairing a defect
  they did not own. The cheap discriminator is `git log -S '<a distinctive
  line>' -- <path>`, which names the commit that introduced the text, plus the
  commit timestamps; run it before handing anything back or "restoring" what
  looks like somebody else's edit. Reconciling a shared file so BOTH sets of
  edits survive is safe whoever owns it — asserting who owns it is not.

  **And `git log -S` is blind to exactly the case where guessing is most
  tempting: an UNCOMMITTED hunk.** It searches history, so for a pending edit
  it returns nothing, which reads as "no answer" and gets filled in with
  adjacency. That is the shape that recurred here — the same shared file,
  twice, and the second time the agent I handed it to was one step from
  committing another agent's unfinished analysis under their own name. Wrong
  credit costs a correction; that would have taken authorship. There is no
  git-side answer for a pending hunk: only your own transcript ("did I write
  this?") and content provenance (does it restate what some agent just said?),
  both weaker than a query. So the rule is not "attribute more carefully", it
  is **never hand a shared file's pending hunk to a named owner** — call it
  unclaimed, leave it untouched, and let its author claim it.

  **Every one of these was caught by the RECIPIENT of a claim, never by its
  author.** Four wrong attributions, a vacuous test, and a false index-reset
  report: in each case the person who made the claim had the evidence to
  disprove it in seconds and did not look, because nobody doubts themselves
  unprompted. So the discipline that pays is not "check your own work harder",
  it is **state a claim in whatever form is cheapest for the recipient to
  falsify** — a named command they can re-run, an exit code, a before/after
  dump, a SHA.
  Every correction in that list happened because the claim was specific enough
  to be tested; a vaguer message would have been believed.

**Source revisions are declared, never discovered.** `browser.lock.json` holds
the full commit SHA of Chromium, depot_tools and the ungoogled patch set.

- **Never `git pull` a build dependency**, and never let an env var or a CLI
  flag select a version. `tools/update-chromium.sh` resolves a version to one
  commit and updates the lock; the lock diff is the review.
- **Never fall back to a similar version.** No exact tag means the command
  fails. The old `git tag -l "$MAJOR.*" | tail -1` → `master` chain exited zero
  while silently targeting a different browser.
- **Never decide in CI whether to synchronise.** A job runs
  `tools/sync-sources.sh` unconditionally, then `--verify-only`. Testing for an
  existing `.git` treats a cache as source-of-truth state and is rejected by
  the pattern scanner, which reads the workflow files too.
- **Checkouts are detached at the locked commit.** A branch at the right commit
  can be advanced afterwards; that is how a pinned build stops being pinned.
- `ASTRO_ALLOW_DIRTY_CHROMIUM=1` has no effect under `--verify-only`. A gate an
  env var can wave through is not a gate.
- Provenance is generated from the trees on disk, never from the lock — the
  disagreement between them is the fact worth recording.

**The baseline is generated, not hand-maintained.** `docs/astro-next/baseline/`
is produced by `tools/baseline/*` and CI runs `generate-all.sh --check`, so a
document that stops matching the repository fails the build. Never hand-edit a
file whose header says it is generated — the next check reverts the edit with
no explanation. Dispositions in `patch-dispositions.json` are the one
hand-maintained input, and the join against the two patch series is strict in
both directions.

Anything the baseline could not measure says `not-captured` and names the
command that will capture it. Do not fill one in from reasoning: the whole
point is that later issues can tell a measurement from an expectation.

**Known defects, declared rather than hidden.** Do not "fix" these silently, and
do not let a build imply they are resolved:

- Domain substitution has never run (Python regexes fed to `sed`, error
  discarded). `apply-patches.sh` refuses; `--skip-domain-substitution`
  reproduces what previous builds did. Owned by #8.
- A whole-file overlay copy of `chrome/browser/ui/webui/chrome_web_ui_configs.cc`
  once reverted four patches, so `AstroAdBlockUIConfig` was never registered.
  That copy is now gone: no such file exists under `src/`, tracked or
  untracked, and `tools/overlay.allowlist` carries no entry for it. Registration
  is a patch again. Kept here because a checkout that reintroduces the copy
  reintroduces the defect with no warning. Owned by #7.
- The Oxy overlay compiled to zero objects because no `BUILD.gn` outside
  `chrome/browser/oxy/` declared a dependency on it. Patch
  `057-oxy-webui-build-edge.patch` adds that edge to
  `//chrome/browser/ui/webui:configs`. Measured on 2026-08-08 against the
  applied series: GN now LOADS the overlay, and there is **no dependency
  cycle** through `//chrome/browser/ui` — the cycle this entry used to warn
  about does not exist. Owned by #7.
- `gn gen` then failed on a crate-privilege collision — nothing in `patches/`
  or the overlay — because pulling the ad blocker's Rust target into the graph
  made it fail the test-only rule. Resolved by
  `059-itertools-shipping-group.patch`, which reclassifies `itertools` from
  Chromium's `test` crate group to `safe` in
  `third_party/rust/chromium_crates_io/gnrt_config.toml`. Measured on
  2026-08-08 with the patch applied and the crates re-vendored:
  `Done. Made 29928 targets from 4409 files`, exit 0. Owned by #7.

  Three things from it are durable and outlive the defect:

  - **The override cannot go on the consuming crate.** gnrt's privilege is
    `min(ancestor_privilege, dependency_privilege)` and a group declared on a
    crate replaces only its ANCESTORS, so `[crate.adblock] group = 'safe'`
    changes nothing — the classification has to move on the dependency that
    carries it.
  - **The edit could not be epoch-scoped when 059 was written, even though the
    config syntax offers it.** `fill_allow_unsafe_settings` in
    `tools/crates/gnrt/vendor.rs` keyed its edits on the bare package name, so
    the next `gnrt vendor` wrote a bare `[crate.itertools]` beside any
    `[crate."itertools@v0_13"]` and `BuildConfig::validate` then rejected the
    file for mixing the two forms. `065-thiserror-epoch-scoped-config.patch`
    lifted that: the loop now writes into an epoch-scoped table when the config
    already has one, so a per-epoch entry survives vendoring. 059 stays
    unversioned because one epoch of itertools is vendored and it needs no
    second statement — not because the mechanism is still unusable.
  - **`group` is not an audit verdict.** It records where Chromium itself uses
    a crate. Moving one to `safe` is nonetheless a claim about its source, so
    the patch header carries the unsafe audit backing it — do that for the
    next one too rather than treating the reclassification as clerical.
- Three more of the same shape followed 059, all fixed:
  `064-rand-chacha-macro-unsafe.patch`, `065-thiserror-epoch-scoped-config.patch`
  and `066-vendored-crate-build-inputs.patch`. Measured 2026-08-09 with all
  three applied and the crates re-vendored: `Done. Made 29957 targets from 4411
  files`, exit 0, and the seven rlibs they govern rebuild from deleted outputs.
  The durable lesson is one none of the three could have found by round-tripping
  the build: **gnrt writes a value only where the key is ABSENT**
  (`entry("allow_unsafe").or_insert_with(...)`), which is both why declaring a
  corrected value sticks and why a "the config came back byte-identical" check
  is VACUOUS on an already-vendored tree — nothing is inserted, `did_make_edits`
  stays false, and an unpatched gnrt produces the same file. Delete the key and
  re-vendor to see where the writer actually puts it.
- **A vendored crate CAN be edited durably, and this file said the opposite.**
  `//chrome/browser/oxy/adblock/rs:adblock_engine_ffi` used to fail at
  `third_party/rust/rmp_serde/v0_15:lib` with 24 × `E0425: cannot find function
  read_data_i8 in module rmp::decode`. rmp-serde 0.15.5 calls
  `rmp::decode::read_data_*` as FREE functions; rmp 0.8.11 moved them into the
  `RmpRead` trait, `#[doc(hidden)]`, leaving no wrappers (0.8.10
  `src/decode/mod.rs:208` has the free `pub fn`; 0.8.15 `:107` has the same
  body as a trait method). adblock 0.9.8 requires `rmp-serde = "0.15"`
  NON-optionally and Cargo resolves rmp-serde's `rmp = "0.8.8"` to 0.8.15 —
  inside the range its own author wrote, incompatible with it.

  The entry that used to sit here said the repair had to be a resolution
  constraint because "editing the vendored crate is not an option; the next
  `gnrt vendor` overwrites it silently". That is true of editing the tree by
  hand and FALSE of the mechanism.
  `third_party/rust/chromium_crates_io/patches/<crate>-<epoch>/` exists so an
  edit survives re-vendoring: `apply_patches` in
  `tools/crates/gnrt/vendor.rs` runs on every download, and 17 crates in this
  checkout already depend on it. `069-rmp-serde-rmpread-backport.patch` adds
  Astro's, carrying rmp-serde 1.1.1's own `RmpRead` migration back to 0.15.5.
  Measured 2026-08-09: `adblock_engine_ffi` builds, `ninja: no work to do.`,
  exit 0, `libastro_adblock_ffi.rlib` 291,988 bytes.

  Four things from it outlive the defect:

  - **`apply_patches` runs on the DOWNLOAD path only.** A crate already
    vendored at the right version takes the `continue` branch, so adding a
    crate patch to a tree that already holds the crate does nothing at all.
    Delete the vendor directory to apply one. The consequence for verification
    is sharper than it looks: a second `gnrt vendor` leaving the tree
    byte-identical proves STABILITY, not that the patch reproduces from
    scratch, because the second run never re-applied it. Both were measured
    separately here — the crate re-downloaded pristine and re-patched to the
    intended md5, and then 6,684 files byte-identical across two runs.
  - **Prefer the crate patch to a resolution pin, and the reason is not
    taste.** Holding rmp below 0.8.11 pins the decoder that parses adblock's
    serialized filter data at 0.8.10 (2021-02-02), needs `rmp` declared a
    direct dependency of the `chromium` package purely as a constraint, and
    silently falsifies a patch that had landed hours earlier: 066 declares
    `[crate.rmp] extra_input_roots = ['../README.md']` because 0.8.15's
    `src/lib.rs` opens `#![doc = include_str!("../README.md")]`, and 0.8.10's
    does not. A version pin can invalidate a build-input declaration made for
    a different version of the same crate; check the other patches naming a
    crate before pinning it.
  - **Bumping the intermediate crate was not available, and the version list
    is how you find that out.** adblock 0.9.8 declares `rmp-serde = "^0.15"`,
    0.15.5 (2021-06-11) is the last 0.15.x; 1.0.0 and 1.1.0 are yanked, so the
    first live release above it is 1.1.1, and all of them are outside the range
    anyway. No published rmp-serde both satisfies its dependant and builds
    against a current rmp. Checked release by release, not sampled: every
    adblock from 0.9.8 to 0.12.0 declares `rmp-serde = "^0.15"`.
  - **The real fix is an engine upgrade, and it is a product decision.**
    adblock 0.12.1 is the first release that drops rmp-serde entirely
    (flatbuffers arrived earlier, in 0.10.0, alongside it — so "the flatbuffers
    release" is not the one to reach for). Taking it costs
    four new vendored crates (`flatbuffers`, `arrayvec`, `precomputed-hash`,
    `rustc-hash`), five epoch bumps that invalidate 066's `cssparser-v0_29`
    and `selectors-v0_24` declarations, a `v0_9` → `v0_12` rename in the FFI's
    `BUILD.gn`, and an FFI rewrite against a changed engine API. 069 says in
    its header that it is removable the day that happens.
- **The overlay's own C++ has never been compiled, and it does not compile.**
  Once the Rust graph stopped blocking, the 13 objects of
  `//chrome/browser/oxy/adblock:adblock` were built for the first time: 4
  succeeded and 9 failed, every failure in Astro's own sources and none in
  `patches/` or a vendored crate. **12 of the 13 compile as of 2026-08-09**;
  the 13th, `astro_adblock_ui.o`, fails only on the undeclared
  `IDR_ASTRO_ADBLOCK_HTML`, which is the grit/pak wiring (#14). The repairs
  were API drift against Chromium 146, not one root cause, and the upstream
  spellings are worth carrying because the next overlay file will hit them
  too:

  - `base::Value::List` / `base::Value::Dict` are now the standalone classes
    `base::ListValue` / `base::DictValue`, and `WebUI::MessageCallback` takes
    `const base::ListValue&`.
  - `GURL::host()` returns `std::string_view` while `spec()` still returns
    `const std::string&`, so `std::string s = url.host();` no longer compiles
    — the `string_view` → `string` constructor is explicit.
  - `base::JSONReader::Read` requires its `options` argument; `ReadDict` /
    `ReadList` replace the read-then-`is_dict()` dance.
  - `RequestDestination::kFavicon` and `net::LOAD_DO_NOT_SEND_COOKIES` are
    gone; `ResourceRequest::credentials_mode = kOmit` is what keeps cookies
    off a request now.
  - `base::RefCountedString` lives in `base/memory/ref_counted_memory.h`.
  - There is no unbranded shield vector icon: the only two in the tree are
    ChromeOS-specific and `google_chrome/gshield.icon`, which a
    non-Google-branded build does not compile. `chrome/app/vector_icons/security.icon`
    (`kSecurityIcon`) IS a shield outline and is already in the aggregate
    list, so no new icon and no new patch was needed. The `alia_spark.icon`
    precedent — overlay `.icon` + `tools/overlay.allowlist` entry + a numbered
    patch to `chrome/app/vector_icons/BUILD.gn` — remains the path if Astro
    ever wants distinct branding here.
  - **`METADATA_HEADER` expands to a trailing `private:`.** Every upstream
    subclass re-states ` public:` on the next line; the bubble header did not,
    which is the whole reason its constructor, destructor and `ShowBubble`
    read as private at every call site. That was a missing access specifier,
    not a design problem.
  - **`views::BubbleDialogDelegateView` is deprecated and its constructor is
    private behind a friend list stamped "DO NOT ADD TO THIS LIST!"** New code
    subclasses `views::BubbleDialogDelegate` (public constructor) and puts the
    contents in a separate `views::View` via `SetContentsView`, which is what
    upstream's own `AccountSelectionBubbleDelegate` does. `Init()` is still the
    hook and `CreateBubble` still calls it, so ownership is the identical code
    path. Astro's bubble was migrated and renamed to
    `AstroAdBlockBubbleDelegate` — a class deriving from a delegate must not be
    called `...View`.

  Expect the same drift on the rest of the overlay: this is what defect #7
  above was hiding, not a regression.
- **Nothing fails when a patch stops applying — the whole series applying is
  a measurement, never an assumption.** All 177 apply today (112 ungoogled +
  65 Astro), measured 2026-08-09 by the replay described below: 766 paths named
  by the two series, of which 748 were seeded pristine (735 from `chromium/src`
  HEAD, 13 from DEPS sub-repositories) and 18 are created by the series itself;
  177/177 applied in declared order, no fuzz. That run supersedes the per-patch
  checks 067 and 069 were each admitted on — a patch that applies against a
  pristine tree can still fail in series, which is the whole reason the replay
  runs the series in order rather than one patch at a time.
  `build/reports/patch-report.json` is OLDER than that and says so — it
  records only what the last full run against the real checkout applied: 177
  entries, the newest Astro one `069`, when the series already carried `070` —
  so read the replay, not the report, for whether the series applies. Also,
  `docs/astro-next/policy/endpoints.json` declares the non-applying list
  EMPTY, with the replay that emptied it and the three waves of repairs
  written up there. Read it there rather than here; what belongs here is the
  part that has not changed:

  - The declared list is checked only for "is this name in
    `patches/astro/series`". It has never been able to detect a change of
    apply STATUS, and an empty list makes that sharper, not milder — with
    nothing named, the validator examines zero entries and cannot fail.
  - What keeps the list honest is a replay of both series in declared order
    against a scratch tree holding the pristine version of every file any
    patch names, with `git apply --check --whitespace=nowarn` as the
    acceptance test — the same test `apply-patches.sh` uses. No fuzz, no
    `--3way`, no `--recount`. It needs a Chromium checkout, so no gate runs
    it automatically.
  - The replay must read pristine input from TWO places. Thirteen of the
    files the series touches live inside `gclient`-fetched DEPS subrepos
    recorded as gitlinks, so `git show HEAD:<path>` cannot read them and a
    replay that skips them reports failures that are its own blindness — that
    mistake once produced eight phantom ungoogled failures from a single
    root cause.
  - Two failure shapes recur and look nothing alike. A MALFORMED patch (hunk
    headers whose line counts disagree with their bodies) is rejected against
    any tree at all, so it has never applied anywhere; `--recount` parses it,
    which identifies the cause and is not a fix. A patch generated by diffing
    an ALREADY-PATCHED tree against pristine carries edits belonging to
    somebody else's patch, so it applies to the pristine file and fails in
    series. A per-patch check against a pristine tree calls the second kind
    healthy, which is why the replay runs the series in order.
  - **A patch is broken by editing the patch BEFORE it, and only the replay
    sees that.** Later patches quote earlier patches' inserted lines as
    CONTEXT, so changing what 054 inserts broke 055, 058 and 060 at once —
    and the BUILD stayed green throughout, because the tree had been edited
    directly rather than rebuilt through `apply-patches.sh`. A green browser
    is not evidence that the series still applies. Mutation-tested: reverting
    one context line in 055 fails four patches; restoring it returns
    180/180.
- The two LEGACY pages (`alia`, `whats-new`) still serve their assets by
  reading a directory next to the executable at runtime (`base::DIR_EXE` +
  `resources/astro-<page>`) rather than from a `.pak`, so neither carries
  Chromium's resource-bundling guarantees, and each still renders BLANK, with
  no error, when its directory is missing. Moving them into the app is the
  remainder of #14. It was three; the new tab page left the arrangement when
  it became an entry of the app.

  Pages built on `astro_webui_page.cc` no longer do any of that:
  `067-astro-webui-pak-repack.patch` put `astro_webui_resources.pak` into
  chrome's repack list, and the base serves every page out of the GRIT
  resource map (`AddResourcePaths` plus a `SetDefaultResource` fallback that
  makes client-side routes resolve). Settings and the new tab page are the
  two such pages today.
  The single remaining filesystem path, `astro_webui_dev_source.cc`, is
  compiled only under `astro_webui_dev_tools` — off in every committed
  configuration, so a release binary contains neither the reader nor the
  `--astro-webui-dir` switch that would reach it. That is not a convention:
  `tools/tests/cases/webui-assets-come-from-the-pak.sh` compares the four
  places the guarantee is spelled and fails if any one of them drifts.

  `chrome://adblock` is neither of those two shapes, and is the one page a
  reader will otherwise mis-file. It serves inline strings:
  `CreateAndAddInlineSource` sets `SetDefaultResource(-1)` — the comment on
  that line reads "No grit resource, we use RequestFilter" — beside a
  `SetRequestFilter` whose predicate claims every path. So it is NOT a
  `DIR_EXE` finding and correctly does not appear beside the legacy
  pages in the security baseline: the bytes are compiled into the binary and
  nothing is read off disk. It is also not in the pak, so it carries none of
  the resource-bundling guarantees, and it is the same catch-all-filter shape
  settings was moved away from. Folding it in is cheap and belongs to #14's
  remainder: add the entry to the Vite build, then the controller becomes
  `.resources = kAstroWebuiResources` / `.default_resource =
  IDR_ASTRO_WEBUI_INDEX_HTML` like settings.

  Do not go looking for a grit id to satisfy here. `IDR_ASTRO_ADBLOCK_HTML`
  and the `CreateAndAddHTMLSource` that referenced it were dead code — the
  constructor never called it — and `676c9eb` deleted both, so a `grep` for
  that identifier now returns nothing. Declaring an id for it would have been
  machinery for nobody.

## Branding

`tools/apply-branding.sh` applies `branding/astro.conf` across the tree.
Rules from real defects found in it, not hypotheticals:

- **Discover the `.grd`/`.grdp` files to rename, never hand-list them.** A
  hand-written list of 4 files left the rest untouched, so the browser said
  "Astro" on `about:version` and "About Chromium" in its own settings menu —
  the tree currently has 31 such files. Discovery excludes `*google_chrome*`
  (inert when `google_chrome_branding = false`) and `ChromiumOS` (a
  DIFFERENT product — renaming it invents "AstroOS").
- **Never blanket-substitute `Chromium` → `Astro`.** That rewrites
  `IDS_ABOUT_VERSION_COMPANY_NAME` ("The Chromium Authors") and
  `IDS_ABOUT_VERSION_COPYRIGHT` — a false copyright attribution shipped to
  every user, produced by a substitution that looks purely cosmetic, on a
  codebase whose licence requires the notice be retained. Attribution
  strings are excluded from the rename.
- **A `--dry-run` must exercise the same substitution the real run does, not
  just count matches.** The old dry run counted files and never executed the
  `sed`, so it reported success for an expression `sed` then refused to run
  for real.
- **The in-UI logo is not `chrome/app/theme/chromium/`** — that directory is
  the application/installer icon. The in-UI logo is a `chrome_scaled_image`
  resolved from
  `chrome/app/theme/default_{100,200}_percent/chromium/product_logo_32.png`;
  a non-Google-branded build declares exactly one entry for it,
  `IDR_PRODUCT_LOGO_32`, in `theme_resources.grd`. The scale directories are
  a pixel-size contract — the 200% file must be 64px — and a wrong-size file
  installs cleanly, renders wrong, and reports nothing.

## Key File Paths

### C++ source overlay

```
src/chrome/browser/oxy/
├── oxy_auth_service.*               # Oxy account auth service
├── oxy_auth_callback_handler.*      # Auth callback URL handler
├── oxy_auth_navigation_throttle.*   # Navigation throttle for auth redirects
├── oxy_auth_token_store.*           # JWT token storage
├── oxy_cookie_signin_observer.*     # Cookie observer for auto sign-in detection
├── oxy_alia_side_panel.*            # Alia AI sidebar panel registration
├── adblock/                         # Rust-based ad blocker
│   ├── astro_adblock_engine.*       # Core blocking engine (wraps Rust FFI)
│   ├── astro_adblock_service.*      # Service + factory (KeyedService pattern)
│   ├── astro_adblock_tab_helper.*   # Per-tab ad block state
│   ├── astro_adblock_toolbar_button.* # Toolbar shield icon + bubble
│   ├── astro_adblock_url_loader_throttle.* # Network request interception
│   ├── astro_adblock_filter_list_*  # Filter list catalog + updater
│   ├── adblock_domain_resolver.*    # Domain matching
│   ├── astro_adblock_resource_type.* # Resource type classification
│   ├── webui/astro_adblock_ui.*     # chrome://adblock controller + handler
│   └── rs/                          # Rust source + BUILD.gn
├── astro_pref_names.h               # Astro's own pref paths, as constants
├── astro_theme_service.*            # KeyedService: watches the mode and preset
│   astro_theme_service_factory.*    #   prefs, repaints the native UI, notifies
│                                    #   the pages. Built with the profile.
├── ui/astro_color_tokens.h          # GENERATED from Bloom's tokens.json by
│                                    #   tools/generate-color-mixer.py. Never
│                                    #   hand-edit: a build-safety case
│                                    #   regenerates it and compares.
├── ui/astro_color_mixer.*           # Bloom token -> Chromium ColorId, by hand.
│                                    #   Called last from AddChromeColorMixers
│                                    #   (patch 061); computes no colour.
└── webui/                           # WebUI page controllers
    ├── BUILD.gn                     # The mojom("mojo_bindings") target, the
    │                                #   astro_webui_dev_tools buildflag, and the
    │                                #   Vite -> generate_grd -> grit -> .pak chain
    │                                #   (build_app, build_grd, resources). The
    │                                #   controllers are sources of the parent
    │                                #   target //chrome/browser/oxy:webui_controllers.
    ├── astro_webui.gni              # astro_webui_dev_tools / astro_webui_app_dir.
    ├── astro_webui_dev_source.*     # The ONE disk-serving path, compiled only
    │                                #   when astro_webui_dev_tools is on.
    ├── tools/build_astro_webui_app.py  # The GN action: runs Vite, checks the
    │                                #   emitted set against the committed
    │                                #   manifest.json, stages it for GRIT.
    ├── astro_theme.mojom            # GetTheme + OnThemeChanged. READ ONLY, and
    │                                #   bound by every Astro page.
    ├── astro_settings.mojom         # SetThemeMode / SetColorPreset. Named
    │                                #   methods only — never SetPref(string,…).
    ├── astro_ntp.mojom              # The new tab page's data plane: widgets,
    │                                #   quick links, notes, tiles, search,
    │                                #   the two side panels. Bound by that
    │                                #   page and no other.
    ├── astro_webui_page.*           # Shared base: asset serving (the one seam
    │                                #   #16 replaces), per-host CSP, and the
    │                                #   plain and Mojo controller bases.
    ├── astro_theme_provider.*       # Serves astro_theme.mojom for one page.
    ├── astro_settings_ui.*          # astro://settings controller + config
    ├── astro_settings_page_handler.* # Browser side of astro_settings.mojom
    ├── astro_ntp_ui.*               # chrome://astro-ntp controller + config
    ├── astro_ntp_page_handler.*     # Browser side of astro_ntp.mojom. Owns
    │                                #   the pref watchers, the MostVisitedSites
    │                                #   observer and the TemplateURLService
    │                                #   observer; validates every URL.
    ├── astro_alia_ui.*              # chrome://alia controller
    └── astro_whats_new_ui.*         # chrome://whats-new controller
```

### WebUI frontend pages

```
webui/
├── app/           # WHERE NEW WORK GOES. One Vite + Tailwind v4 + Bloom
│                  #   application serving every astro:// surface, one entry
│                  #   per WebUI host (each host is a separate origin, so the
│                  #   entry is chosen from location.hostname). Built by a GN
│                  #   action into astro_webui_resources.pak and served to
│                  #   astro://settings today; manifest.json is committed and
│                  #   is the authority for what it emits.
├── alia/          # Alia AI Panel
└── whats-new/     # What's New Page
```

`webui/ntp` is GONE, not moved: the new tab page is `app/src/pages/newtab/`
and the old directory was deleted in the same change, along with its
`REQUIRED_WEBUI_PAGES` entry, its `build.sh` staging and its
`merge-for-chromium.ts`. A clean cut, per the no-compat-shim rule — a page
left behind is a page someone edits.

The two legacy pages keep their current from-disk serving until the app
absorbs them; do not start a third one beside them.

### Other directories

```
patches/ungoogled/   # 112 inherited de-Google patches
patches/astro/       # 65 Astro-specific patches (numbered 001-069; 007 and 035
                     #   were removed as empty files, 012 was retired by 060, and
                     #   068 was never written — two agents were landing patches
                     #   at once and 069 was taken to avoid a collision — so four
                     #   numbers are unused)
gn_args/             # GN build args per platform (linux.gn, android.gn, macos.gn, windows.gn, etc.)
branding/            # Logos, icons, astro.conf, .desktop file
tools/               # Build, install, patch, packaging scripts
```

## Settings: Astro serves it, out of the pak

There is still no Astro error page — it was deleted in `c9c4383` and nothing
replaced it. Settings is different: Astro owns it, and as of
`067-astro-webui-pak-repack.patch` it has assets to serve.

HISTORY, because this file used to lie about it. The Mojo settings backend
older revisions of this document described never existed: no `.mojom` was
committed to this repository at any revision before 2026-08-09. What `c9c4383`
removed was a generic `chrome.send` handler carrying six messages and
thirty-four prefs. `AstroSettingsHandler`, `kProfilePrefMappings[]` and the
"add a setting in three steps" recipe all described something never built.

WHAT IS TRUE NOW. `060-settings-webui-takeover.patch` swaps upstream's
`settings::SettingsUIConfig` for `astro::AstroSettingsUIConfig`, under
upstream's own host. The controller binds two typed Mojo interfaces
(`astro_theme.mojom` read-only, `astro_settings.mojom` for the writes) and
adopts four upstream handlers wholesale — `BrowserLifetimeHandler`,
`ClearBrowsingDataHandler`, `SearchEnginesHandler`, `AboutHandler`.

WHERE ITS ASSETS COME FROM. Not a directory beside the executable — that
arrangement is gone, along with the diagnostic document older revisions of
this section described. `//chrome/browser/oxy/webui:build_app` runs
`bun run build` in `webui/app` as a GN action, `generate_grd` and `grit` turn
the emitted set into `astro_webui_resources.pak`, and
`067-astro-webui-pak-repack.patch` adds that pak to `chrome_extra_paks` and
reserves its id range in `tools/gritsettings/resource_ids.spec`, so the bytes
land in `resources.pak`. `astro_webui_page.cc` serves them through
`AddResourcePaths` plus a `SetDefaultResource` fallback, which is what makes
`astro://settings/privacy` resolve to the app document and route client-side.

Measured 2026-08-09 on the applied series: 66 resources in the pak, all 66
inside the shipped `resources.pak`, and `index.html`, `astro_webui.js` and
`astro-webui-style.css` extracted from it byte-identical to what Vite emitted.
`astro-settings` is deliberately NOT in `build.sh`'s `REQUIRED_WEBUI_PAGES` —
the app is an input the BUILD consumes, not a bundle the script stages, and
the only thing `build.sh` checks for it is the `bun install` precondition a GN
action cannot satisfy for itself.

Three things follow that are easy to get wrong:

- **The app needs generated Mojo TypeScript bindings, and they are not in
  this repository.** The action depends on `:mojo_bindings_ts__generator` and
  passes its own `root_gen_dir` down as `ASTRO_MOJOM_GEN_DIR`. Without both
  halves Vite compiles against whichever `gen/` the app's `tsconfig.json`
  happens to name — a different build's, or none, which fails the build
  naming the target that fixes it.
- **`manifest.json` in `webui/app` is committed and is the authority** for the
  set of files the app emits. The action compares the build's output against
  it and stops if they disagree, so a resource set changing is a reviewable
  event rather than a silent repack.
- **A release binary contains no filesystem-reading path at all.**
  `astro_webui_dev_source.cc` and the `--astro-webui-dir` switch exist only
  under `astro_webui_dev_tools`, off in every committed configuration.

WHY THE SAME HOST. `settingsPrivate` and seven other extension APIs are
granted by host pattern in the two `_api_features.json` files, and the pattern
names the settings host — `grep -n 'chrome://settings/\*'` finds six in
`chrome/common/extensions/api/` and two in `extensions/common/api/`. Any other
host gets no bindings, silently. Registering a second
config for the same origin is not an option either:
`WebUIConfigMap::AddWebUIConfigImpl` CHECKs on a duplicate. Swapping the line
is the only shape that satisfies both.

The rest of the direction — one Vite + Tailwind + Bloom application serving
every `astro://` surface, one entry per host, narrow typed Mojo per domain and
never a generic `SetPref(string, value)` — is issues #15, #14, #22, #17 and
#24. Nothing about it is documented here until it exists.

### Theming reaches the native UI

Changing the theme in settings re-colours the browser, not just the page. The
mode is upstream's `browser.theme.color_scheme2`; the Bloom colour preset is
Astro's own `astro.theme.preset`. `AstroThemeService` watches both, pushes the
preset into `astro::AddAstroColorMixers` (patch 061, called last so it wins),
and calls `NotifyOnNativeThemeUpdated()` on the native themes the windows
observe, so they repaint with no restart. Both halves of that last sentence
are load-bearing and the second bullet below is why: dropping the cached
ColorProviders is not what makes an open window repaint.

Five things to know before touching it:

- **One band is still GTK's and it is not a bug in the mixer.** Measured
  2026-08-09 on the built browser: the tabs, toolbar, omnibox, menus and the
  page all take the preset, while the frame band around the tab strip paints
  GTK's colour (`#333333` under Adwaita dark, `#DBD7D3`-ish under Adwaita
  light — it follows `GTK_THEME`, which is how it was identified). The
  ColorProvider resolves `ui::kColorFrameActive` to the preset's `muted`
  correctly; that band is drawn from the GTK frame rather than read from the
  provider. Owned by #24.

- **On Linux the profile always carries a theme supplier, and nobody chose
  it.** `ThemeServiceAuraLinux` installs a `SystemThemeLinux` supplier —
  `ThemeType::kNativeX11` — whenever `extensions.theme.system_theme` names GTK
  or Qt, and `ThemeService` registers that pref with
  `ui::GetDefaultSystemTheme()`, which answers `kGtk` on a GTK desktop. So
  `key.custom_theme` is non-null on every fresh Linux profile. Reading it as a
  boolean — the shape a stand-down guard naturally takes — stands the whole
  mixer down for every Linux user, and looks fine from the pages, which theme
  through Mojo and never consult this key. Ask what KIND of supplier it is;
  `astro_color_mixer.cc` does it with an exhaustive switch so a new upstream
  `ThemeType` is a compile error.
- **`NotifyOnNativeThemeUpdated()` drops the ColorProvider cache globally but
  notifies only its OWN observers, and on Linux the browser windows are not
  among them.** `BrowserWidget::SelectNativeTheme` points every non-incognito
  window at `ui::LinuxUiTheme`'s NativeTheme (GTK or Qt) when one exists;
  incognito stays on `NativeTheme::GetInstanceForNativeUi()`. Notifying one
  instance produces the most misleading state available: every fresh read of a
  ColorProvider is correct — `chrome://theme/colors.css?sets=ui,chrome`
  included — while the open windows keep the pixels they already had and only
  catch up when something else forces a paint, such as a resize. Notify both,
  which is what `ThemeServiceAuraLinux` does when it starts and stops using
  the system theme. Corollary for verification: a colour read through
  colors.css is NOT evidence that a window repainted, and a screenshot taken
  after a resize is not evidence that it repainted on its own.
- **The preset is process-global in v1.** A `ColorProvider` is keyed by
  `ui::ColorProviderKey`, which carries no profile, so with two profiles open
  the last write wins for every window. Recorded on #24, not fixed here.
- **`astro.theme.preset` is spelled in three places** — `astro_pref_names.h`,
  the registration inside `020-register-oxy-prefs.patch`, and
  `pref-ids.ts` — because a patch edits an upstream file and cannot include an
  overlay header. `PrefService::GetString` on an unregistered path returns
  empty rather than failing, so a rename that misses one produces a control
  that moves and changes nothing.
  `tools/tests/cases/theme-pref-ids-match-across-the-boundary.sh` is the only
  thing that compares them.

## The new tab page: an entry of the app, on a typed data plane

`webui/ntp` is deleted. The new tab page is `webui/app/src/pages/newtab/`,
React + Bloom, served from `astro_webui_resources.pak` by `AstroNtpUI` on the
shared `astro_webui_page` base — the same pak, the same shell and the same
BloomThemeProvider as `astro://settings`, which is what makes a colour change
in settings repaint the new tab page live, in every open tab, with no reload.

What it speaks is `astro_ntp.mojom`: `GetState` plus six push callbacks and
eleven named methods. What it replaced was six `chrome.send` messages, a
`data-ntp-prefs` attribute the controller spliced into the `<html>` tag, and
five localStorage keys. Rules that came out of the port:

- **No localStorage anywhere in the page.** The notes, the links, the widget
  order and the chosen search engine are profile prefs now, so the browser can
  see them: it validates a URL before the page renders it as a link, the same
  note is in every window (each WebUI host is its own origin, so localStorage
  never could be), and none of it is lost when the origin's storage is
  cleared. #22 requires it and nothing under `pages/newtab/` writes to it.
- **The search engine is the browser's, not the page's.** The page it replaced
  carried a table of five providers and its own choice, so searching from the
  new tab page and searching from the omnibox used different engines and
  nothing said so. The page now sends a query string and
  `AstroNtpPageHandler::SearchWithDefaultEngine` resolves it against
  `TemplateURLService`; the picker lists the profile's own engines and sets the
  real default, refusing when policy pins it. No search endpoint is spelled
  anywhere in the page.
- **Most-visited tiles come from `ntp_tiles::MostVisitedSites`**, which is
  Chromium's own infrastructure, and NOT in an off-the-record profile — the
  handler does not construct it there at all. `ChromeMostVisitedSitesFactory`
  is a source of `//chrome/browser`, which already depends on
  `//chrome/browser/oxy:webui_controllers`, so the include needs the
  `allow_circular_includes_from` entry patch 063 adds rather than a dependency
  edge that would be a cycle.
- **Every URL is validated in the browser, in both directions.** `IsLinkableUrl`
  admits http and https only, on the way in from the page AND on the way out of
  the pref store — the store is a profile file that can be edited, synced or
  written by an older build, and this is the last place before a URL becomes an
  anchor in a privileged page.
- **Two widgets are declared rather than working, and say so on the card.**
  Weather has no data source: a trusted page may not fetch, and #22 requires a
  browser-process broker with a declared endpoint before one exists. Discover
  is shipped static content, not a feed. Both were already non-functional in
  the shipped browser — weather rendered `--` with no explanation — so the port
  keeps the cards and puts the reason in them. Do not "fix" either by adding a
  fetch to the page; `connect-src 'none'` is on that page deliberately.
- **The customize panel exists because the controls did not.** The old page's
  markup carried a whole settings panel — wallpaper, engine, seven toggles, a
  link editor — and both buttons that were supposed to open it navigated to
  `chrome://settings` instead, which had no new-tab controls either. So the
  prefs were registered, watched and pushed live to a page nobody could
  adjust. The panel is on the new tab page rather than in settings so that
  `astro_ntp.mojom` stays bound by one surface.
- **Reordering is buttons, not drag,** and that is the one interaction the port
  did not preserve. react-native-web forwards no HTML5 drag props, and
  `onLayout` never fires for a className'd component on this NativeWind
  preview's web runtime, so the measurement a pointer-driven drag needs never
  arrives. The buttons are also the only version that was ever reachable from a
  keyboard.
- **Two things the port dropped outright**, both dead: the wallpaper setting
  (`applyWallpaper()` was an empty function, so the control never did anything
  even when it was reachable) and the temperature unit (weather-only, and
  weather has no data). The sidebar's Search/Discover tab pair and its empty
  "Recent" list went too — the tabs moved an indicator and nothing else, and
  the list was never populated by any code path.
- **The NTP prefs are spelled TWICE, not three times** — `astro_pref_names.h`
  and `020-register-oxy-prefs.patch`. There is no TypeScript spelling because
  the page names a decision rather than a pref path, which is the concrete
  benefit of the typed interface over the pref bridge it replaced.
  `tools/tests/cases/ntp-pref-ids-match-the-registration.sh` joins the two
  that remain, strictly, in both directions.

## How to Add a New WebUI Page

1. **Create the controller** (`astro_foo_ui.h` / `.cc`) in `src/chrome/browser/oxy/webui/`:
   - Inherit from `content::WebUIController` (simple page) or `ui::MojoWebUIController` (if Mojo IPC needed)
   - Define a `kAstroFooHost` constant for the URL host
   - Create a `UIConfig` class inheriting `content::DefaultWebUIConfig<AstroFooUI>`
   - Declare a `WebUIPage` and let `astro_webui_page.cc` build the data
     source; do not construct one by hand and do not read assets from disk

2. **Add the sources** to `source_set("webui_controllers")` in
   `src/chrome/browser/oxy/BUILD.gn`. `webui/BUILD.gn` holds the
   `mojom("mojo_bindings")` target, the `astro_webui_dev_tools` buildflag and
   the Vite -> `generate_grd` -> `grit` -> `.pak` chain — add a `.mojom` there
   if the page needs one, and bind it from a `MojoWebUIController`.

3. **Register the config** with a numbered patch to
   `chrome/browser/ui/webui/chrome_web_ui_configs.cc`, following
   `patches/astro/05{4,5,8}-*-webui-register.patch`. If upstream already
   registers the host, the patch must SWAP its line, never add one beside it —
   `WebUIConfigMap::AddWebUIConfigImpl` CHECKs on a duplicate origin and the
   browser dies at startup. A whole-file overlay copy is not an option: that
   was defect #7.

   **A swap is only safe when nothing outside the config names the upstream
   controller's CONCRETE TYPE.** `WebUIController::GetAs<T>()` returns
   `nullptr` on a mismatch rather than CHECKing, and the views layer
   routinely dereferences the result without a null check, so replacing the
   config turns into a browser-process crash rather than a page that fails to
   load. Measured: `read_later_side_panel_web_view.{h,cc}` names
   `ReadingListUI` three times — as the base of `SidePanelWebUIViewT<>`, in a
   `WebUIContentsWrapperT<>` constructed in the ctor, and in an unchecked
   `GetAs<ReadingListUI>()->SetActiveTabURL(...)` that runs on every tab
   switch while the panel is open. `first_run_flow_controller.cc` names
   `IntroUI` twice, one of them behind a `DCHECK` — which compiles out, so
   release crashes where a developer build asserts. Seven other surfaces
   (management, feedback, downloads, history, bookmarks, …) name none.
   Before planning any takeover:
   `grep -rn 'WebUIContentsWrapperT<\|SidePanelWebUIViewT<\|GetAs<' chrome/browser/ui/views/`.
   Frontend line counts cannot see this and rank these surfaces backwards:
   reading-list is the smallest of the eight and structurally the most
   entangled.

4. **Add the build edge.** A `BUILD.gn` under `chrome/browser/oxy/` that
   nothing depends on compiles to nothing, silently — the overlay sat in that
   state until `057-oxy-webui-build-edge.patch`. Check the target is reachable
   from `//chrome/browser/ui/webui:configs`.

5. **Create the frontend** as an entry in `webui/app/` (see above), not as a
   new top-level `webui/foo/`.

6. **Nothing to wire — that is the point.** A page whose frontend is an entry
   in `webui/app` sets `.resources = kAstroWebuiResources` and
   `.default_resource = IDR_ASTRO_WEBUI_INDEX_HTML` on its `WebUIPage`, the
   same two values every Astro page uses, because the whole app is one
   multi-entry build in one `.pak`. There is no path to stage, no directory to
   agree about, and a resource the map names but GRIT did not compile is a
   LINK error rather than a blank page found by a user.

   The two LEGACY pages still work the old way: the controllers read
   `<DIR_EXE>/resources/astro-<page>/`, `tools/build.sh` stages
   `webui/<page>/dist` to exactly that path, and the page name must be in
   `REQUIRED_WEBUI_PAGES` or nothing stages it. Those three things have to
   agree and nothing checks that they do — when the controllers read one path
   and build.sh wrote another, every page rendered blank and the build
   reported success. Do not add a third page to that arrangement.

## WebUI Page URLs

| Page | Internal URL | Displayed as |
|------|-------------|-------------|
| New Tab | `chrome://astro-ntp` | `astro://newtab` |
| Settings | `chrome://settings` | `astro://settings` |
| Alia AI | `chrome://alia` | `astro://alia` |
| What's New | `chrome://whats-new` | `astro://whats-new` |

Settings is Astro's since `060-settings-webui-takeover.patch`, on upstream's
own host and by swapping upstream's registration — see the settings section
above, including the part where it has no assets to serve yet.

The new tab page keeps the host `astro-ntp` and did NOT move to `newtab` when
it was ported, which #22 lists as a requirement. `newtab` is upstream's own
host string and `WebUIConfigMap::AddWebUIConfigImpl` CHECKs on a duplicate
origin, so taking it means swapping a registration rather than adding one —
the whats-new situation below. It also buys nothing yet:
`056-ntp-redirect-to-astro.patch` already points `search::GetNewTabPageURL` at
this host and teaches `IsInstantNTPURL` to recognise it, so every
browser-created new tab lands here and the omnibox already shows `newtab`.
The canonical spelling is settled by the scheme composition of #12; until
then a rename is a CHECK away from a browser that will not start.

`chrome://astro-error` is NOT in this table: the error page was deleted and
nothing replaced it.

`chrome://whats-new` is served by upstream's `WhatsNewUIConfig`, not by
Astro's controller. Astro's host string is byte-identical to upstream's, and
`WebUIConfigMap::AddWebUIConfigImpl` CHECKs on a duplicate origin, so
registering `AstroWhatsNewUIConfig` alongside it crashes the browser at
startup. Taking that host over means SWAPPING the upstream registration line,
not adding one — which is why only the NTP, Alia and the ad blocker appear in
`patches/astro/05{4,5,8}-*-webui-register.patch`.

The `astro://` URL scheme is aliased to `chrome://` via patch `011-astro-url-scheme-alias.patch`.

## WebUI Scheme Composition

Astro composes its internal WebUI scheme (`astro`) and its untrusted
counterpart (`astro-untrusted`) at build time. This is NOT a one-place
setting: the same fact is spelled independently in ten places across the
build, and each was found by a separate, unrelated failure. Fixing some of
the ten and not the rest leaves a browser that is broken in ways neither
the build nor a test suite reports — the list below exists so the next
rename of anything hits fewer of these blind.

1. `content/public/common/url_constants.h` — the scheme all WebUIConfigs
   (125 of them) register under, via `CONTENT_WEBUI_SCHEME_LITERAL`. One
   missed constant in this file (`kChromeUIUntrustedResourcesURL`) made
   `url::Origin::Create` return an OPAQUE origin, so
   `WebUIDataSourceImpl::GetOrigin` CHECK-failed on the first navigation to
   any WebUI page — the loader config for every page walks every registered
   data source.
2. `chrome/common/webui_url_constants.h` + `chrome/common/url_constants.h` —
   189 internal URL literals, composed via `CHROME_UI_URL_PREFIX` /
   `CHROME_UI_UNTRUSTED_URL_PREFIX` (and their UTF-16 `*16` forms).
3. WebUI resource CONTENT, rewritten in `tools/grit/preprocess_if_expr.py`
   via a `--webui-scheme FROM=TO` flag, wired from
   `tools/grit/preprocess_if_expr.gni`. 407 preprocess actions carry it.
4. TypeScript module resolution — `tools/typescript/path_mappings.py` (the
   shared `//resources` keys) and `tools/typescript/ts_library.py`
   (per-target keys). Without it: `TS2307: Cannot find module
   'astro://resources/js/cr.js'`.
5. The rollup bundler's own path validation —
   `ui/webui/resources/tools/bundle_js.gni` normalises caller-supplied
   `external_paths` and `excludes`; `ui/webui/resources/tools/bundle_js_excludes.gni`.
   Symptom: `Invalid absolute path: astro://... is not in |excludes| or
   |external_paths|`.
6. `ui/webui/resources/tools/bundle_js.py` built the absolute host URL as
   `'chrome://%s/' % host`, hard-coded. That is what emitted
   `chrome://settings/strings.m.js` into a bundle whose page CSP then
   refused to load it: no crash, no build failure, the page still rendered
   — found only by reading a real browser console.
7. The wrapper generators `tools/polymer/css_to_wrapper.py` /
   `html_to_wrapper.py` run AFTER `preprocess_if_expr`, so their emitted
   files are born with the scheme already spelled and nothing downstream
   ever rewrites them.
8. Extension API grant patterns in
   `chrome/common/extensions/api/_api_features.json` and
   `extensions/common/api/_api_features.json` — 211 `matches` patterns,
   rewritten in `tools/json_schema_compiler/feature_compiler.py`. These
   GRANT private APIs (`developerPrivate` → extensions, `settingsPrivate` →
   settings, `bookmarkManagerPrivate` → bookmarks). Left unrewritten, the
   bindings are never installed and the affected pages throw
   `TypeError: Cannot read properties of undefined` on first use, while
   otherwise looking correct.
9. A handful of source files bypass preprocessing entirely: exactly one
   `.ts` (`components/security_interstitials/content/resources/connection_help.ts`)
   and seven `.js` under `components/security_interstitials/core/browser/resources/`
   and `components/neterror/resources/`. Fixed by making their imports
   SCHEME-RELATIVE (`//resources/js/util.js`) — Chromium's own supported
   form, identical in behavior to an unmodified Chromium.
10. `content/browser/webui/url_data_manager_backend.cc` — `kAllDirectives`,
   a hard-coded list of sixteen `CSPDirectiveName` values, decides which
   directives a data source's `OverrideContentSecurityPolicy` ever reaches a
   response header. A directive outside that list is STORED and never asked
   for: no error, no warning, and the source reads as if the policy applied.
   `StyleSrcAttr` was outside it, so five controllers, the shared page base
   and the generated security baseline all correctly stated a directive the
   browser did not have — until a provoked `setAttribute('style', …)` applied
   anyway and the browser named `style-src 'self' 'unsafe-inline'` as the
   policy in force. `072-webui-csp-style-src-attr.patch` adds the one line;
   it is byte-identical for any source that does not set the directive.
   Anything that reads a CSP out of Astro's source rather than off the wire
   inherits this blindness, which is why the check is a provoked violation.

Rules that follow:

- Every one of the ten is applied ONLY when the scheme differs from
  Chromium's default, so an unmodified configuration stays byte-identical.
  Preserve that property in anything new touching this list.
- Untrusted must be rewritten BEFORE trusted, everywhere (sort candidates by
  descending source length). Reversed, an untrusted URL silently becomes a
  trusted one — a security boundary crossed by an ordering mistake, not a
  deliberate one.
- Normalise at the ONE point the data passes through, never at the N
  upstream call sites. 190 mapping entries across 116 `BUILD.gn` files were
  normalised inside `ts_library.py` and `bundle_js.gni` rather than edited
  directly, because those `BUILD.gn` files churn with every Chromium roll.
- `WebUIConfigMap::AddWebUIConfigImpl` CHECKs for a duplicate origin. Once
  `kChromeUIScheme` itself reads `astro`, any Astro-side config that
  registers an upstream page under `astro://` a second time crashes at
  startup — `AstroSettingsUIConfig` did this and was deleted. Only pages
  Astro OWNS belong in `RegisterAstroWebUIConfigs()`.
- `tools/policy/webui_scheme_literals.py`, gated by
  `tools/tests/cases/webui-configs-use-the-scheme-constant.sh`, bans a
  hard-coded scheme string in any WebUIConfig construction — it already
  caught an ungoogled patch spelling `"chrome"` by hand. The other eight
  layers above have no such gate yet.

## C++ Conventions

- C++ code follows Chromium style guide (Google C++ style with Chromium extensions).
- All Oxy integrations in self-contained files under `src/chrome/browser/oxy/`.
- Minimal patches to existing Chromium files — surgical hooks, includes, and registrations only.
- Astro's own mojoms live in `src/chrome/browser/oxy/webui/` and are built by
  `mojom("mojo_bindings")` there — `astro_theme.mojom` and
  `astro_settings.mojom` as of 2026-08-09, the first two ever committed to this
  repository. Keep them narrow and per-domain, one named method per decision;
  never a generic `SetPref(string, value)`. After changing one, rebuild the
  affected targets clean rather than incrementally — generated bindings are a
  classic stale-artifact source. A new interface also needs an entry in the
  WebUI frame binder map (`063-astro-webui-mojo-binders.patch`), or the
  controller's `BindInterface` is never called and the page sees a pipe that
  never answers, with no error on either side.

## Development Workflow

### WebUI pages (hot reload)

```bash
cd webui/app && bun run dev          # http://localhost:5178  (strictPort)
cd webui/alia && bun run dev         # Vite default: 5173, or the next free port
cd webui/whats-new && bun run dev
```

Only `webui/app` pins a port, and the two reasons are worth carrying: 5173 is
taken by `~/Oxy/website`'s dev server on this machine, and Vite's default
behaviour on a busy port is to silently take the next one — which already
produced a session that curled another project's app and read its HTML as this
one's. The other two set no port at all, so their numbers depend on start
order. Read the port Vite prints; do not trust a number written down anywhere,
including here.

### Chromium incremental build

```bash
tools/sync-overlay.sh
ninja -C out/Release chrome          # Recompiles only changed files
```

### Full rebuild

```bash
tools/build.sh                       # Release
tools/build.sh Debug                 # Debug
```

## Verification

- **`tools/cdp-navigate.py` is the only sanctioned way to measure
  navigation.** Three different harnesses reported success while measuring
  nothing: a `--headless --dump-dom` run that never navigated to the
  requested URL at all; a run that hung and died at an outer timeout having
  printed nothing, losing every result gathered before it; and a harness
  that read CDP events and discarded them, so a page that loaded but logged
  a refused resource measured as clean — DOM present, title correct, the
  browser's own complaint went straight in the bin. `cdp-navigate.py`
  collects `Log.entryAdded` and `Runtime.exceptionThrown`, prints per-URL as
  it goes, and gives each CDP call its own timeout.
- **A check that can never fail is not a check — prove the negative case
  fires.** A first attempt to provoke a CSP violation used `<script src>`,
  which Trusted Types blocks BEFORE the scheme check runs, so the detector
  reported zero and looked broken rather than clean. `<link
  rel=stylesheet>` reaches the CSP scheme check and is the working
  provocation.
- **A `.pak` stores each resource compressed, so grepping it for a string
  returns zero even when the string is present.** Verify branding by reading
  the live page in a running browser, or by probing for the asset's raw
  bytes directly — PNGs are stored uncompressed inside a `.pak`, so a
  mid-file byte slice does match.
- **`pgrep -f <pattern>` matches the command line of the shell running it**,
  so "is my build still going?" answers YES forever, including after you kill
  it. Reported twice in one session as "STILL RUNNING" about a terminated
  ninja. `pgrep -x ninja` asks about the process instead of about a string
  that necessarily contains itself. Same family as the rest of this section:
  the check's pass and its nothing-was-measured are the same output.
