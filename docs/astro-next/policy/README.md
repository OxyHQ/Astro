# Astro Next feature and network policy

Issue [#10](https://github.com/OxyHQ/Astro/issues/10) (ASTRO-NEXT-007), under epic
[#3](https://github.com/OxyHQ/Astro/issues/3).

Two machine-enforced manifests. One says what Astro does about every capability;
the other says what Astro does about every host. Later issues cite both as their
input, which is why the boundary between what is *measured* and what is
*decided* is drawn in the schemas rather than in prose.

## What is here

| File | Kind | Holds |
|---|---|---|
| [`features.json`](features.json) | hand-maintained | Every capability Astro must decide about, with the decision, the evidence for what the current build does, and the owner |
| [`endpoints.json`](endpoints.json) | hand-maintained | Every host, with its disposition. **Judgement only** — the host set is derived |
| [`feature-manifest.schema.json`](feature-manifest.schema.json) | contract | The feature schema, enforced by `tools/policy/manifest.py` |
| [`endpoint-manifest.schema.json`](endpoint-manifest.schema.json) | contract | The endpoint schema, same enforcement |
| [`feature-manifest.md`](feature-manifest.md) | generated | Human-readable feature matrix |
| [`network-endpoints.md`](network-endpoints.md) | generated | Human-readable endpoint list |
| [`critical-subset-for-schemes.md`](critical-subset-for-schemes.md) | hand-maintained | Which of #10 actually gates [#11](https://github.com/OxyHQ/Astro/issues/11), measured against the Chromium tree. The source of the `blocks` / `inputs_to` split below |
| `README.md` | hand-maintained | This file: the state vocabulary and the rules |

```sh
tools/policy/manifest.py --write    # validate and regenerate
tools/policy/manifest.py --check    # validate; fail if a document is stale
tools/policy/endpoint_seed.py       # show the derived host set and its provenance
```

## The host set is derived, never typed

`tools/policy/endpoint_seed.py` **imports** `tools/baseline/inventory_endpoints.py`
— issue #6's generator, which CI already checks against
`docs/astro-next/baseline/network-inventory.yaml`. It does not re-implement the
scan and it does not read the committed YAML: a copy of a list is stale the day
it is written, and the staleness is silent.

`tools/policy/manifest.py` then joins the seed against `endpoints.json`
**strictly in both directions**. A host that appears in committed text with no
entry fails. An entry naming a host nothing references fails unless it says why
it cannot be derived. This is the same shape `patch-dispositions.json` and
`pref-dispositions.json` use in the baseline, for the same reason.

### Three sources, each attributed

| Source | What it reads | Why |
|---|---|---|
| `baseline-inventory` | `src/**/*.{cc,h,mojom,rs}` and `patches/**/*.patch` | Issue #6's generator, imported |
| `webui-scan` | `webui/*/src/**` | The baseline generator does **not** read these. 21 hosts live only here |
| `declared` | nothing | An endpoint that exists anyway; each says why it cannot be derived |

**The `webui-scan` gap is worth stating plainly**, because it is not a defect in
#6's generator so much as a boundary nobody had drawn: `inventory_endpoints.py`
scans `src/` for C++ and Rust suffixes only, so it never sees the frontend
sources those controllers serve. Of the hosts found only there, one is the New
Tab Page's weather service, two are its wallpaper CDNs, three are the DNS-over-HTTPS
resolvers the settings page's Secure DNS control offers, and one is the API host
the Alia panel actually calls — which is not the host Alia's own CSP permits.
Extending that generator is #6's call; this manifest reports the gap rather than
quietly patching around it.

**Four of the twenty-one are the settings app's own dev fixtures**, and they are
a category the `reference_kind` enum did not previously have. `webui/app` renders
every settings screen against a fixture when the real browser API is absent, and
those fixtures contain hosts (`mention.earth` as a startup page,
`issues.chromium.org` as a search engine, two RFC 2606 `.example` origins) that
the product has no endpoint for at all. Rounding them off as `documentation`
would have said "a comment somewhere mentions this", which is not what they are:
they are executable data that models a browser API's payload. They carry
`reference_kind: dev-fixture`, and `state: DISABLE_BUILD` — the one state whose
test is artefact absence, which here is `import.meta.env.DEV` dead-branch
elimination, measured against both of `webui/app`'s production build modes rather
than taken from the comment in `platform/browser/env.ts` that promises it.

**The larger gap is upstream, and no scan here closes it.** The baseline
inventory reads Astro's overlay and patch text. It never reads the Chromium tree,
so an upstream endpoint no Astro patch happens to mention is invisible to both
tools. Measured against `chromium/src` at the locked commit `ae03f7fb2c`, counting
C++ sources (`*.cc`, `*.h`) and then all file types:
`update.googleapis.com` 2 / 6, `gstatic.com/generate_204` 4 / 6,
`optimizationguide-pa.googleapis.com` 1 / 1 — and none of the three appears in the
seed. They are in the manifest as `declared` entries with that reason recorded.
**A source scan cannot enumerate a browser's network behaviour. Only a trace can**,
and `tools/baseline/capture-network.sh` is blocked until an Astro binary exists
(baseline finding 1).

## The state vocabulary

Six states, exactly as issue #10 defines them. The two distinctions that carry
weight are `DISABLE_BUILD` versus `DISABLE_RUNTIME`, and `DORMANT` versus either.

### `KEEP`

Ship the capability with upstream Chromium's implementation and upstream's
provider. The code is compiled, registered, reachable, and may contact its
upstream endpoint.

*Test:* with a stock profile the capability behaves as it does in upstream
Chromium.

### `REPLACE`

The capability survives; the implementation or the provider does not. Requires a
named `replacement_component`.

*Test:* the capability works, and a trace shows the new provider and never the
old one.

### `DISABLE_BUILD`

**The code is not in the binary.** Achieved through stable, supported build
configuration — a GN arg, an `enable_*` buildflag, a feature the upstream build
already supports switching off — not by deleting source lines.

*Test:* the symbol, string or resource is **absent** from the shipped artefact.
This is the only state that may be asserted as "cannot happen", and it is
falsifiable at the artefact level by the same class of check
`tools/lib/overlay_in_binary.py` performs.

*Cost:* removing a component can break upstream code that assumes it exists, and
it is a merge conflict at every Chromium roll.

### `DISABLE_RUNTIME`

**The code IS in the binary** and is deliberately never registered, never
constructed, or gated behind a default-off flag or preference Astro owns.

*Test:* two assertions, and **both** are required — the symbol is **present**,
and the capability is unreachable from the UI, from a URL and from the network.
A single assertion cannot distinguish this state from `DISABLE_BUILD`, which is
the whole reason the two are separate.

*Consequence, and the reason the distinction is not academic:* the code is still
reachable by a bug, a flag, an enterprise policy or a `--enable-features`
command line. **A `DISABLE_RUNTIME` endpoint remains a live endpoint for
threat-model purposes** and stays in the endpoint manifest with its expected
traffic declared as none. Only `DISABLE_BUILD` may be described to a user as
removed.

*Where this repository already has 20 of them:* the inherited iridium patch
`all-add-trk-prefixes-to-possibly-evil-connections.patch` rewrites Google URL
literals to `trk:NNN:https://…`, and `block-trk-and-subdomains.patch` makes
`trk:` unresolvable in `components/url_formatter/url_fixer.cc`. The literal
survives, the calling code is compiled and still runs, and only the net layer
refuses. In the manifest those hosts carry `observed_state: RUNTIME_BLOCKED`.

### `DORMANT`

The code is present and compiled, **nobody deliberately disabled it**, and it is
unreachable as a consequence of the surrounding arrangement: no registration
path, no UI entry point, a CSP that blocks its only request, a scheme nothing
routes.

*Requires:* the mechanism that makes it unreachable, **named**, and a statement
of why it is harmless meanwhile.

*Test:* the same two assertions as `DISABLE_RUNTIME`, plus the named mechanism.

*The difference from `DISABLE_RUNTIME` is intent and ownership.*
`DISABLE_RUNTIME` is a decision somebody made and can revert. `DORMANT` is a
property of the current arrangement that nobody is maintaining, so it can become
reachable through a change made for an unrelated reason, and nothing will notice.
**Dormancy therefore carries an expiry: it becomes a decision, or the code goes.**

*Worked example, from committed state:* the New Tab Page's weather widget
(`webui/ntp/src/main.ts:430`) fetches from `wttr.in`. It is unreachable in the
shipped context by two independent mechanisms — the page's own `isWebUIContext()`
guard returns before the fetch, and `astro_ntp_ui.cc` sets no `connect-src`, so
the WebUI default blocks it. Nobody decided to switch off the weather. Relax one
CSP for an unrelated reason and a privacy browser starts making an IP-geolocation
request on every new tab.

*Second example, and it is the cleanest one in the repository:* in committed
state nothing constructs `OxyCookieSigninObserver` — `git grep -l` at `HEAD`
matches only its own two files, and its factory is untracked working-tree
content. Compiled, complete, never instantiated.

### `INVESTIGATE`

No decision. Requires a specific `question` and the `answered_by` that settles
it — a command, an experiment, a document or a named issue. An `INVESTIGATE`
with no way to leave it is a permanent unknown wearing a temporary label. **Not
permitted at release cutover.**

## `observed_state` is a separate field, and that is the point

Both manifests carry two state fields:

- **`observed_state`** — what the **current** build does. Evidence-backed;
  `observed_evidence` is required with no exception.
- **`state`** — the Astro Next **decision**.

They are separate so that "an inherited patch disables this" can never be
silently promoted into "we decided to disable this". Most entries here inherit a
behaviour nobody chose: 47 of 91 features have `observed_state:
DISABLED_BY_PATCH`, and the great majority of those patches were written for
another project.

`NOT_BUILT` is its own value and is **not** a synonym for `DORMANT`. Baseline
finding 1 measured that nothing links `src/chrome/browser/oxy` into the build
graph, so every Astro capability is absent from today's binary through a build
defect owned by [#7](https://github.com/OxyHQ/Astro/issues/7). The validator
**rejects** `DORMANT` on a `NOT_BUILT` entry, because recording a build defect as
a disposition invents a decision nobody took.

## Domain substitution: the asked-about category is empty, an adjacent one is not

Issue #10 asks how to tell a disabled feature from one whose endpoint was merely
broken by domain substitution. In this repository the answer is measured and it
is not the expected one:

**Domain substitution has never run.** Its regexes are Python syntax and the old
implementation fed them to `sed`, which rejected every one with the error
discarded (`tools/baseline/inventory_endpoints.py`, and `apply-patches.sh` now
refuses rather than pretending). So **no endpoint in Astro has been neutered by
substitution**, and the mangled hosts in inherited patch text — `9oo91e.qjz9zk`,
`ch40m1um.qjz9zk` — are upstream ungoogled-chromium's own already-substituted
content, not anything Astro's pipeline produced. That category has **zero**
entries and this manifest invents none.

A different category is **not** empty, and it is worth separating carefully
rather than rounding off: **Astro's own patches carry substituted hostnames as
literal text.** Thirteen hosts in the seed carry the substituted shape. Twelve
sit in translator `desc=` notes, `<ex>` placeholder examples and C++ comments,
and are `reference_kind: documentation` — never rendered as a URL, never fetched,
merely embarrassing.

**One reaches shipped UI.** `patches/astro/038-dino-game-astro-scheme.patch`
rewrites `kRedirectLoopLearnMoreUrl` in
`components/error_page/common/localized_error.cc` to
`https://support.9oo91e.qjz9zk/chrome?p=rl_error` — the "learn more" link on the
`ERR_TOO_MANY_REDIRECTS` interstitial — and **that patch applies**. Today's build
ships a link to a hostname that cannot resolve and that
`block-trk-and-subdomains.patch` would block anyway. Nothing will ever
"un-substitute" it, because nothing substituted it: it is text somebody
committed.

## Patches that do not apply change what a diff side means

The seed resolves every patch reference to the diff side it sits on, because a
host in a patch may be one the patch **deletes**: of the 94 hosts carrying patch
references, 39 appear only on removed lines or diff headers.

A diff side says what the patch *does*, not whether it *applies*, and for most of
this project's life those were different answers. **They are now the same one:
every patch in both declared series applies, in declared order, at the locked
revision — 112 ungoogled and 56 Astro, 168 of 168.** `non_applying_patches` in
`endpoints.json` is an empty list, and the comment on it carries the method and
the history.

That took three waves, and all three found the same two defects. Five patches
(`045`, `046`, `052`, `053`, `056`) had hunk headers whose line counts disagreed
with their bodies, which `git apply` rejects against any tree at all, so they had
never applied anywhere. Nine (`020`, `023`, `027`, `036`, `039`, then `009`,
`012`, `013`, `015`) had been generated by diffing an already-ungoogled tree
against pristine, so each carried edits belonging to an ungoogled patch — or to
domain substitution, a step that has never run — as though they were Astro's own.
Each is now slimmed to its Astro-specific intent and re-anchored against the
in-series state.

What the replay reads its input from turned out to matter more than anything it
measured. `chromium/src` records 13 of the files the series touches inside
gclient-fetched DEPS subrepos, as gitlinks, so `git show HEAD:<path>` cannot read
them and an earlier replay left them out of the tree entirely. Resolving them
from each subrepo's own git, at the commit the gitlink records, changed the
verdict on **twelve** patches at once: all eight ungoogled failures disappeared,
and four Astro patches previously reported as applying did not. The eight had a
single root cause — one patch naming a devtools-frontend file was skipped whole,
and four later ungoogled patches then failed on the edits it never made. So no
ungoogled patch is drift, and none belongs to #8.

Because the series now applies in full, the reason six `DISABLE_BUILD` endpoint
entries carry `observed_state: PRESENT` is no longer that `apply-patches.sh`
stops at the first failure. Those entries describe a tree nobody has built:
baseline finding 1 records that nothing links the Astro overlay into the build
graph, and `capture-network.sh` refuses to emit a trace it did not record.
`observed_state` stays what it is until a binary exists to measure.

The validator's limit is sharper now, not milder. It checks only that each name
in the list is in `patches/astro/series`, so with the list empty it examines
**zero entries and cannot fail**; it never could detect a change of apply status
in either direction. What keeps the list honest is the replay, which needs a
Chromium checkout and which this module deliberately does not run.

## Rules the validator enforces

From issue #10's requirements, each checked on every run:

- Unknown state, duplicate id, or missing owner → fail.
- A host in committed text with no entry → fail. An entry for a host nothing
  references and no `declared_reason` → fail.
- An endpoint naming an unknown `owning_feature`, or a feature naming an unknown
  endpoint id → fail. A contacted endpoint its own feature does not list → fail.
- A wildcard host without `wildcard_justification` → fail.
- An `http` production endpoint without `http_justification` → fail.
- A staging or local-test endpoint without `release_blocked: true` → fail.
- `INVESTIGATE` without both a `question` and an `answered_by` → fail.
- `DORMANT` on a `NOT_BUILT` entry → fail.
- A capability routed to another issue that nonetheless carries a decided state
  → fail.
- An `inputs_to` edge without an `inputs_reason` → fail. An entry naming the same
  issue in both `blocks` and `inputs_to` → fail.
- A `webui_host` without a `scheme_trust`, or the reverse → fail. Two entries
  claiming one `webui_host` → fail.

## `blocks` and `inputs_to` are different relations

`blocks` means *the named issue's design depends on this entry's decision*.
`inputs_to` means *the named issue reads this entry* — weaker, and true of an
entry whose decision is already taken.

They were one field, and conflating them cost a whole epic's worth of apparent
dependency. Ten entries declared `blocks: [11]` while every one of them carried a
decided `state`; read literally, [#11](https://github.com/OxyHQ/Astro/issues/11)
was waiting on ten decisions that had already been made, and read as "#10 is a
blocker", on all 91. Meanwhile the 35 `INVESTIGATE` entries — the manifest's own
marker for *no decision* — contained not one `blocks: [11]`. What those ten
carried was data #11 reads. `critical-subset-for-schemes.md` measures that and
names the five entries where the relation really is a prerequisite; they are the
five that still declare `blocks: [11]`.

The distinction is enforced rather than documented: naming one issue in both
fields fails, so an entry cannot hedge.

## `webui_host` and `scheme_trust` are one row, and neither is a preference

A page's host name and the scheme it is served under are recorded per entry
because both are forced by mechanisms a reader would not guess:

- **`webui_host`.** The WebUI data-source registry is a flat map keyed on the
  bare host, shared across every WebUI scheme except `chrome-untrusted`
  (`url_data_manager_backend.cc:122`, `:149`), and a later same-named
  registration silently replaces the earlier one (`url_data_source.cc:52-54`).
  Two entries that agree on a name are one page; the loser returns
  `ERR_INVALID_URL`. The validator enforces uniqueness among Astro's own names;
  disjointness from Chromium's needs a checkout and is `webui-host-namespace`'s
  test.
- **`scheme_trust`.** A document holding WebUI bindings has its network factory
  revoked (`render_frame_host_impl.cc:12645-12657`), so a page whose own
  JavaScript must reach the network cannot be bound, and therefore cannot be
  trusted. The rule and the per-page result live in `webui-scheme-trust-split`.

`not-determined` is a permitted `webui_host`, and means the name is somebody
else's call — not that nobody looked.

Two guards exist because a check that cannot fail is worse than no check:

- **Vacuity.** Every rule reports how many entries it examined, and a rule that
  examined none of a class the manifests contain fails. The seed itself has a
  floor: fewer than 50 hosts and every join below would pass trivially, so it
  refuses to report a pass.
- **Schema keywords.** `_assert_supported` fails if a schema uses a keyword the
  validator does not honour. Without it, adding a constraint the validator
  ignores is indistinguishable from adding one it enforces.

The validator implements the schema subset directly rather than importing a
library, following `inventory_endpoints.py`'s reasoning: a generator that cannot
run until somebody installs a package is a generator that stops being run.

## Adding a feature or an endpoint

1. Add the entry to `features.json` or `endpoints.json`.
2. `tools/policy/manifest.py --write`, and commit the regenerated documents.
3. If the entry is `INVESTIGATE`, give it a question somebody can actually answer.

A new host in `src/`, `patches/` or `webui/` fails the check until it has an
entry. That is the mechanism the issue asks for: a new endpoint cannot merge
without a manifest entry.

**CI wiring is not done here.** `tools/tests/run.sh` runs
`policy-manifests-are-strict`, which exercises the joins and every rule in both
directions, so the suite already fails on a broken manifest. Adding
`tools/policy/manifest.py --check` as its own **Build safety** step — beside the
existing `Check the Astro Next baseline is current` — is a workflow change this
issue did not make, because the workflow files belong to another track. Until
that step exists, the coverage comes from the test suite rather than from a
dedicated gate.

## What this cannot tell you

- **Whether any of it is true at runtime.** Everything here is static analysis of
  committed text. No Astro binary exists (baseline finding 1), so cold-start,
  idle and incognito traffic are unmeasured, and 3 declared endpoints exist only
  because a source scan cannot see them.
- **Whether a patch applies.** Declared from baseline finding 3, checked only for
  the patch's continued existence.
- **The complete upstream endpoint set.** The seed reads Astro's code, not
  Chromium's. Closing that needs `tools/baseline/capture-network.sh` behind a
  real build.

Every one of those is recorded as `not-captured` in the field it belongs to,
naming what would capture it. An invented value would be cited, argued from, and
eventually used to dismiss a real regression.
