<!-- Hand-maintained. This is a design, not a measurement, so it is not
     generated. Every claim it makes about how Chromium behaves is cited to a
     file and line in the locked checkout, and every claim it makes about what
     Astro ships today is cited to a member of a real artifact in releases/. -->

# The Astro product manifest

Issue [#9](https://github.com/OxyHQ/Astro/issues/9) (ASTRO-NEXT-006), under epic
[#3](https://github.com/OxyHQ/Astro/issues/3). Depends on
[#7](https://github.com/OxyHQ/Astro/issues/7).

One validated file declares every value that makes a build call itself Astro.
Everything else is **generated** from it. No script rewrites Chromium source in
place, no packager holds its own copy of a product name, and no constant is
spelled twice.

## Status

**Design only. Nothing generates anything yet, and that is deliberate.**

The manifest's canonical home is `//astro/app/`. Since
[#7](https://github.com/OxyHQ/Astro/issues/7) landed at `b949a68`, **`//astro`
is this repository's own root** — `BUILD.gn:1-6`: the repo is checked out by
DEPS at `src/astro`, "so ITS ROOT IS `//astro`. There is deliberately no
`astro/` subdirectory". So the canonical home is `<repo>/app/`, which
`git ls-tree b949a68 -- app` shows does not exist yet; creating it is #9's own
work rather than a wait on anyone. Until then the reviewable contract lives
here:

| File | What it is |
|---|---|
| [`product.schema.json`](product.schema.json) | The schema. Complete and enforceable today. |
| [`product.example.json`](product.example.json) | A valid instance carrying the names chosen below. |
| this document | The design, the decisions and their reasons. |

These two files **move** to `app/product.schema.json` and `app/product.json`,
never copied: a second copy of the schema is the same defect as a second copy of
a product name. Branch topology for that move is the team lead's, not this
document's.

Nothing in the repository reads them yet. Do not read their presence as "Astro
branding is generated now" — [`tools/apply-branding.sh`](../../../tools/apply-branding.sh)
is still the only branding path, and §"Retiring the old branding path" says
what has to be true before it can be deleted.

## Measured facts this design is answering

Every row was measured on a real shipped artifact or on the locked Chromium
checkout `ae03f7fb2cf1215853896d6a4c15fdceee2badb7` (146.0.7680.177), not
inferred.

| # | Fact | Evidence |
|---|---|---|
| 1 | The Windows executable a person launches is **`chrome.exe`** | `astro/chrome.exe`, 2,575,872 bytes, in `releases/astro-0.1.0-windows-arm64-portable.zip` |
| 2 | The installer's payload installs the same name | `Chrome-bin/chrome.exe` inside `chrome.7z`, extracted from `releases/astro-0.1.0-windows-arm64-installer.exe` |
| 3 | PE product metadata **is** already Astro | that `chrome.exe`'s version resource: `ProductName=Astro`, `FileDescription=Astro`, `CompanyName=Oxy`, `LegalCopyright=Copyright 2026 Oxy. All rights reserved.` |
| 4 | …but its filename identity is not | same resource: `OriginalFilename=chrome.exe`, `InternalName=chrome_exe`, supplied by `chrome/app/chrome_exe.ver:1-2`, which BRANDING does not feed |
| 5 | Windows OS-facing identity is entirely Chromium's | `astro/chrome_elf.dll` from the same archive contains `ChromiumHTM` ×1, `ChromiumPDF` ×1, `Chromium` ×2 — the compiled `install_static` constants that decide the ProgIDs, the AppUserModelID, the install and user-data path component and the uninstall registry key |
| 6 | The Linux binary is `chrome`, in `/opt/astro` | `./opt/astro/chrome` in `releases/astro-browser_0.1.0_amd64.deb`; `branding/astro.conf` declares `INSTALL_DIR="/opt/oxy/astro"`, so the config and the artifact disagree |
| 7 | The Linux desktop entry declares a window class the browser never reports | shipped `astro-browser.desktop` says `StartupWMClass=astro-browser`; `chrome/common/channel_info_posix.cc:151` returns `chromium-browser.desktop`, and `chrome/browser/shell_integration_linux.cc:485-499` derives `WM_CLASS` from that |
| 8 | The deb's maintainer address disagrees with the config | deb control `Maintainer: Oxy <hello@oxy.so>`; `branding/astro.conf` `MAINTAINER_EMAIL="team@oxy.so"` |
| 9 | **11 of 18** keys in `branding/astro.conf` are read by nothing | counted in `tools/apply-branding.sh`, the file's own declared consumer, over both `$KEY` and `${KEY` forms; a nonexistent key reads 0 as a control |
| 10 | 3 of the 7 files `apply-branding.sh` rewrites do not exist in Chromium 146 | `chrome/installer/linux/common/installer.include`, `chrome/installer/linux/debian/build.sh`, `chrome/installer/linux/rpm/build.sh` |
| 11 | The blanket `.grd` replacement would silently drop 430 strings' translations | `chrome/app/chromium_strings.grd` holds **430 translateable** messages containing "Chromium" (and 33 non-translateable); GRIT keys `.xtb` entries by a fingerprint of the message text (`tools/grit/grit/extern/tclib.py:33-43`, reached from `tools/grit/grit/tclib.py:145-152`), and the file references **80** `.xtb` locale files |

Read together: **the product name is already generated correctly through
Chromium's own BRANDING mechanism, and everything the operating system
actually registers is still Chromium's.** That is the gap this manifest closes,
and it is a narrower gap than "branding is unfinished" suggests.

## Format and location

JSON, validated by a JSON Schema, sitting beside a from-scratch validator —
the same shape as `browser.lock.json` + `browser.lock.schema.json` +
`tools/lib/lock.py`. The issue's sketch was TOML; JSON is chosen because the
repository already has exactly one schema-validation idiom and a second parser
plus a second validation path is a worse cost than the syntax difference.

The consistency is real, not aspirational: **`product.schema.json` validates
under `tools/lib/lock.py`'s validator today, unmodified.** It uses only the
keywords that validator implements, so the contract is enforced from the day it
lands rather than from the day somebody writes a second validator. That
validator treats an unimplemented keyword as a hard error rather than skipping
it (`tools/lib/lock.py:80-92`) — a skipped constraint is an unenforced one —
so the schema cannot quietly grow a rule nothing checks.

```
//astro/app/                = <repo>/app/, not yet created
├── product.json            the manifest        (moves here from docs/)
├── product.schema.json     the contract        (moves here from docs/)
└── generated/              every output below; never hand-edited
```

`tools/lib/product.py` is the reader and validator, modelled on `lock.py`:

```
product.py --validate [MANIFEST]        schema + structural rules
product.py --check-release CHANNEL      additionally: release-safety rules
product.py --get PATH                   one value, e.g. platforms.windows.executable
product.py --generate OUTDIR            write every generated file
product.py --generate OUTDIR --check    regenerate into a temp dir and diff
```

The `--validate` / `--check-release` split mirrors `lock.py`'s
`--validate` / `--check-remote`: the manifest at rest is allowed to record that
an identifier has not been minted; a *release build* is not allowed to proceed
on one.

## Shape

Nine top-level blocks. The full field list, with a description of every field
and the upstream mechanism it feeds, is in
[`product.schema.json`](product.schema.json); this is the map.

| Block | Holds | Principal consumers |
|---|---|---|
| `manifest_version` | format version | every generator refuses an unknown one |
| `product` | short/full/installer names, copyright | the generated `BRANDING` |
| `company` | short/full company names | the generated `BRANDING`, Windows PE `CompanyName` |
| `urls` | product identity URLs | about/version surfaces, package metadata |
| `schemes` | `astro` and `astro-untrusted` | `//astro/common/url_constants` for [#11](https://github.com/OxyHQ/Astro/issues/11) |
| `version` | how Astro's version relates to Chromium's | artifact names, package release, version surface |
| `user_agent` | the UA decision, as asserted constants | the UA tests; nothing else |
| `channels` | which channels exist and how they are named | every per-platform channel block |
| `platforms` | per-OS public identity, `linux`/`windows`/`macos`/`android` | the generated per-platform inputs below |

### The rule that keeps it small

**Nothing derivable is declared.** If Chromium already computes a value from
another declared value, the manifest does not carry it; the generator emits it
and the schema rejects it as an undeclared field.

Worked examples, each a field somebody would reasonably have added:

| Not in the manifest | Because upstream derives it |
|---|---|
| macOS `.app` name, main executable name | `chrome/BUILD.gn:502` — `output_name = chrome_product_full_name` |
| macOS Helper and Framework bundle names | `chrome/BUILD.gn:451-452` — `chrome_product_full_name + " Helper"` / `" Framework"` |
| Windows uninstall registry key | `chrome/install_static/install_util.cc:336-344` — `Software\Microsoft\Windows\CurrentVersion\Uninstall\` + company + product + suffix |
| Windows user-data directory | `install_util.cc:512-523` + `chrome/install_static/user_data_dir.cc:102` — company/product path + `User Data` |
| Windows policy registry key | `install_util.cc:526-527` — `SOFTWARE\Policies\` + product path |
| Linux `.desktop` basename, AppStream filename, `/usr/bin` symlink | `chrome/installer/linux/common/installer.py:407, 782, 794` — all `PACKAGE`-derived |
| Linux per-channel package, install dir, menu name, RDN | `installer.py:405-414` — channel suffixes appended by upstream |
| Android per-channel application id | `chrome/android/chrome_public_apk_tmpl.gni:26-31` — `+= "." + android_channel` |

This is what "add a source scan that reports duplicated generated values" in
the issue is really asking for, and the schema's `additionalProperties: false`
does most of it before a scan is needed.

## Public names, per platform

The policy fixed on the issue: **user-facing and OS-facing identity is Astro;
internal components keep their upstream names.** `chrome.dll`, `chrome_elf.dll`,
`chrome_crashpad_handler`, `chrome_proxy.exe` and the `.pak` filenames stay as
they are. They are build and runtime contracts, renaming them enlarges the
downstream delta for no functional gain, and **branding is not incomplete
because they keep Chromium names**. Rename an internal component only for a
functional reason, and record it.

### Windows: `astro.exe`, lowercase

`platforms.windows.executable = "astro.exe"`.

Lowercase, for four reasons in descending weight:

1. **It matches the command name on every other platform.** Linux ships
   `astro`, and a person, a script, a WebDriver `binary` path and a CI step
   should not have to know which platform capitalises it.
2. **Every shipping Windows browser is lowercase** — `chrome.exe`,
   `msedge.exe`, `firefox.exe`, `brave.exe`, `opera.exe`. A capitalised
   executable reads as a mistake, and process-name tooling (`taskkill /IM …`,
   EDR allowlists, enterprise deployment docs) is written lowercase by habit.
3. **The capitalised identity is already carried elsewhere, correctly.** The
   Start-menu shortcut, the default-browser chooser entry and the install path
   all come from `product_path_name`/`base_app_name`, which are `Astro`. Windows
   never shows a person the raw filename unless they go looking.
4. Upstream's own `ORIGINAL_FILENAME` is lowercase (`chrome/app/chrome_exe.ver:2`),
   so the generated `.ver` stays shaped like the file it replaces.

Renaming the Windows executable touches four places, all generated:

| What | Upstream today | Why it must move together |
|---|---|---|
| build output name | `chrome/BUILD.gn:151-155` (`_chrome_output_name`) | the produced file |
| import-reordering action | `chrome/BUILD.gn:83-90`, hardcoded `initialexe/chrome.exe` | it reads and rewrites the exe by name; miss it and the build breaks or silently ships the un-reordered binary |
| PE filename identity | `chrome/app/chrome_exe.ver:1-2` → `chrome/app/chrome_version.rc.version:32,34` | otherwise `OriginalFilename` keeps saying `chrome.exe`, which is measured fact #4 today |
| installer's idea of the exe | `chrome/installer/util/util_constants.cc:179` (`kChromeExe`) | shortcuts, uninstall command and repair paths are built from it |

`kChromeDll` (`util_constants.cc:178`) is deliberately **not** in that list.

### Linux: package `astro-browser`, command `astro`, `/opt/oxy/astro`

| Field | Value | Reason |
|---|---|---|
| `package` | `astro-browser` | what the deb already ships; also fixes the `.desktop` basename, AppStream filename and `/usr/bin` symlink, which `installer.py` derives from it |
| `program_name` | `astro` | the binary inside the install dir — this is the name a process list shows, and today it is `chrome` |
| `command_name` | `astro` | `/usr/bin/astro`, which the deb already provides as a shim |
| `install_dir` | `/opt/oxy/astro` | vendor-scoped, matching upstream's `/opt/chromium.org/chromium` and `/opt/google/chrome`. `astro.conf` already declares this; the shipped `/opt/astro` is the drift (fact #6) |
| `desktop_id` | `so.oxy.Astro` | already used by the shipped AppStream metainfo |

Two consequences worth stating because they are not obvious:

- **`StartupWMClass` cannot be declared, it must be made true.**
  `chrome/common/channel_info_posix.cc:151` hardcodes `chromium-browser.desktop`
  under Chromium branding, and `WM_CLASS` is derived from it
  (`chrome/browser/shell_integration_linux.cc:485-499`). The generated downstream
  constant must become `<package>.desktop`; declaring the class in the desktop
  file, as the shipped one does, changes nothing (fact #7).
- **The channel suffixes are upstream's, not ours.** `installer.py:405-414`
  already appends `-<channel>` to package and install dir, ` (<channel>)` to the
  menu name and `.<channel>` to the RDN. The manifest declares stable's values
  only; declaring per-channel Linux names would create a second, divergent rule.

### macOS: `Astro.app`, executable `Astro`

Nothing to choose and nothing to declare: `chrome/BUILD.gn:502` makes the bundle
`Astro.app` with main executable `Astro` straight from `product.full_name`, and
`chrome/BUILD.gn:451-452` makes the helpers `Astro Helper*.app` and the framework
`Astro Framework.framework`. The capital `A` is correct here and is not an
inconsistency with `astro.exe`: it is `CFBundleExecutable`, which must equal the
bundle name, not a command a person types.

The manifest carries only what upstream cannot derive: `bundle_id`,
`creator_code`, `team_id`. **`team_id` is undeclared today** and modelled as such
— code signing and notarisation cannot succeed without it, so no macOS release
channel may exist until it is minted.

### Android: `so.oxy.astro`, label `Astro`

`chrome/android/chrome_public_apk_tmpl.gni:22-32` puts
`chrome_public_manifest_package` in `declare_args()`, so the application id is a
GN argument and needs no source change; the same block appends the channel
suffix, so per-channel ids are derived, not declared. The launcher label
replaces the Chromium string at
`chrome/android/java/res_chromium_base/values/channel_constants.xml:10` through
an Astro-owned resource, not an edit to that file.

One constraint from outside this repository: Astro must **not** declare
`android:sharedUserId="so.oxy.shared"`. Oxy's React Native apps share a keychain
through that UID; a browser joining it would put every site credential inside the
same sandbox as the identity vault. The application id `so.oxy.astro` sits in the
same namespace and is fine — the shared UID is a separate declaration, and the
generated manifest must never emit it.

## Internal URL schemes

Two names, fixed here so [#11](https://github.com/OxyHQ/Astro/issues/11) has one
place to read them from:

| Manifest field | Value | C++ constant |
|---|---|---|
| `schemes.trusted` | `astro` | `astro::kAstroUIScheme` |
| `schemes.untrusted` | `astro-untrusted` | `astro::kAstroUIUntrustedScheme` |

Both are pinned in the schema with `const`, not a `pattern`, for the reason the
`user_agent` block's policy fields are: **a scheme name is not a per-build
knob.** Every registered origin, every `WebUIConfigMap` key
(`content/public/browser/webui_config_map.cc:86`) and every process lock is
derived from the string, so changing it must cost a schema edit — which is a
review — rather than a manifest edit. `tools/lib/lock.py:51` lists `const` among
the keywords the validator implements, so this is enforced from the day it lands.

`astro` is chosen for the reason `astro.exe` and `/usr/bin/astro` are: it is the
command name on every platform, and a person typing `astro://settings` should not
have to know it differs from the binary they launched. It collides with nothing
Chromium registers — the full standard-scheme set is
`url/url_constants.h:22-64` plus the four in `content/common/url_schemes.cc:69-72`,
and none is `astro`.

### They are two principals, not a scheme and a variant of it

`astro-untrusted` shares a textual stem with `astro` because Chromium's own
`chrome`/`chrome-untrusted` pair does, and #11's code will sit beside that code.
The stem is a readability convention and nothing more: **no URL, origin or
process-model code can observe a relationship between the two.**

Upstream treats its pair as two independent schemes at every registration site,
which is the model Astro copies:

| What | `chrome` | `chrome-untrusted` |
|---|---|---|
| standard scheme | `url_schemes.cc:70` | `:71` — a separate call |
| secure scheme | `:80` | `:81` |
| CORS-enabled | `:100` | `:101` |
| service worker | `:128` | `:129` |
| **default savable** | `:35` | **absent** |

That last row is the point: they are not interchangeable even upstream, and a
design that treated one as a mode of the other would have to explain which
behaviour it inherits. The isolation that matters is not the string anyway — a
page under either scheme gets its own origin, therefore its own site URL
(`content/browser/site_info.cc:1057-1058`), therefore its own process lock,
therefore no bindings it was not granted
(`content/browser/renderer_host/render_frame_host_impl.cc:7910-7912`).

Two consequences that are enforced rather than described:

- **Neither constant may be derived from the other.** `kAstroUIScheme
  "-untrusted"` would carry the right bytes while making one scheme a
  derivative of another, so the checker rejects any initializer that is not a
  single string literal.
- **They must be distinct strings.** Pinned separately, and cross-checked.

### Where the constants live, and why

`//astro/common/url_constants.h`, in `namespace astro`.

`common/` is the bottom layer of the module
([`astro-module-layout.md`](astro-module-layout.md)), and a scheme name is the
one value every layer above it needs — `browser/` to register, `ui/webui/` to
serve, `components/` to compare. Anywhere else and a caller either takes an
upward dependency or spells the literal, and spelling the literal is the defect
this whole section exists to prevent. `//astro/common/DEPS` subtracts
`+chrome`, `astro/browser`, `astro/components` and `astro/ui`, so the layer
cannot acquire one by accident.

**Header-only, with no `.cc`**, mirroring the file it stands opposite:
`content/public/common/url_constants.h:19-23` declares Chromium's schemes as
`inline constexpr char kFoo[] = "…"`, `content/public/common/url_constants.cc`
does not exist in 146, and `content/public/common/BUILD.gn:224` lists the header
alone. A header-only `source_set` is an established upstream idiom for exactly
this shape — `components/optimization_guide/optimization_guide_internals/webui/BUILD.gn:31-33`
is the same three lines. The target carries no `deps`, which is a property to
keep rather than an omission: anything that makes it expensive to depend on
pushes callers back toward the literal.

`common/DEPS` subtracts `-chrome`, `-astro/browser`, `-astro/components` and
`-astro/ui`. The subtraction is load-bearing rather than decorative: checkdeps
inherits `include_rules` down the tree, so the root's
`+chrome/browser/chrome_browser_main_extra_parts.h` — granted for the single
hook `browser/` implements — otherwise reaches `common/` as well, which is the
one layer `//chrome/browser` sees through `allow_circular_includes_from`. Note
that **nothing runs checkdeps today**; it is in neither `tools/build.sh` nor the
build-safety suite, so this is a declared rule and not yet an enforced one.

**No entry is needed in the module's root `BUILD.gn`.** An earlier revision of
this section said `group("astro")` should gain `"//astro/common"`. That was
wrong twice over, and the second reason is only visible by measuring rather than
reasoning — so it is recorded here with the command that produced it.

Measured against a configured build directory carrying the module
(`gn ls out/AstroModule "//astro/*"`, `gn refs`), the graph is:

| Target | Reached from |
|---|---|
| `//astro/browser:browser` | `//chrome/browser:browser` |
| `//astro/common:astro_schemes` | `//chrome/common:common_lib` |
| `//astro/common:url_constants` | `//astro/common:astro_schemes` |
| `//astro:astro`, `//astro:browser` | **nothing — `gn ls "//astro:*"` is empty** |

Two conclusions, neither of which the design argument would have reached:

1. **The module's root groups are not in the build at all.** Both Chromium hooks
   name a leaf target directly — `chrome/browser/BUILD.gn:1532,1737` says
   `"//astro/browser"` — so `group("astro")` is unreachable and an entry added to
   it compiles nothing and is checked by nothing. `gn desc out/AstroModule
   //astro:astro` answers "matches no targets, configs or files".
2. **`//astro/common:url_constants` is already in the graph anyway**, pulled by
   #11's `astro_schemes`, which is exactly how a leaf is supposed to arrive. The
   concern that motivated the question — that `gn check` would never see the
   layer — does not apply.

`//astro/browser` should **not** take the edge either: it uses no scheme, and
asserting a coupling before it exists is a claim about the code that is not
true. The consumer that legitimately depends on `url_constants` is the one that
includes the header, and that is `//astro/common:astro_schemes`.

### What spells a scheme today

Measured on the committed tree, because "no source file spells a scheme as a
literal" is an aspiration until someone counts:

| Where | Count | Owner |
|---|---|---|
| `src/chrome/browser/oxy/oxy_auth_service.h:22` | `kOxyAuthCallbackScheme[] = "astro"` | gated below |
| `src/chrome/browser/oxy/oxy_auth_callback_handler.cc:11` | `url.SchemeIs("astro")` — a bare literal, not the constant its neighbour declares one file over | gated below |
| `patches/astro/*.patch` | 16 files, `patches/astro/025-astro-scheme-register.patch` among them, which pushes `"astro"` onto four scheme lists as four separate literals | [#8](https://github.com/OxyHQ/Astro/issues/8) / [#11](https://github.com/OxyHQ/Astro/issues/11) |

`astro-untrusted` appears nowhere. And what exists today is not a scheme in the
sense #11 means: `patches/astro/011-astro-url-scheme-alias.patch` rewrites
`astro://` to `chrome://` inside `HandleChromeAboutAndChromeSyncRewrite`, so
`astro://` is an alias that is spent before any origin is computed.

The two overlay spellings are **gated, not just documented** — a duplicate a
document mentions is one nothing checks — by an exact list in
`tools/lib/scheme_constants.py`. It shrinks to nothing as #8 retires the overlay,
and an entry naming a file that no longer exists fails, so the list cannot rot
into one nobody has. The 16 patch files are deliberately not gated: they are
being replaced rather than corrected, and a gate over text that is on its way out
would be work for #8 to delete.

### Drift prevention: validated, not generated

The header is hand-written and `tools/lib/scheme_constants.py --check` proves it
matches the manifest, run by
`tools/tests/cases/scheme-names-match-the-manifest.sh` in the build-safety
suite.

**It stays hand-written, and this is a design decision rather than a stage on
the way to generation.** The reason is upstream's own warning at
`chrome/browser/BUILD.gn:8392-8414`: because Astro is reached through
`allow_circular_includes_from`, "the gn build graph may miss generated
dependencies, which will result in compile errors". A *generated*
`url_constants.h` inside that circular target is precisely the shape that
warning describes, and it fails in only some configurations — the most
expensive kind of build break to diagnose. Two string literals that change
approximately never do not justify that risk when a check makes the duplication
safe. If a generator is ever wanted for the rest of the manifest, it should emit
a **separate** target (`//astro/app:product_constants`) that consumers depend on
directly, rather than routing a generated header through the circular edge.

What the check proves, in both directions:

1. The manifest validates against the schema.
2. The schema pins each scheme with `const`, and the pin equals the manifest's
   value — otherwise the manifest is a source of truth nobody constrains.
3. Each C++ constant carries exactly the manifest's value.
4. Each initializer is a single string literal, so neither scheme is derived
   from the other.
5. No scheme constant exists in the header without a manifest field behind it.
6. The two values differ.
7. Every declared legacy spelling still carries the declared value.
8. **Validator rule 9** — neither scheme is handed to the operating system, as a
   `direct_launch_url_scheme` or as an `x-scheme-handler/*` MIME type. See
   §"Why rule 9 exists"; it is cross-field, so the schema subset cannot express
   it, and pinning the names with `const` does **not** cover it. The fields are
   found by walking the document for their names rather than by a fixed path, so
   moving one to another platform block cannot take it out of reach.
9. **Inside `//astro/common`, only `url_constants.h` spells a scheme
   literally.** This is what makes a second check over #11's
   `common/astro_schemes.cc` unnecessary rather than merely absent: that file
   registers both schemes and correctly uses the constants, and this is what
   keeps it that way.

Three things exit **2** rather than 0 or 1, because "could not measure" must
never read as "measured and agreed": a header that parses to no declarations, a
rule 9 walk that examined no fields, and a literal scan that cannot demonstrate
it would match — the last checks `url_constants.h` itself as a positive control,
since a scan passing because its pattern is broken looks identical to a scan
passing because nothing offends.

### Not decided here

**Host naming is #11's, not this issue's.** #9 owns the names on the left of the
`://`; the catalog to the right of it is a security boundary, not an identity
one. It is decided by process-model constraints this manifest cannot express —
`astro-scheme-hooks.md` §2.9 records that a dotted host makes
`astro://a.alia` and `astro://b.alia` share one process lock through
`content/browser/site_info.cc:44-75`, and #11 already carries the rule that no
host may exist under both schemes. Both are properties of the registration, and
they belong with the code that registers. It is not #10's either: #10's "hosts"
are DNS names the browser contacts on the network, a different noun.

Scheme *behaviour* — privileges, CORS, CSP, WebUI bindings, what an unknown host
does — is likewise #11's. This section fixes the names and nothing else.

## Installation and update identifiers

| Platform | Identifier | Source |
|---|---|---|
| Windows | install path, user-data dir, uninstall key, policy key | all derived from `product_path_name` + `company_path_name` + `install_suffix` |
| Windows | AppUserModelID, ProgIDs, default-browser registration | `base_app_id`, `browser_prog_id_prefix`, `pdf_prog_id_prefix`, per channel |
| Windows | Active Setup GUID, command-execute CLSID, toast activator CLSID, elevator CLSID/IID, tracing CLSID/IID, AppContainer SID prefix | declared per channel, **minted once, never regenerated** |
| Linux | package, install dir, `/usr/bin` symlink, desktop id | `package`, `install_dir`, `command_name`, `desktop_id` |
| macOS | bundle id, team id | `bundle_id`, `team_id` |
| Android | application id | `application_id` |

Three rules govern the identifier set:

1. **A GUID is declared, never generated.** A build-time-generated GUID differs
   on every build and orphans every registration it ever wrote. The schema
   therefore models each one as an object with `declared: true/false`, exactly
   like `browser.lock.schema.json`'s `thirdPartyEntry` — an unminted identifier
   is *declared and greppable* rather than absent and invisible.
2. **Every one of them must differ from Chromium's**, and from every other
   channel's. Chromium's values are literal constants in
   `chrome/install_static/chromium_install_modes.h:57-106`; two forks that both
   kept them fight over one registration, one toast route and one AppContainer
   profile. Cross-checking this is a validator rule, listed below.
3. **`app_guid` is a plain string, and empty is a decision.** Upstream Chromium's
   is the empty string, meaning no update-service integration
   (`chromium_install_modes.h:46-47`). Modelling it as an identifier would force
   an "undeclared" state onto a value that is legitimately empty, and the release
   check would then refuse a correct manifest.

Astro has minted **none** of the Windows identifiers. `--check-release windows`
therefore fails today, naming all sixteen (eight per channel × two channels) —
which is the accurate state of the world, stated loudly.

## Icon and resource generation

Canonical source: `branding/astro-logo.svg` (plus the coloured variant). Every
raster is generated; none is committed as a hand-exported one-off.

| Platform | Required outputs | Required by |
|---|---|---|
| Linux | `product_logo_{16,24,32,48,64,128,256}.png` | `chrome/installer/linux/BUILD.gn:293-303` names this exact set |
| Windows | `win/tiles/Logo.png`, `win/tiles/SmallLogo.png`, the app `.ico` | `chrome/BUILD.gn:1470-1471` |
| macOS | `mac/app.icns`, `mac/Assets.car` | `chrome/BUILD.gn:626-631` |
| Android | mipmap set, adaptive foreground/background/monochrome | already in `branding/android/res/` |

Validation on every generated raster — dimensions, alpha channel present, colour
profile, and for `.icns`/`.ico` that the container holds every declared size.
A silently-wrong icon is the branding defect nobody notices until a release
screenshot.

These are wired through GN by pointing **`branding_path_component`** at an
Astro theme directory rather than by copying files after a sync. See the
integration note below for why that one is not free.

## Version and channel model

**One version string reaches binaries, installers, update manifests, crash
symbols and artifact filenames.** Today there are two: the shipped archive is
named `astro-0.1.0-…` while the PE inside reports `146.0.7680.177`. That
disagreement is the defect.

**Decision: the four-part version is Chromium's, unmodified.**
`chrome/VERSION` stays upstream's, and `chrome/version.gni:25` — a plain
assignment, not a `declare_args()` — keeps reading it. Astro's own respin
counter is `version.release`, and it is **metadata, not an ordering key**.

Why this way:

- A user, a security scanner and `astro://version` all read the same number
  that upstream's advisories cite. "Is this build ≥ 146.0.7680.177?" stays
  answerable.
- Reduced-UA and UA-CH version semantics stay upstream-compatible for free.
- Crash symbols keep matching upstream's version-keyed layout.

What it costs, stated rather than hidden:

> An Astro-only respin of the same Chromium version **cannot be delivered by a
> version-comparing updater on Windows or macOS.** The four parts are identical,
> so nothing orders the new build after the old one.

Linux is unaffected: `installer.py:295, 399, 404` already carry a
`package_release` field and build `versionfull` as `<version>-<release>`, which
is exactly the slot `version.release` fills, and both dpkg and rpm order on it.

Two exits, either of which is a deliberate decision recorded in the manifest
rather than a silent divergence: wait for the next Chromium stable, or give
Astro ownership of the PATCH component and accept that the number no longer
matches upstream's advisories. The default is the first.

Channels are `stable`, `beta`, `dev`, `canary`; only channels that actually
ship may appear in the manifest. An identifier declared for a channel nobody
builds is an invented fact, and its GUIDs would be reserved against nothing.

## User-Agent policy

**Astro exposes no product token, in the UA string or in User-Agent Client
Hints. This is not a default that happens to hold — it is asserted.**

The measured mechanism:

- The UA string's product token is Chromium's `Chrome/<version>`. Astro adds
  nothing to it.
- `components/embedder_support/user_agent_utils.cc:166-168` adds
  `version_info::GetProductName()` to the `Sec-CH-UA` brand list **only** under
  `#if !BUILDFLAG(CHROMIUM_BRANDING)`. `build/BUILD.gn:26,31` sets
  `CHROMIUM_BRANDING=true` whenever `is_chrome_branded` is false, which is
  Astro's configuration. So the brand list is the greased entry plus
  `{"Chromium", version}` and nothing else.

The manifest carries `expose_product_token: false` and
`expose_brand_in_client_hints: false` as `const false`, for a reason that only
becomes visible once you follow the wiring:

> `version_info::GetProductName()` **is** `PRODUCT_FULLNAME` from BRANDING —
> `base/version_info/BUILD.gn:39-46` generates it from `branding_file_path`, and
> `base/version_info/version_info_values.h.version:8` defines
> `PRODUCT_NAME "@PRODUCT_FULLNAME@"`. Renaming the product is therefore one
> `is_chrome_branded` flip away from changing a fingerprinting surface, as a
> side effect of *branding*.

The fields exist so a test can assert the negative and so that flip cannot
happen unnoticed. No manifest field can turn a token on; changing the policy
means editing the schema, which is a review.

## String resources and localization

**No global replacement inside Chromium resource files**, and the reason is
sharper than style.

GRIT keys `.xtb` translation entries by a fingerprint of the *message text*
(`tools/grit/grit/extern/tclib.py:33-43`, via `tools/grit/grit/tclib.py:145-152`).
`chrome/app/chromium_strings.grd` contains **430 translateable messages** whose
text mentions Chromium, and references **80** `.xtb` locale files. A blanket
`sed s/Chromium/Astro/g` changes all 430 message texts, changes all 430 ids, and
every translation keyed to an old id stops matching — so those strings fall back
to English in all 80 locales, with no error from any tool.

The 33 messages marked `translateable="false"` — `IDS_PRODUCT_NAME` at
`chromium_strings.grd:296` among them — carry no translations and are safe.
That distinction is the whole design:

- Astro owns a small GRD/GRDP that **overrides** the product-identity messages,
  with stable ids and proper placeholders.
- Messages Astro has not deliberately replaced keep upstream's text and keep
  their translations.
- The generated inputs come from the manifest; the resource file is not
  hand-edited per release.
- A test asserts placeholder compatibility between each overridden message and
  the upstream message it replaces.

## How the values reach Chromium

Three mechanisms, in strict order of preference. The ratio matters: most of
this is a GN argument, not a patch.

**1. GN argument — no source change at all.**

| Value | Argument | Declared at |
|---|---|---|
| the whole BRANDING file | `branding_file_path` | `build/config/chrome_build.gni:100-103` |
| the branded theme directory | `branding_path_component` | `build/config/chrome_build.gni:79-98` |
| Android application id | `chrome_public_manifest_package` | `chrome/android/chrome_public_apk_tmpl.gni:22-32` |

`branding_file_path` alone carries `PRODUCT_FULLNAME`, `PRODUCT_SHORTNAME`,
`COMPANY_FULLNAME`, `COMPANY_SHORTNAME`, `COPYRIGHT`, `MAC_BUNDLE_ID`,
`MAC_CREATOR_CODE`, `MAC_TEAM_ID` and both installer names into
`build/util/branding.gni:17-45` and `base/version_info/BUILD.gn:39-46` — i.e.
the macOS bundle/helper/framework names, the Windows PE product fields, and
`version_info::GetProductName()`. Point it at `//astro/app/generated/BRANDING`
and that entire surface is Astro's with zero downstream delta.

**2. Added files on the downstream branch — no upstream file modified.**
`branding_path_component` builds paths of the form
`//chrome/app/theme/$branding_path_component/…`, so the theme assets must live
under `chrome/app/theme/`. Adding `chrome/app/theme/astro/` is a pure addition:
no upstream file is edited, and an upstream rename shows up as a missing input
rather than a merge conflict. The same applies to the Astro-owned string GRDP.

**3. A minimal downstream edit — only where upstream hardcodes a name.**
Four places, and they are exactly the ones §"Windows: `astro.exe`" lists, plus
`chrome/common/channel_info_posix.cc:151` for the Linux desktop name. Each edit
substitutes a generated constant for a literal; none adds logic. Every one of
them is listed here so the count is reviewable and cannot grow quietly.

## Rules the schema cannot express

The validator owns these. **A rule that is in neither the schema nor this list
is not enforced** — this list is the contract for `tools/lib/product.py`.

Structural (`--validate`):

1. An identifier with `declared: true` must carry a non-empty `value`; with
   `declared: false` it must carry a `reason`. *(Confirmed necessary: this is
   the one mutation of eleven that the schema alone does not catch — see below.)*
2. Every channel named under `platforms.<os>.channels` must exist in top-level
   `channels`, and vice versa. A one-sided join is how a channel acquires
   identifiers nobody ships.
3. Only `channels.stable` may have an empty `display_suffix`, and only
   `platforms.windows.channels.stable` an empty `install_suffix` — two channels
   installing to the same path is a silent overwrite.
4. Every declared Windows identifier value must be unique across all channels,
   and must differ from the Chromium constants in
   `chrome/install_static/chromium_install_modes.h:57-106`.
5. `platforms.windows.internal_name` must be `executable` with `.exe` replaced
   by `_exe`, so the PE fields cannot disagree with the filename.
6. `version.release` must be an integer ≥ 1.
7. `platforms.linux.mime_types` must be non-empty, contain no duplicates, and
   include `x-scheme-handler/http` and `x-scheme-handler/https` — a browser that
   does not claim those cannot be made the default.
8. ~~`schemes.trusted` and `schemes.untrusted` must differ, and neither may be a
   scheme the network stack already owns.~~ **Retired: the schema now pins both
   with `const`** (see §"Internal URL schemes"), so a manifest cannot reach the
   validator carrying a colliding or duplicated scheme. Restating it here would
   be a rule that can never fire, which is the thing this list is for avoiding.
   The collision was checked once, against the real registry rather than a
   remembered list — `url/url_constants.h:22-64` plus
   `content/common/url_schemes.cc:69-72` — and re-checking it belongs with the
   next change to the pinned values, not with every validation.
9. **An internal scheme may never be registered as an external protocol.**
   `platforms.linux.mime_types` may not contain `x-scheme-handler/<trusted>` or
   `x-scheme-handler/<untrusted>`, and
   `platforms.windows.channels.*.direct_launch_url_scheme`, when non-empty, may
   not equal either. See the note below — this rule exists because the manifest
   got it wrong first.

### Why rule 9 exists

The first version of this manifest declared
`direct_launch_url_scheme: "astro"` on every Windows channel and
`x-scheme-handler/astro` in `platforms.linux.mime_types`, because both fields
name "a scheme" and `astro` is Astro's scheme. That is wrong, and the two
fields are not the same kind of thing:

- `schemes.trusted` is the **privileged internal** scheme. Issue
  [#11](https://github.com/OxyHQ/Astro/issues/11)'s model says it is not
  renderer-accessible from normal web pages, and carries WebUI bindings for
  registered hosts.
- `direct_launch_url_scheme` is an **OS-registered external protocol**. On Linux
  it becomes an `x-scheme-handler/<scheme>` MIME entry
  (`chrome/browser/shell_integration_linux.cc:382-388`); on Windows it is a
  protocol registration. Any web page can emit a link in it and the OS hands
  the navigation to the browser.

Setting them to the same string publishes the privileged internal scheme as a
web-reachable entry point — the exact boundary #11 exists to defend, defeated
by a manifest field rather than by a code change.

Upstream never lets them collide, and says why in its own comments. Chromium's
internal scheme is `chrome://` while its direct-launch scheme is `chromium`
(`shell_integration_linux.cc:927`, asserted by
`chrome/browser/shell_integration_win_unittest.cc:411-413`); Google Chrome's is
`google-chrome` (`:924`). Upstream restricts it further, explicitly "for
security reasons": empty on beta, dev and canary (`:912-922`) and empty on every
secondary install mode on Windows (`shell_integration_win_unittest.cc:399-408`).

Astro therefore declares it **empty** — no external protocol registered at all —
until somebody decides Astro wants one and records why. Rule 9 makes the
collision impossible rather than merely currently-absent, because the mistake
is a natural one to make twice.

Release safety (`--check-release CHANNEL`, additionally):

9. No identifier reachable from that channel may be `declared: false`.
10. No URL anywhere in the manifest may resolve to `localhost`, `127.0.0.0/8`,
    `::1`, a `.local` or `.internal` host, or use a scheme other than `https`.
11. `platforms.macos.team_id` must be declared before a macOS release channel
    may build.
12. The channel must have `is_release: true`.

The eleven-mutation exercise behind rule 1 is worth keeping: each mutation was
applied to the example manifest and re-validated with `tools/lib/lock.py`'s
validator. Ten were caught and named — a copyright missing `@LASTCHANGE_YEAR@`,
a capitalised `Astro.exe`, a `http://localhost` product URL, an undeclared extra
field, `expose_product_token: true`, a bumped `manifest_version`, a removed
`bundle_id`, a `nightly` channel, a space inside `base_app_id`, and a schema
using an unimplemented keyword. The eleventh — `declared: true` with no `value`
— was not, which is why it heads the validator's list rather than being assumed.

## Retiring the old branding path

`tools/apply-branding.sh` and `branding/astro.conf` are removed from the Astro
Next build once the generator exists. They cannot simply be deleted today: they
are the only thing that puts `Astro` into the PE product fields, and measured
fact #3 says that part currently works.

What has to be true first:

- [ ] `//astro/app/generated/BRANDING` is produced from the manifest and
      `branding_file_path` points at it. This alone replaces everything
      `apply-branding.sh` achieves that is not broken.
- [ ] The Astro-owned string resource replaces the `.grd` `sed`.
- [ ] The Linux `.info` file is generated, replacing the three `sed` targets
      that no longer exist (fact #10).
- [ ] `tools/package-*.sh` read identity from the manifest instead of holding
      literals (`PKG_NAME="astro-browser"`, `/opt/astro`, `hello@oxy.so`).
- [ ] A presubmit fails when any generated output is stale.

Only then are `apply-branding.sh` and `astro.conf` deleted, together. Deleting
the conf while the script survives, or vice versa, leaves a half-configured
build that still looks configured — which is what facts #6, #8 and #9 already
are.

## What is blocked, and on what

**Updated after [#7](https://github.com/OxyHQ/Astro/issues/7) landed at
`b949a68` ("build(#7): create //astro and link it through one declared hook").**
The earlier version of this table said six deliverables were blocked on #7. Three
of them no longer are, and the reason the other three still are is different from
what the table said, so it is rewritten rather than ticked off.

Two facts changed the answers, both read from `b949a68`:

- **The repository root *is* `//astro`.** `BUILD.gn:1-6` says so: the repo is
  checked out by DEPS at `src/astro`, "so ITS ROOT IS `//astro`. There is
  deliberately no `astro/` subdirectory". So `//astro/app/` is `<repo>/app/` —
  which `git ls-tree b949a68 -- app` shows does **not** exist yet. Creating it
  is #9's own work, not a wait on anyone.
- **`minimum-chromium-hooks.md` §B pre-declares the branding hook and assigns it
  to #9**: row `chrome/app/theme/…`, version/branding inputs → "product name,
  icons, `chrome/VERSION`-adjacent constants", owner #9. So the Chromium-side
  branding hook is mine to add on the integration branch, not a dependency.

| Deliverable | Blocked on | Why |
|---|---|---|
| Manifest + schema + this design | — | done; reviewable now |
| `tools/lib/product.py` validator | — | reads a file and applies rules; needs no Chromium |
| Generated `BRANDING` | **— (unblocked by #7)** | `branding_file_path` is its own `declare_args` (`build/config/chrome_build.gni:100-103`), so BRANDING can live in `//astro` and be selected by a GN argument. Zero Chromium-owned files. `//astro` now exists |
| Generated `product_config.gni`, C++ constants | **— (unblocked by #7)** | emitted into `<repo>/app/generated/`; `//astro` exists and `app/` is #9's to create |
| Astro-owned string GRD/GRDP | **— (unblocked by #7)** | needs a GN target in `//astro`, which now exists. `grit_rule.gni:272-275` lets the target name its own `resource_ids`, so no Chromium file is touched |
| Astro theme directory + icon generation | the §B hook, **owned by #9** | `branding_path_component` builds `//chrome/app/theme/$branding_path_component/…`, a path inside Chromium. Not a wait on another issue — but see the open question below before assuming a Chromium-owned directory is required |
| Generated scheme constants in `//astro/common/` | slice9's branch, not #7 | `//astro` exists; `common/` is being created on `feature/astro-next-9-scheme-names` |
| Scheme *behaviour* — privileges, CORS, CSP, WebUI bindings | [#11](https://github.com/OxyHQ/Astro/issues/11) | this issue generates the names; #11 owns what they mean |
| `astro://version` acceptance test | [#11](https://github.com/OxyHQ/Astro/issues/11) | #7's half is done — `//astro` compiles and links. Still needs a registered `astro://` scheme |
| Windows executable rename | the four edits in §"Windows: `astro.exe`" | three are Chromium-owned. Not listed in §B; adding them is a #9 allowlist entry |
| Minting the Windows GUIDs and the macOS Team ID | — | not blocked; blocks the first Windows and macOS releases |
| Retiring `apply-branding.sh` | all of the above | see the checklist |

### Open question: can the theme directory avoid Chromium entirely?

`branding_file_path` escaped Chromium because it is an independent
`declare_args`. `branding_path_component` may not be able to: it is interpolated
into `//chrome/app/theme/$branding_path_component/…`, so pointing it at `//astro`
would need a `..`-relative value such as `../../../astro/app/branding`.

Slashes are certainly allowed — Chrome for Testing sets it to
`google_chrome/google_chrome_for_testing` (`build/config/chrome_build.gni:86`).
Whether `..` survives GN's path normalisation in a `sources` list is **not
verified**, and I am not going to guess: it decides whether one §B hook exists
at all.

The command that settles it, which needs a configured build directory and is
therefore not run here:

```
gn gen out/BrandingProbe --args="$(cat gn_args/linux.gn)
    branding_path_component=\"../../../astro/app/branding\""
gn desc out/BrandingProbe //chrome:chrome_app sources | grep product_logo
```

A pass makes the icon row zero-Chromium-delta like BRANDING; a failure confirms
the §B hook. Until then the table above assumes the hook is needed, which is the
conservative direction.

**The warning the old table carried still stands, for the rows that remain.**
Generating into a `//astro` path that does not exist yet means generating into
the legacy `src/` overlay, which is the copy-into-Chromium path Astro Next exists
to remove — and baseline finding 9 records what happens when overlay content
reaches a compiler by a route nobody declared. `BUILD.gn:10-13` is explicit that
the legacy tree "still lives in this repository while #8 retires it. Being in the
repository does not put it in the build graph: nothing below references it, and
nothing should." 
