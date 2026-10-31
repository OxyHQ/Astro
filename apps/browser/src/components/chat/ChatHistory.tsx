import { useConversations, useDeleteConversation, type Conversation } from "@alia.onl/sdk/runtime";
import { AgentChatHistory, type AgentChatThread } from "@oxy.so/bloom/agent-chat";
import { Loading } from "@oxy.so/bloom/loading";
import { confirm } from "@astro-browser/shell";
import { useMemo, useState } from "react";
import { View } from "react-native";

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

export function useChatList() {
  const conversations = useConversations({ app: ASTRO_APP });
  const all = useMemo(() => conversations.data?.pages.flatMap((page) => page.conversations) ?? [], [conversations.data]);
  return { conversations, all };
}

export async function deleteAllChats(all: Conversation[], remove: (id: string) => Promise<unknown>) {
  if (!all.length) return;
  const { confirmed } = await confirm({
    title: `Delete All ${all.length} Chats?`,
    message: "They're deleted from your Alia account everywhere.",
    confirmTitle: "Delete All",
    destructive: true,
  });
  if (!confirmed) return;
  for (const c of all) await remove(c.id).catch(() => undefined);
}

export function ChatHistory({ current, onOpen, onNewChat }: { current: string | null; onOpen: (conversationId: string) => void; onNewChat: () => void }) {
  const [query, setQuery] = useState("");
  const { conversations, all } = useChatList();
  const { mutate: remove } = useDeleteConversation();
  const q = query.trim().toLowerCase();
  const threads = useMemo<AgentChatThread[]>(
    () =>
      (q ? all.filter((c) => c.title.toLowerCase().includes(q) || (c.lastMessage ?? "").toLowerCase().includes(q)) : all).map((c) => ({
        id: c.id,
        title: c.title || "New Chat",
        updatedAt: new Date(c.updatedAt).getTime(),
        group: dayLabel(new Date(c.updatedAt)),
      })),
    [all, q],
  );
  const loading = conversations.isLoading || conversations.isFetchingNextPage;
  return (
    <AgentChatHistory
      framed={false}
      threads={threads}
      {...(current ? { activeId: current } : {})}
      onSelect={onOpen}
      onNewChat={onNewChat}
      onDelete={(id) => remove(id)}
      query={query}
      onQueryChange={setQuery}
      onEndReached={() => {
        if (conversations.hasNextPage && !conversations.isFetchingNextPage) void conversations.fetchNextPage();
      }}
      {...(loading
        ? {
            after: (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <Loading variant="spinner" size="sm" />
              </View>
            ),
          }
        : {})}
      labels={{ search: "Search chats", empty: q ? "No chats match your search" : "No chats yet", region: "Chats" }}
      style={{ paddingTop: 4 }}
    />
  );
}
