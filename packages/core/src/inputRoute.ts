import { fixupUrl } from "./omnibox.ts";

export type InputRoute = "site" | "search" | "chat";

const WH_WORDS = new Set([
  "what", "whats", "what's", "why", "how", "who", "whom", "whose", "which", "when", "where",
  "qué", "que", "cómo", "como", "cuál", "cual", "cuáles", "cuales", "quién", "quien", "cuándo", "cuando", "dónde", "donde", "cuánto", "cuanto", "cuántos", "cuantos", "porque", "porqué",
  "pourquoi", "comment", "quel", "quelle", "quels", "quelles", "qui", "quand", "où",
  "warum", "wieso", "weshalb", "wie", "wer", "wann", "wo", "welche", "welcher", "welches",
  "perché", "quale", "quali", "dove", "quanto",
]);

const WH_PAIRS = new Set(["por qué", "por que", "para qué", "para que", "est-ce que", "how come"]);

const AUXILIARIES = new Set([
  "is", "are", "was", "were", "do", "does", "did", "can", "could", "should", "would", "has", "have", "had", "isn't", "aren't", "don't", "doesn't", "didn't", "can't", "won't", "shouldn't",
  "es", "son", "está", "esta", "están", "puedo", "puedes", "puede", "debo", "debería", "deberia", "hay", "tiene", "tengo",
  "est", "sont", "peut", "peux", "ist", "sind", "kann", "kannst", "soll", "è", "sono", "posso", "puoi",
]);

const TASKS = new Set([
  "explain", "summarize", "summarise", "rewrite", "paraphrase", "draft", "compose", "translate", "compare", "brainstorm", "outline", "proofread",
  "simplify", "elaborate", "eli5", "tldr", "tl;dr",
  "explica", "explícame", "explicame", "explícalo", "resúmeme", "resumeme", "resúmelo", "traduce", "tradúceme", "compara", "redacta", "ayúdame", "ayudame",
  "dime", "dame", "hazme", "escríbeme", "escribeme", "enséñame", "ensename", "corrígeme", "corrigeme",
  "explique", "résume", "traduis", "erkläre", "erklär", "übersetze", "fasse", "spiega", "riassumi", "traduci",
]);

const TASKS_WITH_OBJECT = new Set([
  "write", "list", "make", "create", "generate", "suggest", "recommend", "plan", "fix", "review", "improve", "shorten", "describe", "analyze", "analyse",
  "debug", "convert", "teach", "quiz", "help", "tell", "give", "show", "find", "check", "correct", "resume", "summary", "turn", "build", "design", "name",
  "escribe", "haz", "crea", "genera", "sugiere", "recomienda", "corrige", "revisa", "mejora", "describe", "analiza", "busca", "resume", "planifica", "convierte",
  "écris", "schreibe", "scrivi",
]);

const OBJECTS = new Set([
  "me", "us", "a", "an", "the", "my", "our", "your", "this", "that", "these", "those", "it", "some", "few", "several", "ideas", "him", "her", "them",
  "me,", "un", "una", "unos", "unas", "el", "la", "los", "las", "mi", "mis", "este", "esta", "esto", "estos", "estas", "ese", "esa", "lo", "algunos", "algunas", "nos",
  "moi", "le", "les", "ce", "cette", "mir", "mich", "einen", "eine", "ein", "diesen", "diese", "dieses", "mi", "questo", "questa",
]);

const OPENERS = /^((can|could|would|will) you|i need|i want|i'm trying|im trying|i am trying|i'd like|id like|help me|show me|teach me|tell me|give me|let's|lets|what if|necesito|quiero|me gustaría|me gustaria|me puedes|me podrías|me podrias|puedes|podrías|podrias)\b/i;
const POLITE = /^((please|pls|hey|hi|hello|ok|okay|por favor|oye|hola|bitte|s'il te plaît|s'il vous plaît)\b[\s,!]*)+/i;
const SEARCH_SYNTAX = /(^|\s)(site|inurl|intitle|allintitle|filetype|ext|related|cache|define|before|after):\S|(^|\s)-[\w"]|"[^"]+"|\s(OR|AND)\s/;
const HOW_TO = /^(how to|cómo|como|comment|wie)\s/i;
const LONG_PROSE_WORDS = 9;

const stripPunctuation = (word: string) => word.replace(/^[¿¡"'(]+/, "").replace(/[,:;.!?)"']+$/, "");

export function routeInput(raw: string): InputRoute {
  const text = raw.trim();
  if (!text) return "search";
  if (fixupUrl(text)) return "site";
  if (!/\s/.test(text)) return "search";
  if (SEARCH_SYNTAX.test(text)) return "search";
  const plain = text.replace(POLITE, "");
  const words = plain.toLowerCase().split(/\s+/).filter(Boolean).map(stripPunctuation).filter(Boolean);
  const [first = "", second = ""] = words;
  if (words.length >= 2 && TASKS.has(first)) return "chat";
  if (words.length < 3) return "search";
  const asked = /[?¿]/.test(text);
  if (OPENERS.test(plain.replace(/^[¿¡]/, ""))) return "chat";
  if (TASKS_WITH_OBJECT.has(first) && OBJECTS.has(second)) return "chat";
  if (WH_WORDS.has(first) || WH_PAIRS.has(`${first} ${second}`)) {
    if (HOW_TO.test(plain.replace(/^[¿¡]/, "")) && !asked && words.length <= 5) return "search";
    return asked || words.length >= 4 ? "chat" : "search";
  }
  if (AUXILIARIES.has(first)) return asked ? (words.length >= 3 ? "chat" : "search") : words.length >= 6 ? "chat" : "search";
  if (words.length >= LONG_PROSE_WORDS) return "chat";
  if (asked && words.length >= 5) return "chat";
  return "search";
}
