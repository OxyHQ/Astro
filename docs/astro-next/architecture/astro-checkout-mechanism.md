<!-- Hand-maintained. Design for issue #7; nothing here has been applied to the
     repository. Every claim about gclient behaviour was measured against the
     pinned depot_tools, and the probe is reproduced at the end. -->

# The exact mechanism for `//astro` as a deterministic checkout

Implements decision **A1** of
[`ADR-0001`](ADR-0001-chromium-integration-model.md). This document is the
concrete config and command set, written against the machinery this repository
already has: `browser.lock.json`, `tools/gclient.template` and
`tools/sync-sources.sh`.

Nothing here has been applied. It is the design #7 implements.

---

## 1. What already exists, and why it fits

| Existing piece | What it already does | What #7 adds |
|---|---|---|
| `browser.lock.json` | Full-SHA pins for chromium, depot_tools, ungoogled (`browser.lock.json:6-30`) | two new top-level entries: `astro` and `chromium_downstream` |
| `browser.lock.schema.json` | `$defs/sha` rejects anything but 40 lowercase hex (`browser.lock.schema.json`, `$defs`) | schema entries for the two new sections; the SHA rule is reused unchanged |
| `tools/gclient.template` | The committed source of `.gclient`, with `@CHROMIUM_URL@` / `@TARGET_OS@` placeholders | one more placeholder, `@CUSTOM_DEPS@` |
| `tools/sync-sources.sh:500-541` | Renders the template, and under `--verify-only` **fails if `.gclient` on disk differs** | the render gains the custom_deps block; the existing comparison then gates the Astro pin for free |
| `tools/sync-sources.sh:318-469` | `sync_repository()` — detached checkout at a locked commit, with the dirty/branch/artifact guards | reused verbatim for the downstream Chromium repository |
| `tools/sync-sources.sh:576` | `gclient revinfo --output-json=…/deps-revinfo.json` | already records `src/astro`; measured below |

The important property: **`--verify-only` already compares the rendered template
against the file on disk and dies on a mismatch** (`tools/sync-sources.sh:526-541`).
Putting the Astro pin into the template means the existing gate covers it, rather
than a new gate having to be written and then remembered.

## 2. Lock additions

Two entries, because two revisions have to agree.

```jsonc
  // The //astro module. Placed at chromium/src/astro by gclient; addressed as
  // //astro by GN. Not a patch input and not an overlay: a normal git checkout
  // that gclient owns.
  "astro": {
    "commit": "<40 hex>",
    "url": "https://github.com/OxyHQ/astro-module.git",
    "path": "src/astro",
    "note": "The gclient path is authoritative for GN's // label: src/astro -> //astro. Changing it changes every Astro GN label."
  },

  // The Chromium downstream integration branch. Carries ONLY the hooks listed
  // in docs/astro-next/architecture/minimum-chromium-hooks.md.
  //
  // `upstream_base` MUST equal chromium.commit. tools/sync-sources.sh asserts
  // `git merge-base --is-ancestor <upstream_base> <commit>` and that
  // upstream_base == chromium.commit, because a downstream branch based on the
  // wrong upstream builds perfectly well and is wrong silently.
  "chromium_downstream": {
    "commit": "<40 hex>",
    "upstream_base": "ae03f7fb2cf1215853896d6a4c15fdceee2badb7",
    "url": "https://github.com/OxyHQ/chromium.git",
    "ref": "refs/heads/astro-next"
  }
```

Schema notes, so the validator does not have to be re-derived later:

- Both `commit` fields reuse `#/$defs/sha`; both `url` fields reuse `#/$defs/url`
  (which already permits `file://` for fixtures, per its own description).
- `chromium_downstream.upstream_base` is a `sha`, and `lock.py` gains one
  cross-field check: it must equal `chromium.commit`. That is the only
  cross-field rule in the lock, and it earns its place — it is the difference
  between "pinned" and "pinned to the thing we think".
- `lock.py`'s `revisions()` (`tools/lib/lock.py:202-218`) enumerates a fixed tuple
  `("chromium", "depot_tools", "ungoogled_chromium")`. Both new names must be
  added there, or they are absent from every revision listing, from the sync
  banner (`tools/sync-sources.sh:591-602`) and from provenance — pinned but
  invisible, which is the worst of both.

**`chromium.url` changes meaning.** Once a downstream branch exists,
`tools/sync-sources.sh` fetches Chromium from `chromium_downstream.url` and checks
out `chromium_downstream.commit`. `chromium.url` / `chromium.commit` stay in the
lock as the **upstream identity being tracked** — what the version is, what the
merge base must be, what `tools/update-chromium.sh` resolves and what
`--check-remote` re-verifies against `chromium.googlesource.com`. They stop being
the thing checked out. That distinction must be written into the schema
descriptions, or a later reader will "fix" the apparent inconsistency.

## 3. `tools/gclient.template`

One added placeholder. The rest of the file, including the `managed = False`
rationale, is unchanged:

