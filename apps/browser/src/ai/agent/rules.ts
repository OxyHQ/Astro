export type AxValue = { type?: string; value?: unknown };
export type AxProperty = { name: string; value?: AxValue };
export type AxNode = {
  nodeId: string;
  ignored?: boolean;
  role?: AxValue;
  name?: AxValue;
  value?: AxValue;
  description?: AxValue;
  properties?: AxProperty[];
  childIds?: string[];
  parentId?: string;
  backendDOMNodeId?: number;
};

export type Snapshot = { text: string; truncated: boolean; refs: number };

export const SNAPSHOT_LIMIT = 40_000;
const NAME_LIMIT = 160;
const VALUE_LIMIT = 200;

const INTERACTIVE = new Set([
  "button",
  "checkbox",
  "combobox",
  "link",
  "listbox",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "searchbox",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "textbox",
  "treeitem",
  "TextField",
  "PopUpButton",
  "ToggleButton",
  "DisclosureTriangle",
]);

const TRANSPARENT = new Set(["none", "generic", "LabelText", "presentation", "InlineTextBox", "LineBreak", "RootWebArea", "WebArea", "LayoutTable", "LayoutTableRow", "LayoutTableCell", "Iframe", "IframePresentational", "group", "paragraph", "Section", "Div", "Span", "GenericContainer"]);

const LEAVES = new Set(["button", "checkbox", "link", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "radio", "searchbox", "slider", "spinbutton", "switch", "tab", "textbox"]);

const STATES = ["checked", "pressed", "selected", "expanded", "disabled", "required", "readonly", "invalid", "focused"] as const;

const text = (value: unknown) => (typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : "");

const short = (value: string, limit: number) => {
  const one = value.replace(/\s+/g, " ").trim();
  return one.length > limit ? `${one.slice(0, limit - 1)}…` : one;
};

export const refOf = (backendNodeId: number) => `e${backendNodeId}`;

export function backendIdOf(ref: unknown): number | null {
  if (typeof ref !== "string") return null;
  const match = /^e?(\d{1,10})$/.exec(ref.trim());
  return match ? Number(match[1]) : null;
}

function property(node: AxNode, name: string): unknown {
  return node.properties?.find((p) => p.name === name)?.value?.value;
}

export function isInteractive(node: AxNode): boolean {
  const role = text(node.role?.value);
  return INTERACTIVE.has(role) || property(node, "focusable") === true || property(node, "editable") === "plaintext" || property(node, "editable") === "richtext";
}

function describe(node: AxNode): string {
  const role = text(node.role?.value) || "node";
  const name = short(text(node.name?.value), NAME_LIMIT);
  const parts = [role === "heading" && property(node, "level") ? `heading[${text(property(node, "level"))}]` : role];
  if (name) parts.push(JSON.stringify(name));
  const value = text(node.value?.value);
  if (value && role !== "link" && property(node, "protected") !== true) parts.push(`value=${JSON.stringify(short(value, VALUE_LIMIT))}`);
  for (const state of STATES) {
    const v = property(node, state);
    if (v === true || v === "true" || v === "mixed") parts.push(v === "mixed" ? `${state}=mixed` : state);
  }
  if (role === "checkbox" || role === "switch" || role === "radio" || role === "menuitemcheckbox" || role === "menuitemradio") {
    if (property(node, "checked") === false || property(node, "checked") === "false") parts.push("unchecked");
  }
  if (property(node, "expanded") === false) parts.push("collapsed");
  if (property(node, "protected") === true) parts.push("password");
  return parts.join(" ");
}

export function snapshotText(nodes: AxNode[], limit = SNAPSHOT_LIMIT): Snapshot {
  const byId = new Map(nodes.map((node) => [node.nodeId, node]));
  const root = nodes.find((node) => !node.parentId || !byId.has(node.parentId));
  const lines: string[] = [];
  let size = 0;
  let truncated = false;
  let refs = 0;
  const seen = new Set<string>();
  const controlNames = new Set(nodes.filter((node) => !node.ignored && isInteractive(node)).map((node) => short(text(node.name?.value), NAME_LIMIT * 2)).filter(Boolean));

  const emit = (line: string) => {
    if (truncated) return false;
    if (size + line.length + 1 > limit) {
      truncated = true;
      return false;
    }
    lines.push(line);
    size += line.length + 1;
    return true;
  };

  const walk = (node: AxNode, depth: number, parentName: string) => {
    if (truncated || seen.has(node.nodeId)) return;
    seen.add(node.nodeId);
    const role = text(node.role?.value);
    const name = text(node.name?.value).trim();
    let nextDepth = depth;
    let nextName = parentName;
    if (!node.ignored) {
      if (role === "StaticText" || role === "text") {
        const clean = short(name, NAME_LIMIT * 2);
        if (clean && !parentName.includes(clean) && !controlNames.has(clean)) emit(`${"  ".repeat(depth)}- text ${JSON.stringify(clean)}`);
        return;
      }
      const interactive = isInteractive(node) && role !== "RootWebArea" && role !== "WebArea";
      const meaningful = interactive || (!TRANSPARENT.has(role) && role !== "") || (role === "group" && !!name);
      if (meaningful) {
        const ref = interactive && typeof node.backendDOMNodeId === "number" ? ` [ref=${refOf(node.backendDOMNodeId)}]` : "";
        if (ref) refs++;
        if (!emit(`${"  ".repeat(depth)}- ${describe(node)}${ref}`)) return;
        nextDepth = depth + 1;
        nextName = name;
        if (LEAVES.has(role)) return;
      }
    }
    for (const id of node.childIds ?? []) {
      const child = byId.get(id);
      if (child) walk(child, nextDepth, nextName);
    }
  };

  if (root) walk(root, 0, "");
  return { text: lines.join("\n"), truncated, refs };
}

