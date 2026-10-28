const tidy = (text: string) => text.replace(/\s+/g, " ").trim();

export function joinTranscript(parts: readonly string[]): string {
  let out = "";
  for (const raw of parts) {
    const part = tidy(raw);
    if (!part) continue;
    if (!out) {
      out = part;
      continue;
    }
    const continues = /^[a-z]/.test(part);
    if (continues && /[^.]\.$/.test(out)) out = out.slice(0, -1);
    out += ` ${part}`;
  }
  return out;
}

export function forCommandBar(text: string): string {
  return text.endsWith(".") && !text.endsWith("..") && !/[.!?…]\s/.test(text) ? text.slice(0, -1) : text;
}

export function spliceDictation(before: string, text: string, after: string): { value: string; caret: number } {
  if (!text) return { value: before + after, caret: before.length };
  const lead = before && !/\s$/.test(before) ? " " : "";
  const trail = after && !/^[\s.,!?;:)\]}]/.test(after) ? " " : "";
  const head = before + lead + text;
  return { value: head + trail + after, caret: head.length };
}

export function dictationLanguage(locale?: string): string {
  const tag = (locale ?? safeLocale()).split(/-[ux]-/i)[0] ?? "";
  return /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(tag) && tag.length <= 35 ? tag : "en";
}

function safeLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return "en";
  }
}