```python
solutions = [
  {
    "name": "src",
    "url": "@CHROMIUM_URL@",
    "managed": False,
    # custom_deps ADDS dependencies the solution's own DEPS does not declare;
    # it is not limited to overriding existing ones. See
    # depot_tools/gclient.py:698-711. This is how //astro enters the checkout
    # without a single Chromium-owned file changing.
    "custom_deps": {
@CUSTOM_DEPS@
    },
    "custom_vars": {},
  },
]
target_os = [@TARGET_OS@]
```

`render_gclient()` (`tools/sync-sources.sh:500-520`) already substitutes
placeholders with a small inline Python block. It gains one substitution:

```
@CUSTOM_DEPS@  ->  '      "src/astro": "<astro.url>@<astro.commit>",'
```

built from `astro.path`, `astro.url` and `astro.commit` — never string-built from
flags, which is the defect the template's own header records replacing.

## 4. `tools/sync-sources.sh` — the ordered changes

The script's existing structure is: validate lock → depot_tools → Chromium →
render `.gclient` → `gclient sync` → ungoogled → report. Five insertions, in that
frame:

1. **After the lock is read** (`tools/sync-sources.sh:117-125`), read the two new
   entries. Under `--verify-only`, assert
   `chromium_downstream.upstream_base == chromium.commit` before touching disk.
   A lock that disagrees with itself must fail before any network access.

2. **Chromium checkout** (`tools/sync-sources.sh:492`) changes one argument set:
   `sync_repository "$CHROMIUM_SRC" "$DOWNSTREAM_URL" "$DOWNSTREAM_COMMIT"
   "$DOWNSTREAM_REF" "chromium"`. All the guards — the pristine/attributable
   check, detached-HEAD enforcement, the `.rej`/`.orig` scan, the retrying
   fetch — apply unchanged.

3. **Immediately after that checkout**, the merge-base assertion. This is a new
   check and the one most worth writing carefully, because its failure mode is
   silent:

   ```bash
   if ! git -C "$CHROMIUM_SRC" merge-base --is-ancestor \
            "$CHROMIUM_COMMIT" "$DOWNSTREAM_COMMIT"; then
       astro::die_with_hint \
           "The downstream branch is not based on the locked Chromium commit." \
           "  locked upstream:   $CHROMIUM_COMMIT" \
           "  downstream commit: $DOWNSTREAM_COMMIT" \
           "" \
           "A downstream branch based on a different upstream builds without" \
           "complaint and is wrong silently. Rebase the integration branch onto" \
           "the locked commit and re-pin it."
   fi
   ```

   `--is-ancestor` needs both commits reachable. `ASTRO_FETCH_DEPTH` defaults to
   `1` (`tools/sync-sources.sh:246`), so a depth-1 fetch of the downstream branch
   **cannot** answer this. The fetch of the downstream ref must be deep enough to
   reach the merge base — `--shallow-since` or an explicit
   `git fetch origin "$CHROMIUM_COMMIT"` alongside the branch fetch. This is a
   real interaction between two existing decisions and is the single most likely
   thing to be got wrong; a check that cannot be evaluated must fail, not pass.

4. **`.gclient` render** (`tools/sync-sources.sh:526-541`) — no structural change.
   The Astro pin now travels inside the rendered text, so a `.gclient` on disk
   carrying a stale Astro SHA fails `--verify-only` with the existing message.

5. **After `gclient sync`** (`tools/sync-sources.sh:557-577`), verify `//astro`
   the same way Chromium is verified at `:561-567`:

   ```bash
   astro_head="$(git -C "$CHROMIUM_SRC/astro" rev-parse HEAD)"
   [ "$astro_head" = "$ASTRO_COMMIT" ] || astro::die_with_hint \
       "//astro is not at the locked commit." \
       "  locked:  $ASTRO_COMMIT" \
       "  on disk: $astro_head"
   ```

   Under `--verify-only` — which never runs `gclient sync` (`:549-550`) — this
   same comparison runs directly against the existing checkout, so a stale
   `src/astro` on a cached runner fails before `gn gen`, which is #7's
   "a missing or wrong Astro revision fails before GN generation."

`--dry-run` and `--no-deps` need no new semantics: the new checks are reads.

## 5. Commands

Bootstrap, from an empty tree — unchanged from what `AGENTS.md` documents:

```bash
tools/sync-sources.sh          # depot_tools, downstream Chromium, //astro, DEPS
tools/build.sh                 # gn gen + compile
```

Verification, which is what CI runs:

```bash
tools/sync-sources.sh --verify-only
```

Re-pinning `//astro` after a module change:

```bash
git -C chromium/src/astro rev-parse HEAD          # the new SHA
# edit browser.lock.json: astro.commit
tools/sync-sources.sh                             # re-syncs and re-verifies
```

Chromium version bump — `tools/update-chromium.sh VER` gains a second phase:

