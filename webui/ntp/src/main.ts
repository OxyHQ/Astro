// ── Astro New Tab Page ──
// Premium, customizable NTP with widgets

// ── Types ──

interface QuickLink {
  title: string;
  url: string;
}

interface NTPSettings {
  wallpaperUrl: string;
  searchEngine: "duckduckgo" | "google" | "bing" | "brave" | "startpage";
  tempUnit: "F" | "C";
  widgets: {
    weather: boolean;
    "quick-links": boolean;
    notes: boolean;
    sites: boolean;
  };
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
}

// ── Constants ──

const STORAGE_KEY = "astro-ntp";
const WEATHER_CACHE_KEY = "astro-ntp-weather";
const WEATHER_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const NOTES_KEY = "astro-ntp-notes";

const SEARCH_ENGINES: Record<string, { action: string; param: string }> = {
  duckduckgo: { action: "https://duckduckgo.com/", param: "q" },
  google: { action: "https://www.google.com/search", param: "q" },
  bing: { action: "https://www.bing.com/search", param: "q" },
  brave: { action: "https://search.brave.com/search", param: "q" },
  startpage: { action: "https://www.startpage.com/search", param: "query" },
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
    "quick-links": true,
    notes: true,
    sites: true,
  },
  quickLinks: DEFAULT_QUICK_LINKS,
};

// ── State ──

let settings: NTPSettings = loadSettings();
let notesDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// ── DOM References ──

const greetingEl = document.getElementById("greeting") as HTMLHeadingElement;
const clockEl = document.getElementById("clock") as HTMLSpanElement;
const dateEl = document.getElementById("date") as HTMLSpanElement;
const searchForm = document.getElementById("search-form") as HTMLFormElement;
const searchInput = document.getElementById("search-input") as HTMLInputElement;
const searchHint = document.getElementById("search-hint") as HTMLElement;
const aliaSearchBtn = document.getElementById(
  "alia-search-btn",
) as HTMLButtonElement;
const aliaChip = document.getElementById("alia-chip") as HTMLButtonElement;
const sitesGrid = document.getElementById("sites-grid") as HTMLDivElement;
const sitesSection = document.getElementById("sites-section") as HTMLDivElement;
const themeToggle = document.getElementById(
  "theme-toggle",
) as HTMLButtonElement;
const iconSun = document.getElementById("icon-sun") as SVGElement;
const iconMoon = document.getElementById("icon-moon") as SVGElement;
const wallpaperBg = document.getElementById("wallpaper-bg") as HTMLDivElement;

// Widget elements
const weatherWidget = document.getElementById(
  "weather-widget",
) as HTMLDivElement;
const weatherContent = document.getElementById(
  "weather-content",
) as HTMLDivElement;
const quickLinksWidget = document.getElementById(
  "quick-links-widget",
) as HTMLDivElement;
const quickLinksGrid = document.getElementById(
  "quick-links-grid",
) as HTMLDivElement;
const notesWidget = document.getElementById("notes-widget") as HTMLDivElement;
const notesTextarea = document.getElementById(
  "notes-textarea",
) as HTMLTextAreaElement;
const notesSaved = document.getElementById("notes-saved") as HTMLSpanElement;

// Settings elements
const settingsBtn = document.getElementById(
  "settings-btn",
) as HTMLButtonElement;
const settingsOverlay = document.getElementById(
  "settings-overlay",
) as HTMLDivElement;
const settingsPanel = document.getElementById(
  "settings-panel",
) as HTMLDivElement;
const wallpaperInput = document.getElementById(
  "wallpaper-input",
) as HTMLInputElement;
const wallpaperUnsplash = document.getElementById(
  "wallpaper-unsplash",
) as HTMLButtonElement;
const wallpaperClear = document.getElementById(
  "wallpaper-clear",
) as HTMLButtonElement;
const searchEngineSelect = document.getElementById(
  "search-engine-select",
) as HTMLSelectElement;
const quickLinksEditor = document.getElementById(
  "quick-links-editor",
) as HTMLDivElement;
const addQuickLinkBtn = document.getElementById(
  "add-quick-link-btn",
) as HTMLButtonElement;
const editLinksBtn = document.getElementById(
  "edit-links-btn",
) as HTMLButtonElement;
const tempFBtn = document.getElementById("temp-f") as HTMLButtonElement;
const tempCBtn = document.getElementById("temp-c") as HTMLButtonElement;

// ── Settings Persistence ──

