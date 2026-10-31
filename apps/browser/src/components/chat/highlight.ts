import type { CodeToken, CodeTokenKind } from "@oxy.so/bloom/code";

type Grammar = {
  keywords: Set<string>;
  constants: Set<string>;
  lineComments: string[];
  blockComments: [string, string][];
  quotes: string[];
  types?: RegExp;
  variables?: RegExp;
  tags?: boolean;
};

const words = (list: string) => new Set(list.split(/\s+/).filter(Boolean));
const C_KEYWORDS =
  "auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while class namespace template typename public private protected virtual override final using new delete this throw try catch operator friend explicit noexcept constexpr nullptr";
const CONSTANTS = "true false null nil None True False undefined NULL nullptr";

const C_LIKE: Omit<Grammar, "keywords"> = {
  constants: words(CONSTANTS),
  lineComments: ["//"],
  blockComments: [["/*", "*/"]],
  quotes: ['"', "'"],
  types: /^[A-Z][A-Za-z0-9_]*$/,
};

const GRAMMARS: Record<string, Grammar> = {
  python: {
    keywords: words(
      "and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case self print",
    ),
    constants: words(CONSTANTS),
    lineComments: ["#"],
    blockComments: [],
    quotes: ['"""', "'''", '"', "'"],
    types: /^[A-Z][A-Za-z0-9_]*$/,
  },
  ruby: {
    keywords: words(
      "alias and begin break case class def defined do else elsif end ensure for if in module next not or redo rescue retry return self super then undef unless until when while yield require attr_accessor puts",
    ),
    constants: words(CONSTANTS),
    lineComments: ["#"],
    blockComments: [["=begin", "=end"]],
    quotes: ['"', "'"],
    types: /^[A-Z][A-Za-z0-9_]*$/,
  },
  shell: {
    keywords: words("if then else elif fi for while until do done case esac in function return local export source alias unset set echo cd exit sudo"),
    constants: words("true false"),
    lineComments: ["#"],
    blockComments: [],
    quotes: ['"', "'"],
    variables: /^\$[A-Za-z_][A-Za-z0-9_]*|^\$\{[^}]*\}/,
  },
  c: { keywords: words(C_KEYWORDS), ...C_LIKE },
  java: {
    keywords: words(
      "abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long native new package private protected public return short static super switch synchronized this throw throws try void volatile while var record sealed permits yield fun val when object companion data suspend override open internal lateinit by is as",
    ),
    ...C_LIKE,
  },
  csharp: {
    keywords: words(
      "abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new object operator out override params private protected public readonly ref return sbyte sealed short sizeof static string struct switch this throw try typeof uint ulong unchecked unsafe ushort using virtual void volatile while var async await record init get set",
    ),
    ...C_LIKE,
  },
  go: {
    keywords: words(
      "break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var string int int64 int32 uint byte rune float64 bool error any",
    ),
    ...C_LIKE,
    quotes: ['"', "'", "`"],
  },
  rust: {
    keywords: words(
      "as async await break const continue crate dyn else enum extern fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait type unsafe use where while i32 i64 u8 u32 u64 usize isize f32 f64 bool str String Vec Option Result Some Ok Err",
    ),
    ...C_LIKE,
  },
  swift: {
    keywords: words(
      "associatedtype class deinit enum extension fileprivate func import init inout internal let open operator private protocol public rethrows static struct subscript typealias var break case continue default defer do else fallthrough for guard if in repeat return switch where while as catch is try throws async await some any self Self",
    ),
    ...C_LIKE,
  },
  php: {
    keywords: words(
      "abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile extends final finally fn for foreach function global goto if implements include instanceof insteadof interface isset list match namespace new or print private protected public readonly require return static switch throw trait try unset use var while xor yield",
    ),
    ...C_LIKE,
    lineComments: ["//", "#"],
    variables: /^\$[A-Za-z_][A-Za-z0-9_]*/,
  },
  sql: {
    keywords: words(
      "select from where and or not insert into values update set delete create table drop alter add column index primary key foreign references join left right inner outer full on as group by order having limit offset union all distinct case when then else end is null like in between exists returning with default constraint unique view begin commit rollback",
    ),
    constants: words("true false null"),
    lineComments: ["--"],
    blockComments: [["/*", "*/"]],
    quotes: ["'", '"'],
  },
  css: {
    keywords: words("@media @import @keyframes @font-face @supports !important"),
    constants: words(""),
    lineComments: [],
    blockComments: [["/*", "*/"]],
    quotes: ['"', "'"],
  },
  json: { keywords: words(""), constants: words("true false null"), lineComments: [], blockComments: [], quotes: ['"'] },
  yaml: { keywords: words(""), constants: words("true false null yes no on off ~"), lineComments: ["#"], blockComments: [], quotes: ['"', "'"] },
  markup: { keywords: words(""), constants: words(""), lineComments: [], blockComments: [["<!--", "-->"]], quotes: ['"', "'"], tags: true },
};

