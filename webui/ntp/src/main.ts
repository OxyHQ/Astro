// ── Astro New Tab Page ──
// Comet-style NTP with Oxy/Astro branding

// ── cr.webUIListenerCallback polyfill ──
// Chrome's WebUI C++ uses FireWebUIListener which calls cr.webUIListenerCallback.
// Since our Vite-built NTP doesn't include chrome://resources/js/cr.js, we
// provide a minimal implementation so C++ → JS callbacks work.
{
  const g = globalThis as Record<string, unknown>;
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  if (!g.cr) g.cr = {};
  const cr = g.cr as Record<string, unknown>;
  cr.addWebUIListener = (event: string, callback: (...args: unknown[]) => void) => {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event)!.push(callback);
  };
  cr.webUIListenerCallback = (event: string, ...args: unknown[]) => {
    for (const cb of listeners.get(event) ?? []) cb(...args);
  };
}

// ── Types ──

interface QuickLink {
  title: string;
  url: string;
}

type WidgetId =
  | "weather-widget"
  | "clock-widget"
  | "quick-links-widget"
  | "notes-widget"
  | "discover-widget"
  | "alia-widget";

const REORDERABLE_WIDGETS: readonly WidgetId[] = [
  "weather-widget",
  "clock-widget",
  "quick-links-widget",
  "notes-widget",
  "discover-widget",
  "alia-widget",
];

interface NTPSettings {
  wallpaperUrl: string;
  searchEngine: "duckduckgo" | "google" | "bing" | "brave" | "startpage";
  tempUnit: "F" | "C";
  widgets: {
    weather: boolean;
    clock: boolean;
    "quick-links": boolean;
    notes: boolean;
    discover: boolean;
    alia: boolean;
    sites: boolean;
  };
  widgetOrder: WidgetId[];
  quickLinks: QuickLink[];
}

interface WeatherData {
  tempF: number;
  tempC: number;
  description: string;
  location: string;
  icon: string;
  humidity: string;
  feelsLikeF: number;
  feelsLikeC: number;
  bgColor: string;
  accentColor1: string;
  accentColor2: string;
}

interface SiteEntry {
  title: string;
  url: string;
}

// ── Constants ──

const STORAGE_KEY = "astro-ntp";
const WEATHER_CACHE_KEY = "astro-ntp-weather";
const WEATHER_CACHE_TTL = 30 * 60 * 1000;
const NOTES_KEY = "astro-ntp-notes";

const SEARCH_ENGINES: Record<string, { action: string; param: string; label: string }> = {
  duckduckgo: { action: "https://duckduckgo.com/", param: "q", label: "DuckDuckGo" },
  google: { action: "https://www.google.com/search", param: "q", label: "Google" },
  bing: { action: "https://www.bing.com/search", param: "q", label: "Bing" },
  brave: { action: "https://search.brave.com/search", param: "q", label: "Brave" },
  startpage: { action: "https://www.startpage.com/search", param: "query", label: "Startpage" },
};

const WEATHER_ICONS: Record<string, string> = {
  Sunny: "\u2600\uFE0F",
  Clear: "\uD83C\uDF19",
  "Partly cloudy": "\u26C5",
  "Partly Cloudy": "\u26C5",
  Cloudy: "\u2601\uFE0F",
  Overcast: "\u2601\uFE0F",
  Mist: "\uD83C\uDF2B\uFE0F",
  Fog: "\uD83C\uDF2B\uFE0F",
  "Patchy rain possible": "\uD83C\uDF26\uFE0F",
  "Patchy rain nearby": "\uD83C\uDF26\uFE0F",
  "Light rain": "\uD83C\uDF27\uFE0F",
  "Light drizzle": "\uD83C\uDF27\uFE0F",
  "Moderate rain": "\uD83C\uDF27\uFE0F",
  "Heavy rain": "\uD83C\uDF27\uFE0F",
  Rain: "\uD83C\uDF27\uFE0F",
  Thunderstorm: "\u26C8\uFE0F",
  Snow: "\uD83C\uDF28\uFE0F",
  "Light snow": "\uD83C\uDF28\uFE0F",
  "Heavy snow": "\uD83C\uDF28\uFE0F",
  Blizzard: "\uD83C\uDF28\uFE0F",
  Sleet: "\uD83C\uDF28\uFE0F",
};

// Weather condition to background color
function getWeatherColors(description: string): { bg: string; accent1: string; accent2: string } {
  const d = description.toLowerCase();
  if (d.includes("sunny") || d.includes("clear")) {
    return { bg: "rgb(31, 132, 205)", accent1: "rgb(255, 199, 0)", accent2: "rgb(255, 129, 58)" };
  }
  if (d.includes("cloud") || d.includes("overcast")) {
    return { bg: "rgb(107, 114, 128)", accent1: "rgb(156, 163, 175)", accent2: "rgb(75, 85, 99)" };
  }
  if (d.includes("rain") || d.includes("drizzle")) {
    return { bg: "rgb(55, 65, 81)", accent1: "rgb(59, 130, 246)", accent2: "rgb(37, 99, 235)" };
  }
  if (d.includes("snow") || d.includes("blizzard") || d.includes("sleet")) {
    return { bg: "rgb(148, 163, 184)", accent1: "rgb(226, 232, 240)", accent2: "rgb(203, 213, 225)" };
  }
  if (d.includes("thunder") || d.includes("storm")) {
    return { bg: "rgb(30, 41, 59)", accent1: "rgb(250, 204, 21)", accent2: "rgb(55, 65, 81)" };
  }
  if (d.includes("mist") || d.includes("fog")) {
    return { bg: "rgb(148, 163, 184)", accent1: "rgb(203, 213, 225)", accent2: "rgb(226, 232, 240)" };
  }
  return { bg: "rgb(31, 132, 205)", accent1: "rgb(255, 199, 0)", accent2: "rgb(255, 129, 58)" };
}

