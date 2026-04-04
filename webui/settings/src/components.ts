// ── Reusable UI components for settings page ──

import { getSettingValue, setSettingValue } from "./state.ts";

/** On/off toggle switch */
export function Toggle(
  id: string,
  label: string,
  description: string,
  defaultChecked: boolean = false,
): string {
  const checked = getSettingValue(id, defaultChecked);
  return `
    <div class="setting-row" data-setting-label="${label}" data-setting-desc="${description}">
      <div class="min-w-0 flex-1">
        <div class="text-sm font-medium text-oxy-text">${label}</div>
        <div class="mt-0.5 text-[13px] leading-relaxed text-oxy-text-secondary">${description}</div>
      </div>
      <button
        type="button"
        class="toggle-track"
        data-toggle-id="${id}"
        data-checked="${checked}"
        aria-label="${label}"
        role="switch"
        aria-checked="${checked}"
      >
        <span class="toggle-thumb"></span>
      </button>
    </div>
  `;
}

/** Dropdown select */
export function Select(
  id: string,
  label: string,
  description: string,
  options: Array<{ value: string; label: string }>,
  defaultValue: string,
): string {
  const current = getSettingValue(id, defaultValue);
  const optionsHtml = options
    .map(
      (o) =>
        `<option value="${o.value}" ${o.value === current ? "selected" : ""}>${o.label}</option>`,
    )
    .join("");

  return `
    <div class="setting-row" data-setting-label="${label}" data-setting-desc="${description}">
      <div class="min-w-0 flex-1">
        <div class="text-sm font-medium text-oxy-text">${label}</div>
        <div class="mt-0.5 text-[13px] leading-relaxed text-oxy-text-secondary">${description}</div>
      </div>
      <select class="setting-select" data-select-id="${id}">
        ${optionsHtml}
      </select>
    </div>
  `;
}

/** Range slider */
export function Slider(
  id: string,
  label: string,
  description: string,
  min: number,
  max: number,
  step: number,
  defaultValue: number,
  unit: string = "",
): string {
  const current = getSettingValue(id, defaultValue);
  return `
    <div class="setting-row" data-setting-label="${label}" data-setting-desc="${description}">
      <div class="min-w-0 flex-1">
        <div class="text-sm font-medium text-oxy-text">${label}</div>
        <div class="mt-0.5 text-[13px] leading-relaxed text-oxy-text-secondary">${description}</div>
      </div>
      <div class="flex items-center gap-3">
        <input
          type="range"
          class="w-32"
          data-slider-id="${id}"
          min="${min}"
          max="${max}"
          step="${step}"
          value="${current}"
        />
        <span class="w-12 text-right text-sm font-medium text-oxy-text-secondary" data-slider-value="${id}">${current}${unit}</span>
      </div>
    </div>
  `;
}

/** Action button row */
export function ButtonRow(
  label: string,
  description: string,
  buttonLabel: string,
  variant: "primary" | "secondary" | "danger" = "secondary",
  buttonId: string = "",
): string {
  return `
    <div class="setting-row" data-setting-label="${label}" data-setting-desc="${description}">
      <div class="min-w-0 flex-1">
        <div class="text-sm font-medium text-oxy-text">${label}</div>
        <div class="mt-0.5 text-[13px] leading-relaxed text-oxy-text-secondary">${description}</div>
      </div>
      <button type="button" class="btn btn-${variant} shrink-0" ${buttonId ? `id="${buttonId}"` : ""}>${buttonLabel}</button>
    </div>
  `;
}

/** Informational row (read-only display) */
export function InfoRow(label: string, value: string): string {
  return `
    <div class="setting-row" data-setting-label="${label}" data-setting-desc="${value}">
      <div class="text-sm font-medium text-oxy-text">${label}</div>
      <div class="text-sm text-oxy-text-secondary">${value}</div>
    </div>
  `;
}

/** Section card wrapper */
export function SectionCard(
  sectionId: string,
  title: string,
  rows: string[],
): string {
  return `
    <section id="section-${sectionId}" class="section-card animate-section" data-section="${sectionId}">
      <div class="border-b border-oxy-border-subtle px-6 py-4">
        <h2 class="text-base font-semibold text-oxy-text">${title}</h2>
      </div>
      ${rows.join("")}
    </section>
  `;
}

/** Initialize interactive handlers after DOM render */
export function bindControls(): void {
  // Toggle switches
  document.querySelectorAll<HTMLButtonElement>(".toggle-track").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset["toggleId"];
      if (!id) return;
      const current = el.dataset["checked"] === "true";
      const next = !current;
      el.dataset["checked"] = String(next);
      el.setAttribute("aria-checked", String(next));
      setSettingValue(id, next);

      // Apply special handlers
      if (id === "theme-dark") {
        document.documentElement.classList.toggle("dark", next);
        localStorage.setItem("astro-theme", next ? "dark" : "light");
        updateThemeIcons();
      }
    });
  });

  // Select dropdowns
  document
    .querySelectorAll<HTMLSelectElement>(".setting-select")
    .forEach((el) => {
      el.addEventListener("change", () => {
        const id = el.dataset["selectId"];
        if (!id) return;
        setSettingValue(id, el.value);

        if (id === "theme-mode") {
          const dark =
            el.value === "dark" ||
            (el.value === "system" &&
              matchMedia("(prefers-color-scheme:dark)").matches);
          document.documentElement.classList.toggle("dark", dark);
          localStorage.setItem(
            "astro-theme",
            el.value === "system" ? "" : el.value,
          );
          updateThemeIcons();
        }
      });
    });

  // Sliders
  document.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((el) => {
    el.addEventListener("input", () => {
      const id = el.dataset["sliderId"];
      if (!id) return;
      const valueDisplay = document.querySelector<HTMLSpanElement>(
        `[data-slider-value="${id}"]`,
      );
      if (valueDisplay) {
        const unit = id.includes("zoom") ? "%" : id.includes("font") ? "px" : "";
        valueDisplay.textContent = `${el.value}${unit}`;
      }
      setSettingValue(id, Number(el.value));
    });
  });
}

function updateThemeIcons(): void {
  const dark = document.documentElement.classList.contains("dark");
  const sun = document.getElementById("icon-sun");
  const moon = document.getElementById("icon-moon");
  if (sun && moon) {
    sun.classList.toggle("hidden", !dark);
    moon.classList.toggle("hidden", dark);
  }
}
