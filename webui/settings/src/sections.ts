// ── Settings sections with full content ──

import {
  Toggle,
  Select,
  Slider,
  ButtonRow,
  InfoRow,
  SectionCard,
} from "./components.ts";

// ── 1. You and Oxy ──

export function youAndOxy(): string {
  return SectionCard("you-and-oxy", "You and Oxy", [
    `<div class="setting-row" data-setting-label="Oxy Account" data-setting-desc="Sign in to sync">
      <div class="flex items-center gap-4">
        <div class="flex h-11 w-11 items-center justify-center rounded-full bg-oxy-primary/10 text-oxy-primary font-semibold text-lg">A</div>
        <div>
          <div class="text-sm font-medium text-oxy-text">Not signed in</div>
          <div class="text-[13px] text-oxy-text-secondary">Sign in to sync your data across devices</div>
        </div>
      </div>
      <button type="button" class="btn btn-primary shrink-0">Sign in</button>
    </div>`,
    Toggle(
      "sync-bookmarks",
      "Sync bookmarks",
      "Keep bookmarks synced across all your devices",
      true,
    ),
    Toggle(
      "sync-history",
      "Sync history",
      "Sync browsing history with your Oxy account",
      true,
    ),
    Toggle(
      "sync-passwords",
      "Sync passwords",
      "Securely sync saved passwords across devices",
      true,
    ),
    Toggle(
      "sync-open-tabs",
      "Sync open tabs",
      "Access tabs from other devices",
      false,
    ),
    Toggle(
      "sync-extensions",
      "Sync extensions",
      "Keep the same extensions on all devices",
      true,
    ),
  ]);
}

// ── 2. Appearance ──

export function appearance(): string {
  return SectionCard("appearance", "Appearance", [
    Select("theme-mode", "Theme", "Choose your preferred color scheme", [
      { value: "system", label: "System default" },
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
    ], "system"),
    Select(
      "font-family",
      "Font",
      "Primary typeface for the browser interface",
      [
        { value: "inter", label: "Inter (Default)" },
        { value: "system", label: "System font" },
        { value: "mono", label: "Monospace" },
      ],
      "inter",
    ),
    Slider("font-size", "Font size", "Base size for browser text", 12, 24, 1, 16, "px"),
    Slider("page-zoom", "Page zoom", "Default zoom level for web pages", 50, 200, 10, 100, "%"),
    Toggle(
      "show-home-button",
      "Show home button",
      "Display a home button on the toolbar",
      false,
    ),
    Toggle(
      "show-bookmarks-bar",
      "Show bookmarks bar",
      "Always show the bookmarks bar below the address bar",
      true,
    ),
    Select(
      "tab-style",
      "Tab style",
      "Visual style for browser tabs",
      [
        { value: "rounded", label: "Rounded (Default)" },
        { value: "squared", label: "Squared" },
        { value: "compact", label: "Compact" },
      ],
      "rounded",
    ),
    Toggle(
      "sidebar-enabled",
      "Side panel",
      "Enable the side panel for quick access to tools",
      true,
    ),
  ]);
}

// ── 3. Search Engine ──

export function searchEngine(): string {
  return SectionCard("search-engine", "Search Engine", [
    Select(
      "default-search",
      "Default search engine",
      "Used for address bar and new tab searches",
      [
        { value: "duckduckgo", label: "DuckDuckGo" },
        { value: "brave", label: "Brave Search" },
        { value: "startpage", label: "Startpage" },
        { value: "qwant", label: "Qwant" },
        { value: "ecosia", label: "Ecosia" },
        { value: "searxng", label: "SearXNG" },
      ],
      "duckduckgo",
    ),
    Toggle(
      "search-suggestions",
      "Search suggestions",
      "Show suggestions as you type in the address bar",
      true,
    ),
    Toggle(
      "search-autocomplete",
      "Autocomplete URLs",
      "Suggest previously visited URLs while typing",
      true,
    ),
    ButtonRow(
      "Manage search engines",
      "Add, edit, or remove search engines",
      "Manage",
      "secondary",
    ),
    Toggle(
      "address-bar-search",
      "Use address bar for search",
      "Type queries directly in the address bar",
      true,
    ),
  ]);
}

// ── 4. Privacy & Security ──

