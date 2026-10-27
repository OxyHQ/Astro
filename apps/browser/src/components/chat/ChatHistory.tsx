import { useConversations, useDeleteConversation, type Conversation } from "@alia.onl/sdk/runtime";
import { RiDeleteBinLine } from "@oxy.so/bloom/icons/RiDeleteBinLine";
import { showMenu } from "@astro-browser/shell";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useTheme } from "../../lib/theme";
import { useHover } from "../primitives";

export const ASTRO_APP = "astro";

function dayLabel(date: Date): string {
  const today = new Date();
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(today) - start(date)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Previous 7 Days";
  if (days < 30) return "Previous 30 Days";
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function ChatHistory({ current, onOpen }: { current: string | null; onOpen: (conversationId: string) => void }) {
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const conversations = useConversations({ app: ASTRO_APP });
  const { mutateAsync: remove } = useDeleteConversation();
  const [clearing, setClearing] = useState(false);
  const all = useMemo(() => conversations.data?.pages.flatMap((page) => page.conversations) ?? [], [conversations.data]);
  const q = query.trim().toLowerCase();
  const shown = q ? all.filter((c) => c.title.toLowerCase().includes(q) || (c.lastMessage ?? "").toLowerCase().includes(q)) : all;
  const sections = useMemo(() => {
    const out: { label: string; items: Conversation[] }[] = [];
    for (const c of shown) {
      const label = dayLabel(new Date(c.updatedAt));
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(c);
      else out.push({ label, items: [c] });
    }
    return out;
  }, [shown]);

  const clearAll = async () => {
    const choice = await showMenu([{ id: "clear", title: `Delete All ${all.length} Chats` }]);
    if (choice !== "clear") return;
    setClearing(true);
    for (const c of all) await remove(c.id).catch(() => undefined);
    setClearing(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search chats"
          placeholderTextColor={theme.textSecondary}
          autoFocus
          style={{
            flex: 1,
            height: 30,
            paddingHorizontal: 10,
            borderRadius: 8,
            fontSize: 13,
            color: theme.textPrimary,
            backgroundColor: theme.dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
          }}
        />
        {all.length > 0 && (
          <Pressable accessibilityRole="button" onPress={() => void clearAll()} disabled={clearing}>
            <Text style={{ fontSize: 12, color: theme.textSecondary }}>{clearing ? "Deleting…" : "Clear All"}</Text>
          </Pressable>
        )}
      </View>
      {conversations.isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : !shown.length ? (
        <Text style={{ textAlign: "center", marginTop: 32, fontSize: 13, color: theme.textSecondary }}>
          {q ? "No chats match your search" : "No chats yet"}
        </Text>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 6, paddingBottom: 12 }}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            if (contentOffset.y + layoutMeasurement.height > contentSize.height - 200 && conversations.hasNextPage && !conversations.isFetchingNextPage)
              void conversations.fetchNextPage();
          }}
          scrollEventThrottle={64}
        >
          {sections.map((section) => (
            <View key={section.label} style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: theme.textSecondary, paddingHorizontal: 8, paddingVertical: 6 }}>{section.label}</Text>
              {section.items.map((c) => (
                <HistoryRow key={c.id} conversation={c} current={c.id === current} onOpen={() => onOpen(c.id)} onDelete={() => void remove(c.id)} />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function HistoryRow({ conversation, current, onOpen, onDelete }: { conversation: Conversation; current: boolean; onOpen: () => void; onDelete: () => void }) {
  const theme = useTheme();
  const { hovered, hoverProps } = useHover();
  return (
    <View {...hoverProps}>
      <Pressable
        accessibilityRole="button"
        onPress={onOpen}
        style={{
          minHeight: 34,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingLeft: 8,
          paddingRight: 4,
          borderRadius: 8,
          backgroundColor: current || hovered ? (theme.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)") : undefined,
        }}
      >
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: theme.textPrimary }}>
          {conversation.title || "New Chat"}
        </Text>
        {hovered && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete Chat"
            onPress={onDelete}
            style={{ width: 26, height: 26, borderRadius: 6, alignItems: "center", justifyContent: "center" }}
          >
            <RiDeleteBinLine width={14} height={14} fill={theme.textSecondary} />
          </Pressable>
        )}
      </Pressable>
    </View>
  );
}
