<!-- Hand-maintained. Design for issue #7. Deliberately modelled on the existing
     tools/overlay.allowlist + tools/sync-overlay.sh mechanism, so a reader who
     knows one knows the other. -->

# The upstream allowlist and the downstream-delta report

#7 requires "a documented allowlist of Chromium-owned files that may call Astro"
and "a presubmit check that lists or rejects Chromium-owned changes outside the
allowlist", plus "a generated downstream-delta report".

This repository already has a working instance of that idea for a different
subject — `tools/overlay.allowlist` + `tools/sync-overlay.sh` — and the design
below is deliberately the same shape, because a second mechanism that is *nearly*
the same is worse than one that is exactly the same.

---

## 1. What the existing mechanism does, and what carries over

`tools/sync-overlay.sh` parses `tools/overlay.allowlist` in `load_allowlist()`
(`tools/sync-overlay.sh:102-136`) and matches every candidate path against it in
`match_allowlist_index()` (`:146-171`). Five properties are worth carrying over,
and one is worth dropping.

**Carry over:**

1. **`<kind> <path> [key=value ...]`**, comments stripped, blank lines ignored,
   absolute paths and `..` rejected (`:117-119`). A trivially parseable format that
   is also a readable document.
2. **Required attributes per kind.** `overwrite` entries must carry `owner=` and
   `issue=` or the parse dies (`:120-129`). An exception with no owner is not an
   exception, it is a leak.
3. **Exactly one match, or die.** `match_allowlist_index()` sets a global and
   `astro::die`s when nothing matched (`:164-170`), with a message that names the
   offending path and says what to do. The comment above it explains why a global
   rather than an echo — `astro::die` inside a command substitution kills only the
   subshell. That trap is real and the new checker must not reintroduce it.
4. **An empty allowlist is a failure**, not a permissive default
   (`:135`: `[ "${#ALLOW_PATH[@]}" -gt 0 ] || astro::die`). This is the vacuity
   floor. Without it, a checker whose allowlist failed to load reports "no
   violations" and reads exactly like a pass.
5. **Collision declaration.** `assert_declared_collisions()` (`:194`) requires an
   entry to name every patch that also touches the file. The general principle —
   *two mechanisms writing the same destination must be declared, not discovered* —
   survives the removal of patches, and reappears in §4 below.

**Drop:** the `overwrite` kind, and with it `conflicts-with=`. In the new
architecture nothing copies a file over an upstream file, so a "declared
overwrite" has no meaning. Its one live entry —
`chrome/browser/ui/webui/chrome_web_ui_configs.cc` — is removable outright: see
[`minimum-chromium-hooks.md`](minimum-chromium-hooks.md) §C1, which establishes
that `WebUIConfigMap` is a public runtime embedder API and the file never needed
to be touched.

---

## 2. `tools/upstream.allowlist`

A new file, alongside the existing one, declaring **every Chromium-owned file the
integration branch is permitted to modify**.

```
# upstream.allowlist — the complete, declared set of Chromium-owned files the
# Astro downstream integration branch may modify, and the shape each change is
# permitted to take.
#
# tools/check-upstream-delta.sh compares the integration branch against its
# locked upstream merge base and fails on:
#   * any modified Chromium-owned file with no entry here;
#   * any entry whose actual diff exceeds its declared shape;
#   * any entry that no longer differs at all (a stale declaration);
#   * any NEW file added under a Chromium-owned path.
#
# Format:  <shape> <path> owner=<team> issue=<n> [max-added=<n>] [note="..."]
#
#   gn-append   A GN file that gains an import() of an Astro-owned .gni and
#               appends Astro-owned list variables to existing lists. No new
#               target, no new source, no conditional on an Astro value.
#
#   include-rule  A checkdeps DEPS file that gains "+astro" entries and nothing
#               else. include_rules only; no other key may change.
#
#   call-hook   A .cc/.h that gains #include lines for astro/ headers and calls
#               into the astro:: (or oxy::) namespace. No other statement may
#               change, and no line may be REMOVED.
#
# max-added bounds the added-line count. It is not a style rule: it is what makes
# "a small call" checkable rather than aspirational. Raising one is a reviewed
# change to this file, which is the point.
#
# There is deliberately no shape that permits removing an upstream line. The
# single historic exception is on record: 007-oxy-auth-build-hook.patch was 7
# added lines against 36 REMOVED, and the removals stripped Safe Browsing
# notification content detection, accessibility, Screen AI, the preloading model,
# enterprise interstitials and the dangerous-download UI. See
# docs/astro-next/baseline/findings.md section 1. A removal is not a hook, and
# this file cannot express one.

# --- Phase 1 (#7): the minimum needed to build and reach //astro -------------

gn-append    chrome/browser/BUILD.gn                 owner=oxy-browser issue=7 max-added=3
include-rule chrome/browser/DEPS                     owner=oxy-browser issue=7 max-added=1
call-hook    chrome/browser/chrome_browser_main.cc   owner=oxy-browser issue=7 max-added=2
```