```bash
tools/update-chromium.sh 147.0.XXXX.YY      # resolves ONE upstream commit -> lock
git -C chromium/src rebase --onto <new-upstream-commit> <old-upstream-commit> astro-next
git -C chromium/src push origin astro-next
# edit browser.lock.json: chromium_downstream.commit AND upstream_base
tools/sync-sources.sh --verify-only
```

The lock diff remains the review, which is the rule `AGENTS.md` already states.

## 6. Local development override

#7 requires "local development overrides without changing the release lock or
creating accidental dirty release builds." Two mechanisms, and they compose:

**Editing `//astro` in place.** `chromium/src/astro` is a real git checkout, so a
developer just works in it. It is `gclient`-managed but the solution is
`managed = False`, so nothing moves it between syncs. The existing dirty-tree
machinery then does the right thing:

- `astro::require_attributable_chromium` (`tools/lib/astro-common.sh:625`) refuses
  a Chromium checkout carrying changes Astro did not write. `src/astro` is a
  nested git checkout, so it is opaque to `git -C chromium/src status` and must be
  covered by an explicit check rather than assumed.
- The pattern to copy is `ASTRO_ALLOW_DIRTY_OVERLAY` (findings §13): a
  developer-only override that **records the build as not reproducible in
  provenance**, after which packaging refuses to ship it and CI asserts the
  variable is never set. `ASTRO_ALLOW_DIRTY_ASTRO=1` should behave identically,
  and reuse the same provenance field rather than adding a second one.

**Pointing `//astro` somewhere else.** `gclient` accepts `"src/astro": None` in
`custom_deps` to stop managing that path entirely, at which point a developer may
`git clone` or symlink whatever they like there. This must be a
`.gclient`-editing action a developer takes deliberately, **not** an Astro flag:
the moment `tools/sync-sources.sh` can be told by an environment variable to
render a different `.gclient`, the lock stops being the authority. `--verify-only`
then fails on the modified `.gclient`, which is the correct outcome — that tree
is not a release tree.

## 7. Provenance

`tools/generate-provenance.sh` already carries an `astro` section
(`tools/generate-provenance.sh:182-186`, fields `astro_disk` / `astro_state`),
which today records the **Astro repository** commit. With `//astro` a separate
checkout there are two facts to record, and they must not be merged:

- the integration repository (this repo) — what tooling and lock produced the
  build;
- `//astro` at `chromium/src/astro` — what product source was compiled.

`gclient revinfo --output-json` already reports the second. Measured against the
probe in §8:

```json
{"src": {"url": "…/sol", "rev": null},
 "src/astro": {"url": "…/astro", "rev": "384166c6652a641e497105535f19b1bf938aea31"}}
```

`tools/sync-sources.sh:576` already writes that file to
`build/reports/deps-revinfo.json`, so provenance gains a read, not a new capture.

The repository's existing rule stands and is worth restating here because this is
where it bites: **provenance is generated from the trees on disk, never from the
lock** (`AGENTS.md`). The disagreement between `browser.lock.json` and
`chromium/src/astro`'s actual HEAD is the fact worth recording.

## 8. The probe — how the gclient claims above were measured

Read against `depot_tools/gclient.py` at the locked commit, then run. The
solution's `DEPS` was literally `deps = {}`, so anything appearing at `src/astro`
came from `custom_deps` alone.

```bash
# origin/sol   : a git repo whose DEPS is `deps = {}`
# origin/astro : a git repo with one commit, SHA 384166c6…
# work/.gclient: managed=False, custom_deps {"src/astro": "file://…/astro@384166c6…"}
gclient sync --nohooks --no-history
```

| Probe | Result |
|---|---|
| module present after sync | `work/src/astro/` exists, contains the module's files |
| `git -C work/src/astro rev-parse HEAD` | `384166c6652a641e497105535f19b1bf938aea31` — the pin |
| `git -C work/src/astro symbolic-ref -q --short HEAD` | no output — **detached** |
| `gclient revinfo --output-json` | includes `src/astro` with the exact rev |
| pin changed to a second commit, re-sync | HEAD = new SHA, still detached, **exit 0** |
| pin set to `0000…0000`, re-sync | **exit 1**, `fatal: … not our ref 0000…` |

The last two rows are the mutation test: the same command exits 0 on a good pin
and 1 on a bad one, so the gate distinguishes the two states rather than merely
having been observed passing. The first measurement of that row read exit 0 —
because `$?` had been taken after a `| tail` pipeline and was reporting `tail`'s
status. Re-measured without the pipe it is 1. Recorded because the shape recurs:
a status read through a pipeline is the pipeline's status.

**One behaviour not measured, and named as such:** whether `gclient sync` moves
`src/astro` when a developer has left it on a local branch with commits. The probe
only exercised a clean detached checkout. Under `managed = False` the expectation
is that it does not, but that is an expectation, not a measurement — capture it
with the same probe extended by `git -C src/astro checkout -b local && git commit
--allow-empty` before re-syncing.