const DEFAULT_QUICK_LINKS: QuickLink[] = [
  { title: "GitHub", url: "https://github.com" },
  { title: "Reddit", url: "https://reddit.com" },
  { title: "YouTube", url: "https://youtube.com" },
  { title: "Wikipedia", url: "https://wikipedia.org" },
  { title: "HN", url: "https://news.ycombinator.com" },
  { title: "Stack Overflow", url: "https://stackoverflow.com" },
  { title: "MDN", url: "https://developer.mozilla.org" },
  { title: "Twitter", url: "https://x.com" },
];

const DEFAULT_SETTINGS: NTPSettings = {
  wallpaperUrl: "",
  searchEngine: "duckduckgo",
  tempUnit: "F",
  widgets: {
    weather: true,
    clock: true,
    "quick-links": true,
    notes: true,
    discover: true,
    alia: true,
    sites: true,
  },
  widgetOrder: [...REORDERABLE_WIDGETS],
  quickLinks: DEFAULT_QUICK_LINKS,
};

const DEFAULT_SITES: SiteEntry[] = [
  { title: "DuckDuckGo", url: "https://duckduckgo.com" },
  { title: "Wikipedia", url: "https://wikipedia.org" },
  { title: "GitHub", url: "https://github.com" },
  { title: "Reddit", url: "https://reddit.com" },
  { title: "YouTube", url: "https://youtube.com" },
  { title: "Hacker News", url: "https://news.ycombinator.com" },
  { title: "Stack Overflow", url: "https://stackoverflow.com" },
  { title: "MDN", url: "https://developer.mozilla.org" },
];

// ── State ──

let settings: NTPSettings = loadSettings();
let notesDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let engineDropdownOpen = false;

// ── DOM References ──

const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

const searchForm = $<HTMLFormElement>("search-form");
const searchInput = $<HTMLInputElement>("search-input");
const searchEngineBtn = $<HTMLButtonElement>("search-engine-btn");
const searchEngineLabel = $<HTMLSpanElement>("search-engine-label");
const engineDropdown = $<HTMLDivElement>("engine-dropdown");
const searchEngineSelect = $<HTMLSelectElement>("search-engine-select");

const clockTime = $<HTMLDivElement>("clock-time");
const clockDate = $<HTMLDivElement>("clock-date");
const clockDay = $<HTMLDivElement>("clock-day");

const weatherWidget = $<HTMLDivElement>("weather-widget");
const weatherContent = $<HTMLDivElement>("weather-content");
const weatherTemp = $<HTMLDivElement>("weather-temp");
const weatherIconDisplay = $<HTMLDivElement>("weather-icon-display");
const weatherDesc = $<HTMLDivElement>("weather-desc");
const weatherLocation = $<HTMLDivElement>("weather-location");

const clockWidget = $<HTMLDivElement>("clock-widget");
const quickLinksWidget = $<HTMLDivElement>("quick-links-widget");
const quickLinksGrid = $<HTMLDivElement>("quick-links-grid");
const notesWidget = $<HTMLDivElement>("notes-widget");
const notesTextarea = $<HTMLTextAreaElement>("notes-textarea");
const discoverWidget = $<HTMLDivElement>("discover-widget");
const discoverLink = $<HTMLAnchorElement>("discover-link");
const discoverImg = $<HTMLImageElement>("discover-img");
const discoverTime = $<HTMLDivElement>("discover-time");
const discoverTitle = $<HTMLDivElement>("discover-title");
const aliaWidget = $<HTMLDivElement>("alia-widget");
const sitesContainer = $<HTMLDivElement>("sites-container");
const widgetGrid = $<HTMLDivElement>("widget-grid");

const customizeChromeBtn = $<HTMLButtonElement>("customize-chrome-btn");

const settingsBtn = $<HTMLButtonElement>("settings-btn");
const settingsOverlay = $<HTMLDivElement>("settings-overlay");
const settingsPanel = $<HTMLDivElement>("settings-panel");
const wallpaperInput = $<HTMLInputElement>("wallpaper-input");
const wallpaperUnsplash = $<HTMLButtonElement>("wallpaper-unsplash");
const wallpaperClear = $<HTMLButtonElement>("wallpaper-clear");
const quickLinksEditor = $<HTMLDivElement>("quick-links-editor");
const addQuickLinkBtn = $<HTMLButtonElement>("add-quick-link-btn");
const editLinksBtn = $<HTMLButtonElement>("edit-links-btn");
const tempFBtn = $<HTMLButtonElement>("temp-f");
const tempCBtn = $<HTMLButtonElement>("temp-c");

const tabSearch = $<HTMLAnchorElement>("tab-search");
const tabDiscover = $<HTMLAnchorElement>("tab-discover");
const sidebarIndicator = $<HTMLDivElement>("sidebar-active-indicator");