Later phases append entries as their issues land; the pre-declared set is in
[`minimum-chromium-hooks.md`](minimum-chromium-hooks.md) §B. They are **not**
added now — an allowlist entry for a hook that does not exist yet is a permission
granted in advance, which is how `008-os-crypt-visibility.patch` came to grant a
privilege to a target that was not in the build (findings §1).

### Why the shape, and not just the path

A path-only allowlist answers "may this file be touched" and not "how much". That
is the weaker half of the question. `007` would have passed a path-only allowlist:
`chrome/browser/BUILD.gn` is exactly the file a build hook should touch. What it
would not pass is `gn-append max-added=3` with no removal shape available.

---

## 3. `tools/check-upstream-delta.sh`

One script, three outputs, run in CI and locally. Sources
`tools/lib/astro-common.sh` like every other script in `tools/`
(`AGENTS.md`: "Shared helpers live in `tools/lib/astro-common.sh`").

### Inputs

- `browser.lock.json` → `chromium.commit` (the upstream base) and
  `chromium_downstream.commit` (the branch head). See
  [`astro-checkout-mechanism.md`](astro-checkout-mechanism.md) §2.
- `tools/upstream.allowlist`.
- The Chromium checkout, resolved through `astro::resolve_chromium_src`
  (`tools/lib/astro-common.sh:472`) — never a raw path, per `AGENTS.md`.

### The measurement

```bash
git -C "$CHROMIUM_SRC" diff --numstat "$UPSTREAM_BASE".."$DOWNSTREAM_COMMIT"
```

`--numstat` gives added, deleted and path per file in one pass, which is exactly
the three facts each rule needs. `--diff-filter` separates modifications from
additions and deletions, and each gets a different verdict:

| git status | Verdict |
|---|---|
| `M` with an allowlist entry, within its shape | pass |
| `M` with an allowlist entry, outside its shape | **fail**, naming the entry and the excess |
| `M` with no entry | **fail**, naming the file |
| `A` (new file under a Chromium-owned path) | **fail** — Astro source belongs in `//astro`; `git diff` against the base cannot see files under `astro/`, since `//astro` is a separate checkout gclient places at `src/astro`, so this can only be an Astro file in the wrong place |
| `D` | **fail** unconditionally. There is no shape that deletes an upstream file |
| `R` / `C` | **fail** — a rename is a delete plus an add |

### The four checks, and the failure each is for

1. **Undeclared modification.** The rule #7 asks for.
2. **Shape violation.** `max-added` exceeded, any line removed, or a `call-hook`
   whose added lines are neither an `astro/` include nor a call into `astro::` /
   `oxy::`. This is the check that would have caught 007.
3. **Stale entry** — an allowlist entry naming a file the branch no longer
   modifies. Fails, because a permission nobody uses is a permission nobody
   reviews, and it silently pre-authorises whatever lands there next. The existing
   codebase already treats this as load-bearing: findings §11 records that two of
   the repository's five `astro-allow:` markers had never suppressed anything, and
   the suite now asserts all five are load-bearing precisely so a decorative
   exception cannot masquerade as a reviewed one.
4. **Vacuity floor.** The check must refuse to report success when it measured
   nothing. Concretely, it fails unless *all* of: the allowlist parsed at least one
   entry; both commits resolve; and `git diff --numstat` produced at least one
   line. A downstream branch with an empty diff is not a pass — it means the hooks
   are missing, which is findings §1's state, and findings §1 is the record of
   that state being invisible for a long time. Related and exactly parallel:
   findings §7, where `gn check` against a directory with no build graph reports
   `0 errors`, which reads exactly like "clean".

