# Key file paths and the overlay layout

> Moved out of `AGENTS.md` unchanged.


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