const blockedCount = $<HTMLDivElement>("blocked-count");

// ── Settings Persistence ──

/** Reconcile a saved widget order with the canonical list (handles added/removed widgets). */
function reconcileWidgetOrder(saved: WidgetId[]): WidgetId[] {
  const valid = new Set<WidgetId>(REORDERABLE_WIDGETS);
  const order = saved.filter((id) => valid.has(id));
  for (const id of REORDERABLE_WIDGETS) {
    if (!order.includes(id)) order.push(id);
  }
  return order;
}

function loadSettings(): NTPSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<NTPSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        widgets: { ...DEFAULT_SETTINGS.widgets, ...parsed.widgets },
        widgetOrder: reconcileWidgetOrder(parsed.widgetOrder ?? []),
        quickLinks:
          parsed.quickLinks && parsed.quickLinks.length > 0
            ? parsed.quickLinks
            : DEFAULT_QUICK_LINKS,
      };
    }
  } catch {
    // Corrupted storage, use defaults
  }
  return { ...DEFAULT_SETTINGS, quickLinks: [...DEFAULT_QUICK_LINKS], widgetOrder: [...REORDERABLE_WIDGETS] };
}

function saveSettings(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

// ── Mojo connection to the browser ──
// The C++ NewTabPageThirdPartyUI controller exposes a Mojo PageHandlerFactory.
// We connect to it to receive theme updates pushed by PageHandler::SetTheme().

interface NtpTheme {
  colorBackground: string;
  hasCustomBackground: boolean;
}

interface NtpMojoModule {
  PageCallbackRouter: new () => NtpCallbackRouter;
  PageHandlerRemote: new () => NtpPageHandler;
  PageHandlerFactory: { getRemote(): NtpPageHandlerFactory };
}

interface NtpCallbackRouter {
  $: { bindNewPipeAndPassRemote(): unknown };
  setTheme: { addListener(cb: (theme: NtpTheme) => void): void };
}

interface NtpPageHandler {
  $: { bindNewPipeAndPassReceiver(): unknown };
  updateTheme(): void;
}

interface NtpPageHandlerFactory {
  createPageHandler(remote: unknown, receiver: unknown): void;
}

async function initNtpMojo(): Promise<boolean> {
  try {
    const mod: NtpMojoModule = await import(
      /* @vite-ignore */
      "chrome://new-tab-page-third-party/new_tab_page_third_party.mojom-webui.js"
    );
    const callbackRouter = new mod.PageCallbackRouter();
    const handler = new mod.PageHandlerRemote();
    const factory = mod.PageHandlerFactory.getRemote();
    factory.createPageHandler(
      callbackRouter.$.bindNewPipeAndPassRemote(),
      handler.$.bindNewPipeAndPassReceiver()
    );

    // Listen for theme changes pushed by the browser
    callbackRouter.setTheme.addListener((theme: NtpTheme) => {
      document.documentElement.style.backgroundColor = theme.colorBackground;
      document.documentElement.toggleAttribute(
        "has-custom-background",
        theme.hasCustomBackground
      );
      // Reload colors.css to pick up new ColorProvider values
      const old = document.querySelector<HTMLLinkElement>(
        'link[href*="colors.css"]'
      );
      if (old) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href =
          "chrome://theme/colors.css?sets=ui,chrome&v=" + Date.now();
        old.parentNode?.insertBefore(link, old);
        link.onload = () => old.remove();
      }
    });

    // Ask the browser for the current theme
    handler.updateTheme();
    return true;
  } catch {
    // Not running inside the browser (e.g. Vite dev server) -- degrade gracefully
    return false;
  }
}

// ── Clock ──

function updateClock(): void {
  const now = new Date();

  clockTime.textContent = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  clockDate.textContent = now.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  clockDay.textContent = now.toLocaleDateString(undefined, {
    weekday: "short",
  });
}

// ── Theme ──

// Theme is now purely CSS-driven via @media (prefers-color-scheme: dark).
// The browser's native theme (controlled via chrome://settings) applies automatically.

function isDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function openCustomizeChrome(): void {
  // Open Chrome's native Customize side panel via SidePanelUI::Show().
  if ((globalThis as any).chrome?.send) {
    (globalThis as any).chrome.send("openCustomizeChrome");
  }
}

// ── Search Engine ──

function applySearchEngine(): void {
  const engine = SEARCH_ENGINES[settings.searchEngine];
  if (engine) {
    searchForm.action = engine.action;
    searchInput.name = engine.param;
    searchEngineLabel.textContent = engine.label;
    searchEngineSelect.value = settings.searchEngine;
  }
}

function showEngineDropdown(): void {
  const rect = searchEngineBtn.getBoundingClientRect();
  engineDropdown.style.top = `${rect.bottom + 4}px`;
  engineDropdown.style.left = `${rect.left}px`;
  engineDropdown.classList.remove("hidden");
  engineDropdownOpen = true;

  // Mark active
  const options = engineDropdown.querySelectorAll<HTMLButtonElement>(".engine-option");
  for (const opt of options) {
    opt.classList.toggle("active", opt.dataset.engine === settings.searchEngine);
  }
}

function hideEngineDropdown(): void {
  engineDropdown.classList.add("hidden");
  engineDropdownOpen = false;
}

