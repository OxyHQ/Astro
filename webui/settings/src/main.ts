// ── Astro Settings Page ──

import { icons } from "./icons.ts";
import { bindControls } from "./components.ts";
import {
  youAndOxy,
  appearance,
  searchEngine,
  privacySecurity,
  performance,
  accessibility,
  languages,
  downloads,
  system,
  aboutAstro,
} from "./sections.ts";

// ── Navigation definition ──

interface NavItem {
  id: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "you-and-oxy", label: "You and Oxy", icon: icons.user },
  { id: "appearance", label: "Appearance", icon: icons.palette },
  { id: "search-engine", label: "Search engine", icon: icons.search },
  { id: "privacy-security", label: "Privacy & Security", icon: icons.shield },
  { id: "performance", label: "Performance", icon: icons.zap },
  { id: "accessibility", label: "Accessibility", icon: icons.accessibility },
  { id: "languages", label: "Languages", icon: icons.globe },
  { id: "downloads", label: "Downloads", icon: icons.download },
  { id: "system", label: "System", icon: icons.monitor },
  { id: "about", label: "About Astro", icon: icons.info },
];

// ── Section renderers ──

const SECTION_RENDERERS: Record<string, () => string> = {
  "you-and-oxy": youAndOxy,
  appearance,
  "search-engine": searchEngine,
  "privacy-security": privacySecurity,
  performance,
  accessibility,
  languages,
  downloads,
  system,
  about: aboutAstro,
};

// ── DOM references ──

const navList = document.getElementById("nav-list") as HTMLDivElement;
const sectionsContainer = document.getElementById("sections") as HTMLDivElement;
const searchInput = document.getElementById("search-input") as HTMLInputElement;
const menuBtn = document.getElementById("menu-btn") as HTMLButtonElement | null;
const sidebar = document.getElementById("sidebar") as HTMLElement;
const sidebarOverlay = document.getElementById(
  "sidebar-overlay",
) as HTMLElement;

// ── State ──

let activeSection = "you-and-oxy";
let searchQuery = "";

// ── Render navigation ──

function renderNav(): void {
  navList.innerHTML = NAV_ITEMS.map(
    (item) => `
    <a
      href="#${item.id}"
      class="sidebar-link flex items-center gap-2.5 rounded-full px-3.5 py-[6px] text-[13px] font-medium text-oxy-text-secondary ${
        item.id === activeSection ? "active" : ""
      }"
      data-nav-id="${item.id}"
    >
      <span class="shrink-0 opacity-70">${item.icon}</span>
      <span>${item.label}</span>
    </a>
  `,
  ).join("");

  // Bind click handlers
  navList.querySelectorAll<HTMLAnchorElement>("[data-nav-id]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const id = el.dataset["navId"];
      if (!id) return;
      navigateTo(id);
      closeSidebar();
    });
  });
}

// ── Render all sections ──

function renderAllSections(): void {
  const html = NAV_ITEMS.map((item) => {
    const renderer = SECTION_RENDERERS[item.id];
    return renderer ? renderer() : "";
  }).join("");

  sectionsContainer.innerHTML = html;
  bindControls();
  bindResetButton();
}

// ── Navigation ──