### Mutation test, required before this is a gate

`AGENTS.md`'s own rule — a check that cannot distinguish success from failure is
worse than no check. Before `check-upstream-delta.sh` is wired into CI, each of
the four checks must be shown to fail on a deliberately broken input **and to name
the offending path**, and to pass on the good one. Six fixtures, in
`tools/tests/cases/`, following the existing suite's conventions:

| Fixture | Must fail with |
|---|---|
| touch `chrome/browser/about_flags.cc` | *undeclared file* |
| add 40 lines to `chrome/browser/BUILD.gn` | *shape: max-added=3 exceeded* |
| remove one line from `chrome_browser_main.cc` | *shape: removal not permitted* |
| add `chrome/browser/oxy/foo.cc` | *new file under a Chromium-owned path* |
| allowlist entry for an unmodified file | *stale entry* |
| empty allowlist / empty diff | *vacuity: nothing was measured* |

`tools/tests/run.sh` runs without a Chromium checkout (`AGENTS.md`), so these
fixtures are synthetic git repositories, the way the existing cases are. That is
also their limit, and worth writing down: a synthetic fixture cannot reproduce a
400,000-file tree, and `AGENTS.md` records that the `find | head` SIGPIPE hazard
"never fired on the synthetic fixtures because `find` always finished first" —
so the diff must be obtained from `git`, which is exact and cheap, and the
producer must never be piped into `head`.

### Reporting mode

`--report` prints the delta and exits 0 regardless. That is what a PR description
pastes, and what #7 means by "lists or rejects": the same tool does both, and the
listing is derived from the same measurement as the rejection, so the two cannot
disagree.

---

## 4. The generated downstream-delta report

`docs/astro-next/architecture/downstream-delta.md`, generated — never
hand-edited, carrying the header the baseline documents already use
(`AGENTS.md`: "Never hand-edit a file whose header says it is generated").

Contents:

- The two commits it was taken between, and the upstream version string.
- One row per modified Chromium-owned file: path, `+added/-deleted`, declared
  shape, owner, issue.
- The full diff, inline. At this size the delta *is* the report; a summary that
  omits the text would have to be trusted.
- Totals, and a restatement of the deletion count. **The total-deleted line
  belongs in the report even though the checker forbids deletions**, because a
  reader should be able to confirm it is `0` rather than infer it from a rule.

CI runs the generator with `--check` and fails on any diff, which is the
arrangement `tools/baseline/generate-all.sh --check` already uses. This is where
the "declared collisions" principle from §1 reappears in its new form: the report
is derived from the branch, the allowlist is derived from review, and the check
is that they agree.

**Placement note.** Generating into `docs/astro-next/architecture/` rather than
`docs/astro-next/baseline/` is deliberate: `tools/baseline/generate-all.sh:31`
scopes itself to `BASELINE_DIR`, and the baseline is a frozen record of the
*legacy* system taken for #6. The delta report tracks live architecture. Mixing
them would make `generate-all.sh --check` fail whenever the architecture moved,
for reasons unrelated to the baseline.

---

## 5. What this does not cover, said plainly

- **It cannot see behavioural equivalence.** A three-line hook that calls into
  `//astro` and thereby changes what Chromium does is inside every rule here. The
  allowlist bounds the *surface*; what happens behind `astro::` is #10's feature
  matrix and #26's test matrix.
- **It cannot see `//astro` itself.** By construction: `//astro` is a separate
  checkout and does not appear in `git diff <base>..<head>` of the Chromium
  repository. Astro-internal layering is a `//astro/DEPS` `include_rules` matter
  (see [`astro-module-layout.md`](astro-module-layout.md)), enforced by
  `checkdeps`, not by this tool.
- **It cannot see a GN arg change.** `gn_args/*.gn` is Astro-owned and outside
  the Chromium repository, yet a single value there changes the browser more than
  any hook in the allowlist. `tools/lib/gn_args_drift.py` already exists for
  exactly this and is already run by `tools/build.sh` (findings §2). The two
  reports are complementary and neither substitutes for the other.
