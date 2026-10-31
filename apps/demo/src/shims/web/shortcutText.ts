const platform = typeof navigator !== "undefined" ? navigator.platform : "";
const isMac = /Mac/.test(platform);
const superKey = /Win/.test(platform) ? "Win" : "Super";

const MODIFIERS: Record<string, string> = { "⌘": "Ctrl", "⌃": superKey, "⌥": "Alt", "⇧": "Shift" };
const ORDER = ["Ctrl", superKey, "Alt", "Shift"];
const KEYS: Record<string, string> = { "↩": "Enter", "⌫": "Backspace", "⌦": "Delete", "⇥": "Tab", "←": "Left", "→": "Right", "↑": "Up", "↓": "Down", "⎋": "Esc" };
const SHORTCUT = /([⌃⌥⇧⌘]+)(↩|⌫|⌦|⇥|←|→|↑|↓|⎋|Space|Tab|F\d{1,2}|[^\s⌃⌥⇧⌘)]?)/g;

export function shortcutText(text: string): string {
  if (isMac || !SHORTCUT.test(text)) return text;
  SHORTCUT.lastIndex = 0;
  return text.replace(SHORTCUT, (_, mods: string, key: string) => {
    const names = new Set([...mods].map((m) => MODIFIERS[m]!));
    const parts = ORDER.filter((name) => names.has(name));
    return key ? [...parts, KEYS[key] ?? key.toUpperCase()].join("+") : parts.join("+");
  });
}
