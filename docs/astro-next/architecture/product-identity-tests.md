<!-- Hand-maintained. Test designs, not measurements — but every command below
     was run against the real artifacts in releases/ before it was written
     down, and the outputs quoted are what those runs produced. -->

# Product identity: acceptance tests

Companion to [`product-manifest.md`](product-manifest.md). Turns the eight
Windows acceptance criteria on issue
[#9](https://github.com/OxyHQ/Astro/issues/9) into implementable checks, and
adds the equivalents for the other three platforms and for the generator
itself.

Every check names **what it inspects**. That is the point of the exercise: the
gate that already exists answers "is the Astro overlay compiled into this
artifact", which is a build-integrity question, and no check anywhere answers
"does this artifact present itself as Astro".

## The rule these tests exist to enforce

> **Verify the installed artifact, never the installer's filename.**

`releases/astro-0.1.0-windows-arm64-portable.zip` and
`releases/astro-0.1.0-windows-arm64-installer.exe` are both named after the
product. Inside the first, the executable is `chrome.exe`; inside the second,
the payload installs `Chrome-bin/chrome.exe`. A filename check passes on both.

## The measurement that makes this possible on Linux CI

All eight Windows criteria can be evaluated on a Linux runner, because the
installed layout is recoverable from the shipped artifacts without Windows.
Both paths were run against the real artifacts:

```
$ 7z x -y -o<dir> releases/astro-0.1.0-windows-arm64-installer.exe
Everything is Ok
Size:       423686415
real    0m3.011s

$ 7z l <dir>/chrome.7z
   2575872  Chrome-bin/chrome.exe
 269735424  Chrome-bin/146.0.7680.177/chrome.dll
   1623040  Chrome-bin/146.0.7680.177/chrome_elf.dll
```

The portable zip is already the extracted layout, so it needs only `unzip`.

**PE metadata is read structurally, not scraped.** `7z l -slt <file.exe>`
prints the parsed `VS_VERSION_INFO` block. Run against the shipped
`astro/chrome.exe` (md5 `d455fd5299434b2ac5f07fa53d1ef00e`):

```
CompanyName: Oxy
FileDescription: Astro
InternalName: chrome_exe
LegalCopyright: Copyright 2026 Oxy. All rights reserved.
OriginalFilename: chrome.exe
ProductName: Astro
ProductShortName: Astro
```

> **Harness rule, learned the expensive way here.** The first read of that block
> used `strings -el`, whose default minimum length is 4, which silently dropped
> the three-character value `Oxy` — making `CompanyName` and `CompanyShortName`
> look **empty** and very nearly producing a finding that the company name was
> never applied. Any string-scraping check in this area must pass `-n 2` at
> minimum; better, use the structured read above, which has no length threshold
> at all.

Icons are extractable too: `7z l -ba <file.exe>` lists 37 icon resources in that
same binary, as `.rsrc/1033/ICON/*.ico`.

## Windows: the eight criteria

Each check is one `tools/tests/cases/*.sh` case in the existing harness: it must
exit 0 **and** print the token via `harness::pass`, which itself refuses to pass
a case that made zero assertions (`tools/tests/lib/harness.sh:14, 69-72`). That
is the outer vacuity floor; the inner floors below are per-check.

Every check runs against a **subject tree** produced by one of two extractors —
`unzip` for the portable archive, `7z x` for the installer — and must run
against *both* for a release, because they are separately produced and have
already disagreed with each other in this repository.

---

### W1 — The public executable is Astro, not `chrome.exe`

**Satisfies:** criterion 1.
**Inspects:** the filenames at the root of the subject tree, and
`platforms.windows.executable` in the manifest.

```
subject must contain  <executable>            (astro.exe)
subject must NOT contain  chrome.exe
PE OriginalFilename of <executable> == <executable>
PE InternalName of <executable> == <internal_name>
```

The last two rows are what stops a rename-after-build: today
`OriginalFilename` reports `chrome.exe`, sourced from `chrome/app/chrome_exe.ver:2`,
so a packager that merely renamed the file would pass a name check and fail this
one.

**Vacuity floor:** assert the subject tree contains more than 100 members and at
least one `.dll`. An extractor that produced an empty directory otherwise passes
"does not contain chrome.exe" perfectly.

**Fails today.** Measured: `astro/chrome.exe`, and `OriginalFilename: chrome.exe`.

**Blocked on [#7](https://github.com/OxyHQ/Astro/issues/7)** — three of the four
edits that rename the executable are downstream source changes. The *check* is
not blocked and should land first, red, rather than arriving with the fix.

---

### W2 — The shortcut targets the Astro executable

**Satisfies:** criterion 2.
**Inspects:** `install_static`'s compiled shortcut constants inside
`chrome_elf.dll`, plus `installer::kChromeExe`'s generated value.

A `.lnk` is written by `setup.exe` at install time and does not exist in any
artifact, so it cannot be read on Linux. What *can* be read is the value setup
would use: the shortcut target is built from `installer::kChromeExe`
(`chrome/installer/util/util_constants.cc:179`) joined to the install directory.

```
UTF-16 string scan of chrome_elf.dll and (when present) setup.exe:
  must contain  <executable>
  must NOT contain  "chrome.exe"
```

**Vacuity floor:** the same scan must find `<product_path_name>` — a positive
control proving the scanner reads this binary's wide strings at all. Without it,
a broken scan reports "no chrome.exe" and reads as a pass. This is the exact
shape that produced a false `unmeasurable` on `chrome.exe` in baseline finding 12.

**Stated limit:** this proves the constant, not the written shortcut. A real
`.lnk` assertion needs a Windows runner and is listed under "What these cannot
prove".

**Observation for [#4](https://github.com/OxyHQ/Astro/issues/4), not for this
issue:** the shipped installer appears to carry no `setup.exe` at all. Its PE
resource list holds exactly one entry — `.rsrc/B7/CHROME.PACKED.7Z` — with no
`SETUP.EX_` resource, and the extracted `chrome.7z` contains no `setup.exe` and
no `Installer/` directory (0 matches for either, case-insensitive, across 355
members). The literal `SETUP.EX_` *does* appear in the binary as a wide string,
which is mini_installer's lookup name for a resource that is not there. That is
a packaging question and belongs on #4; it is recorded here because it is
another reason these checks must read the installed tree rather than trust the
installer.

---

### W3 — AppUserModelID, registry entries and default-browser registration belong to Astro

**Satisfies:** criterion 3.
**Inspects:** the `install_static::kInstallModes` constants compiled into
`chrome_elf.dll` (and `chrome.dll`), compared against the manifest's
`platforms.windows.channels.<channel>` block.

```
for each of: base_app_id, browser_prog_id_prefix, browser_prog_id_description,
             pdf_prog_id_prefix, pdf_prog_id_description, base_app_name
    UTF-16 scan must contain the manifest value
    UTF-16 scan must NOT contain the Chromium value from
        chrome/install_static/chromium_install_modes.h:48-56
```

**Vacuity floor:** the count of manifest values found must equal the number
searched for. A scan that finds zero of six "correctly absent" Chromium values
and zero of six Astro values is a broken scan, not a pass.

**Fails today, and this is the sharpest measurement in the set.** The shipped
`astro/chrome_elf.dll` contains `ChromiumHTM` ×1, `ChromiumPDF` ×1 and
`Chromium` ×2 — so the ProgIDs Windows would register for HTML and PDF, the
AppUserModelID used for taskbar grouping and toasts, and the default-browser
entry under `Software\Clients\StartMenuInternet\…`
(`chrome/installer/util/shell_util.cc:204-219, 462`) are all Chromium's.

**Blocked on [#7](https://github.com/OxyHQ/Astro/issues/7)** for the fix
(a generated `astro_install_modes.h` must be reachable from the build) and on
minting the per-channel GUIDs, which is not blocked by anything.

---

### W4 — The uninstall entry belongs to Astro

**Satisfies:** criterion 4.
**Inspects:** `install_static::kProductPathName` and `kCompanyPathName` in
`chrome_elf.dll`, plus the generated header, against the derivation at
`chrome/install_static/install_util.cc:336-344`.

The key is not stored anywhere; it is computed as
`Software\Microsoft\Windows\CurrentVersion\Uninstall\` + `[<company> ]` +
`<product>` + `<install_suffix>`. The check therefore asserts the *inputs* and
asserts the derivation separately, in a unit test over the generated header, so
that a future upstream change to the derivation is caught by the second rather
than silently accepted by the first.

```
generated header: kProductPathName == platforms.windows.product_path_name
generated header: kCompanyPathName == platforms.windows.company_path_name
chrome_elf.dll UTF-16 scan: contains product_path_name, lacks "Chromium"
DisplayName written by setup == <product.full_name><channel display_suffix>
```

**Vacuity floor:** the same scan must find at least one other known constant
from the same binary (`Chrome Sandbox` is present in the shipped `chrome.exe`
and serves as an upstream-invariant control).

**Fails today** — `Chromium` is present in both `chrome.exe` and
`chrome_elf.dll`.

---

### W5 — Installation paths belong to Oxy/Astro

**Satisfies:** criterion 5.
**Inspects:** the same two constants (they decide the install directory under
Program Files, `install_util.cc:512-523`), the user-data directory
(`chrome/install_static/user_data_dir.cc:102`), and the policy key
(`install_util.cc:526-527`).

```
chrome_elf.dll must contain  "SOFTWARE\Policies\<product_path_name>"
chrome_elf.dll must NOT contain  "SOFTWARE\Policies\Chromium"
payload root directory name is derived from product_path_name, not "Chrome-bin"
```

**Vacuity floor:** assert the `SOFTWARE\Policies\` prefix is found at all —
a typo in the backslash escaping otherwise makes every variant absent, and
absence reads as success on the negative half.

**Fails today** — the shipped `chrome.exe` contains `SOFTWARE\Policies\Chromium`,
and the installer payload root is `Chrome-bin/`.

**Note on `Chrome-bin`:** it is a payload-internal directory name, not something
a person sees. Renaming it is an internal-component rename and is **not**
required by the policy. It is listed here only so a reviewer can see it was
considered and deliberately left alone.

---

### W6 — The icon and PE metadata show Astro/Oxy

**Satisfies:** criterion 6.
**Inspects:** the parsed `VS_VERSION_INFO` block of every Astro-owned PE in the
subject tree, and the icon resources of the browser executable.

```
for the browser executable and the installer:
    ProductName        == product.full_name  (installer: installer_full_name)
    FileDescription    == the same
    CompanyName        == company.full_name
    CompanyShortName   == company.short_name
    ProductShortName   == product.short_name (installer: installer_short_name)
    LegalCopyright     matches ^Copyright [0-9]{4} <company.full_name>\b
    OriginalFilename   == platforms.windows.executable
    InternalName       == platforms.windows.internal_name

icons:
    the extracted GROUP_ICON/ICON set is byte-identical to the generated set
    it is NOT byte-identical to upstream Chromium's
```

**Vacuity floor:** assert the parsed block yielded at least eight key/value
pairs before comparing any of them; an unparsed or empty block otherwise makes
every comparison vacuously skippable. And read with the structured method or
`-n 2`, per the harness rule above.

**Half passes today.** `ProductName`, `FileDescription`, `CompanyName`,
`CompanyShortName`, `ProductShortName` and `LegalCopyright` are already correct
on the shipped `chrome.exe` and on the installer (`ProductName: Astro Installer`,
`CompanyName: Oxy`). `OriginalFilename` and `InternalName` are not.

---

### W7 — `astro://version` reports Astro and the path of the Astro executable

**Satisfies:** criterion 7.
**Inspects:** the rendered version page in a running browser.

```
the "Application" label     == product.full_name
the "Executable path" row   ends with platforms.windows.executable
                            and starts with the derived install directory
the "User agent" row        contains no "Astro"
```

The first row is `IDS_PRODUCT_NAME` (`chrome/browser/ui/webui/version/version_ui.cc:83`),
which is `Chromium` at `chrome/app/chromium_strings.grd:296` and is one of the
33 non-translateable messages the Astro-owned resource may safely override.
The third row is the User-Agent assertion (UA1 below) taken at the surface a
person actually looks at.

**Vacuity floor:** the page must also yield a non-empty "Revision" row matching
the locked Chromium commit. A probe that returns an empty document otherwise
satisfies "contains no Astro" perfectly — this is exactly the failure baseline
finding 10 recorded, where a headless `--dump-dom` probe reported
`chrome://version` as absent, which is false in every Chromium ever built.

**Blocked on [#7](https://github.com/OxyHQ/Astro/issues/7) and
[#11](https://github.com/OxyHQ/Astro/issues/11).** It needs a build that
contains the Astro overlay — baseline finding 1 records that no such build
currently exists from committed source — and a registered `astro://` scheme,
which is #11's. Until both land this check must report **not-captured**, naming
the two issues. It must not report a pass, and it must not report a failure
either: nothing was measured.

---

### W8 — Internal Chromium DLLs are not required to be renamed

**Satisfies:** criterion 8.
**Inspects:** the subject tree, asserting the *presence* of the upstream names.

```
subject MUST contain  chrome.dll, chrome_elf.dll, chrome_crashpad_handler.exe
```

This check exists to be a ratchet in the opposite direction from the other
seven. Written as an assertion rather than left implicit, it means a future
"finish the branding" change that renames the internal components fails a test
that names the policy, instead of being reviewed on taste.

**Vacuity floor:** the same case asserts W1's negative (`chrome.exe` absent)
in the same run, so the two cannot both be satisfied by an empty tree.

**Passes today**, and must keep passing.

---

## The other platforms

Shorter, because they follow the same pattern: inspect the installed artifact,
compare against the manifest, and give every negative assertion a positive
control.

| ID | Criterion | Inspects | State today |
|---|---|---|---|
| L1 | The Linux binary is Astro | `<install_dir>/<program_name>` inside the deb | fails: `./opt/astro/chrome` |
| L2 | The install directory is vendor-scoped | the deb's path set | fails: `/opt/astro`, while `astro.conf` declares `/opt/oxy/astro` |
| L3 | The command is `astro` | `./usr/bin/<command_name>` exists and resolves into `install_dir` | passes: `/usr/bin/astro` |
| L4 | Package metadata matches the manifest | deb `control`: Package, Maintainer, Homepage, Description | would pass on the shipped values, and that is the problem: they are literals in `tools/package-deb.sh`, and the config that claims to own them says `team@oxy.so` while the deb says `hello@oxy.so`. The check is only meaningful once G6 forbids the literals |
| L5 | The desktop entry is consistent | `.desktop` basename == package; `Exec` points at `command_name`; `MimeType` == manifest list | partially fails |
| L6 | **`StartupWMClass` is true, not merely declared** | the generated desktop-name constant == `<package>.desktop` | fails: `chrome/common/channel_info_posix.cc:151` returns `chromium-browser.desktop`, so the declared `StartupWMClass=astro-browser` never matches |
| L7 | AppStream id matches `desktop_id` | `usr/share/metainfo/<desktop_id>.metainfo.xml` | passes: `so.oxy.Astro.metainfo.xml` |
| M1 | The bundle is `Astro.app` with executable `Astro` | the built bundle | not-captured: no macOS build on this machine |
| M2 | `CFBundleIdentifier` == `macos.bundle_id`, helpers suffixed from it | `Info.plist` in the bundle and each helper | not-captured |
| M3 | The build is signed with the declared Team ID | `codesign -dv` | blocked: `team_id` is undeclared |
| A1 | Application id == `android.application_id` | `aapt2 dump packagename` on the APK | not-captured: no Android build |
| A2 | Launcher label == `android.app_label` | `aapt2 dump badging` | not-captured |
| A3 | **No `sharedUserId` is declared** | the merged `AndroidManifest.xml` | not-captured; must be asserted before the first Android release |

`not-captured` is used in the sense the baseline uses it: the check is designed,
the command that would capture it is named, and nothing may be marked satisfied
on its behalf.

## User-Agent

| ID | Asserts | Inspects |
|---|---|---|
| UA1 | The UA string contains no product name other than Chromium's `Chrome/` token | `navigator.userAgent` from a real page load, and `astro://version`'s user-agent row |
| UA2 | `Sec-CH-UA` carries no Astro brand | the request header received by a local test server |
| UA3 | The manifest cannot express the opposite | `expose_product_token` and `expose_brand_in_client_hints` are `const false` in the schema; a mutation setting either true must fail validation |

UA3 is runnable today and was run: setting `expose_product_token: true` on the
example manifest produces
`user_agent.expose_product_token: expected False, got True`. UA1 and UA2 are
blocked on a real Astro build.

The positive control for UA1 and UA2 is not optional. `Chromium` **must** be
present in the brand list — `GenerateBrandVersionList` always emits
`{"Chromium", version}` — so a probe finding neither `Astro` nor `Chromium`
has failed to read the header rather than confirmed anything.

## Generator and manifest tests

These are the only ones with no external dependency, and they should land first.

| ID | Asserts | Notes |
|---|---|---|
| G1 | The example/real manifest validates against the schema | ran clean: 0 errors under `tools/lib/lock.py`'s validator |
| G2 | Each invalid-manifest fixture is rejected, and the message names the field | the eleven mutations in `product-manifest.md` §"Rules the schema cannot express"; ten are schema-caught, one is a validator rule |
| G3 | The schema uses no keyword the validator skips | already enforced: `tools/lib/lock.py:80-92` reports an unimplemented keyword as an error. Verified by injecting `minimum` into the schema, which was rejected by name |
| G4 | Generated outputs are byte-stable across two runs on the same manifest | deterministic ordering and formatting; no timestamps, no dict-iteration order |
| G5 | Generated outputs are stale-free | `product.py --generate --check` regenerates into a temp dir and diffs, the same shape as `tools/baseline/generate-all.sh --check` |
| G6 | No value declared in the manifest appears as a literal anywhere else | a source scan over `tools/`, `src/` and the packagers. This is the check that keeps `PKG_NAME="astro-browser"` and `/opt/astro` from coming back |
| G7 | `--check-release` refuses an undeclared identifier | run it against the example manifest: it must fail, naming all sixteen Windows identifiers and the macOS Team ID |
| G8 | Every generated file carries a "generated, do not edit" header naming the manifest and the generator | the same rule the baseline documents already live under |

G6 needs care to avoid being the check that cries wolf: it must exclude the
generated tree itself, must print the full matched line rather than a truncated
capture, and must be run against a deliberately reintroduced literal to confirm
it fires before it becomes a gate.

## What these tests cannot prove

Stated so nothing is marked satisfied on their strength:

- **Nothing about a real installation.** Registry keys actually written,
  shortcuts actually created, `.lnk` targets, default-browser association after
  a user accepts it, and the Add/Remove Programs entry as Windows renders it all
  require a Windows runner. W2–W5 assert the constants those operations are
  built from, which is strictly weaker and is labelled as such.
- **Nothing about macOS or Android artifacts**, neither of which can be produced
  on this machine. Baseline finding 12 records what happens when a gate is
  written for an artifact nobody has: the direction is correct and loud, but it
  is uncalibrated until a real one exists.
- **Nothing about the browser's runtime identity** until an Astro build exists.
  Baseline finding 1 is explicit that a binary from current committed source is
  Chromium plus the legacy patch base, with no Astro overlay, and no behavioural
  criterion may be marked satisfied on one.

## Blocking summary

| Group | Blocked on | May be implemented now? |
|---|---|---|
| G1–G8 generator/manifest tests | — | yes; land these first |
| UA3 | — | yes |
| W1, W2, W3, W4, W5, W6, W8 — the *checks* | — | yes, and they should land red against the current artifacts |
| W1, W3, W4, W5 — the *fixes* | [#7](https://github.com/OxyHQ/Astro/issues/7) | no |
| W6 icon half | [#7](https://github.com/OxyHQ/Astro/issues/7) | no — needs the generated icon set wired through GN |
| W7 | [#7](https://github.com/OxyHQ/Astro/issues/7) + [#11](https://github.com/OxyHQ/Astro/issues/11) | no; report not-captured |
| L1–L7 checks | — | yes |
| L6 fix | [#7](https://github.com/OxyHQ/Astro/issues/7) | no — a downstream constant |
| M1–M3, A1–A3 | a macOS/Android build | no; report not-captured |
| UA1, UA2 | [#7](https://github.com/OxyHQ/Astro/issues/7) | no |

Landing a check red before its fix exists is deliberate. A check that arrives
with its fix has never been observed to fail, and the repository has already
recorded three separate instances of a check whose pass and whose
nothing-was-measured looked identical.
