// ── Astro What's New Page ──
// Shown after browser updates to highlight new features

// ── Constants ──

const CURRENT_VERSION = "146.0.7680.177";
const LAST_SEEN_KEY = "astro-whats-new-last-seen";
const THEME_KEY = "astro-ntp-theme";

// ── DOM References ──

const getStartedBtn = document.getElementById(
  "get-started-btn",
) as HTMLButtonElement;

// ── Theme ──

function applySystemThemeListener(): void {
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!localStorage.getItem(THEME_KEY)) {
      document.documentElement.classList.toggle("dark", e.matches);
    }
  });
}

// ── Scroll-triggered animations (IntersectionObserver) ──

function initRevealAnimations(): void {
  const revealElements = document.querySelectorAll<HTMLElement>(".reveal");

  if (revealElements.length === 0) return;

  // Track how many have been revealed so far for stagger
  let revealedCount = 0;

  const observer = new IntersectionObserver(
    (entries) => {
      // Sort by DOM position so stagger order is consistent
      const intersecting = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => {
          const pos = a.target.compareDocumentPosition(b.target);
          return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });

      for (const entry of intersecting) {
        const el = entry.target as HTMLElement;
        el.style.animationDelay = `${revealedCount * 0.1}s`;
        el.classList.add("visible");
        observer.unobserve(el);
        revealedCount++;
      }
    },
    {
      threshold: 0.1,
      rootMargin: "0px 0px -20px 0px",
    },
  );

  for (const el of revealElements) {
    observer.observe(el);
  }
}

// ── Version tracking ──
// Exposed on window for Astro's C++ WebUI integration to query

function markVersionSeen(): void {
  localStorage.setItem(LAST_SEEN_KEY, CURRENT_VERSION);
}

function hasSeenCurrentVersion(): boolean {
  return localStorage.getItem(LAST_SEEN_KEY) === CURRENT_VERSION;
}

// Expose to browser integration layer
(globalThis as Record<string, unknown>).astroWhatsNew = {
  version: CURRENT_VERSION,
  hasSeenCurrentVersion,
  markVersionSeen,
};

// ── Get Started action ──

function handleGetStarted(): void {
  markVersionSeen();

  // Try Astro's internal navigation first
  const chrome = (globalThis as Record<string, unknown>).chrome as
    | {
        tabs?: {
          update(
            tabId: number | undefined,
            props: { url: string },
            cb?: () => void,
          ): void;
          getCurrent(cb: (tab: { id?: number }) => void): void;
        };
      }
    | undefined;

  if (chrome?.tabs) {
    // Navigate current tab to new tab page
    chrome.tabs.getCurrent((tab) => {
      if (tab.id !== undefined) {
        chrome.tabs?.update(tab.id, { url: "chrome://newtab" });
      } else {
        window.location.href = "chrome://newtab";
      }
    });
    return;
  }

  // Fallback: try to close the tab, or navigate to newtab
  try {
    window.close();
  } catch {
    // If window.close() is blocked, navigate away
    window.location.href = "chrome://newtab";
  }
}

// ── Keyboard shortcut ──

function handleKeyboard(e: KeyboardEvent): void {
  if (e.key === "Enter" && !e.repeat) {
    const target = e.target as HTMLElement;
    const isInteractive =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "A" ||
      target.tagName === "BUTTON";

    if (!isInteractive) {
      handleGetStarted();
    }
  }

  if (e.key === "Escape") {
    handleGetStarted();
  }
}

// ── Init ──

applySystemThemeListener();
initRevealAnimations();

// Event listeners
getStartedBtn.addEventListener("click", handleGetStarted);
document.addEventListener("keydown", handleKeyboard);