export type ConsequenceKind = "purchase" | "send" | "delete" | "submit" | "account";

export type Consequence = { kind: ConsequenceKind; label: string };

export type ElementFacts = {
  role: string;
  name: string;
  tag: string;
  type: string;
  inForm: boolean;
  searchForm: boolean;
  multiline: boolean;
};

const RULES: [ConsequenceKind, RegExp][] = [
  ["purchase", /\b(buy|purchase|pay|payment|checkout|check out|place (?:your |my )?order|order now|complete (?:order|purchase)|subscribe|donate|bid|sell|book now|reserve|rent now|upgrade|start (?:free )?trial)\b/i],
  ["delete", /\b(delete|remove|erase|destroy|discard|trash|empty trash|clear all|wipe|revoke)\b/i],
  ["account", /\b(cancel (?:my |your )?(?:subscription|membership|order|account|plan|booking|reservation)|close (?:my |your )?account|deactivate|unsubscribe|sign out everywhere|change password|transfer|withdraw|send money)\b/i],
  ["send", /\b(send|post|publish|reply|tweet|share|comment|invite|message|email)\b/i],
  ["submit", /\b(submit|confirm|apply now|sign up|register|create account|accept offer|agree and continue|finish|complete|authorize|approve)\b/i],
];

const HARMLESS = /\b(cookie|cookies|search|filter|sort|share (?:this )?(?:link|page) copy|copy link|preview|learn more|see more|show more|close|dismiss|back|next page|previous)\b/i;

function byName(name: string): ConsequenceKind | null {
  if (!name || HARMLESS.test(name)) return null;
  for (const [kind, pattern] of RULES) if (pattern.test(name)) return kind;
  return null;
}

const LABELS: Record<ConsequenceKind, string> = {
  purchase: "a purchase or payment",
  delete: "deleting something",
  account: "a change to an account or money",
  send: "sending or posting something",
  submit: "submitting a form",
};

export const consequenceLabel = (kind: ConsequenceKind) => LABELS[kind];

const isSubmitControl = (facts: ElementFacts) =>
  (facts.tag === "button" && (facts.type === "" || facts.type === "submit") && facts.inForm) || (facts.tag === "input" && (facts.type === "submit" || facts.type === "image"));

export function clickConsequence(facts: ElementFacts): Consequence | null {
  const named = byName(facts.name);
  if (named) return { kind: named, label: LABELS[named] };
  if (isSubmitControl(facts) && !facts.searchForm) return { kind: "submit", label: LABELS.submit };
  return null;
}

export function enterConsequence(facts: ElementFacts): Consequence | null {
  if (facts.multiline || facts.searchForm || !facts.inForm) return null;
  if (facts.role === "searchbox" || facts.role === "combobox" || facts.type === "search") return null;
  return { kind: "submit", label: LABELS.submit };
}

export type KeyStroke = { key: string; code: string; keyCode: number; text?: string; modifiers: number };

const KEYS: Record<string, [string, number, string?]> = {
  Enter: ["Enter", 13, "\r"],
  Tab: ["Tab", 9],
  Escape: ["Escape", 27],
  Backspace: ["Backspace", 8],
  Delete: ["Delete", 46],
  ArrowUp: ["ArrowUp", 38],
  ArrowDown: ["ArrowDown", 40],
  ArrowLeft: ["ArrowLeft", 37],
  ArrowRight: ["ArrowRight", 39],
  Home: ["Home", 36],
  End: ["End", 35],
  PageUp: ["PageUp", 33],
  PageDown: ["PageDown", 34],
  Space: ["Space", 32, " "],
};

const ALIASES: Record<string, string> = { return: "Enter", esc: "Escape", up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", " ": "Space", spacebar: "Space", del: "Delete" };

const MODIFIERS: Record<string, number> = { alt: 1, option: 1, control: 2, ctrl: 2, meta: 4, cmd: 4, command: 4, shift: 8 };

export function parseKey(spec: unknown): KeyStroke | null {
  if (typeof spec !== "string" || !spec.trim() || spec.length > 40) return null;
  const parts = spec.split("+").map((p) => p.trim());
  const last = parts.pop() ?? "";
  let modifiers = 0;
  for (const part of parts) {
    const bit = MODIFIERS[part.toLowerCase()];
    if (!bit) return null;
    modifiers |= bit;
  }
  const named = ALIASES[last.toLowerCase()] ?? Object.keys(KEYS).find((k) => k.toLowerCase() === last.toLowerCase());
  if (named && KEYS[named]) {
    const [code, keyCode, typed] = KEYS[named];
    return { key: named === "Space" ? " " : named, code, keyCode, modifiers, ...(typed && !(modifiers & 7) ? { text: typed } : {}) };
  }
  if (last.length === 1) {
    const upper = last.toUpperCase();
    const letter = /[A-Z]/.test(upper);
    const digit = /[0-9]/.test(last);
    return {
      key: modifiers & 8 && letter ? upper : last,
      code: letter ? `Key${upper}` : digit ? `Digit${last}` : "",
      keyCode: letter || digit ? upper.charCodeAt(0) : 0,
      modifiers,
      ...(modifiers & 7 ? {} : { text: modifiers & 8 && letter ? upper : last }),
    };
  }
  return null;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}
