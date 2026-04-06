// ── Settings sections ──
// Only settings that map to real Chromium PrefService paths are included.

import {
  Toggle,
  Select,
  Slider,
  ButtonRow,
  SectionCard,
  InfoRow,
} from "./components.ts";

// ── 1. Appearance ──

export function appearance(): string {
  return SectionCard("appearance", "Appearance", [
    Select(
      "theme-mode",
      "Theme",
      "Choose your preferred color scheme",
      [
        { value: "0", label: "System default" },
        { value: "1", label: "Light" },
        { value: "2", label: "Dark" },
      ],
      "0",
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
    Toggle(
      "system-titlebar",
      "Use system title bar",
      "Use native system window decorations instead of custom ones",
      false,
    ),
  ]);
}

// ── 2. New Tab Page ──

export function newTabPage(): string {
  return SectionCard("new-tab-page", "New Tab Page", [
    Toggle(
      "ntp-show-weather",
      "Show weather widget",
      "Display current weather conditions on the new tab page",
      true,
    ),
    Toggle(
      "ntp-show-clock",
      "Show clock widget",
      "Display a clock on the new tab page",
      true,
    ),
    Toggle(
      "ntp-show-quick-links",
      "Show quick links",
      "Display quick access links on the new tab page",
      true,
    ),
    Toggle(
      "ntp-show-notes",
      "Show notes widget",
      "Display a notes area on the new tab page",
      true,
    ),
    Toggle(
      "ntp-show-sites",
      "Show most visited sites",
      "Display frequently visited sites on the new tab page",
      true,
    ),
    Toggle(
      "ntp-show-discover",
      "Show discover widget",
      "Display trending content on the new tab page",
      true,
    ),
    Toggle(
      "ntp-show-alia",
      "Show Alia AI widget",
      "Display the Alia AI assistant shortcut on the new tab page",
      true,
    ),
  ]);
}

// ── 3. Autofill & Passwords ──

export function autofillPasswords(): string {
  return SectionCard("autofill", "Autofill & Passwords", [
    Toggle("save-passwords", "Offer to save passwords", "Save passwords for sites you sign in to", true),
    Toggle("auto-sign-in", "Auto sign-in", "Automatically sign in to websites using stored credentials", true),
    ButtonRow("Passwords", "View and manage your saved passwords", "Manage passwords", "secondary", "manage-passwords-btn", "openPage:passwords"),
    Toggle("save-addresses", "Save and fill addresses", "Fill addresses automatically in web forms", true),
    Toggle("save-payment-methods", "Save and fill payment methods", "Fill credit cards and payment info in forms", true),
    ButtonRow("Payment methods", "View and manage saved payment methods", "Manage payments", "secondary", "manage-payments-btn", "openPage:paymentMethods"),
    ButtonRow("Addresses", "View and manage saved addresses", "Manage addresses", "secondary", "manage-addresses-btn", "openPage:addresses"),
  ]);
}

// ── 3. Search Engine ──

export function searchEngine(): string {
  return SectionCard("search-engine", "Search Engine", [
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
      "Search engines",
      "Add, edit, or remove search engines",
      "Manage search engines",
      "secondary",
      "manage-search-engines-btn",
      "openPage:searchEngines",
    ),
  ]);
}

// ── 4. Default Browser ──

export function defaultBrowser(): string {
  return SectionCard("default-browser", "Default Browser", [
    InfoRow("Default browser", "Make Astro your default browser for the best experience"),
    ButtonRow("Default browser", "Set Astro as your default web browser", "Make default", "primary", "set-default-btn"),
  ]);
}

// ── 5. Privacy & Security ──

export function privacySecurity(): string {
  return SectionCard("privacy-security", "Privacy & Security", [
    Select(
      "tracking-protection",
      "Tracking protection",
      "Control how third-party trackers are blocked",
      [
        { value: "0", label: "Off" },
        { value: "1", label: "Block third-party in Incognito" },
        { value: "2", label: "Block all third-party (Recommended)" },
      ],
      "2",
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
        { value: "https://cloudflare-dns.com/dns-query", label: "Cloudflare (1.1.1.1)" },
        { value: "https://dns.quad9.net/dns-query", label: "Quad9" },
        { value: "https://dns.nextdns.io", label: "NextDNS" },
      ],
      "https://cloudflare-dns.com/dns-query",
    ),
    Toggle(
      "do-not-track",
      "Send Do Not Track",
      "Ask sites not to track your browsing activity",
      true,
    ),
    Toggle(
      "download-warnings",
      "Safe browsing protection",
      "Warn before downloading potentially dangerous files",
      true,
    ),
    ButtonRow(
      "Clear browsing data",
      "Remove browsing history, cookies, and cached files",
      "Clear data",
      "danger",
      "clear-browsing-data-btn",
      "clearBrowsingData",
    ),
    ButtonRow(
      "Site permissions",
      "Manage permissions for camera, microphone, location, and more",
      "Site permissions",
      "secondary",
      "site-permissions-btn",
      "openPage:content",
    ),
  ]);
}

