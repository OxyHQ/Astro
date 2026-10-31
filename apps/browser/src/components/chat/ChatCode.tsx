import { CodeBlock, isHighlightedLanguage, tokenColor, useCodePalette } from "@oxy.so/bloom/code";
import { RiCheckLine } from "@oxy.so/bloom/icons/RiCheckLine";
import { RiFileCopyLine } from "@oxy.so/bloom/icons/RiFileCopyLine";
import { copyText } from "@astro-browser/shell";
import { memo, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { grammarFor, tokenizeWith } from "./highlight";

const MONO = "var(--bloom-font-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const COPIED_MS = 1600;

const copy = (code: string) => copyText(code);

export function renderCodeBlock(code: string, language?: string) {
  return <ChatCode code={code} language={language} />;
}

const ChatCode = memo(function ChatCode({ code, language }: { code: string; language?: string }) {
  const grammar = grammarFor(language);
  if (!grammar || isHighlightedLanguage(language as never)) {
    return <CodeBlock code={code} language={language as never} languageLabel={language?.toUpperCase()} lineNumbers={false} onCopy={copy} />;
  }
  return <HighlightedCode code={code} language={language!} grammar={grammar} />;
});

function HighlightedCode({ code, language, grammar }: { code: string; language: string; grammar: NonNullable<ReturnType<typeof grammarFor>> }) {
  const palette = useCodePalette();
  const lines = useMemo(() => tokenizeWith(grammar, code.replace(/\n$/, "")), [grammar, code]);
  const [copied, setCopied] = useState(false);
  const Glyph = copied ? RiCheckLine : RiFileCopyLine;
  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, overflow: "hidden" }}>
      <View style={{ height: 36, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <Text style={{ fontFamily: MONO, fontSize: 10, fontWeight: "500", color: palette.className, flex: 1 }}>{language.toUpperCase()}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copied ? "Copied" : "Copy"}
          onPress={() => {
            void copy(code);
            setCopied(true);
            setTimeout(() => setCopied(false), COPIED_MS);
          }}
          style={{ width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center" }}
        >
          <Glyph width={14} height={14} fill={palette.plain} />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10 }}>
        <View>
          {lines.map((tokens, i) => (
            <Text key={i} selectable style={{ fontFamily: MONO, fontSize: 12, lineHeight: 18, color: palette.plain }}>
              {tokens.length
                ? tokens.map((token, j) => (
                    <Text key={j} style={{ color: tokenColor(token.kind, palette) }}>
                      {token.text}
                    </Text>
                  ))
                : " "}
            </Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
