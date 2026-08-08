# Astro Next baseline

An evidence-based record of what Astro is today, taken before its
architecture is replaced, so that a later change can be classified as an
intentional product decision or as an accidental regression.

Issue [#6](https://github.com/OxyHQ/Astro/issues/6) (ASTRO-NEXT-003), under
epic [#3](https://github.com/OxyHQ/Astro/issues/3). Later issues cite this
directory as their compatibility reference, which is the whole reason it
distinguishes carefully between what has been measured and what has not.

## What is here

| Document | Kind | Produced by | Holds |
|---|---|---|---|
| [`source-inventory.md`](source-inventory.md) | generated | `tools/baseline/inventory_sources.py` | What this baseline was taken from: the locked revisions, and what is declared rather than measured |
| [`patch-inventory.md`](patch-inventory.md) | generated | `tools/baseline/inventory_patches.py` | Every patch in series order with its files, hunks, purpose and disposition |
| [`patch-dispositions.json`](patch-dispositions.json) | hand-maintained | — | The judgement half of the patch inventory: what each patch is for and whether it is kept, replaced, removed or still to be investigated |
| [`pref-dispositions.json`](pref-dispositions.json) | hand-maintained | — | The judgement half of the preference registry: what each Astro-owned preference is for, and whether it belongs to the reproducible baseline or is a candidate preference observed only in a working tree |
| [`platform-matrix.md`](platform-matrix.md) | generated | `tools/baseline/inventory_gn_args.py` | GN args across every platform configuration, and the keys that disagree between them |
| [`security-baseline.md`](security-baseline.md) | generated | `tools/baseline/inventory_webui_security.py` | Per-WebUI CSP directives, Trusted Types and remote content, read from the controller sources |
| [`network-inventory.yaml`](network-inventory.yaml) | generated | `tools/baseline/inventory_endpoints.py` | Endpoints referenced in source and patch text. Static today: it carries `measured: false` and says so |
| [`feature-matrix.md`](feature-matrix.md) | hand-maintained | — | 145 product behaviour scenarios with steps, expectation, result and whether the behaviour is contractual or incidental |
| [`screenshots.md`](screenshots.md) | hand-maintained | — | The UI reference set: which surfaces and states to capture, and the exact conditions to capture them under |
| `README.md` | hand-maintained | — | This index |

Generated documents carry a header saying so. Do not edit one by hand: the
next regeneration discards the edit, and the check below fails in the
meantime. Fix the tool, or — for a patch's purpose and disposition, which
cannot be derived from a diff — fix `patch-dispositions.json`, which the
inventory joins in strictly and which fails generation in both directions.
`pref-dispositions.json` is the same shape for preferences: the names are
parsed out of the committed patch stack, the judgement is declared, and the
join fails in both directions. Its `observed-local-only` entries each assert
that the committed stack does **not** register that preference, so the day
that work lands the join fails naming every one of them rather than letting
the record quietly become untrue.

Hand-maintained documents must not restate a figure a generated document
owns. A count copied out of `patch-inventory.md` into this file would go
stale without anything noticing, because only the generated set is checked.

## Every generated document is derived from committed state

This is the rule the generators enforce, and it is not a style preference:

> A generated document is a function of `HEAD` and nothing else. No generator
> reads the working tree for anything that reaches a committed artefact.

Without it, `--check` is worthless. The generators originally read files off
disk, so a baseline produced on a machine carrying uncommitted work embedded
that work, `--check` passed *there*, and a clean checkout regenerated
different documents — meaning the check failed for everyone else, naming
content they had never seen.

The damage was not hypothetical. Measured on one such tree, the committed
documents asserted all of the following about a repository in which none of it
was true:

- `security-baseline.md` credited **four** WebUI controllers with loading
  remote fonts; only two do. `astro_error_ui.cc` and `astro_whats_new_ui.cc`
  acquired `fonts.gstatic.com` in uncommitted work, and several `ImgSrc` and
  `ScriptSrc` directive values were the uncommitted versions.
- `network-inventory.yaml` listed those same two files as references to
  `fonts.gstatic.com`.
- `platform-matrix.md` reported **five** GN findings that do not exist in the
  repository: `safe_browsing_mode` and `build_with_tflite_lib` as keys whose
  value disagrees between platforms, `enable_supervised_users` with the wrong
  value on `windows_arm64`, and `enable_rlz_support` and
  `fatal_linker_warnings` as set on one platform only.
- `source-inventory.md` put the overlay at 3,992,504 bytes — the working-tree
  `stat` sizes. The committed blobs total 3,973,982.

Each of those is the shape of finding a later issue would cite as evidence that
something needs fixing, or as evidence that it already was.

Every read that feeds a committed artefact therefore goes through
`tools/baseline/committed_state.py`, which reads `HEAD` via git and **fails
loudly** rather than falling back to the filesystem. Falling back silently is
how the bug happened.

This applies to `test/astro-next/fixtures/` too, which is generated and
committed on the same terms.

**The workflow consequence, which is real:** commit the source change first,
then regenerate and commit the documents. Regenerating before committing the
source produces documents that describe the *previous* revision, and CI —
which regenerates at the merge commit — then reports drift. Two commits, or a
regenerate-and-amend, both work.

Working-tree differences are not swept away; they are reported **separately**,
never merged in. Each generator prints a `WORKING-TREE DELTA` block to stderr
and records the same data in its JSON under `build/reports/` (gitignored). It
is a set difference, not a count — paths present in the working tree and absent
from `HEAD`, paths present in `HEAD` and deleted, and paths present in both
whose content differs, the last with line counts. The point of the report is
that someone can see at a glance which baseline findings would change if the
uncommitted work landed.

An uncommitted overlay file is copied into Chromium by a local build and is
absent from a fresh clone, so two people building "the same" revision get
different browsers — worth saying out loud on every run, and worth keeping out
of a document that describes the clean checkout.

`inventory_webui_security.py` has a `--worktree-source DIR` mode for pointing
the detectors at a constructed directory. It announces itself on stderr and
**refuses** `--markdown`: a warning is something a script pipes to
`/dev/null`, so the committed document is unreachable from that mode rather
than merely discouraged.

`inventory_gn_args.py` additionally reports its working-tree delta **per key**,
not per file. "`gn_args/linux.gn` changed" is not the useful statement, because
this document's findings are per key: the report names the platform, the key,
the committed value and the working-tree one, so a reader can see which entry
in the matrix would move.

## Regenerating

```sh
tools/baseline/generate-all.sh          # regenerate in place
tools/baseline/generate-all.sh --check  # regenerate; fail on any diff
```

`--check` regenerates into a scratch copy and diffs, so it is safe to run
against a checkout carrying unrelated uncommitted work, and it restores what
was committed if it finds drift.

CI runs it. The **Build safety** workflow has a `Check the Astro Next
baseline is current` step, so a change to a patch, a GN arg or a WebUI
controller that is not reflected in the committed documents fails the pull
request rather than silently ageing. `tools/tests/run.sh` additionally
mutation-tests the check itself, in
`tools/tests/cases/baseline-documents-are-current.sh`: it drifts a committed
document deliberately and asserts the check fails and names the file. A
drift check nobody has seen fail is indistinguishable from one that cannot
fail.

The same case is the regression test for the committed-state rule above. It
plants content in two real working-tree files that between them feed four
generators — a WebUI controller and a patch — regenerates, and asserts the
whole baseline directory is byte-identical and that `--check` still exits 0.
Comparing the directory rather than grepping for the planted marker is
deliberate: it catches a leaked count or byte size just as well as leaked
text. The planted files are restored from a pristine byte copy on any exit,
written in place, never with `git checkout` — the targets may carry a
developer's uncommitted work.

That gate covers the generated set only. The two hand-maintained documents
are work lists rather than derivations, and nothing can machine-check
whether their contents are still true — which is exactly why every
unmeasured field in them says so in as many words.

## What is captured, and what is not

| Area | State | Where |
|---|---|---|
| Locked source revisions | recorded, as declarations rather than measurements | `source-inventory.md` |
| Patch inventory and dispositions | generated from the series files and the disposition file | `patch-inventory.md` |
| GN args per platform, and their inconsistencies | generated from `gn_args/` | `platform-matrix.md` |
| WebUI CSP, Trusted Types and remote content | generated from the controller sources | `security-baseline.md` |
| Endpoints referenced in source and patches | generated, and explicitly **static, not measured** | `network-inventory.yaml` |
| **Product behaviour** | **not captured** — every scenario, no exceptions | `feature-matrix.md` |
| **Screenshots** | **not captured** — no images committed | `screenshots.md` |
| **A measured network trace** | **not captured** — needs a running browser behind a recorder | `network-inventory.yaml` |
| **Runtime security behaviour** — effective origins, process locks, incognito behaviour | **not captured** — the committed security baseline is static analysis of the sources | `security-baseline.md` |
| **Smoke run results** | **not captured** — no build to run against | `build/reports/smoke-report.json` |
| Profile fixtures | partly generated; entries whose format Chromium owns are deferred with the command that captures them | `test/astro-next/fixtures/` |

The single cause of every gap is the same: there is no built Astro on the
machine this baseline was assembled on, and no Chromium checkout to build
one from. Everything derivable from the repository has been derived;
everything requiring a running browser is marked as absent rather than
estimated.

An invented result would not be caught. It would be cited, argued from, and
eventually used to dismiss a real regression — so a gap is recorded as a
gap.

### What unblocks the rest

```sh
tools/sync-sources.sh                             # locked revisions
tools/sync-ungoogled.sh                           # stage ungoogled patches
tools/apply-patches.sh --skip-domain-substitution # 168 patches, in order
tools/sync-overlay.sh                             # copy the Astro overlay
tools/build.sh Release linux                      # build
tools/baseline/smoke.sh                           # structured smoke report
```

`--skip-domain-substitution` is required rather than optional: domain
substitution has never run, and `apply-patches.sh` refuses instead of
pretending. Both that and the overlay collision that reverts four patches
change what a capture means; `feature-matrix.md` opens with both, and any
recorded result must say which state the build was in.

## Related, outside this directory

| Path | What it is |
|---|---|
| `tools/baseline/` | The generators, the fixture builder and the smoke runner |
| `tools/baseline/committed_state.py` | The single seam through which every generator reads `HEAD`. Fails loudly rather than falling back to the working tree, and supplies the working-tree observation report |
| `tools/baseline/smoke.sh` | Launches a clean build, navigates a representative URL set, writes `build/reports/smoke-report.json`. Refuses to write a report it did not measure |
| `tools/baseline/make_profile_fixtures.py` | Builds the synthetic profile fixtures, splitting what it can derive from what needs a browser capture |
| `test/astro-next/fixtures/` | The fixtures themselves, containing test data only |
| `build/reports/` | Machine-readable output: the inventories in JSON, the smoke report, provenance. Gitignored, because it describes one machine's run |
| [`../../reproducibility.mdx`](../../reproducibility.mdx) | The source lock and build provenance a recorded result must cite |
| [`../../recovery.mdx`](../../recovery.mdx) | Getting a checkout back to a known state when a patch run stops |

## Adding to this directory

A new document is either generated or hand-maintained, and the choice is not
stylistic. Anything derivable from the repository must be generated and
wired into `generate-all.sh`, so the CI check keeps it honest. Anything that
is a judgement or a work list is hand-maintained, and must state plainly
which of its contents are measured and which are not.
