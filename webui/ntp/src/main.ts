// ---------- Clock ----------

const clockEl = document.getElementById("clock") as HTMLDivElement;
const dateEl = document.getElementById("date") as HTMLDivElement;

function updateClock(): void {
  const now = new Date();

  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  clockEl.textContent = `${hours}:${minutes}`;

  dateEl.textContent = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

updateClock();
setInterval(updateClock, 10_000);

// ---------- Most Visited Sites ----------

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

function faviconUrl(siteUrl: string): string {
  try {
    const { hostname } = new URL(siteUrl);
    // Use DuckDuckGo's favicon service (no Google dependency)
    return `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
  } catch {
    return "";
  }
}

/** Generate a letter-based placeholder when favicon fails to load */
function createFaviconFallback(title: string): HTMLDivElement {
  const div = document.createElement("div");
  div.className =
    "flex items-center justify-center w-8 h-8 rounded-md bg-oxy-primary/10 text-oxy-primary font-semibold text-sm";
  div.textContent = title.charAt(0).toUpperCase();
  return div;
}

function renderSites(sites: SiteEntry[]): void {
  const grid = document.getElementById("sites-grid") as HTMLDivElement;
  grid.innerHTML = "";

  for (const site of sites) {
    const anchor = document.createElement("a");
    anchor.href = site.url;
    anchor.className =
      "site-tile flex flex-col items-center gap-2 rounded-xl bg-oxy-surface p-3 border border-oxy-border/60 cursor-pointer select-none w-[88px]";
    anchor.title = site.title;

    const iconSrc = faviconUrl(site.url);
    const img = document.createElement("img");
    img.src = iconSrc;
    img.alt = "";
    img.width = 32;
    img.height = 32;
    img.className = "rounded-md";
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
    grid.appendChild(anchor);
  }
}

/**
 * Try to use the chrome.topSites API if available (Chromium internal pages).
 * Falls back to sensible defaults.
 */
function loadSites(): void {
  const chromeTopSites = (globalThis as Record<string, unknown>).chrome as
    | { topSites?: { get(cb: (sites: { title: string; url: string }[]) => void): void } }
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

loadSites();

// ---------- Keyboard shortcut ----------

document.addEventListener("keydown", (e: KeyboardEvent) => {
  // Focus search on "/" or Ctrl+K
  if (e.key === "/" || (e.key === "k" && (e.metaKey || e.ctrlKey))) {
    e.preventDefault();
    const input = document.querySelector<HTMLInputElement>('input[name="q"]');
    input?.focus();
  }
});
