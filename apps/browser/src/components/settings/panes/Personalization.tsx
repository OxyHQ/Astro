import { confirm } from "@astro-browser/shell";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useAliaReady } from "../../../ai/alia/api";
import {
  forgetMemory,
  fromOption,
  toOption,
  interestsOf,
  LANGUAGES,
  refreshMemory,
  RESPONSE_LENGTHS,
  saveContext,
  saveMemorySettings,
  savePreferences,
  TONES,
  useMemoryProfile,
  type MemoryContext,
  type MemoryEntry,
  type ResponseLength,
} from "../../../ai/alia/memory";
import { useTheme } from "../../../lib/theme";
import { Button, Group, PopUp, Row, SectionHeader, TextField, Toggle } from "../controls";
import { SignedOutRow } from "./Apps";

const MEMORY_KINDS: Record<MemoryEntry["type"], string> = { profile: "You", topic: "Topic", person: "Person" };
const SHOWN_MEMORIES = 50;

export function PersonalizationPane() {
  const theme = useTheme();
  const ready = useAliaReady();
  const profile = useMemoryProfile((s) => s.profile);
  const loading = useMemoryProfile((s) => s.loading);
  const error = useMemoryProfile((s) => s.error);
  useEffect(() => {
    if (ready) void refreshMemory();
  }, [ready]);

  if (!ready)
    return (
      <View>
        <SectionHeader title="About you" description="Chat can answer with you in mind: what you do, how you like answers, and what it remembers from your chats." />
        <SignedOutRow description="Sign in with your Oxy account to personalize Chat." />
      </View>
    );
  if (!profile)
    return (
      <View>
        <SectionHeader title="About you" />
        <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>{loading ? "Loading…" : (error ?? "")}</Text>
      </View>
    );

  const prefs = profile.preferences;
  return (
    <View>
      <SectionHeader
        title="About you"
        description="Chat reads this with every message you send, in Astro and everywhere else you use Alia. Turn personalization off for one chat in its ⋯ menu."
      />
      {error ? <Text style={{ fontSize: 12, color: "#FF453A", marginBottom: 8 }}>{error}</Text> : null}
      <Group>
        <ContextRow anchor="personalization.occupation" field="occupation" value={profile.context.occupation} placeholder="Product designer" />
        <ContextRow anchor="personalization.location" field="location" value={profile.context.location} placeholder="Barcelona" />
        <ContextRow anchor="personalization.bio" field="bio" value={profile.context.bio} placeholder="I lead a small team and like short answers with sources." wide />
        <Row anchor="personalization.interests">
          <CommittedField
            value={prefs.interests.join(", ")}
            placeholder="Design, running, jazz"
            width={260}
            onCommit={(text) => void savePreferences({ interests: interestsOf(text) })}
          />
        </Row>
      </Group>

      <SectionHeader title="How Chat answers" />
      <Group>
        <Row anchor="personalization.language">
          <PopUp value={toOption(prefs.language)} options={withCurrent(LANGUAGES, prefs.language)} onChange={(v) => void savePreferences({ language: fromOption(v) })} minWidth={190} />
        </Row>
        <Row anchor="personalization.tone">
          <PopUp value={toOption(prefs.tone)} options={withCurrent(TONES, prefs.tone)} onChange={(v) => void savePreferences({ tone: fromOption(v) })} minWidth={190} />
        </Row>
        <Row anchor="personalization.responseLength">
          <PopUp
            value={toOption(prefs.responseLength)}
            options={RESPONSE_LENGTHS}
            onChange={(v) => void savePreferences({ responseLength: fromOption(v) as ResponseLength | "" })}
            minWidth={190}
          />
        </Row>
      </Group>

      <SectionHeader title="Memory" />
      <Group>
        <Row anchor="personalization.autoSave">
          <Toggle value={profile.settings.autoSaveEnabled} onChange={(autoSaveEnabled) => void saveMemorySettings({ autoSaveEnabled })} />
        </Row>
        <Row anchor="personalization.recall">
          <Toggle value={profile.settings.recallEnabled} onChange={(recallEnabled) => void saveMemorySettings({ recallEnabled })} />
        </Row>
      </Group>

      <SectionHeader
        anchor="personalization.memories"
        description={profile.memories.length ? `${profile.memories.length} saved. Forget any you don't want Chat to use.` : "Nothing yet. What Chat learns about you shows here."}
      />
      {profile.memories.length ? (
        <Group>
          {profile.memories.slice(0, SHOWN_MEMORIES).map((m) => (
            <MemoryRow key={m._id} memory={m} />
          ))}
        </Group>
      ) : null}
    </View>
  );
}

function withCurrent(options: { value: string; title: string }[], current: string) {
  return !current || options.some((o) => o.value === current) ? options : [...options, { value: current, title: current }];
}

function CommittedField({ value, placeholder, width, onCommit }: { value: string; placeholder: string; width: number; onCommit: (text: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => {
    if (text.trim() !== value.trim()) onCommit(text);
  };
  return <TextField value={text} onChangeText={setText} placeholder={placeholder} onSubmit={commit} onBlur={commit} onEscape={() => setText(value)} style={{ width }} />;
}

function ContextRow({ anchor, field, value, placeholder, wide }: { anchor: string; field: keyof MemoryContext; value: string; placeholder: string; wide?: boolean }) {
  return (
    <Row anchor={anchor}>
      <CommittedField value={value} placeholder={placeholder} width={wide ? 320 : 220} onCommit={(text) => void saveContext({ [field]: text })} />
    </Row>
  );
}

function MemoryRow({ memory }: { memory: MemoryEntry }) {
  const forget = async () => {
    const { confirmed } = await confirm({ title: `Forget “${memory.title}”?`, message: "Chat won't use it again.", confirmTitle: "Forget", destructive: true });
    if (confirmed) void forgetMemory(memory._id);
  };
  return (
    <Row title={memory.title} description={[MEMORY_KINDS[memory.type], memory.summary].filter(Boolean).join(" · ")}>
      <Button title="Forget…" kind="destructive" onPress={() => void forget()} />
    </Row>
  );
}