function selectEngine(engine: string): void {
  settings.searchEngine = engine as NTPSettings["searchEngine"];
  saveSettings();
  applySearchEngine();
  hideEngineDropdown();
}

// ── Wallpaper ──

function applyWallpaper(): void {
  // No wallpaper system needed for Comet-style layout (uses solid bg-base)
  // But we keep the setting for future use
}

function setWallpaper(url: string): void {
  settings.wallpaperUrl = url;
  saveSettings();
  applyWallpaper();
  wallpaperInput.value = url;
}

async function fetchUnsplashRandom(): Promise<void> {
  // External fetch is blocked in chrome:// WebUI context.
  if (isWebUIContext()) {
    return;
  }
  wallpaperUnsplash.textContent = "Loading...";
  wallpaperUnsplash.disabled = true;
  try {
    const url = `https://source.unsplash.com/random/1920x1080/?nature,landscape&t=${Date.now()}`;
    const response = await fetch(url, { redirect: "follow" });
    if (response.ok) {
      setWallpaper(response.url);
    }
  } catch {
    setWallpaper(
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80",
    );
  } finally {
    wallpaperUnsplash.textContent = "Random from Unsplash";
    wallpaperUnsplash.disabled = false;
  }
}

// ── Weather ──

function getWeatherIcon(description: string): string {
  for (const [key, icon] of Object.entries(WEATHER_ICONS)) {
    if (description.toLowerCase().includes(key.toLowerCase())) {
      return icon;
    }
  }
  return "\uD83C\uDF24\uFE0F";
}

function renderWeather(data: WeatherData): void {
  const temp = settings.tempUnit === "F" ? `${data.tempF}\u00B0` : `${data.tempC}\u00B0`;

  // Update the weather background colors
  const bgEl = weatherContent.querySelector<HTMLDivElement>(".absolute.inset-0.overflow-hidden");
  if (bgEl) {
    bgEl.style.backgroundColor = data.bgColor;
    const circles = bgEl.querySelectorAll<HTMLDivElement>(".-inset-xl");
    if (circles[0]) circles[0].style.backgroundColor = data.accentColor1;
    if (circles[1]) circles[1].style.backgroundColor = data.accentColor2;
  }

  weatherTemp.textContent = temp;
  weatherIconDisplay.textContent = data.icon;
  weatherDesc.textContent = data.description;
  weatherLocation.textContent = data.location;
}

function renderWeatherError(): void {
  weatherTemp.textContent = "--";
  weatherIconDisplay.textContent = "\u2601\uFE0F";
  weatherDesc.textContent = "Weather unavailable";
  weatherLocation.textContent = "";
}

// Detects if we're running inside a chrome:// WebUI context where external
// https:// fetch/img loads are blocked by the WebUI URL loader factory.
function isWebUIContext(): boolean {
  return location.protocol === "chrome:" || location.protocol === "chrome-untrusted:";
}

async function fetchWeather(): Promise<void> {
  // Check cache first
  try {
    const cached = localStorage.getItem(WEATHER_CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached) as {
        data: WeatherData;
        timestamp: number;
      };
      // In WebUI context, use cached data regardless of TTL since we cannot
      // make external network requests.
      if (Date.now() - timestamp < WEATHER_CACHE_TTL || isWebUIContext()) {
        renderWeather(data);
        return;
      }
    }
  } catch {
    // Ignore cache errors
  }

  // In chrome:// WebUI context, external fetch requests are blocked.
  // Show the cached data or fallback state.
  if (isWebUIContext()) {
    renderWeatherError();
    return;
  }

  try {
    const response = await fetch("https://wttr.in/?format=j1", {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) throw new Error("Weather API error");

    const json = await response.json();
    const current = json.current_condition?.[0];
    const area = json.nearest_area?.[0];

    if (!current || !area) throw new Error("Invalid weather data");

    const description = current.weatherDesc?.[0]?.value ?? "Unknown";
    const colors = getWeatherColors(description);

    const data: WeatherData = {
      tempF: parseInt(current.temp_F, 10),
      tempC: parseInt(current.temp_C, 10),
      description,
      location: area.areaName?.[0]?.value ?? "Unknown",
      icon: getWeatherIcon(description),
      humidity: current.humidity,
      feelsLikeF: parseInt(current.FeelsLikeF, 10),
      feelsLikeC: parseInt(current.FeelsLikeC, 10),
      bgColor: colors.bg,
      accentColor1: colors.accent1,
      accentColor2: colors.accent2,
    };

    localStorage.setItem(
      WEATHER_CACHE_KEY,
      JSON.stringify({ data, timestamp: Date.now() }),
    );

    renderWeather(data);
  } catch {
    renderWeatherError();
  }
}

// ── Quick Links ──

function faviconUrl(siteUrl: string): string {
  try {
    // In chrome:// WebUI pages, external https:// resource loads are blocked
    // by the WebUI URL loader factory. Use chrome://favicon2/ which is served
    // by the FaviconSource registered in NewTabPageThirdPartyUI.
    const url = new URL(siteUrl);
    return `chrome://favicon2/?size=24&scaleFactor=1x&pageUrl=${encodeURIComponent(url.href)}`;
  } catch {
    return "";
  }
}

