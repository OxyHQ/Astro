interface ErrorConfig {
  title: string;
  description: string;
  icon: string;
  tips: string[];
  showAnimation: boolean;
}

const ERROR_CONFIGS: Record<string, ErrorConfig> = {
  connection: {
    title: "Can't reach this site",
    description:
      "The server's DNS address could not be found. The site may be down or the address may be incorrect.",
    icon: "connection",
    tips: [
      "Check your internet connection",
      "Check the URL for typos",
      "Try clearing your DNS cache",
      "Check your proxy and firewall settings",
      "Try using a different DNS server (e.g. 1.1.1.1 or 9.9.9.9)",
    ],
    showAnimation: false,
  },
  timeout: {
    title: "This site took too long to respond",
    description:
      "The connection to the server timed out. The site may be overloaded or your connection may be too slow.",
    icon: "timeout",
    tips: [
      "Check your internet connection speed",
      "Try reloading the page in a few minutes",
      "Check if other sites are working",
      "Disable browser extensions that might interfere",
      "Try clearing your browser cache",
    ],
    showAnimation: false,
  },
  ssl: {
    title: "Your connection is not private",
    description:
      "The certificate for this site is invalid or untrusted. Attackers might be trying to steal your information.",
    icon: "ssl",
    tips: [
      "Do not enter any personal information on this site",
      "Check that your system clock is set correctly",
      "Try accessing the site without the www prefix (or vice versa)",
      "Contact the site administrator if you believe this is an error",
      "If you're on a public network, it may be intercepting the connection",
    ],
    showAnimation: false,
  },
  offline: {
    title: "You are offline",
    description:
      "Your device has lost its internet connection. Check your network settings and try again.",
    icon: "offline",
    tips: [
      "Check that Wi-Fi or Ethernet is enabled",
      "Restart your router or modem",
      "Check if airplane mode is turned on",
      "Try connecting to a different network",
      "Contact your internet service provider if the problem persists",
    ],
    showAnimation: true,
  },
  blocked: {
    title: "This site has been blocked",
    description:
      "Access to this site has been restricted by a content filter, ad blocker, or parental controls.",
    icon: "blocked",
    tips: [
      "Check your ad blocker or content filter settings",
      "Ask your network administrator for access",
      "Check parental control settings",
      "Try disabling extensions that may be blocking the site",
    ],
    showAnimation: false,
  },
  generic: {
    title: "Something went wrong",
    description:
      "An unexpected error occurred while trying to load this page. Please try again.",
    icon: "generic",
    tips: [
      "Try reloading the page",
      "Check your internet connection",
      "Clear your browser cache and cookies",
      "Try again in a few minutes",
      "If the problem persists, the site may be experiencing issues",
    ],
    showAnimation: false,
  },
};