function navigateTo(sectionId: string): void {
  activeSection = sectionId;
  window.location.hash = sectionId;
  renderNav();

  // Scroll to section
  const sectionEl = document.getElementById(`section-${sectionId}`);
  if (sectionEl) {
    sectionEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// ── Scroll spy: update active nav based on scroll position ──

function setupScrollSpy(): void {
  const content = document.getElementById("content") as HTMLElement;

  content.addEventListener(
    "scroll",
    () => {
      const sections = sectionsContainer.querySelectorAll<HTMLElement>("[data-section]");
      let currentId = activeSection;

      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        // Section is at or above the top third of viewport
        if (rect.top <= 200) {
          currentId = section.dataset["section"] ?? currentId;
        }
      }

      if (currentId !== activeSection) {
        activeSection = currentId;
        // Update nav without re-rendering everything
        navList
          .querySelectorAll<HTMLAnchorElement>("[data-nav-id]")
          .forEach((el) => {
            el.classList.toggle(
              "active",
              el.dataset["navId"] === activeSection,
            );
          });
      }
    },
    { passive: true },
  );
}

// ── Search filtering ──

function applySearch(query: string): void {
  searchQuery = query.toLowerCase().trim();
  const sections = sectionsContainer.querySelectorAll<HTMLElement>("[data-section]");

  if (!searchQuery) {
    // Show everything
    sections.forEach((section) => {
      section.style.display = "";
      section.querySelectorAll<HTMLElement>(".setting-row").forEach((row) => {
        row.style.display = "";
        // Remove highlights
        row.querySelectorAll("mark").forEach((m) => {
          const parent = m.parentNode;
          if (parent) {
            parent.replaceChild(document.createTextNode(m.textContent ?? ""), m);
            parent.normalize();
          }
        });
      });
    });
    return;
  }

  sections.forEach((section) => {
    const rows = section.querySelectorAll<HTMLElement>(".setting-row");
    let hasVisibleRow = false;

    rows.forEach((row) => {
      const label = (row.dataset["settingLabel"] ?? "").toLowerCase();
      const desc = (row.dataset["settingDesc"] ?? "").toLowerCase();
      const matches = label.includes(searchQuery) || desc.includes(searchQuery);

      row.style.display = matches ? "" : "none";
      if (matches) hasVisibleRow = true;
    });

    // Also check section title
    const sectionTitle = section.querySelector("h2");
    if (sectionTitle) {
      const titleMatch = (sectionTitle.textContent ?? "").toLowerCase().includes(searchQuery);
      if (titleMatch) {
        hasVisibleRow = true;
        rows.forEach((row) => (row.style.display = ""));
      }
    }

    // For About section (no rows), check if text content matches
    if (section.dataset["section"] === "about") {
      const text = (section.textContent ?? "").toLowerCase();
      hasVisibleRow = text.includes(searchQuery);
    }

    section.style.display = hasVisibleRow ? "" : "none";
  });
}

// ── Mobile sidebar ──

function openSidebar(): void {
  sidebar.classList.remove("-translate-x-full");
  sidebar.classList.add("translate-x-0");
  sidebarOverlay.classList.add("open");
}

function closeSidebar(): void {
  sidebar.classList.add("-translate-x-full");
  sidebar.classList.remove("translate-x-0");
  sidebarOverlay.classList.remove("open");
}

// ── Theme toggle ──

const themeToggle = document.getElementById("theme-toggle") as HTMLButtonElement | null;
const iconSun = document.getElementById("icon-sun") as SVGElement | null;
const iconMoon = document.getElementById("icon-moon") as SVGElement | null;

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

function applyThemeIcons(): void {
  if (iconSun) iconSun.classList.toggle("hidden", !isDark());
  if (iconMoon) iconMoon.classList.toggle("hidden", isDark());
}

function toggleTheme(): void {
  const dark = !isDark();
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem("astro-theme", dark ? "dark" : "light");
  applyThemeIcons();

  // Also update the theme-mode select if visible
  const themeSelect = document.querySelector<HTMLSelectElement>(
    '[data-select-id="theme-mode"]',
  );
  if (themeSelect) {
    themeSelect.value = dark ? "dark" : "light";
  }
}

// ── Reset settings ──

function bindResetButton(): void {
  const btn = document.getElementById("reset-settings-btn");
  if (btn) {
    btn.addEventListener("click", () => {
      if (confirm("Reset all settings to their defaults? This cannot be undone.")) {
        localStorage.removeItem("astro-settings");
        renderAllSections();
      }
    });
  }
}

// ── Keyboard shortcuts ──

function handleKeyboard(e: KeyboardEvent): void {
  const target = e.target as HTMLElement;
  const isInput =
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable;

  if (e.key === "/" && !isInput) {
    e.preventDefault();
    openCommand();
    return;
  }

  if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    openCommand();
    return;
  }

  if (e.key === "Escape") {
    if (commandOverlay.style.display !== "none") {
      closeCommand();
      return;
    }
    closeSidebar();
  }
}