function createFaviconFallback(title: string): HTMLDivElement {
  const div = document.createElement("div");
  div.className = "favicon-fallback";
  div.textContent = title.charAt(0).toUpperCase();
  return div;
}

function renderQuickLinks(): void {
  quickLinksGrid.innerHTML = "";

  // Show up to 8 links in the grid (2 cols x 4 rows fits in square card)
  const links = settings.quickLinks.slice(0, 8);

  for (const link of links) {
    const anchor = document.createElement("a");
    anchor.href = link.url;
    anchor.className = "quick-link-item";
    anchor.title = link.title;

    const iconSrc = faviconUrl(link.url);
    const img = document.createElement("img");
    img.src = iconSrc;
    img.alt = "";
    img.width = 24;
    img.height = 24;
    img.loading = "lazy";
    img.onerror = () => {
      img.replaceWith(createFaviconFallback(link.title));
    };

    const label = document.createElement("span");
    label.className = "link-label";
    label.textContent = link.title;

    anchor.appendChild(img);
    anchor.appendChild(label);
    quickLinksGrid.appendChild(anchor);
  }
}

function renderQuickLinksEditor(): void {
  quickLinksEditor.innerHTML = "";

  settings.quickLinks.forEach((link, index) => {
    const row = document.createElement("div");
    row.className = "flex items-center gap-2";

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.value = link.title;
    titleInput.placeholder = "Title";
    titleInput.className = "settings-input flex-1 !py-2 text-sm";
    titleInput.addEventListener("input", () => {
      settings.quickLinks[index].title = titleInput.value;
      saveSettings();
      renderQuickLinks();
    });

    const urlInput = document.createElement("input");
    urlInput.type = "text";
    urlInput.value = link.url;
    urlInput.placeholder = "https://...";
    urlInput.className = "settings-input flex-[2] !py-2 text-sm";
    urlInput.addEventListener("input", () => {
      settings.quickLinks[index].url = urlInput.value;
      saveSettings();
      renderQuickLinks();
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className =
      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-quiet transition-colors hover:bg-super/10 hover:text-[var(--color-sys-error,#ef4444)]";
    removeBtn.innerHTML = `<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
    removeBtn.addEventListener("click", () => {
      settings.quickLinks.splice(index, 1);
      saveSettings();
      renderQuickLinks();
      renderQuickLinksEditor();
    });

    row.appendChild(titleInput);
    row.appendChild(urlInput);
    row.appendChild(removeBtn);
    quickLinksEditor.appendChild(row);
  });
}

function addQuickLink(): void {
  settings.quickLinks.push({ title: "New Link", url: "https://" });
  saveSettings();
  renderQuickLinks();
  renderQuickLinksEditor();
}

// ── Most Visited Sites ──

function renderSites(sites: SiteEntry[]): void {
  sitesContainer.innerHTML = "";

  for (const site of sites) {
    const wrapper = document.createElement("div");
    wrapper.className = "relative isolate col-span-1";

    const card = document.createElement("div");
    card.className =
      "relative border rounded-xl shadow-card active:!bg-subtle aspect-[1/1] w-full overflow-hidden !rounded-2xl border-subtlest ring-subtlest divide-subtlest bg-raised site-card";

    const anchor = document.createElement("a");
    anchor.href = site.url;
    anchor.draggable = false;
    anchor.className = "relative block size-full";

    const inner = document.createElement("div");
    inner.className = "flex size-full flex-col items-center justify-center gap-2 p-3";

    const iconSrc = faviconUrl(site.url);
    const img = document.createElement("img");
    img.src = iconSrc;
    img.alt = "";
    img.width = 32;
    img.height = 32;
    img.className = "rounded-xl";
    img.loading = "lazy";
    img.onerror = () => {
      const fallback = createFaviconFallback(site.title);
      fallback.style.width = "32px";
      fallback.style.height = "32px";
      fallback.style.fontSize = "0.875rem";
      img.replaceWith(fallback);
    };

    const label = document.createElement("div");
    label.className = "font-sans text-2xs font-medium text-quiet truncate max-w-full text-center";
    label.textContent = site.title;

    inner.appendChild(img);
    inner.appendChild(label);
    anchor.appendChild(inner);
    card.appendChild(anchor);
    wrapper.appendChild(card);
    sitesContainer.appendChild(wrapper);
  }
}

function loadSites(): void {
  const chromeTopSites = (globalThis as Record<string, unknown>).chrome as
    | {
        topSites?: {
          get(cb: (sites: { title: string; url: string }[]) => void): void;
        };
      }
    | undefined;

  if (chromeTopSites?.topSites) {
    chromeTopSites.topSites.get((topSites) => {
      const mapped: SiteEntry[] = topSites.slice(0, 4).map((s) => ({
        title: s.title || new URL(s.url).hostname,
        url: s.url,
      }));
      renderSites(mapped.length > 0 ? mapped : DEFAULT_SITES.slice(0, 4));
    });
  } else {
    renderSites(DEFAULT_SITES.slice(0, 4));
  }
}

// ── Notes ──

function loadNotes(): void {
  const stored = localStorage.getItem(NOTES_KEY);
  if (stored) {
    notesTextarea.value = stored;
  }
}

function saveNotes(): void {
  localStorage.setItem(NOTES_KEY, notesTextarea.value);
}

function handleNotesInput(): void {
  if (notesDebounceTimer) clearTimeout(notesDebounceTimer);
  notesDebounceTimer = setTimeout(saveNotes, 500);
}

// ── Discover / News ──

async function loadDiscover(): Promise<void> {
  // In chrome:// WebUI pages, external https:// image loads are blocked by the
  // URL loader factory. Use a CSS gradient instead of an external image.
  discoverImg.style.display = "none";
  const bgDiv = discoverImg.parentElement;
  if (bgDiv) {
    const fallback = document.createElement("div");
    fallback.className = "absolute inset-0";
    fallback.className = "absolute inset-0 discover-gradient";
    bgDiv.insertBefore(fallback, bgDiv.firstChild);
  }
  discoverTitle.textContent = "Explore trending topics";
  discoverTime.textContent = "Just now";
  discoverLink.href = "https://duckduckgo.com/?q=trending+news";
}

// ── Widget Visibility ──

function applyWidgetVisibility(): void {
  weatherWidget.style.display = settings.widgets.weather ? "" : "none";
  clockWidget.style.display = settings.widgets.clock ? "" : "none";
  quickLinksWidget.style.display = settings.widgets["quick-links"] ? "" : "none";
  notesWidget.style.display = settings.widgets.notes ? "" : "none";
  discoverWidget.style.display = settings.widgets.discover ? "" : "none";
  aliaWidget.style.display = settings.widgets.alia ? "" : "none";

  // Sites are rendered as separate cards in the grid
  const siteCards = sitesContainer.querySelectorAll<HTMLDivElement>(".relative.isolate");
  for (const card of siteCards) {
    card.style.display = settings.widgets.sites ? "" : "none";
  }
}

// ── Widget Drag Reorder ──

let draggedWidgetId: WidgetId | null = null;

/** Reorder widget DOM elements to match settings.widgetOrder. */
function applyWidgetOrder(): void {
  for (const id of settings.widgetOrder) {
    const el = document.getElementById(id);
    if (el) widgetGrid.insertBefore(el, sitesContainer);
  }
}

/** Set draggable attribute on all reorderable widgets. */
function initWidgetDrag(): void {
  for (const id of REORDERABLE_WIDGETS) {
    const el = document.getElementById(id);
    if (el) el.draggable = true;
  }

  widgetGrid.addEventListener("dragstart", onWidgetDragStart);
  widgetGrid.addEventListener("dragend", onWidgetDragEnd);
  widgetGrid.addEventListener("dragover", onWidgetDragOver);
  widgetGrid.addEventListener("dragleave", onWidgetDragLeave);
  widgetGrid.addEventListener("drop", onWidgetDrop);
}

function onWidgetDragStart(e: DragEvent): void {
  // Don't initiate widget drag from interactive elements
  const origin = document.elementFromPoint(e.clientX, e.clientY);
  if (origin?.closest("textarea, input, select, [contenteditable]")) {
    e.preventDefault();
    return;
  }

  const widget = (e.target as HTMLElement).closest<HTMLDivElement>("[data-widget-id]");
  if (!widget?.dataset.widgetId || !e.dataTransfer) return;

  draggedWidgetId = widget.dataset.widgetId as WidgetId;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", draggedWidgetId);

  requestAnimationFrame(() => widget.classList.add("widget-dragging"));
}

function onWidgetDragEnd(e: DragEvent): void {
  const widget = (e.target as HTMLElement).closest<HTMLDivElement>("[data-widget-id]");
  widget?.classList.remove("widget-dragging");

  for (const id of REORDERABLE_WIDGETS) {
    document.getElementById(id)?.classList.remove("widget-drag-over");
  }
  draggedWidgetId = null;
}

function onWidgetDragOver(e: DragEvent): void {
  if (!draggedWidgetId) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";

  const target = (e.target as HTMLElement).closest<HTMLDivElement>("[data-widget-id]");
  if (!target || target.dataset.widgetId === draggedWidgetId) return;

  // Highlight only the current drop target
  for (const id of REORDERABLE_WIDGETS) {
    const el = document.getElementById(id);
    if (el && el !== target) el.classList.remove("widget-drag-over");
  }
  target.classList.add("widget-drag-over");
}

function onWidgetDragLeave(e: DragEvent): void {
  const target = (e.target as HTMLElement).closest<HTMLDivElement>("[data-widget-id]");
  if (target && !target.contains(e.relatedTarget as Node)) {
    target.classList.remove("widget-drag-over");
  }
}

function onWidgetDrop(e: DragEvent): void {
  e.preventDefault();
  const target = (e.target as HTMLElement).closest<HTMLDivElement>("[data-widget-id]");
  if (!target || !draggedWidgetId) return;

  const targetId = target.dataset.widgetId as WidgetId;
  if (targetId === draggedWidgetId) return;

  const order = [...settings.widgetOrder];
  const fromIdx = order.indexOf(draggedWidgetId);
  const toIdx = order.indexOf(targetId);
  if (fromIdx === -1 || toIdx === -1) return;

  // Move the dragged widget to the target's position
  order.splice(fromIdx, 1);
  order.splice(toIdx, 0, draggedWidgetId);

  settings.widgetOrder = order;
  saveSettings();
  applyWidgetOrder();
  target.classList.remove("widget-drag-over");
}

function syncToggleSwitches(): void {
  const toggles = document.querySelectorAll<HTMLDivElement>(".toggle-switch");
  for (const toggle of toggles) {
    const widget = toggle.dataset.widget as keyof NTPSettings["widgets"];
    if (widget && widget in settings.widgets) {
      toggle.classList.toggle("active", settings.widgets[widget]);
    }
  }
}

function handleToggleClick(e: Event): void {
  const toggle = (e.target as HTMLElement).closest(
    ".toggle-switch",
  ) as HTMLDivElement | null;
  if (!toggle) return;

  const widget = toggle.dataset.widget as keyof NTPSettings["widgets"];
  if (!widget || !(widget in settings.widgets)) return;

  settings.widgets[widget] = !settings.widgets[widget];
  toggle.classList.toggle("active", settings.widgets[widget]);
  saveSettings();
  applyWidgetVisibility();
}

// ── Settings Panel ──

function openSettings(): void {
  // Open Astro settings page
  window.location.href = "chrome://settings/";
}

function closeSettings(): void {
  settingsOverlay.classList.remove("open");
  settingsPanel.classList.remove("open");
}

// ── Temperature Unit ──

function syncTempButtons(): void {
  if (settings.tempUnit === "F") {
    tempFBtn.className =
      "rounded-lg bg-super/10 px-4 py-1.5 text-sm font-medium text-super transition-colors";
    tempCBtn.className =
      "rounded-lg bg-subtle px-4 py-1.5 text-sm font-medium text-quiet transition-colors";
  } else {
    tempCBtn.className =
      "rounded-lg bg-super/10 px-4 py-1.5 text-sm font-medium text-super transition-colors";
    tempFBtn.className =
      "rounded-lg bg-subtle px-4 py-1.5 text-sm font-medium text-quiet transition-colors";
  }
}

function setTempUnit(unit: "F" | "C"): void {
  settings.tempUnit = unit;
  saveSettings();
  syncTempButtons();
  fetchWeather();
}

// ── Sidebar Tabs ──

function activateTab(tab: "search" | "discover"): void {
  if (tab === "search") {
    tabSearch.classList.add("active");
    tabSearch.classList.remove("text-quiet", "hover:text-foreground");
    tabDiscover.classList.remove("active");
    tabDiscover.classList.add("text-quiet", "hover:text-foreground");
    sidebarIndicator.style.transform = "translateY(0px)";
  } else {
    tabDiscover.classList.add("active");
    tabDiscover.classList.remove("text-quiet", "hover:text-foreground");
    tabSearch.classList.remove("active");
    tabSearch.classList.add("text-quiet", "hover:text-foreground");
    sidebarIndicator.style.transform = "translateY(100%)";
  }
}

// ── Keyboard Shortcuts ──

function handleKeyboard(e: KeyboardEvent): void {
  const target = e.target as HTMLElement;
  const isInput =
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable;

  if (e.key === "Escape") {
    if (engineDropdownOpen) {
      hideEngineDropdown();
      return;
    }
    if (settingsPanel.classList.contains("open")) {
      closeSettings();
      return;
    }
    if (document.activeElement === searchInput) {
      searchInput.blur();
      return;
    }
  }

  if (e.key === "/" && !isInput) {
    e.preventDefault();
    searchInput.focus();
    return;
  }

  if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    searchInput.focus();
    return;
  }

  if (e.key === "," && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    if (settingsPanel.classList.contains("open")) {
      closeSettings();
    } else {
      openSettings();
    }
  }
}

// ── Alia Integration ──

function openAlia(): void {
  // Open Alia AI side panel via SidePanelUI::Show().
  if ((globalThis as any).chrome?.send) {
    (globalThis as any).chrome.send("openAliaSidePanel");
  }
}

// ── Blocked Count ──
//
// The lifetime count of ads/trackers blocked by Astro's built-in ad blocker
// is stored in PrefService (oxy.adblock.lifetime_blocked_count) and pushed
// to the NTP via chrome.send + cr.addWebUIListener. The C++ side is in
// src/chrome/browser/oxy/webui/astro_ntp_ui.cc (AstroNtpHandler::
// HandleGetBlockedCount / OnBlockedCountChanged).

function renderBlockedCount(count: number): void {
  if (!blockedCount) return;
  blockedCount.textContent =
    `${count.toLocaleString()} ads and trackers blocked`;
}

function requestBlockedCount(): void {
  const g = globalThis as Record<string, unknown>;
  const cr = g.cr as {
    addWebUIListener?: (
      event: string,
      callback: (...args: unknown[]) => void,
    ) => void;
  } | undefined;
  if (cr?.addWebUIListener) {
    cr.addWebUIListener("onBlockedCount", (count: unknown) => {
      if (typeof count === "number") {
        renderBlockedCount(count);
      }
    });
  }
  const chrome = g.chrome as { send?: (msg: string) => void } | undefined;
  if (chrome?.send) {
    chrome.send("getBlockedCount");
  } else {
    // Vite dev fallback: no browser bridge available, render zero.
    renderBlockedCount(0);
  }
}

// ── Widget Prefs from PrefService ──
// The NTP and Settings pages run on different origins (chrome://astro-ntp vs
// chrome://settings), so localStorage isn't shared. Widget visibility prefs
// are the source of truth in PrefService. We request them via chrome.send()
// and the C++ AstroNtpHandler calls back via onWidgetPrefs().

interface WidgetPrefs {
  weather: boolean;
  clock: boolean;
  quickLinks: boolean;
  notes: boolean;
  sites: boolean;
  discover: boolean;
  alia: boolean;
}

function onWidgetPrefs(prefs: WidgetPrefs): void {
  settings.widgets.weather = prefs.weather;
  settings.widgets.clock = prefs.clock;
  settings.widgets["quick-links"] = prefs.quickLinks;
  settings.widgets.notes = prefs.notes;
  settings.widgets.sites = prefs.sites;
  settings.widgets.discover = prefs.discover;
  settings.widgets.alia = prefs.alia;

  applyWidgetVisibility();
  syncToggleSwitches();

  // If weather was just enabled and we haven't fetched yet, fetch now
  if (prefs.weather && weatherTemp.textContent === "") {
    fetchWeather();
  }
}

function requestWidgetPrefs(): void {
  // 1. Read initial prefs injected by C++ into the HTML data attribute.
  const raw = document.documentElement.dataset.ntpPrefs;
  if (raw) {
    try {
      onWidgetPrefs(JSON.parse(raw) as WidgetPrefs);
    } catch {
      // Invalid JSON — use defaults
    }
  }

  // 2. Listen for live updates when prefs change (e.g., user toggles in settings).
  //    Uses the cr.webUIListenerCallback polyfill we set up above.
  const g = globalThis as Record<string, unknown>;
  const cr = g.cr as {
    addWebUIListener?: (event: string, callback: (...args: unknown[]) => void) => void;
  } | undefined;
  if (cr?.addWebUIListener) {
    cr.addWebUIListener("onWidgetPrefs",
      (weather: boolean, clock: boolean, quickLinks: boolean,
       notes: boolean, sites: boolean, discover: boolean, alia: boolean) => {
        onWidgetPrefs({ weather, clock, quickLinks, notes, sites, discover, alia });
      });
  }

  // 3. Trigger chrome.send to activate the pref watcher + get initial values.
  const chrome = g.chrome as { send?: (msg: string) => void } | undefined;
  if (chrome?.send) {
    chrome.send("getWidgetPrefs");
  }
}

// ── Init ──

// Connect to the browser's Mojo PageHandler for theme updates.
// Fire-and-forget: the NTP renders fine without it (e.g. during Vite dev).
initNtpMojo();

// Request widget visibility prefs from PrefService (overrides localStorage).
requestWidgetPrefs();

applyWidgetOrder();
initWidgetDrag();
updateClock();
applySearchEngine();
// Widget visibility is applied by requestWidgetPrefs() above.
loadNotes();
renderQuickLinks();
loadSites();
loadDiscover();
requestBlockedCount();

if (settings.widgets.weather) {
  fetchWeather();
}

// Update timers
setInterval(updateClock, 10_000);

// ── Event Listeners ──

document.addEventListener("keydown", handleKeyboard);
customizeChromeBtn.addEventListener("click", openCustomizeChrome);

// Search engine dropdown
searchEngineBtn.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (engineDropdownOpen) {
    hideEngineDropdown();
  } else {
    showEngineDropdown();
  }
});

document.addEventListener("click", (e) => {
  if (
    engineDropdownOpen &&
    !engineDropdown.contains(e.target as Node) &&
    !searchEngineBtn.contains(e.target as Node)
  ) {
    hideEngineDropdown();
  }
});

const engineOptions = engineDropdown.querySelectorAll<HTMLButtonElement>(".engine-option");
for (const opt of engineOptions) {
  opt.addEventListener("click", () => {
    if (opt.dataset.engine) {
      selectEngine(opt.dataset.engine);
    }
  });
}

// Alia widget click
aliaWidget.addEventListener("click", openAlia);

// Notes
notesTextarea.addEventListener("input", handleNotesInput);

// Settings panel
settingsBtn.addEventListener("click", openSettings);
const mobileSettingsBtn =
  document.getElementById("mobile-settings-btn");
if (mobileSettingsBtn) {
  mobileSettingsBtn.addEventListener("click", openSettings);
}
settingsOverlay.addEventListener("click", closeSettings);
editLinksBtn.addEventListener("click", openSettings);

// Wallpaper controls
wallpaperInput.addEventListener("change", () => {
  setWallpaper(wallpaperInput.value.trim());
});
wallpaperUnsplash.addEventListener("click", fetchUnsplashRandom);
wallpaperClear.addEventListener("click", () => {
  setWallpaper("");
});

// Search engine (settings panel)
searchEngineSelect.addEventListener("change", () => {
  settings.searchEngine = searchEngineSelect.value as NTPSettings["searchEngine"];
  saveSettings();
  applySearchEngine();
});

// Widget toggles
document.querySelectorAll(".toggle-switch").forEach((toggle) => {
  toggle.addEventListener("click", handleToggleClick);
});

// Add quick link
addQuickLinkBtn.addEventListener("click", addQuickLink);

// Temperature unit
tempFBtn.addEventListener("click", () => setTempUnit("F"));
tempCBtn.addEventListener("click", () => setTempUnit("C"));

// Sidebar tabs
tabSearch.addEventListener("click", (e) => {
  e.preventDefault();
  activateTab("search");
});
tabDiscover.addEventListener("click", (e) => {
  e.preventDefault();
  activateTab("discover");
});


