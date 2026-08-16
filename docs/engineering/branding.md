# Branding

> Moved out of `AGENTS.md` unchanged.


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