// ── 6. Performance ──

export function performance(): string {
  return SectionCard("performance", "Performance", [
    Toggle(
      "memory-saver",
      "Memory saver",
      "Reduce memory usage by suspending inactive tabs",
      true,
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

// ── 7. Accessibility ──

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
      "Focus highlight",
      "Show a visible highlight around the focused element",
      false,
    ),
    Toggle(
      "reduced-motion",
      "Reduce motion",
      "Minimize animations and transitions",
      false,
    ),
    Toggle(
      "force-text-contrast",
      "Force text contrast",
      "Override page colors to ensure text is always readable",
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

// ── 8. Languages ──

export function languages(): string {
  return SectionCard("languages", "Languages", [
    Select(
      "ui-language",
      "Browser language",
      "Language used for the Astro interface",
      [
        { value: "en-US", label: "English (US)" },
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
      "Language used for spell checking",
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
      "Languages",
      "Add or remove languages and set preferences",
      "Manage languages",
      "secondary",
      "manage-languages-btn",
      "openPage:languages",
    ),
  ]);
}

// ── 9. On Startup ──

export function onStartup(): string {
  return SectionCard("on-startup", "On Startup", [
    Select("startup-behavior", "On startup", "What to show when Astro launches", [
      { value: "5", label: "Open the new tab page" },
      { value: "1", label: "Continue where you left off" },
      { value: "4", label: "Open a specific page or set of pages" },
    ], "5"),
  ]);
}

// ── 10. Downloads ──

export function downloads(): string {
  return SectionCard("downloads", "Downloads", [
    InfoRow("Download location", "~/Downloads"),
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
  ]);
}

// ── 11. System ──

export function system(): string {
  return SectionCard("system", "System", [
    Toggle(
      "continue-background",
      "Continue running in background",
      "Keep Astro running when all windows are closed",
      false,
    ),
  ]);
}

// ── 12. Extensions ──

export function extensions(): string {
  return SectionCard("extensions", "Extensions", [
    InfoRow("Extensions", "Add functionality to Astro with extensions"),
    ButtonRow("Extensions", "Manage installed browser extensions", "Manage extensions", "secondary", "manage-extensions-btn", "openPage:extensions"),
  ]);
}

// ── 13. Reset Settings ──

export function resetSettings(): string {
  return SectionCard("reset", "Reset Settings", [
    ButtonRow("Restore defaults", "Reset all Astro settings to their original defaults. This won't affect your bookmarks, history, or passwords.", "Reset settings", "danger", "reset-all-btn", "resetSettings"),
  ]);
}

// ── 14. About Astro ──

export function aboutAstro(): string {
  return `
    <section id="section-about" class="section-card animate-section" data-section="about">
      <div class="flex flex-col items-center px-6 py-10 text-center">
        <div class="about-logo mb-6">
          <svg class="h-20 w-20 text-oxy-primary" viewBox="0 0 163 169" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(0,169) scale(0.1,-0.1)" fill="currentColor" stroke="none">
              <path d="M936 1454 c37 -22 114 -116 114 -139 0 -4 22 -44 49 -89 75 -124 89 -148 112 -191 24 -45 87 -153 207 -357 101 -171 120 -228 102 -293 -17 -62 -61 -120 -110 -145 -91 -47 -434 -36 -566 18 -136 55 -246 148 -315 267 -77 132 -94 192 -93 335 1 141 25 223 107 362 30 51 66 114 81 140 67 119 199 158 312 92z"/>
              <path d="M361 586 c108 -45 154 -170 101 -273 -34 -65 -83 -93 -162 -93 -81 0 -124 21 -165 81 -25 37 -30 54 -30 104 0 50 5 67 30 105 52 76 148 109 226 76z"/>
            </g>
          </svg>
        </div>

        <h2 class="mb-1 text-2xl font-semibold tracking-tight text-oxy-text">Astro</h2>
        <p class="mb-1 text-sm text-oxy-text-secondary">Version 146.0.7680.177 (Official Build)</p>
        <p class="mb-6 text-sm text-oxy-text-tertiary">Chromium-based \u00b7 Privacy-first \u00b7 De-Googled</p>

        <p class="text-sm text-oxy-text-secondary">Made by Oxy.</p>

        <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a href="https://astrobrowser.org" target="_blank" rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 rounded-lg border border-oxy-border px-3 py-1.5 text-[13px] font-medium text-oxy-text-secondary transition-colors hover:border-oxy-primary/40 hover:text-oxy-primary">
            astrobrowser.org
            <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
          </a>
          <a href="https://github.com/OxyHQ/Astro" target="_blank" rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 rounded-lg border border-oxy-border px-3 py-1.5 text-[13px] font-medium text-oxy-text-secondary transition-colors hover:border-oxy-primary/40 hover:text-oxy-primary">
            GitHub
            <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
          </a>
        </div>
      </div>
    </section>
  `;
}
