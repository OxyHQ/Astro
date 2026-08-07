// One control per preference, chosen from the pref's own declared type.
//
// The type comes from chrome.settingsPrivate, so a pref that changes shape
// upstream changes control here without anyone editing a table. A type this
// page cannot yet edit renders READ-ONLY with its value visible, rather than
// being dropped: a settings page that quietly omits a setting is indis-
// tinguishable from a browser that does not have it.

import {set, type Pref, PrefType} from './prefs.ts';
import {labelFor} from './catalog.ts';

function row(pref: Pref): HTMLElement {
  const container = document.createElement('div');
  container.className =
      'flex items-center justify-between gap-6 px-5 py-3.5 ' +
      'border-b border-white/5 last:border-0';

  const text = document.createElement('div');
  text.className = 'min-w-0';

  const label = document.createElement('div');
  label.className = 'text-sm text-neutral-100';
  label.textContent = labelFor(pref.key);

  const key = document.createElement('div');
  key.className = 'font-mono text-[11px] text-neutral-500 truncate mt-0.5';
  key.textContent = pref.key;

  text.append(label, key);
  container.append(text);

  if (pref.enforcement) {
    // Say WHY it cannot be changed. A disabled control with no reason reads as
    // a broken page.
    const badge = document.createElement('span');
    badge.className =
        'shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 ' +
        'text-amber-300 border border-amber-500/20';
    badge.textContent = 'Managed';
    container.append(badge);
  }
  return container;
}

function toggle(pref: Pref): HTMLElement {
  const container = row(pref);
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = pref.value === true;
  input.disabled = Boolean(pref.enforcement);
  input.className =
      'shrink-0 size-[18px] rounded accent-violet-500 cursor-pointer ' +
      'disabled:cursor-not-allowed disabled:opacity-40';
  input.addEventListener('change', () => {
    void set(pref.key, input.checked).then(ok => {
      // The browser is the authority. If it refused the write, put the control
      // back rather than leaving the page asserting something untrue.
      if (!ok) {
        input.checked = !input.checked;
      }
    });
  });
  container.append(input);
  return container;
}

function numberBox(pref: Pref): HTMLElement {
  const container = row(pref);
  const input = document.createElement('input');
  input.type = 'number';
  input.value = String(pref.value ?? '');
  input.disabled = Boolean(pref.enforcement);
  input.className =
      'shrink-0 w-24 bg-white/5 border border-white/10 rounded-md px-2 py-1 ' +
      'text-sm text-right tabular-nums focus:outline-none ' +
      'focus:border-violet-500/60 disabled:opacity-40';
  input.addEventListener('change', () => {
    const parsed = Number(input.value);
    // NaN would be sent straight to the browser and silently rejected, leaving
    // the box showing a value the browser does not hold.
    if (Number.isFinite(parsed)) {
      void set(pref.key, parsed);
    } else {
      input.value = String(pref.value ?? '');
    }
  });
  container.append(input);
  return container;
}

function textBox(pref: Pref): HTMLElement {
  const container = row(pref);
  const input = document.createElement('input');
  input.type = 'text';
  input.value = String(pref.value ?? '');
  input.disabled = Boolean(pref.enforcement);
  input.className =
      'shrink-0 w-64 bg-white/5 border border-white/10 rounded-md px-2 py-1 ' +
      'text-sm focus:outline-none focus:border-violet-500/60 ' +
      'disabled:opacity-40';
  input.addEventListener('change', () => { void set(pref.key, input.value); });
  container.append(input);
  return container;
}

function readOnly(pref: Pref): HTMLElement {
  const container = row(pref);
  const value = document.createElement('span');
  value.className =
      'shrink-0 font-mono text-[11px] text-neutral-500 max-w-64 truncate';
  // Structured values are shown, not hidden. Editing them needs a dedicated
  // control per pref; until one exists, showing the value is honest and
  // omitting the row is not.
  value.textContent = JSON.stringify(pref.value);
  container.append(value);
  return container;
}

export function controlFor(pref: Pref): HTMLElement {
  switch (pref.type) {
    case PrefType.BOOLEAN:
      return toggle(pref);
    case PrefType.NUMBER:
      return numberBox(pref);
    case PrefType.STRING:
    case PrefType.URL:
      return textBox(pref);
    default:
      return readOnly(pref);
  }
}