export function privacySecurity(): string {
  return SectionCard("privacy-security", "Privacy & Security", [
    Select(
      "tracking-protection",
      "Tracking protection",
      "Block trackers and fingerprinting across the web",
      [
        { value: "strict", label: "Strict (Recommended)" },
        { value: "standard", label: "Standard" },
        { value: "off", label: "Off" },
      ],
      "strict",
    ),
    Toggle(
      "block-third-party-cookies",
      "Block third-party cookies",
      "Prevent cross-site tracking cookies from being set",
      true,
    ),
    Toggle(
      "https-only",
      "HTTPS-Only mode",
      "Always try to connect using a secure HTTPS connection",
      true,
    ),
    Toggle(
      "dns-over-https",
      "Secure DNS",
      "Use DNS over HTTPS for encrypted name resolution",
      true,
    ),
    Select(
      "dns-provider",
      "DNS provider",
      "Service used for secure DNS lookups",
      [
        { value: "cloudflare", label: "Cloudflare (1.1.1.1)" },
        { value: "quad9", label: "Quad9" },
        { value: "nextdns", label: "NextDNS" },
        { value: "custom", label: "Custom" },
      ],
      "cloudflare",
    ),
    Toggle(
      "do-not-track",
      "Send Do Not Track",
      "Ask sites not to track your browsing activity",
      true,
    ),
    ButtonRow(
      "Clear browsing data",
      "Remove cookies, cache, history, and other site data",
      "Clear data",
      "danger",
    ),
    ButtonRow(
      "Site permissions",
      "Manage permissions for camera, microphone, location, and more",
      "Manage",
      "secondary",
    ),
  ]);
}

// ── 5. Performance ──

export function performance(): string {
  return SectionCard("performance", "Performance", [
    Toggle(
      "memory-saver",
      "Memory saver",
      "Reduce memory usage by suspending inactive tabs",
      true,
    ),
    Select(
      "memory-saver-delay",
      "Suspend tabs after",
      "How long before inactive tabs are suspended",
      [
        { value: "5m", label: "5 minutes" },
        { value: "15m", label: "15 minutes" },
        { value: "30m", label: "30 minutes" },
        { value: "1h", label: "1 hour" },
        { value: "2h", label: "2 hours" },
      ],
      "15m",
    ),
    Toggle(
      "energy-saver",
      "Energy saver",
      "Reduce background activity to extend battery life",
      false,
    ),
    Toggle(
      "preload-pages",
      "Preload pages",
      "Speed up browsing by preloading pages you might visit",
      true,
    ),
    Toggle(
      "hardware-acceleration",
      "Hardware acceleration",
      "Use GPU to accelerate rendering when available",
      true,
    ),
    Toggle(
      "smooth-scrolling",
      "Smooth scrolling",
      "Animate page scrolling for a smoother experience",
      true,
    ),
  ]);
}

// ── 6. Accessibility ──

export function accessibility(): string {
  return SectionCard("accessibility", "Accessibility", [
    Toggle(
      "live-captions",
      "Live captions",
      "Automatically generate captions for audio and video",
      false,
    ),
    Toggle(
      "high-contrast",
      "High contrast mode",
      "Increase contrast for better readability",
      false,
    ),
    Toggle(
      "focus-highlight",
      "Focus highlighting",
      "Add a visible outline around focused elements for keyboard navigation",
      true,
    ),
    Toggle(
      "reduced-motion",
      "Reduce motion",
      "Minimize animations and transitions throughout the browser",
      false,
    ),
    Toggle(
      "force-text-contrast",
      "Force text contrast",
      "Override page styles to ensure text is always readable",
      false,
    ),
    Slider(
      "min-font-size",
      "Minimum font size",
      "Smallest allowed text size on web pages",
      0,
      24,
      1,
      0,
      "px",
    ),
  ]);
}

// ── 7. Languages ──

export function languages(): string {
  return SectionCard("languages", "Languages", [
    Select(
      "ui-language",
      "Browser language",
      "Display language for menus and interface",
      [
        { value: "en-US", label: "English (United States)" },
        { value: "es", label: "Espa\u00f1ol" },
        { value: "fr", label: "Fran\u00e7ais" },
        { value: "de", label: "Deutsch" },
        { value: "pt-BR", label: "Portugu\u00eas (Brasil)" },
        { value: "zh-CN", label: "\u4e2d\u6587 (\u7b80\u4f53)" },
        { value: "ja", label: "\u65e5\u672c\u8a9e" },
        { value: "ko", label: "\ud55c\uad6d\uc5b4" },
      ],
      "en-US",
    ),
    Toggle(
      "offer-translate",
      "Offer to translate",
      "Show a translation prompt for pages in other languages",
      true,
    ),
    Toggle(
      "spell-check",
      "Spell check",
      "Check spelling as you type in text fields",
      true,
    ),
    Select(
      "spell-check-lang",
      "Spell check language",
      "Primary language for spell checking",
      [
        { value: "en-US", label: "English (US)" },
        { value: "en-GB", label: "English (UK)" },
        { value: "es", label: "Espa\u00f1ol" },
        { value: "fr", label: "Fran\u00e7ais" },
        { value: "de", label: "Deutsch" },
        { value: "pt-BR", label: "Portugu\u00eas (Brasil)" },
      ],
      "en-US",
    ),
    ButtonRow(
      "Manage languages",
      "Add or remove preferred languages for web content",
      "Manage",
      "secondary",
    ),
  ]);
}