const ALIASES: Record<string, string> = {
  py: "python",
  python3: "python",
  rb: "ruby",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  console: "shell",
  shellscript: "shell",
  ps1: "shell",
  powershell: "shell",
  c: "c",
  h: "c",
  cpp: "c",
  "c++": "c",
  cc: "c",
  hpp: "c",
  objc: "c",
  "objective-c": "c",
  java: "java",
  kotlin: "java",
  kt: "java",
  scala: "java",
  dart: "java",
  cs: "csharp",
  csharp: "csharp",
  "c#": "csharp",
  go: "go",
  golang: "go",
  rust: "rust",
  rs: "rust",
  swift: "swift",
  php: "php",
  sql: "sql",
  postgres: "sql",
  postgresql: "sql",
  mysql: "sql",
  sqlite: "sql",
  css: "css",
  scss: "css",
  sass: "css",
  less: "css",
  json: "json",
  jsonc: "json",
  json5: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "yaml",
  ini: "yaml",
  html: "markup",
  xml: "markup",
  svg: "markup",
  vue: "markup",
  svelte: "markup",
};

export const grammarFor = (language: string | undefined): Grammar | null => {
  const key = language?.toLowerCase().trim();
  return key ? (GRAMMARS[ALIASES[key] ?? key] ?? null) : null;
};

const NUMBER = /^(0x[0-9a-fA-F_]+|\d[\d_]*(\.\d+)?([eE][+-]?\d+)?)/;
const IDENT = /^[A-Za-z_@$][\w$-]*/;
const PUNCT = /^[{}[\]();,.:]/;
const OPERATOR = /^[=+\-*/%<>!&|^~?]+/;

export function tokenizeWith(grammar: Grammar, source: string): CodeToken[][] {
  const lines: CodeToken[][] = [[]];
  const push = (kind: CodeTokenKind, text: string) => {
    const parts = text.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1]!.push({ kind, text: part });
    });
  };
  let i = 0;
  let inTag = false;
  while (i < source.length) {
    const rest = source.slice(i);
    const block = grammar.blockComments.find(([open]) => rest.startsWith(open));
    if (block) {
      const end = rest.indexOf(block[1], block[0].length);
      const text = end < 0 ? rest : rest.slice(0, end + block[1].length);
      push("comment", text);
      i += text.length;
      continue;
    }
    const line = grammar.lineComments.find((open) => rest.startsWith(open));
    if (line) {
      const end = rest.indexOf("\n");
      const text = end < 0 ? rest : rest.slice(0, end);
      push("comment", text);
      i += text.length;
      continue;
    }
    if (grammar.tags && (rest.startsWith("</") || /^<[A-Za-z!]/.test(rest))) {
      const name = /^<\/?[A-Za-z!][\w:-]*/.exec(rest)![0];
      push("punctuation", name.startsWith("</") ? "</" : "<");
      push("className", name.replace(/^<\/?/, ""));
      i += name.length;
      inTag = true;
      continue;
    }
    if (grammar.tags && inTag && (rest.startsWith(">") || rest.startsWith("/>"))) {
      const text = rest.startsWith("/>") ? "/>" : ">";
      push("punctuation", text);
      i += text.length;
      inTag = false;
      continue;
    }
    const quote = grammar.quotes.find((q) => rest.startsWith(q));
    if (quote) {
      let j = quote.length;
      while (j < rest.length && !rest.startsWith(quote, j)) {
        if (rest[j] === "\\") j++;
        else if (rest[j] === "\n" && quote.length === 1) break;
        j++;
      }
      const text = rest.slice(0, Math.min(rest.length, j + quote.length));
      push(grammar.tags && inTag ? "attrValue" : "string", text);
      i += text.length;
      continue;
    }
    const variable = grammar.variables?.exec(rest);
    if (variable) {
      push("constant", variable[0]);
      i += variable[0].length;
      continue;
    }
    const number = NUMBER.exec(rest);
    if (number && !/[\w$]/.test(source[i - 1] ?? "")) {
      push("constant", number[0]);
      i += number[0].length;
      continue;
    }
    const ident = IDENT.exec(rest);
    if (ident) {
      const word = ident[0];
      const lower = word.toLowerCase();
      const next = rest.slice(word.length).trimStart()[0];
      const kind: CodeTokenKind =
        grammar.tags && inTag
          ? "attrName"
          : grammar.keywords.has(word) || grammar.keywords.has(lower)
            ? "keyword"
            : grammar.constants.has(word)
              ? "constant"
              : grammar.types?.test(word)
                ? "className"
                : next === "(" || (grammar === GRAMMARS.json && next === ":")
                  ? "function"
                  : "plain";
      push(kind, word);
      i += word.length;
      continue;
    }
    const punct = PUNCT.exec(rest) ?? OPERATOR.exec(rest);
    if (punct) {
      push(PUNCT.test(punct[0]) ? "punctuation" : "operator", punct[0]);
      i += punct[0].length;
      continue;
    }
    push("plain", rest[0]!);
    i += 1;
  }
  return lines;
}