function loadSettings(): NTPSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<NTPSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        widgets: { ...DEFAULT_SETTINGS.widgets, ...parsed.widgets },
        quickLinks:
          parsed.quickLinks && parsed.quickLinks.length > 0
            ? parsed.quickLinks
            : DEFAULT_QUICK_LINKS,
      };
    }
  } catch {
    // Corrupted storage, use defaults
  }
  return { ...DEFAULT_SETTINGS, quickLinks: [...DEFAULT_QUICK_LINKS] };
}

function saveSettings(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

// ── Greeting ──

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function updateGreeting(): void {
  greetingEl.textContent = getGreeting();
}

// ── Clock ──

function updateClock(): void {
  const now = new Date();

  clockEl.textContent = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  dateEl.textContent = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// ── Theme ──

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

function applyThemeIcons(): void {
  if (isDark()) {
    iconSun.classList.remove("hidden");
    iconMoon.classList.add("hidden");
  } else {
    iconSun.classList.add("hidden");
    iconMoon.classList.remove("hidden");
  }
}

function toggleTheme(): void {
  const dark = !isDark();
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem("astro-ntp-theme", dark ? "dark" : "light");
  applyThemeIcons();
}

// ── Wallpaper ──

function applyWallpaper(): void {
  const url = settings.wallpaperUrl;
  if (url) {
    wallpaperBg.style.backgroundImage = `url(${url})`;
    wallpaperBg.classList.remove("default-gradient");
    wallpaperBg.classList.add("has-wallpaper");
  } else {
    wallpaperBg.style.backgroundImage = "";
    wallpaperBg.classList.add("default-gradient");
    wallpaperBg.classList.remove("has-wallpaper");
  }
}

function setWallpaper(url: string): void {
  settings.wallpaperUrl = url;
  saveSettings();
  applyWallpaper();
  wallpaperInput.value = url;
}

async function fetchUnsplashRandom(): Promise<void> {
  wallpaperUnsplash.textContent = "Loading...";
  wallpaperUnsplash.disabled = true;
  try {
    // Unsplash Source API provides random images without an API key
    const url = `https://source.unsplash.com/random/1920x1080/?nature,landscape&t=${Date.now()}`;
    // We need to follow the redirect to get the actual image URL
    const response = await fetch(url, { redirect: "follow" });
    if (response.ok) {
      setWallpaper(response.url);
    }
  } catch {
    // Fallback: use a known good Unsplash image
    setWallpaper(
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80",
    );
  } finally {
    wallpaperUnsplash.textContent = "Random from Unsplash";
    wallpaperUnsplash.disabled = false;
  }
}

// ── Search Engine ──

function applySearchEngine(): void {
  const engine = SEARCH_ENGINES[settings.searchEngine];
  if (engine) {
    searchForm.action = engine.action;
    searchInput.name = engine.param;
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
  const temp =
    settings.tempUnit === "F" ? `${data.tempF}\u00B0F` : `${data.tempC}\u00B0C`;
  const feelsLike =
    settings.tempUnit === "F"
      ? `${data.feelsLikeF}\u00B0`
      : `${data.feelsLikeC}\u00B0`;

  weatherContent.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="text-3xl leading-none">${data.icon}</span>
      <div class="min-w-0 flex-1">
        <div class="text-2xl font-semibold text-oxy-text">${temp}</div>
        <div class="text-sm text-oxy-text-secondary truncate">${data.description} &middot; ${data.location}</div>
      </div>
    </div>
    <div class="mt-2 flex gap-4 text-xs text-oxy-text-tertiary">
      <span>Feels like ${feelsLike}</span>
      <span>Humidity ${data.humidity}%</span>
    </div>
  `;
}

function renderWeatherError(): void {
  weatherContent.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="text-2xl leading-none opacity-50">\u2601\uFE0F</span>
      <div>
        <div class="text-sm text-oxy-text-secondary">Weather unavailable</div>
        <div class="text-xs text-oxy-text-tertiary">Could not load weather data</div>
      </div>
    </div>
  `;
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
      if (Date.now() - timestamp < WEATHER_CACHE_TTL) {
        renderWeather(data);
        return;
      }
    }
  } catch {
    // Ignore cache errors
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

    const description =
      current.weatherDesc?.[0]?.value ?? "Unknown";
    const data: WeatherData = {
      tempF: parseInt(current.temp_F, 10),
      tempC: parseInt(current.temp_C, 10),
      description,
      location:
        area.areaName?.[0]?.value ?? "Unknown",
      icon: getWeatherIcon(description),
      humidity: current.humidity,
      feelsLikeF: parseInt(current.FeelsLikeF, 10),
      feelsLikeC: parseInt(current.FeelsLikeC, 10),
    };

    // Cache it
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
    const { hostname } = new URL(siteUrl);
    return `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
  } catch {
    return "";
  }
}

function createFaviconFallback(title: string): HTMLDivElement {
  const div = document.createElement("div");
  div.className =
    "flex items-center justify-center w-8 h-8 rounded-lg bg-oxy-primary/10 text-oxy-primary font-semibold text-xs select-none";
  div.textContent = title.charAt(0).toUpperCase();
  return div;
}

function renderQuickLinks(): void {
  quickLinksGrid.innerHTML = "";

  for (const link of settings.quickLinks) {
    const anchor = document.createElement("a");
    anchor.href = link.url;
    anchor.className =
      "quick-link-item flex flex-col items-center gap-1.5 rounded-xl p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer select-none";
    anchor.title = link.title;

    const iconSrc = faviconUrl(link.url);
    const img = document.createElement("img");
    img.src = iconSrc;
    img.alt = "";
    img.width = 32;
    img.height = 32;
    img.className = "rounded-lg";
    img.loading = "lazy";
    img.onerror = () => {
      img.replaceWith(createFaviconFallback(link.title));
    };

    const label = document.createElement("span");
    label.className =
      "text-[10px] leading-tight font-medium text-oxy-text-secondary truncate max-w-full text-center";
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
      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-oxy-text-tertiary transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10";
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

interface SiteEntry {
  title: string;
  url: string;
}

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

function renderSites(sites: SiteEntry[]): void {
  sitesGrid.innerHTML = "";

  for (const site of sites) {
    const anchor = document.createElement("a");
    anchor.href = site.url;
    anchor.className =
      "site-tile flex flex-col items-center gap-2 rounded-xl bg-white/60 dark:bg-white/5 border border-white/20 dark:border-white/6 cursor-pointer select-none p-3 w-[84px] backdrop-blur-sm";
    anchor.title = site.title;

    const iconSrc = faviconUrl(site.url);
    const img = document.createElement("img");
    img.src = iconSrc;
    img.alt = "";
    img.width = 36;
    img.height = 36;
    img.className = "rounded-xl";
    img.loading = "lazy";
    img.onerror = () => {
      img.replaceWith(createFaviconFallback(site.title));
    };

    const label = document.createElement("span");
    label.className =
      "text-[11px] leading-tight font-medium text-oxy-text-secondary truncate max-w-full text-center";
    label.textContent = site.title;

    anchor.appendChild(img);
    anchor.appendChild(label);
    sitesGrid.appendChild(anchor);
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
      const mapped: SiteEntry[] = topSites.slice(0, 8).map((s) => ({
        title: s.title || new URL(s.url).hostname,
        url: s.url,
      }));
      renderSites(mapped.length > 0 ? mapped : DEFAULT_SITES);
    });
  } else {
    renderSites(DEFAULT_SITES);
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
  // Show "Saved" indicator
  notesSaved.style.opacity = "1";
  setTimeout(() => {
    notesSaved.style.opacity = "0";
  }, 1500);
}

function handleNotesInput(): void {
  if (notesDebounceTimer) clearTimeout(notesDebounceTimer);
  notesDebounceTimer = setTimeout(saveNotes, 500);
}

// ── Widget Visibility ──

function applyWidgetVisibility(): void {
  weatherWidget.style.display = settings.widgets.weather ? "" : "none";
  quickLinksWidget.style.display = settings.widgets["quick-links"] ? "" : "none";
  notesWidget.style.display = settings.widgets.notes ? "" : "none";
  sitesSection.style.display = settings.widgets.sites ? "" : "none";
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
  settingsOverlay.classList.add("open");
  settingsPanel.classList.add("open");
  wallpaperInput.value = settings.wallpaperUrl;
  searchEngineSelect.value = settings.searchEngine;
  syncToggleSwitches();
  syncTempButtons();
  renderQuickLinksEditor();
}

function closeSettings(): void {
  settingsOverlay.classList.remove("open");
  settingsPanel.classList.remove("open");
}

// ── Temperature Unit ──

function syncTempButtons(): void {
  if (settings.tempUnit === "F") {
    tempFBtn.className =
      "rounded-lg bg-oxy-primary/10 px-4 py-1.5 text-sm font-medium text-oxy-primary transition-colors";
    tempCBtn.className =
      "rounded-lg bg-white/50 px-4 py-1.5 text-sm font-medium text-oxy-text-secondary transition-colors dark:bg-white/5";
  } else {
    tempCBtn.className =
      "rounded-lg bg-oxy-primary/10 px-4 py-1.5 text-sm font-medium text-oxy-primary transition-colors";
    tempFBtn.className =
      "rounded-lg bg-white/50 px-4 py-1.5 text-sm font-medium text-oxy-text-secondary transition-colors dark:bg-white/5";
  }
}

function setTempUnit(unit: "F" | "C"): void {
  settings.tempUnit = unit;
  saveSettings();
  syncTempButtons();
  // Re-render weather with new unit
  fetchWeather();
}

// ── Keyboard Shortcuts ──

function handleKeyboard(e: KeyboardEvent): void {
  const target = e.target as HTMLElement;
  const isInput =
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable;

  // Escape closes settings panel
  if (e.key === "Escape") {
    if (settingsPanel.classList.contains("open")) {
      closeSettings();
      return;
    }
    if (document.activeElement === searchInput) {
      searchInput.blur();
      searchHint.classList.remove("!hidden");
      return;
    }
  }

  // "/" focuses search (only when not already in an input)
  if (e.key === "/" && !isInput) {
    e.preventDefault();
    searchInput.focus();
    searchHint.classList.add("!hidden");
    return;
  }

  // Ctrl/Cmd + K focuses search from anywhere
  if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    searchInput.focus();
    searchHint.classList.add("!hidden");
    return;
  }

  // Ctrl/Cmd + , opens settings
  if (e.key === "," && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    if (settingsPanel.classList.contains("open")) {
      closeSettings();
    } else {
      openSettings();
    }
  }
}

// Show/hide the "/" hint based on focus
function handleSearchFocus(): void {
  searchHint.classList.add("!hidden");
}

function handleSearchBlur(): void {
  if (searchInput.value === "") {
    searchHint.classList.remove("!hidden");
  }
}

// ── Alia Integration ──

function openAlia(): void {
  // Try to open Alia sidebar (Astro browser integration)
  const chrome = (globalThis as Record<string, unknown>).chrome as
    | {
        runtime?: {
          sendMessage(msg: unknown): void;
        };
      }
    | undefined;

  if (chrome?.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ action: "openAliaSidebar" });
  } else {
    // Fallback: open Alia web app
    window.open("https://alia.oxy.so", "_blank");
  }
}

// ── Blocked Count (Ads & Trackers) ──

function updateBlockedCount(): void {
  const count = parseInt(
    localStorage.getItem("astro-blocked-count") || "0",
    10,
  );
  const el = document.getElementById("blocked-count");
  if (el) {
    el.textContent = `${count.toLocaleString()} ads and trackers blocked`;
  }
}

// ── Init ──

// Apply initial state
updateGreeting();
updateClock();
applyThemeIcons();
applyWallpaper();
applySearchEngine();
applyWidgetVisibility();
loadNotes();
renderQuickLinks();
loadSites();
updateBlockedCount();

// Fetch weather (async, non-blocking)
if (settings.widgets.weather) {
  fetchWeather();
}

// Update clock every 10 seconds, greeting every minute, blocked count every 5 seconds
setInterval(updateClock, 10_000);
setInterval(updateGreeting, 60_000);
setInterval(updateBlockedCount, 5_000);

// ── Event Listeners ──

document.addEventListener("keydown", handleKeyboard);
searchInput.addEventListener("focus", handleSearchFocus);
searchInput.addEventListener("blur", handleSearchBlur);
themeToggle.addEventListener("click", toggleTheme);

// Alia buttons
aliaSearchBtn.addEventListener("click", () => {
  const query = searchInput.value.trim();
  if (query) {
    // If there's a query, pass it to Alia
    const chrome = (globalThis as Record<string, unknown>).chrome as
      | {
          runtime?: {
            sendMessage(msg: unknown): void;
          };
        }
      | undefined;

    if (chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        action: "askAlia",
        query,
      });
    } else {
      window.open(`https://alia.oxy.so?q=${encodeURIComponent(query)}`, "_blank");
    }
  } else {
    openAlia();
  }
});
aliaChip.addEventListener("click", openAlia);

// Notes
notesTextarea.addEventListener("input", handleNotesInput);

// Settings panel
settingsBtn.addEventListener("click", openSettings);
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

// Search engine
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

// Listen for system theme changes (only if no stored preference)
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  if (!localStorage.getItem("astro-ntp-theme")) {
    document.documentElement.classList.toggle("dark", e.matches);
    applyThemeIcons();
  }
});