// ── Init ──

// Render
renderNav();
renderAllSections();
applyThemeIcons();

// Handle initial hash
const initialHash = window.location.hash.slice(1);
if (initialHash && NAV_ITEMS.some((n) => n.id === initialHash)) {
  activeSection = initialHash;
  renderNav();
  // Delay scroll to let layout settle
  requestAnimationFrame(() => {
    const el = document.getElementById(`section-${initialHash}`);
    if (el) el.scrollIntoView({ block: "start" });
  });
}

// Scroll spy
setupScrollSpy();

// Event listeners
document.addEventListener("keydown", handleKeyboard);

// ── Command palette ──

const commandOverlay = document.getElementById("command-overlay") as HTMLDivElement;
const commandInput = document.getElementById("command-input") as HTMLInputElement;
const commandResults = document.getElementById("command-results") as HTMLDivElement;
const searchTrigger = document.getElementById("search-trigger") as HTMLButtonElement;
let commandIndex = 0;

function openCommand(): void {
  commandOverlay.style.display = "block";
  commandInput.value = "";
  commandIndex = 0;
  renderCommandResults("");
  requestAnimationFrame(() => commandInput.focus());
}

function closeCommand(): void {
  commandOverlay.style.display = "none";
  commandInput.value = "";
}

function renderCommandResults(query: string): void {
  const q = query.toLowerCase().trim();
  const items = NAV_ITEMS.filter(
    (n) => !q || n.label.toLowerCase().includes(q) || n.id.includes(q),
  );
  commandResults.innerHTML = items
    .map(
      (item, i) => `
    <button type="button" data-cmd-id="${item.id}" class="command-item flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-oxy-text-secondary ${i === commandIndex ? "active" : ""}">
      <span class="shrink-0 opacity-60">${item.icon}</span>
      <span>${item.label}</span>
    </button>`,
    )
    .join("");

  commandResults.querySelectorAll<HTMLButtonElement>("[data-cmd-id]").forEach((el) => {
    el.addEventListener("click", () => {
      navigateTo(el.dataset.cmdId!);
      closeCommand();
    });
  });
}

function handleCommandKey(e: KeyboardEvent): void {
  const items = commandResults.querySelectorAll<HTMLButtonElement>("[data-cmd-id]");
  if (e.key === "ArrowDown") {
    e.preventDefault();
    commandIndex = Math.min(commandIndex + 1, items.length - 1);
    renderCommandResults(commandInput.value);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    commandIndex = Math.max(commandIndex - 1, 0);
    renderCommandResults(commandInput.value);
  } else if (e.key === "Enter" && items[commandIndex]) {
    e.preventDefault();
    const id = items[commandIndex].dataset.cmdId;
    if (id) navigateTo(id);
    closeCommand();
  }
}

searchTrigger?.addEventListener("click", openCommand);
commandOverlay?.addEventListener("click", (e) => {
  if (e.target === commandOverlay || (e.target as HTMLElement).closest(".command-dialog") === null) closeCommand();
});
commandInput?.addEventListener("input", () => {
  commandIndex = 0;
  renderCommandResults(commandInput.value);
});
commandInput?.addEventListener("keydown", handleCommandKey);

// Keep old search input working too (for sidebar search if it exists)
searchInput?.addEventListener("input", () => {
  applySearch(searchInput.value);
});

menuBtn?.addEventListener("click", openSidebar);
sidebarOverlay.addEventListener("click", closeSidebar);
themeToggle?.addEventListener("click", toggleTheme);

// Listen for hash changes
window.addEventListener("hashchange", () => {
  const hash = window.location.hash.slice(1);
  if (hash && NAV_ITEMS.some((n) => n.id === hash)) {
    navigateTo(hash);
  }
});

// System theme changes
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  if (!localStorage.getItem("astro-theme")) {
    document.documentElement.classList.toggle("dark", e.matches);
    applyThemeIcons();
  }
});