// ── 8. Downloads ──

export function downloads(): string {
  return SectionCard("downloads", "Downloads", [
    InfoRow("Download location", "~/Downloads"),
    ButtonRow(
      "Change download folder",
      "Choose a different folder for saving downloads",
      "Change",
      "secondary",
    ),
    Toggle(
      "ask-download-location",
      "Ask where to save",
      "Always ask for a download location before saving files",
      false,
    ),
    Toggle(
      "show-download-shelf",
      "Show downloads bar",
      "Display the downloads bar at the bottom when downloading files",
      true,
    ),
    Toggle(
      "auto-open-downloads",
      "Auto-open safe files",
      "Automatically open certain file types after downloading",
      false,
    ),
    Toggle(
      "download-warnings",
      "Download warnings",
      "Warn before downloading potentially dangerous files",
      true,
    ),
  ]);
}

// ── 9. System ──

export function system(): string {
  return SectionCard("system", "System", [
    Select(
      "startup-behavior",
      "On startup",
      "What to show when Astro launches",
      [
        { value: "new-tab", label: "Open new tab page" },
        { value: "continue", label: "Continue where you left off" },
        { value: "specific", label: "Open specific pages" },
      ],
      "new-tab",
    ),
    Toggle(
      "continue-background",
      "Continue running in background",
      "Keep Astro running when all windows are closed",
      false,
    ),
    Toggle(
      "use-system-proxy",
      "System proxy settings",
      "Use your operating system's proxy configuration",
      true,
    ),
    Toggle(
      "system-titlebar",
      "System title bar",
      "Use the native system title bar instead of the custom one",
      false,
    ),
    ButtonRow(
      "Open proxy settings",
      "Configure network proxy for your system",
      "Open",
      "secondary",
    ),
    ButtonRow(
      "Reset all settings",
      "Restore all browser settings to their defaults",
      "Reset",
      "danger",
      "reset-settings-btn",
    ),
  ]);
}

// ── 10. About Astro ──

export function aboutAstro(): string {
  return `
    <section id="section-about" class="section-card animate-section" data-section="about">
      <div class="flex flex-col items-center px-6 py-10 text-center">
        <!-- Astro logo -->
        <div class="about-logo mb-6">
          <svg class="h-20 w-20" viewBox="0 0 163 169" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(0,169) scale(0.1,-0.1)" fill="#c46ede" stroke="none">
              <path d="M936 1454 c37 -22 114 -116 114 -139 0 -4 22 -44 49 -89 75 -124 89 -148 112 -191 24 -45 87 -153 207 -357 101 -171 120 -228 102 -293 -17 -62 -61 -120 -110 -145 -91 -47 -434 -36 -566 18 -136 55 -246 148 -315 267 -77 132 -94 192 -93 335 1 141 25 223 107 362 30 51 66 114 81 140 67 119 199 158 312 92z"/>
              <path d="M361 586 c108 -45 154 -170 101 -273 -34 -65 -83 -93 -162 -93 -81 0 -124 21 -165 81 -25 37 -30 54 -30 104 0 50 5 67 30 105 52 76 148 109 226 76z"/>
            </g>
          </svg>
        </div>

        <h2 class="mb-1 text-2xl font-semibold tracking-tight text-oxy-text">Astro</h2>
        <p class="mb-1 text-sm text-oxy-text-secondary">Version 146.0.7680.177 (Official Build)</p>
        <p class="mb-6 text-sm text-oxy-text-tertiary">Chromium-based \u00b7 Privacy-first \u00b7 De-Googled</p>

        <div class="mb-6 flex items-center gap-2 rounded-full bg-oxy-success/10 px-4 py-2">
          <svg class="h-4 w-4 text-oxy-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          <span class="text-sm font-medium text-oxy-success">Astro is up to date</span>
        </div>

        <p class="text-sm text-oxy-text-secondary">Made with \u2764\ufe0f in the \ud83c\udf0e by Oxy.</p>

        <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a href="https://oxy.so" target="_blank" rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 rounded-lg border border-oxy-border px-3 py-1.5 text-[13px] font-medium text-oxy-text-secondary transition-colors hover:border-oxy-primary/40 hover:text-oxy-primary">
            Visit oxy.so
            <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
          </a>
          <a href="https://github.com/OxyHQ" target="_blank" rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 rounded-lg border border-oxy-border px-3 py-1.5 text-[13px] font-medium text-oxy-text-secondary transition-colors hover:border-oxy-primary/40 hover:text-oxy-primary">
            GitHub
            <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
          </a>
          <a href="#" class="inline-flex items-center gap-1.5 rounded-lg border border-oxy-border px-3 py-1.5 text-[13px] font-medium text-oxy-text-secondary transition-colors hover:border-oxy-primary/40 hover:text-oxy-primary">
            Licenses
          </a>
        </div>
      </div>
    </section>
  `;
}
