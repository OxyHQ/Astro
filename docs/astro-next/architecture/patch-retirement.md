<!-- Hand-maintained. Not generated: a retirement decision is a judgement about
     what a patch is for, and no tool can derive that from a diff.
     Every count and every quoted line in it was measured from committed state;
     the command that produced each is given. -->

# Patch retirement plan

How each of the 54 Astro patches stops existing, in what order, and what has to
be true first.

Issue [#8](https://github.com/OxyHQ/Astro/issues/8) (ASTRO-NEXT-005), under epic
[#3](https://github.com/OxyHQ/Astro/issues/3). This document is the
**final-disposition** half that #8 asks for; the *inventory* half already exists
and is generated —
[`../baseline/patch-inventory.md`](../baseline/patch-inventory.md) and
[`../baseline/patch-dispositions.json`](../baseline/patch-dispositions.json).
Neither of those is edited by this work. Where a figure is owned by a generated
document this file cites it rather than restating it.

`patch-retirement.json` beside this file carries the same decisions
machine-readably, one entry per patch.

> **Measured before the patch repairs; every quoted `@@` header below is a
> pre-repair one.** This document was written against a patch stack in which
> seven files were structurally malformed and nine carried edits belonging to an
> ungoogled patch or to domain substitution. §4.2's diagnosis of the second group
> — *"they were diffed from an already-patched tree"* — was correct, and all
> fourteen have since been repaired on exactly that reading (`7bb07f4`,
> `76466c6`, `3310e14`, and the commit adding this note). Every patch in both
> declared series now applies, 168 of 168.
>
> What that changes here, and nothing else: the ungoogled content this file
> attributes to an Astro patch is no longer in that patch. Concretely, §1.3 and
> §4.2's "carries ungoogled deletions" set is now empty — `015`'s two hunks
> (`@@ -1017,9 +1021,7 @@`, `@@ -1041,25 +1043,6 @@`), `020`'s seven and `039`'s
> one are gone from those patches, and the deletions belong to
> `remove-unused-preferences-fields` and `fix-building-without-safebrowsing`
> alone. So are the six "Learn more" help-link deletions of §7 (`009` ×3, `013`
> ×3) and `012`'s `if="[[false]]"` hunk, which are `remove-uneeded-ui`'s. Line
> numbers in `015`'s surviving `@@` headers shifted with the re-anchoring. Every
> retirement **decision**, bucket and owner in this file is unaffected: what a
> patch is for did not change, only which lines are actually its own. The current
> apply status is `docs/astro-next/policy/endpoints.json`'s
> `non_applying_patches` and baseline finding 3; read those rather than this file
> for it.

## Scope, and what this document deliberately does not do

- **Analysis only.** Nothing under `patches/`, `src/`, `webui/` or `gn_args/`
  was modified. No patch was rewritten, reordered, split or deleted.
- **Committed state only.** Two patch files carry uncommitted working-tree
  edits — `020-register-oxy-prefs.patch` and `046-adblock-prefs.patch`
  (`git status --porcelain patches/`). Every classification below was made
  against `git archive HEAD patches/astro`, and the working-tree delta is
  reported separately in §8. This is the rule finding 6 of
  [`../baseline/findings.md`](../baseline/findings.md) exists to enforce.
- **It does not decide product policy.** Where a patch encodes a behaviour
  somebody has to choose — Safe Browsing, EV certificates, the User-Agent, the
  default search engine — this file records *that a decision is owed and who
  owns it*, and stops. Guessing a disposition here would launder an expectation
  into the record as a measurement, which is the failure mode finding 6
  documents.
- **It does not restore `007-oxy-auth-build-hook.patch`.** Finding 1 rules that
  out and the reasoning is unchanged by anything here.

## How to read a classification

Every patch gets exactly one primary bucket. Several patches do more than one
thing; those carry **per-hunk** rows naming the `@@` header, because a patch
that is 97 % branding and 3 % a security-relevant deletion must not be filed as
branding.

| Bucket | Meaning |
|---|---|
| **A — auto** | Disappears once a real `//astro` target exists and is linked. No Chromium-owned file changes at all. |
| **B — hook** | The behaviour survives and needs a named minimal call from a Chromium file into `//astro`. |
| **C — branding** | Product naming, identifiers and strings. Owned by [#9](https://github.com/OxyHQ/Astro/issues/9). |
| **D — scheme** | Exists only because `astro://` is not a real scheme. Owned by [#11](https://github.com/OxyHQ/Astro/issues/11) / [#12](https://github.com/OxyHQ/Astro/issues/12) / [#13](https://github.com/OxyHQ/Astro/issues/13). |
| **E — policy** | Inherited or product behaviour needing a decision. Owned by [#10](https://github.com/OxyHQ/Astro/issues/10), and [#20](https://github.com/OxyHQ/Astro/issues/20) where security is involved. |
| **O — obsolete** | The surface it modifies stops being Astro's product surface. Remove, do not reimplement. |
| **R — remove** | Content that must not survive in any form. No successor hook. |
| **F — unclassified** | Stated as unclassified rather than guessed. Three hunk-level items only; see §7. |

`A` and `R` were not in the brief's list and are reported as additions rather
than folded into a neighbour: forcing `011`/`036` into "scheme" would file a
token-handling defect as a URL-display concern, and forcing `051` into "hook"
would assert a Chromium change that measurement says is not needed.

---

## 1. Read first — security-relevant content, and who must not inherit it silently

Six items. Each names the patch and the hunk. Every attribution below was
produced by matching each removed line of the Astro patch against the removed
lines of all 112 ungoogled patches, so "Astro-originated" means *no ungoogled
patch removes that line*, not an impression.

### 1.1 An identity flow that carries tokens in URLs — patches `011`, `015`, `036`, `039`

The epic's non-negotiable list says *"No access token, refresh token or
sensitive session identifier in URLs."* The committed stack implements exactly
that, in the Chromium tree, at four sites:

- `011-astro-url-scheme-alias.patch` @@ -50,6 +56,38 @@ — inside
  `HandleChromeAboutAndChromeSyncRewrite`, parses an auth callback, writes
  `oxy.session_id` / `oxy.user_id` / … to profile prefs, calls
  `OxyAuthTokenStore::StoreAccessToken` / `StoreRefreshToken`, and
  `LOG(INFO) << "Oxy: Signed in as " << params.username`.
- `036-navigator-auth-intercept.patch` @@ -142,6 +145,36 @@ — the same logic
  again in `AdjustNavigateParamsForURL`, for `https://auth.oxy.so` redirects.
- `039-auth-navigation-throttle-register.patch` @@ -611,6 +608,9 @@ — registers
  `oxy::OxyAuthNavigationThrottle`, a third implementation of the same
  interception.
- `015-oxy-profile-menu-impl.patch` @@ -1249,6 +1234,58 @@ — the button that
  starts it, building `…/login?client_id=astro-browser&redirect_uri=astro://auth/callback&response_type=token`.

The overlay side (`src/chrome/browser/oxy/oxy_auth_callback_handler.cc`,
committed) shows what those four accept:

```cpp
net::GetValueForKeyInQuery(url, "access_token", &params.access_token);
net::GetValueForKeyInQuery(url, "refresh_token", &params.refresh_token);
…
params.is_valid = !params.access_token.empty();
```

`IsOxyAuthCallback` matches `https://auth.oxy.so/redirect/astro` as well as
`astro://auth/callback` **and `chrome://auth/callback`**; the throttle's
`MaybeCreateAndAdd` keys only on the URL. There is no `state`, no PKCE, no
origin check, and `oxy_auth_navigation_throttle.cc` base64-decodes the JWT
payload to recover `user_id` without verifying a signature. Validity is
"a non-empty `access_token` was present in a query string".

> **Ordering consequence, and it is the single most important line in this
> document.** Today this code is inert: finding 1 measured that nothing links
> the overlay into the build. **Linking `//astro` (#7) while `011`, `036` and
> `039` are still in the stack switches this flow on for the first time.**
> These three must leave the stack in the same change that links the overlay,
> or before it — not in a later identity wave.

Owner: [#16](https://github.com/OxyHQ/Astro/issues/16). Disposition: **R —
remove**, no successor hook. The replacement is Authorization Code + PKCE inside
`//astro`, which needs no `browser_about_handler.cc` or `browser_navigator.cc`
edit at all.

### 1.2 Tokens registered as plaintext profile preferences — patch `020`

`020-register-oxy-prefs.patch` @@ -1720,6 +1713,15 @@ registers
`oxy.access_token` and `oxy.refresh_token` as profile string prefs. Profile
prefs are plaintext JSON on disk. The overlay's own store writes to
OS-encrypted files instead (`oxy_auth_token_store.cc`, `OSCrypt::EncryptString`),
so these two pref names are a second, unencrypted home for the same secrets that
no committed code appears to fill — but they are registered, writable and
readable by anything holding a `PrefService`. Owner: #16. They must not be
carried into `astro::RegisterProfilePrefs`.

### 1.3 Security-relevant deletions Astro re-carries but did not originate — `020`, `015`, `039`

This is the distinction that keeps #20 from chasing a decision nobody made.

| Patch / hunk | Deleted | Originated by |
|---|---|---|
| `020` @@ -164,7 +164,6 @@, @@ -176,7 +175,6 @@, @@ -269,7 +267,6 @@ | three includes: `safe_browsing_prefs.h`, `signin_pref_names.h`, ntp `safe_browsing_handler.h` | ungoogled `remove-unused-preferences-fields.patch`, `fix-building-without-safebrowsing.patch` |
| `020` @@ -1425,7 +1422,6 @@ | `safe_browsing::RegisterLocalStatePrefs(registry)` | ungoogled `remove-unused-preferences-fields.patch` |
| `020` @@ -1622,9 +1618,6 @@ | `screen_ai::RegisterLocalStatePrefs(registry)` + its `#if !BUILDFLAG(IS_ANDROID)` guard | ungoogled `disable-ai.patch` |
| `020` @@ -1784,7 +1786,6 @@ | `safe_browsing::RegisterProfilePrefs(registry)` | ungoogled `remove-unused-preferences-fields.patch` |
| `020` @@ -1900,7 +1901,6 @@ | `ntp::SafeBrowsingHandler::RegisterProfilePrefs(registry)` | ungoogled `fix-building-without-safebrowsing.patch` |
| `015` @@ -1017,9 +1021,7 @@ | the signed-in test behind the account-settings button, replaced by `false` | ungoogled `remove-unused-preferences-fields.patch` |
| `015` @@ -1041,25 +1043,6 @@ | the entire body of `MaybeBuildGoogleServicesSettingsButton()` | ungoogled `remove-unused-preferences-fields.patch` |
| `039` @@ -418,10 +419,6 @@ | `SSLErrorHandler::SetClientCallbackOnInterstitialsShown(base::BindRepeating(&MaybeTriggerSecurityInterstitialShownEvent))` — the hook that reports a shown SSL interstitial to the enterprise API | inox `0001-fix-building-without-safebrowsing.patch` |

**Measured: every substantive deletion in `020` (9 of 9 removed lines), in `015`
(all four substantive removals) and in `039` (all four removed lines) is
byte-identical to a deletion an ungoogled patch already makes.** Nothing in
these three is an Astro-originated removal.

The operational consequence is the part that is easy to get backwards:
**dropping the ungoogled patch does not restore the behaviour, because the
Astro patch deletes the same lines independently.** Any #20 decision to restore
Safe Browsing pref registration, the profile-menu account settings entry or the
SSL-interstitial reporting hook has to be applied to *both* stacks, and a
`patches/ungoogled/` audit alone will report the job done while `020`, `015` and
`039` continue to remove it.

Why the duplication exists at all: these patches were generated by diffing a
tree that already had the ungoogled stack applied, so they captured foreign
content. It is also the concrete cause of three of the nine "context drift"
failures finding 3 records — `020`, `015` and `039` cannot apply after the
ungoogled patches, because the lines they expect to delete are already gone.

### 1.4 Certificate handling, and the one Astro-originated security change — patch `044`

`044-disable-ev-certificate-metadata.patch` is the only patch in the stack whose
security-relevant deletions are Astro's own:

- @@ -16,12 +16,9 @@ removes `#define PLATFORM_USES_CHROMIUM_EV_METADATA`
  entirely, so every platform takes the stub path.
- @@ -123,24 +123,18 @@ changes `EVRootCAMetadata::RemoveEVCA` from
  `return true;` to `return false;`, and drops four `LOG(WARNING)` lines.

Its own header explains it exists to correct ungoogled's
`extra/iridium-browser/Remove-EV-certificates.patch`, which substitutes a dummy
root whose OID `"0"` fails ASN.1 decoding at every startup. The two are a pair:
**if #8 drops the Iridium patch, `044` has nothing left to correct** and both
retire in one change. If EV treatment is to be a deliberate Astro position, that
position is #20's to state. Owner: [#20](https://github.com/OxyHQ/Astro/issues/20),
paired with `extra/iridium-browser/Remove-EV-certificates.patch`.

### 1.5 A scheme registered as standard, secure, CORS-enabled and savable, with no trust model — patch `025`

`025-astro-scheme-register.patch` @@ -278,6 +278,12 @@ pushes `"astro"` onto
four lists at once in `ChromeContentClient::AddAdditionalSchemes`:
`standard_schemes`, `secure_schemes`, `cors_enabled_schemes`,
`savable_schemes`. Nothing else in the stack constrains what may be loaded over
it, and `030` adds it to `ProfileIOData::IsHandledProtocol`. That combination is
precisely what #11 exists to design deliberately. It is not a defect to fix
here; it is a decision that has never been written down. Owner:
[#11](https://github.com/OxyHQ/Astro/issues/11).

### 1.6 Settings text that tells users their data goes to Oxy when the code still sends it to Google — patches `013`, `033`, `009`

A find-and-replace of `Google` → `Oxy` ran over the settings string resources.
The strings are user-facing privacy disclosures and the underlying
implementations are untouched. Measured examples from
`013-settings-google-to-oxy.patch`:

```
+      Uses the same spell checker that’s used in Oxy search. Text you type in the browser is sent to Oxy.
+      Sends URLs to Safe Browsing to check them. … Temporarily links this data to your Oxy Account when you're signed in, to protect you across Oxy apps.
+      Real-time, AI-powered protection … based on your browsing data getting sent to Oxy
```

and from `033-shared-settings-google-to-oxy.patch`:

```
+      Sends URLs of pages you visit to Oxy
+      Automatically sends usage statistics and crash reports to Oxy
+      Encrypt synced passwords with your Oxy Account
```

Chromium's enhanced spell check, Safe Browsing and UKM endpoints are unchanged
by these patches; crash reporting is disabled by the inherited
`disable-crash-reporter.patch`, so the crash-report sentence describes a
transmission that does not happen at all. Either way the disclosure is false in
the shipped UI.

This is not a branding item and must not retire with the branding cluster.
Owner: [#10](https://github.com/OxyHQ/Astro/issues/10) (privacy policy and
feature matrix) with [#15](https://github.com/OxyHQ/Astro/issues/15) for the
settings surface. It is also the strongest single argument for #8's rule that
"no feature removal merely because code contains a Google reference": here the
reference was removed and the feature was not.

---

## 2. Classification counts

54 patches. Every patch has exactly one primary bucket; 12 of them additionally
carry hunk-level rows.

| Bucket | Count | Patches |
|---|---|---|
| **A — auto** (no Chromium change once `//astro` exists) | 4 | `008`\*, `051`, `054`, `055` |
| **B — hook** (needs a named Chromium hook) | 15 | `010`, `014`, `015`, `020`, `025`, `039`, `045`, `046`, `047`, `048`, `049`, `050`, `052`, `053`, `056` |
| **C — branding → #9** | 11 | `001`, `002`, `003`, `005`, `009`, `012`, `013`, `031`, `032`, `033`, `034` |
| **D — `astro://` → #11/#12/#13** | 15 | `021`, `022`, `023`, `024`, `026`, `027`, `028`, `029`, `030`, `037`, `038`, `040`, `041`, `042`, `043` |
| **E — policy decision → #10 / #20** | 4 | `004`, `006`, `019`, `044` |
| **O — obsolete surface** | 3 | `016`, `017`, `018` |
| **R — remove outright** | 2 | `011`, `036` |
| **F — unclassified** | 0 whole patches, 3 hunk-level items | see §7 |

\* `008` is bucket **A** only under one storage decision; see its row.

Cross-cutting, counted separately because they are *hunks*, not patches:

| Marker | Count | Where |
|---|---|---|
| Security-relevant deletions re-carried from ungoogled | 10 hunks | `020` ×7, `015` ×2, `039` ×1 (see §1.3) |
| Astro-originated security-relevant change | 2 hunks | `044` |
| Token-in-URL identity handling | 4 hunks | `011`, `015`, `036`, `039` |
| Patches carrying domain-substituted text | 9 | `001`(12), `009`(4), `013`(37), `023`(1), `028`(1), `033`(6), `034`(4), `038`(1), `041`(2) — counts are matching lines from `grep -c 'qjz9zk\|9oo91e' ` |
| Patches carrying ungoogled *additions* | 2 | `023`, `027` |
| Patches carrying ungoogled *deletions* | 3 | `015`, `020`, `039` |
| "Learn more" help links deleted from strings | 6 hunks | `009` ×3, `013` ×3 (+ `012` hunk 3 disables the settings help button) |

---

## 3. Per-patch classification

Hunk references are the patch's own `@@` headers.

### Branding and product constants — bucket C, owner #9

| Patch | Bucket | Retires by | Hunk-level exceptions |
|---|---|---|---|
| `001-branding-strings.patch` | C | #9 generates `chromium_strings.grd` overrides from one source | @@ -…IDS_ABOUT_VERSION_COPYRIGHT: replaces `Copyright <ph name="YEAR">{0,date,y}</ph> The Chromium Authors. All rights reserved.` with `Made with ❤️ in the 🌎 by Oxy.` — deletes an attribution notice **and** the `{0,date,y}` format placeholder the caller supplies. Licence/attribution decision, not branding: #9 + #29. Also 12 substituted-domain lines. |
| `002-branding-product-name.patch` | C | #9 (`BRANDING` is already generated from `branding/astro.conf` in spirit) | — |
| `003-branding-linux-package.patch` | C | #9 | — |
| `005-branding-components-strings.patch` | C | #9 | Measured clean: 0 lines unexplained by the substitution map. |
| `009-branding-settings-strings.patch` | C | #9 (strings) | 3 hunks delete a `<ph name="BEGIN_LINK">…"$1"…</ph>` help link (memory saver, energy saver, preload pages) while the C++ caller still supplies `$1`. → §7. 4 substituted-domain lines, one of them inside a live `href` (`safebrowsing.9oo91e.qjz9zk`). |
| `012-settings-border-style.patch` | C (→ #15) | #15 owns the settings surface | @@ -94,7 +95,7 @@ replaces `if="[[learnMoreUrl]]"` with `if="[[false]]"`, disabling the subpage help button globally. Behaviour, not styling → #10/#15. |
| `013-settings-google-to-oxy.patch` | C (→ #15) | #9 + #15 | §1.6 false disclosures; 3 hunks delete help links as in `009`; 37 substituted-domain lines. |
| `031-linux-icon-name.patch` | C | #9 | — |
| `032-linux-desktop-name.patch` | C | #9 | — |
| `033-shared-settings-google-to-oxy.patch` | C (→ #15) | #9 + #15 | §1.6. |
| `034-profiles-google-to-oxy.patch` | C (→ #15) | #9 + #15 | — |

Structural check on all six string patches: added and removed line counts are
equal, the set of `<message name=…>` ids is identical on both sides, and every
changed line pair except those named above is explained by the substitution map
`Chromium→Astro`, `Google→Oxy` plus the domain-substitution table. So the
branding cluster is mechanically safe to regenerate — the exceptions above are
the entire non-mechanical content.

### `astro://` — bucket D

All 15 exist for one reason: `chrome://` is the real scheme and `astro://` is
painted on at every site that displays, parses, copies, persists or navigates a
URL. **They are not retired one at a time.** Once #11/#12 make `astro://` a real
scheme with its own origin and process lock, the URL *is* `astro://` and there
is nothing to rewrite.

| Patch | Sub-owner | What it rewrites |
|---|---|---|
| `024-astro-scheme-constant.patch` | #11 | Adds `content::kAstroUIScheme` to `content/public/common/url_constants.h`. |
| `025-astro-scheme-register.patch` | #11 | `AddAdditionalSchemes` — see §1.5. Survives as the hook `astro::AddAdditionalSchemes(schemes)`, which is why it is also bucket B. |
| `030-protocol-handler-astro.patch` | #11/#12 | `ProfileIOData::IsHandledProtocol`. |
| `026-navigator-astro-rewrite.patch` | #12 | Rewrites `astro://`→`chrome://` in `AdjustNavigateParamsForURL`. **Conflicts with `036`** — see §4.3. |
| `028-security-display-astro.patch` | #12/#13 | `FormatUrlForSecurityDisplay` — the security/permission surface. Also carries 1 substituted-domain comment. |
| `041-navigation-controller-astro.patch` | #12 | `RewriteUrlForNavigation` in `content/`. Plus 2 substituted-domain comment hunks (@@ -1841 and @@ -4846) that are pure noise → #8 source audit. |
| `043-web-app-astro-scheme.patch` | #12/#13 | `AppBrowserController::FormatUrlOrigin`. |
| `021-omnibox-display-astro.patch` | #13 | `LocationBarModelImpl::GetFormattedURL`. |
| `022-autocomplete-astro-scheme.patch` | #13 | `GetEmbedderRepresentationOfAboutScheme` returns `"astro"`. |
| `023-url-fixer-astro-scheme.patch` | #13 | URL fixup. **Carries ungoogled content** — @@ -597,6 +600,10 @@ (`url::kTraceScheme` rejection, from `block-trk-and-subdomains.patch`) and @@ -639,6 +649,8 @@ (the `omnibox-autocomplete-filtering` switch, from the ungoogled flag patch) are not Astro's; @@ -584,7 +587,7 @@ is a substituted-domain comment. → #8. |
| `027-scheme-classifier-astro.patch` | #13 | Adds `astro` to `GetInputTypeForScheme`; the `url::kTraceScheme` line in the same hunk is ungoogled's → #8. |
| `029-copy-url-astro.patch` | #13 | `AdjustTextForCopy`. |
| `037-builtin-provider-astro-scheme.patch` | #13 | Builtin omnibox provider. Its comment states the whole problem: *"FixupURL converts astro:// to chrome:// internally"*. |
| `038-dino-game-astro-scheme.patch` | #13 | `localized_error.cc`, 4 hunks; one substitutes the redirect-loop support URL. |
| `040-tab-hover-astro-scheme.patch` | #13 | String-replaces the tab hover card's domain label. |
| `042-session-restore-astro.patch` | #13 | `ContentSerializedNavigationDriver::Sanitize` — the only patch that touches **persisted** URLs, so it is also the legacy-URL-migration case #13 owns. |

### Overlay integration — bucket B, with the hook named

The epic fixes the hook vocabulary. Where a patch maps onto a name the epic
already lists, that name is used unchanged.

| Patch | Hook | Owner | Note |
|---|---|---|---|
| `020`, `046` | `astro::RegisterProfilePrefs(registry)` + `astro::RegisterLocalStatePrefs(registry)` | #7 | Both call sites are `chrome/browser/prefs/browser_prefs.cc`. `046`'s hunk context is `020`'s last added line, so `046` cannot apply without `020`. |
| `045` | `astro::AppendURLLoaderThrottles(...)` | #18 | Insertion point `ChromeContentBrowserClient::CreateURLLoaderThrottles`, verified present at `chrome/browser/chrome_content_browser_client.cc:5827`. |
| `052` | `astro::AttachTabHelpers(web_contents)` (new name) | #18 | `TabHelpers::AttachTabHelpers`, `chrome/browser/ui/tab_helpers.cc:306`. |
| `053` | `astro::AppendToolbarButtons(...)` (new name) | #18 | **Broken as committed** — see §4.4. |
| `047`, `048` | X-macro list entries in `side_panel_entry_id.h` and `chrome_action_id.h` | #17 | These two genuinely need a Chromium edit: the enum is generated from a macro list in a Chromium header. Two lines total, and the smallest available shape. |
| `049`, `050` | `astro::RegisterSidePanelEntries(...)` | #17 | `SidePanelUtil::PopulateGlobalEntries`, `side_panel_util.cc:75`. |
| `039` | `astro::AppendNavigationThrottles(registry)` | #16 | Needed **only if** the replacement identity flow still wants a throttle. Authorization Code + PKCE handled inside `//astro` may need none — decide before writing the hook. Carries the §1.3 SSL deletion regardless. |
| `010` | `astro::AddColorMixers(...)` | #24 | @@ -36 sets the frame colour; @@ -50 additionally makes inactive-tab foreground white instead of falling through to `kGoogleGrey800`. Two decisions, one patch. |
| `014`, `015` | `astro::AppendProfileMenuItems(...)` | #24 (chrome) / #16 (content) | `014` declares, `015` implements: `015` cannot apply without `014`. The Oxy sign-in content is §1.1; the deletions are §1.3; what remains for #24 is the menu-item seam itself. |
| `056` | `astro::GetNewTabPageURL()` (new name) | #22 | Two hunks in `chrome/browser/search/search.cc`: the local NTP URL, and `IsInstantNTPURL` recognition. |
| `025` | `astro::AddAdditionalSchemes(schemes)` | #11 | Also bucket D; see §1.5. |

### Build-graph and asset ownership — bucket A

| Patch | Verdict | Evidence |
|---|---|---|
| `051-alia-vector-icon.patch` | **A — disappears.** `//astro` declares its own `aggregate_vector_icons("astro_vector_icons")` target and owns `alia_spark.icon`; no Chromium file changes. | `aggregate_vector_icons` is a public template from `//components/vector_icons/vector_icons.gni` used by 12 different `BUILD.gn` files in the locked tree (`grep -rln aggregate_vector_icons --include=BUILD.gn`). The patch exists only because the icon was dropped into `chrome/app/vector_icons/` — `git ls-files src/` shows `src/chrome/app/vector_icons/alia_spark.icon` sitting in a Chromium-owned directory, and `tools/overlay.allowlist` has to declare it as a `file` exception. |
| `008-os-crypt-visibility.patch` | **A — conditional.** Disappears entirely if the token store moves to OSCrypt **async**; becomes a one-line allowlist entry naming `//astro` if it stays on OSCrypt sync. | Measured in the locked tree: `components/os_crypt/sync/BUILD.gn:12` carries a `visibility` allowlist; `components/os_crypt/async/*/BUILD.gn` has no such restriction on the browser target. The overlay currently uses sync (`oxy_auth_token_store.cc` includes `components/os_crypt/sync/os_crypt.h`). Storage choice is #16's; the allowlist line, if needed, is #7's. |
| `054-adblock-webui-register.patch`, `055-ntp-webui-register.patch` | **A — disappear.** `//astro` registers its own configs from the `ChromeBrowserMainExtraParts` that #7 already buys. No edit to `chrome_web_ui_configs.cc`, and no `astro::RegisterWebUIConfigs` hook. | Verified independently in the locked tree: `content/public/browser/webui_config_map.h` declares `WebUIConfigMap::GetInstance()`, `AddWebUIConfig` and `AddUntrustedWebUIConfig` public on a `CONTENT_EXPORT` class, with a class comment telling embedders to use them; `RegisterChromeWebUIConfigs()` has exactly two callers in the tree — `chrome/browser/chrome_browser_main.cc:1830` and `chrome/test/base/chrome_unit_test_suite.cc:205` — so it is one caller of a public API, not the registration mechanism. Register from `PostProfileInit` or `PreBrowserStart`, both of which run after line 1830. This corrects an earlier draft of this document, which filed the pair as bucket B; the point was established in [`minimum-chromium-hooks.md`](minimum-chromium-hooks.md) §C1 for #7 and re-checked here rather than taken on trust. |

> Everything else that *looks* like a build-graph symptom is not one. Finding 1
> established that the overlay is absent from the build graph, which makes
> `045`, `052`, `053` and the rest **dead** — it does not make them
> **unnecessary**. They are call-site insertions and each needs a successor
> hook. Only the two rows above disappear on their own.

### Product and inherited-behaviour policy — bucket E

| Patch | Decision owed | Owner |
|---|---|---|
| `004-default-search-duckduckgo.patch` | Keep DuckDuckGo as the prepopulated fallback? Currently the only patch dispositioned `keep` in the baseline. Implementation seam is `GetPrepopulatedFallbackSearch` in `template_url_prepopulate_data.cc` — a Chromium edit unless the choice moves into search-engine-choice configuration. | #10 |
| `006-user-agent-astro.patch` | Ship ` Astro/<version>` appended to the UA on every request? It is a new, permanent, network-visible identifier and a fingerprinting surface, in both the full and reduced UA. Two hunks in `components/version_info/`. | #10 (+ #20 for fingerprinting) |
| `019-ntp-default-sites.patch` | Ship a curated tile list (DuckDuckGo, Wikipedia, GitHub, Reddit) in all three `default_popular_sites*.json`? These are product endorsements, and the third file's upstream contents are the ones a fresh profile shows. | #10 / #22 |
| `044-disable-ev-certificate-metadata.patch` | See §1.4. Retires paired with the Iridium patch. | #20 |

### Obsolete surfaces — bucket O

| Patch | Why it stops existing |
|---|---|
| `016-ntp-astro-logo.patch` | Overwrites Chromium's `new_tab_page/icons/google_logo.svg` with an Astro wordmark. Once `astro://newtab` is Astro's own WebUI (#22), Chromium's NTP resources are not the product's NTP. Remove; do not port. |
| `017-ntp-logo-css.patch` | Same surface (`logo.css`); also switches `-webkit-mask-image` to `background-image`, silently disabling the single-colour theming path. |
| `018-ntp-logo-ts.patch` | Same surface; comment-only plus one property doc. Zero behaviour. |

### Remove outright — bucket R

| Patch | Why |
|---|---|
| `011-astro-url-scheme-alias.patch` | Both halves are defects. The alias is rejected going forward (#11 delivers a genuine scheme, not a rewrite in `browser_about_handler.cc`); the auth half is §1.1. Nothing in it has a successor. |
| `036-navigator-auth-intercept.patch` | §1.1, plus it conflicts with `026` (§4.3). Nothing in it has a successor. |

---

## 4. Facts that change the plan

Each was measured; none is inferable from the patch names.

### 4.1 The WebUI registrations do not work the way the patch stack implies

`054` and `055` are the only patches that register an Astro WebUI config, and
they register two: adblock and NTP. The overlay contains **five** committed
WebUI controllers — `astro_alia_ui`, `astro_error_ui`, `astro_ntp_ui`,
`astro_settings_ui`, `astro_whats_new_ui` — and `grep -l` across
`patches/astro/` finds **no patch mentioning four of them**. What registers
those four is the untracked whole-file copy of
`chrome/browser/ui/webui/chrome_web_ui_configs.cc` (declared defect 2 in
`AGENTS.md`, and declared with `conflicts-with=` in `tools/overlay.allowlist`),
which registers alia/error/ntp/settings/whats-new and **not** adblock.

So the shipped registration path is a 483-line file copy, not a patch; `054`
and `055` are both malformed and do not apply (finding 3); and the two
mechanisms disagree about which five pages exist.

**And none of it needed a Chromium-owned change in the first place.**
`WebUIConfigMap::GetInstance()`, `AddWebUIConfig` and `AddUntrustedWebUIConfig`
are public on a `CONTENT_EXPORT` class whose own class comment says *"Embedders
wishing to register WebUIConfigs should use AddWebUIConfig and
AddUntrustedWebUIConfig"*, and `RegisterChromeWebUIConfigs()` has exactly two
callers in the tree (`chrome_browser_main.cc:1830` and the unit-test suite). An
Astro `ChromeBrowserMainExtraParts` registering at `PostProfileInit` or
`PreBrowserStart` — both after line 1830 — replaces the two patches *and* the
file copy, deleting the only `overwrite` entry in `tools/overlay.allowlist`.

### 4.2 Sixteen Astro patches sit on files the ungoogled stack also modifies

Computed by intersecting the `+++ b/` file lists of all 54 Astro patches with
all 112 ungoogled patches: `009`, `012`, `013`, `015`, `020`, `023`, `027`,
`039`, `044`, `045`, `046`, `052`, `053`, `054`, `055`, `056` touch a file some
ungoogled patch also touches. Five of them go further and *contain* ungoogled
content, because they were diffed from an already-patched tree — and the two
shapes differ: `023` and `027` carry ungoogled **added** lines, while `015`,
`020` and `039` carry ungoogled **deletions** (§1.3).

This is why the two stacks cannot be retired independently, and why "delete the
ungoogled patch" is not a sufficient action for any behaviour in §1.3.

### 4.3 `026` and `036` are a conflicting pair, not two features

Both modify `chrome/browser/ui/browser_navigator.cc`, both insert at the top of
`AdjustNavigateParamsForURL`, and both declare the **same pre-image blob**:

```
026: index b5c2da1226eae..ec974341d55da
036: index b5c2da1226eae..db27c3fbb842f
```

`036`'s added block contains `026`'s rewrite verbatim plus the auth interception,
so `036` is a superset generated against a tree where `026` had not been applied.
Applying `026` first removes `036`'s context. Retiring them separately is not
possible; retiring `036` (bucket R) and letting `026` retire with the scheme
work (bucket D) resolves it.

### 4.4 `053` could not compile even if it applied

`053-adblock-toolbar-button.patch` assigns to `adblock_button_`:

```cpp
+  adblock_button_ = AddChildView(std::move(adblock_button));
```

Measured: no patch in `patches/astro/` touches
`chrome/browser/ui/views/toolbar/toolbar_view.h`; `grep -n adblock` against the
locked tree's `toolbar_view.h` returns nothing; and `toolbar_view.h` is not a
declared destination in `tools/overlay.allowlist`, so the overlay cannot supply
the member either. The member has no declaration anywhere in the pipeline. The
adblock toolbar button has therefore never been built from committed state, and
`053` should be treated as a specification of intent rather than as working code
to preserve.

### 4.5 Nine patches inject domain-substituted text into an unsubstituted tree

`grep -c 'qjz9zk\|9oo91e\|…'` over the committed Astro patches:
`013` (37), `001` (12), `033` (6), `009` (4), `034` (4), `041` (2), `023` (1),
`028` (1), `038` (1).

Domain substitution has never actually run in this pipeline (declared defect 1
in `AGENTS.md`), so these strings are not the output of a substitution pass on
the Chromium tree — they are baked into the patch text and get written into
otherwise-clean upstream files. At least one lands in a live user-facing
`href` (`https://safebrowsing.9oo91e.qjz9zk/safebrowsing/report_error/`, in
`009`), i.e. a clickable link to a domain that does not resolve.

This is #8's own acceptance item *"verify no source file contains substituted
fake domains generated by the old process"*, and the nine patches above are the
complete list of places it will fire from the Astro side.

### 4.6 Chromium-file blast radius today

`grep -h '^+++ b/' patches/astro/*.patch | sort -u` → **57 distinct
Chromium-owned files** (37 under `chrome/`, 16 under `components/`, 2 under
`net/`, 2 under `content/`).

Under the hook model in §3 the same behaviour needs **11 integration points**
(`AddAdditionalSchemes`, `RegisterProfilePrefs`, `RegisterLocalStatePrefs`,
`AppendURLLoaderThrottles`, `AttachTabHelpers`, `AppendToolbarButtons`,
`RegisterSidePanelEntries`, `AppendProfileMenuItems`, `AddColorMixers`,
`GetNewTabPageURL`, and the two X-macro enum entries counted as one), plus
whatever #11/#12 decide the scheme genuinely requires in `content/`. WebUI
config registration is deliberately **not** in that list — §4.1 — and any
future hook count that reintroduces it is measuring the wrong thing. That is
the number a reviewer should hold the result to.

---

## 5. Clusters — what retires together, and what must be true first

Thirteen clusters. Each is one reviewable change. Every patch appears in exactly
one cluster.

| # | Cluster | Patches | Owner | What must be true before it can go |
|---|---|---|---|---|
| **CL-1** | Build & asset ownership | `008`, `051` | #7 (+#16 for storage) | `//astro` exists as a real GN target with its own `BUILD.gn`; it declares `aggregate_vector_icons`; the token store's OSCrypt sync-vs-async choice is made. |
| **CL-2** | Preference registration | `020`, `046` | #7 | `astro::RegisterProfilePrefs` / `RegisterLocalStatePrefs` exist. **#20 has ruled on the six inherited deletions in §1.3** — otherwise retiring `020` silently changes Safe Browsing pref registration. **#16 has confirmed `oxy.access_token`/`oxy.refresh_token` are not carried over** (§1.2). `046` cannot precede `020`. |
| **CL-3** | WebUI config registration | `054`, `055` | #7 / #14 | `//astro`'s `ChromeBrowserMainExtraParts` registers its configs at `PostProfileInit`/`PreBrowserStart` **and** the untracked whole-file copy of `chrome_web_ui_configs.cc` is deleted in the same change (§4.1). Retiring the patches alone leaves the copy in charge. `055` cannot precede `054`. No Chromium-owned edit is needed for this cluster. |
| **CL-4** | Adblock browser integration | `045`, `052`, `053` | #18 | Throttle/tab-helper/toolbar hooks exist; the `adblock_button_` declaration question (§4.4) is answered as part of the toolbar hook, not inherited. |
| **CL-5** | Alia integration | `047`, `048`, `049`, `050` | #17 | `astro::RegisterSidePanelEntries` exists; the two enum entries are accepted as the minimum Chromium delta or an alternative is designed. |
| **CL-6** | Identity | `011`, `014`, `015`, `036`, `039` | #16 | **Nothing.** This cluster retires by deletion and is a *precondition* for CL-1, not a consequence of it (§1.1). Anything #24 wants from `014`/`015` — the profile-menu seam — is re-created from scratch, not preserved. |
| **CL-7** | Theme | `010` | #24 | `astro::AddColorMixers` exists; the inactive-tab-foreground change is a stated decision, not a side effect. |
| **CL-8** | Scheme trust core | `024`, `025`, `030` | #11 | The trust model of §1.5 is written down: which of standard/secure/CORS-enabled/savable `astro://` gets, and what `astro-untrusted://` is. |
| **CL-9** | Scheme navigation & origin | `026`, `028`, `041`, `043` | #12 | CL-8 landed; origin, SiteInstance and process-lock assertions pass. `036` already gone (§4.3). |
| **CL-10** | Scheme display & persistence | `021`, `022`, `023`, `027`, `029`, `037`, `038`, `040`, `042` | #13 | CL-9 landed. The captured ungoogled hunks in `023`/`027` are handed to #8's ungoogled curation rather than ported. `042` needs the legacy-URL migration decision (sessions already on disk). |
| **CL-11** | New Tab Page surface | `016`, `017`, `018`, `019`, `056` | #22 | `astro://newtab` is the product NTP; the tile list in `019` is a stated product decision (#10). CL-3 landed, so the NTP config is registered by `//astro` rather than by the whole-file copy. |
| **CL-12** | Branding & product constants | `001`, `002`, `003`, `005`, `009`, `012`, `013`, `031`, `032`, `033`, `034` | #9 (+#15) | One source of truth generates names/identifiers/strings. The §1.6 disclosure strings are re-authored, not substituted. The six deleted help links (§7) have a decision. The copyright/attribution replacement in `001` is confirmed acceptable. |
| **CL-13** | Inherited & product policy | `004`, `006`, `044` | #10 / #20 | The feature matrix and network manifest exist (#10); the security baseline decision exists (#20); `044` retires with `extra/iridium-browser/Remove-EV-certificates.patch`. |

---

## 6. Retirement order

```text
                    ┌──────────────────────────────────────────┐
   W0  #7 lands //astro   ──────────────────────────────────►  │
       #11 states the scheme trust model                       │
                    └───────────────┬──────────────────────────┘
                                    │
   W1  CL-6  Identity (DELETE FIRST) ── hard gate on everything below
                                    │
   W2  CL-1  build & assets ────────┤
                                    │
   W3  CL-2  prefs        CL-3  WebUI registration
                                    │
   W4  CL-8 ─► CL-9 ─► CL-10   (scheme, in #11→#12→#13 order)
                                    │
   W5  CL-4 adblock   CL-5 Alia   CL-7 theme   CL-11 NTP
                                    │
   W6  CL-13 policy decisions (#10/#20)

   CL-12 branding — order-independent, may run from W0 in parallel
                    (the epic explicitly parallelises #8 and #9)
```

Why this order and not another:

1. **W1 before W2 is not a preference.** CL-1 is what makes the overlay
   compile; CL-6's four patches are what turn a token-in-URL flow on the moment
   it does. Any plan that links `//astro` first ships that flow, in a build
   nobody has yet decided to ship. This is the one ordering constraint in this
   document that has a security consequence rather than a convenience one.
2. **CL-3 before CL-11** — until `//astro` owns its own WebUI registration, the
   NTP config is whatever the untracked whole-file copy happens to say, and
   that copy has to be deleted in the same change (§4.1).
3. **CL-2 before the product clusters** — adblock (`046`) and NTP both register
   preferences; retiring `020` last would leave `046` depending on a patch that
   is gone.
4. **CL-8 → CL-9 → CL-10 is the epic's own order** (#11 → #12 → #13) and the
   patches match it exactly: trust, then navigation/origin, then display and
   persistence. Retiring a display patch early makes `astro://` visible in
   surfaces whose origin handling has not been fixed.
5. **CL-13 last** — every patch in it needs a document that does not exist yet
   (feature matrix, network manifest, security baseline). Retiring them earlier
   would mean deciding them here, which §"Scope" rules out.
6. **CL-12 anywhere** — it shares no file with any other cluster except the
   settings resources, and its only ordering requirement is internal.

### Dependency graph (edges that are properties of the patches, not of the plan)

```text
014 ──► 015            015 implements what 014 declares
020 ──► 046            046's hunk context is 020's last added line
054 ──► 055            055's hunk context contains 054's added line
026 ✗ 036              same pre-image blob, same insertion point (§4.3)
044 ──► iridium Remove-EV-certificates.patch      044 exists to correct it
015, 020, 039 ──► ungoogled remove-unused-preferences-fields /
                  fix-building-without-safebrowsing / disable-ai
                       they re-carry those patches' deletions (§1.3)
023, 027 ──► ungoogled block-trk-and-subdomains,
             add-flag-for-omnibox-autocomplete-filtering
                       they contain those patches' content (§4.2)
054, 055 ✗ untracked chrome_web_ui_configs.cc overlay copy   (§4.1)
053 ──► an undeclared ToolbarView member                     (§4.4)
```

---

## 7. What could not be classified, and why

Three hunk-level items. Each is recorded as unclassified rather than guessed,
and each names the observation that would settle it.

1. **The six deleted "Learn more" links** — `009` ×3 (memory saver, energy
   saver, preload pages) and `013` ×3 (keep-sites-active, inactive-tab
   indicator, performance alerts). Each removes a
   `<ph name="BEGIN_LINK">&lt;a href="$1" …&gt;</ph>…<ph name="END_LINK">` pair
   from a message body while leaving the message id unchanged. **Unknown:**
   whether this was a deliberate "no Google help-centre links" decision — in
   which case it belongs with `012` hunk 3 and is #10's — or collateral damage
   from hand-editing. **Settles it:** whether the C++ callers still pass the
   `$1` (and `$2`) substitution arguments for those six ids; a `grid` build with
   the patched `.grdp` will say whether grit accepts the mismatch or errors.
   Not run here: it needs a build of the patched resource targets.

2. **`001`'s replacement of `IDS_ABOUT_VERSION_COPYRIGHT`** — classification as
   a #9 branding item is straightforward; whether replacing a copyright notice
   with `Made with ❤️ in the 🌎 by Oxy.` satisfies the epic's *"License and
   attribution requirements for deliberately ported code are satisfied"* is not
   a call this analysis can make. Owner: #9 with #29; needs a licensing answer,
   not a measurement.

3. **`012` hunk 3 vs. the item above** — `if="[[learnMoreUrl]]"` → `if="[[false]]"`
   disables the settings subpage help button for *every* subpage, not only
   Google-hosted ones. Whether the intended policy is "no help links at all" or
   "Astro-hosted help links" determines whether this is retired (restore
   upstream) or replaced (point at Oxy documentation). Owner: #10/#15.

Nothing else in the 54 was left unclassified. Where the baseline records
`investigate` (`006`, `044`, `054`) this document assigns a bucket and an owner,
which narrows the open question without answering it: `006` and `044` are policy
decisions with named owners, and `054`'s "investigate" was about the overlay
collision, which §4.1 resolves mechanically.

## 8. Working-tree delta

Two patch files differ from `HEAD` on the machine this was written on. The
classifications above are unaffected — both deltas add preference registrations
inside hunks already classified — but the record would be wrong without them:

| Patch | Working tree adds |
|---|---|
| `020-register-oxy-prefs.patch` | seven `astro.ntp_show_*` boolean prefs, and widens the hunk header from `+1713,15` to `+1713,24` |
| `046-adblock-prefs.patch` | `oxy.adblock.lifetime_blocked_count` |

Both are already recorded as `observed-local-only` candidates in
[`../baseline/pref-dispositions.json`](../baseline/pref-dispositions.json) and
belong to #22 and #18/#19 respectively. If they land, CL-2's gate grows by eight
preferences and nothing else in this plan changes.

## 9. Reproducing every measurement in this document

```bash
# committed patch text (never the working tree)
git archive HEAD patches/astro | tar -x -C <scratch>

# which patches carry substituted domains, and how many lines
grep -c 'qjz9zk\|9oo91e' patches/astro/*.patch

# Chromium files the stack touches
grep -h '^+++ b/' patches/astro/*.patch | sort -u | wc -l

# attribution: does an ungoogled patch already remove this line?
#   compare each '-' line of an Astro patch against every '-' line
#   under patches/ungoogled/ (script inlined in the #8 working notes)

# upstream anchors, at the locked commit ae03f7fb2cf1215853896d6a4c15fdceee2badb7
grep -n 'void ChromeContentClient::AddAdditionalSchemes' chromium/src/chrome/common/chrome_content_client.cc
grep -n 'ChromeContentBrowserClient::CreateURLLoaderThrottles' chromium/src/chrome/browser/chrome_content_browser_client.cc
grep -n 'void TabHelpers::AttachTabHelpers' chromium/src/chrome/browser/ui/tab_helpers.cc
grep -n 'void RegisterChromeWebUIConfigs' chromium/src/chrome/browser/ui/webui/chrome_web_ui_configs.cc
grep -n 'void SidePanelUtil::PopulateGlobalEntries' chromium/src/chrome/browser/ui/views/side_panel/side_panel_util.cc
grep -rln aggregate_vector_icons --include=BUILD.gn chromium/src
grep -n visibility -A 14 chromium/src/components/os_crypt/sync/BUILD.gn
grep -n adblock chromium/src/chrome/browser/ui/views/toolbar/toolbar_view.h   # no output
```

The `chromium/src` checkout used for the upstream anchors is at the locked
commit and carries the applied patch stack; every anchor quoted above is an
upstream symbol that no Astro patch renames, so the anchor names hold on a
pristine tree too. The one measurement that depends on the checkout being
patched — `git status --porcelain` reporting `chrome_web_ui_configs.cc` as
modified — is labelled as such where it is used.