function getIconSvg(icon: string): string {
  switch (icon) {
    case "connection":
      return `<svg viewBox="0 0 48 48" fill="none" class="w-12 h-12">
        <circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3" opacity="0.3"/>
        <path d="M16 28c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.5"/>
        <path d="M12 24c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.3"/>
        <circle cx="24" cy="32" r="2.5" fill="currentColor"/>
        <line x1="15" y1="15" x2="33" y2="33" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      </svg>`;
    case "timeout":
      return `<svg viewBox="0 0 48 48" fill="none" class="w-12 h-12">
        <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2" opacity="0.3"/>
        <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2.5" stroke-dasharray="94.25 31.42" stroke-linecap="round"/>
        <path d="M24 14v11l7 4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    case "ssl":
      return `<svg viewBox="0 0 48 48" fill="none" class="w-12 h-12">
        <path d="M24 4L8 12v12c0 10.5 6.8 17.2 16 20 9.2-2.8 16-9.5 16-20V12L24 4z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" opacity="0.3"/>
        <path d="M24 4L8 12v12c0 10.5 6.8 17.2 16 20 9.2-2.8 16-9.5 16-20V12L24 4z" fill="currentColor" opacity="0.05"/>
        <path d="M24 18v8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        <circle cx="24" cy="31" r="2" fill="currentColor"/>
      </svg>`;
    case "offline":
      return `<svg viewBox="0 0 48 48" fill="none" class="w-12 h-12">
        <path d="M8 36l4-4m0 0c2-2 5.373-4 12-4s10 2 12 4m0 0l4 4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.2"/>
        <path d="M14 30c2-1.5 4.373-3 10-3s8 1.5 10 3" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.4"/>
        <circle cx="24" cy="34" r="2.5" fill="currentColor"/>
        <line x1="10" y1="10" x2="38" y2="38" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      </svg>`;
    case "blocked":
      return `<svg viewBox="0 0 48 48" fill="none" class="w-12 h-12">
        <circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="2.5" opacity="0.3"/>
        <circle cx="24" cy="24" r="18" fill="currentColor" opacity="0.05"/>
        <line x1="11.27" y1="36.73" x2="36.73" y2="11.27" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      </svg>`;
    default:
      return `<svg viewBox="0 0 48 48" fill="none" class="w-12 h-12">
        <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2.5" opacity="0.3"/>
        <circle cx="24" cy="24" r="20" fill="currentColor" opacity="0.05"/>
        <path d="M19 19c0-2.761 2.239-5 5-5s5 2.239 5 5c0 2.5-2 3.5-3.5 4.5S24 21 24 23" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="24" cy="30" r="2" fill="currentColor"/>
      </svg>`;
  }
}

function getSpaceAnimation(): string {
  return `
    <div class="relative w-48 h-48 mx-auto mb-6">
      <!-- Star field -->
      <svg viewBox="0 0 200 200" class="absolute inset-0 w-full h-full">
        <circle cx="20" cy="30" r="1.5" fill="currentColor" class="animate-twinkle opacity-30"/>
        <circle cx="170" cy="25" r="1" fill="currentColor" class="animate-twinkle-delayed opacity-30"/>
        <circle cx="45" cy="160" r="1.5" fill="currentColor" class="animate-twinkle-slow opacity-30"/>
        <circle cx="155" cy="150" r="1" fill="currentColor" class="animate-twinkle opacity-30"/>
        <circle cx="80" cy="15" r="1" fill="currentColor" class="animate-twinkle-delayed opacity-30"/>
        <circle cx="130" cy="175" r="1.5" fill="currentColor" class="animate-twinkle-slow opacity-30"/>
        <circle cx="15" cy="100" r="1" fill="currentColor" class="animate-twinkle opacity-30"/>
        <circle cx="185" cy="90" r="1" fill="currentColor" class="animate-twinkle-delayed opacity-30"/>
        <circle cx="60" cy="80" r="0.8" fill="currentColor" class="animate-twinkle-slow opacity-20"/>
        <circle cx="140" cy="60" r="0.8" fill="currentColor" class="animate-twinkle opacity-20"/>
      </svg>
      <!-- Floating astronaut -->
      <svg viewBox="0 0 120 140" class="absolute inset-0 m-auto w-28 h-28 animate-float animate-drift" style="color: var(--color-super)">
        <!-- Helmet -->
        <ellipse cx="60" cy="42" rx="24" ry="26" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="2"/>
        <!-- Visor -->
        <ellipse cx="60" cy="44" rx="16" ry="14" fill="currentColor" opacity="0.25" stroke="currentColor" stroke-width="1.5"/>
        <!-- Visor glare -->
        <ellipse cx="53" cy="40" rx="4" ry="6" fill="currentColor" opacity="0.15" transform="rotate(-15 53 40)"/>
        <!-- Body / suit -->
        <rect x="40" y="64" width="40" height="36" rx="10" fill="currentColor" opacity="0.12" stroke="currentColor" stroke-width="2"/>
        <!-- Backpack -->
        <rect x="74" y="68" width="12" height="28" rx="5" fill="currentColor" opacity="0.1" stroke="currentColor" stroke-width="1.5"/>
        <!-- Left arm -->
        <path d="M40 72 Q20 80 26 100" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
        <circle cx="26" cy="100" r="4" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="1.5"/>
        <!-- Right arm -->
        <path d="M80 72 Q100 76 96 96" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
        <circle cx="96" cy="96" r="4" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="1.5"/>
        <!-- Left leg -->
        <path d="M48 98 Q42 118 38 128" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
        <ellipse cx="36" cy="130" rx="6" ry="4" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="1.5"/>
        <!-- Right leg -->
        <path d="M72 98 Q78 118 82 128" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
        <ellipse cx="84" cy="130" rx="6" ry="4" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="1.5"/>
        <!-- Tether line -->
        <path d="M86 82 Q110 60 100 30 Q90 10 70 8" stroke="currentColor" stroke-width="1" fill="none" stroke-dasharray="3 3" opacity="0.4"/>
      </svg>
    </div>`;
}

function getSparkSvg(): string {
  return `<svg viewBox="0 0 32 32" fill="none" class="w-8 h-8" style="color: var(--color-super)">
    <path d="M16 2C16 2 18.5 10 22 13.5C25.5 17 32 16 32 16C32 16 25.5 18.5 22 22C18.5 25.5 16 30 16 30C16 30 13.5 25.5 10 22C6.5 18.5 0 16 0 16C0 16 6.5 13.5 10 10C13.5 6.5 16 2 16 2Z" fill="currentColor" opacity="0.9"/>
  </svg>`;
}

function renderPage(): void {
  const params = new URLSearchParams(window.location.search);
  const errorType = params.get("type") ?? "generic";
  const failedUrl = params.get("url") ?? "";

  const FALLBACK: ErrorConfig = {
    title: "Something went wrong",
    description: "An unexpected error occurred while trying to load this page. Please try again.",
    icon: "generic",
    tips: ["Try reloading the page", "Check your internet connection"],
    showAnimation: false,
  };

  const config: ErrorConfig =
    ERROR_CONFIGS[errorType] ?? FALLBACK;

  const root = document.getElementById("root");
  if (!root) return;

  const tipsHtml = config.tips
    .map((tip) => `<p class="tip-item text-sm leading-relaxed">${tip}</p>`)
    .join("");

  const animationHtml = config.showAnimation ? getSpaceAnimation() : "";

  const urlHtml = failedUrl
    ? `<div class="url-display rounded-xl px-4 py-2.5 text-sm max-w-md mx-auto truncate"
           title="${failedUrl}">${failedUrl}</div>`
    : "";

  root.innerHTML = `
    <div class="min-h-screen flex items-center justify-center px-6 py-12">
      <div class="max-w-lg w-full text-center">
        ${animationHtml}

        ${!config.showAnimation ? `<div class="mb-6 flex justify-center">${getSparkSvg()}</div>` : ""}

        <div class="mb-3 flex justify-center" style="color: var(--color-text-quieter)">
          ${getIconSvg(config.icon)}
        </div>

        <h1 class="text-2xl font-semibold mb-3 tracking-tight" style="color: var(--color-foreground)">
          ${config.title}
        </h1>

        <p class="text-base leading-relaxed mb-5 max-w-md mx-auto" style="color: var(--color-text-quiet)">
          ${config.description}
        </p>

        ${urlHtml ? `<div class="mb-6">${urlHtml}</div>` : ""}

        <div class="flex items-center justify-center gap-3 mb-8">
          <button id="btn-retry" class="btn-primary px-6 py-2.5 rounded-xl text-sm font-medium">
            Try Again
          </button>
          <button id="btn-back" class="btn-outline px-6 py-2.5 rounded-xl text-sm font-medium">
            Go Back
          </button>
        </div>

        <details class="text-left max-w-sm mx-auto">
          <summary class="flex items-center justify-center gap-2 text-sm font-medium cursor-pointer select-none py-2" style="color: var(--color-text-quiet)">
            <span>Troubleshooting tips</span>
            <svg class="chevron-icon w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </summary>
          <div class="mt-3 flex flex-col gap-2.5 pb-4">
            ${tipsHtml}
          </div>
        </details>
      </div>
    </div>`;

  document.getElementById("btn-retry")?.addEventListener("click", () => {
    if (failedUrl) {
      window.location.href = failedUrl.startsWith("http")
        ? failedUrl
        : `https://${failedUrl}`;
    } else {
      window.location.reload();
    }
  });

  document.getElementById("btn-back")?.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "chrome://newtab";
    }
  });
}

document.addEventListener("DOMContentLoaded", renderPage);
