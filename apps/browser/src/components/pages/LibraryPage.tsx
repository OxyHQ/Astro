import { Button } from "@oxy.so/bloom/button";
import { Card } from "@oxy.so/bloom/card";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@oxy.so/bloom/dropdown-menu";
import { EmptyState } from "@oxy.so/bloom/empty-state";
import { RiArrowDownSLine } from "@oxy.so/bloom/icons/RiArrowDownSLine";
import { RiBookOpenLine } from "@oxy.so/bloom/icons/RiBookOpenLine";
import { RiChat3Line } from "@oxy.so/bloom/icons/RiChat3Line";
import { RiFileList3Line } from "@oxy.so/bloom/icons/RiFileList3Line";
import { RiMoreFill } from "@oxy.so/bloom/icons/RiMoreFill";
import { RiSearchLine } from "@oxy.so/bloom/icons/RiSearchLine";
import { Item } from "@oxy.so/bloom/item";
import { Loading } from "@oxy.so/bloom/loading";
import { SegmentedControl, SegmentedControlItem, SegmentedControlItemText } from "@oxy.so/bloom/segmented-control";
import { useTheme } from "@oxy.so/bloom/theme";
import { Text } from "@oxy.so/bloom/typography";
import { confirm, copyText } from "@astro-browser/shell";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { aliaErrorMessage, useAliaReady } from "../../ai/alia/api";
import {
  DATE_RANGES,
  dateInQuery,
  groupByDay,
  intersect,
  rangeSpan,
  searchChats,
  searchFiles,
  shortDate,
  type ChatHit,
  type DateRange,
  type FileHit,
} from "../../ai/library/library";
import { closeDeletedChat, openLibraryChat, openLibraryFile } from "../../ai/library/open";
import { deleteLibraryChat, refreshLibrary, useLibrary } from "../../ai/library/store";
import { useBrowser } from "../../store/browser";
import { KIND_GLYPH } from "../artifacts/glyphs";
import { AiPageHeader, PAGE_COLUMN, SignedOutState } from "./AiPageChrome";
import { internalQuery, tabDestination } from "./urls";

type LibraryView = "chats" | "files";

const viewOf = (url: string): LibraryView => (/^astro:\/\/library\/files\b/i.test(url) ? "files" : "chats");

export function LibraryPage({ tabId }: { tabId: string }) {
  const url = useBrowser((s) => (s.tabs[tabId] ? tabDestination(s.tabs[tabId]!) : ""));
  const windowId = useBrowser((s) => s.tabs[tabId]?.windowId ?? "");
  const ready = useAliaReady();
  const [query, setQuery] = useState(() => internalQuery(url));
  const [view, setView] = useState<LibraryView>(() => viewOf(url));
  const [range, setRange] = useState<DateRange>("any");

  useEffect(() => {
    setQuery(internalQuery(url));
    setView(viewOf(url));
  }, [url]);

  useEffect(() => {
    if (ready) void refreshLibrary();
  }, [ready]);

  const rangeTitle = DATE_RANGES.find((r) => r.id === range)!.title;
  const dateMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild label="Date">
        <Button appearance="subtle" tone="neutral" size="sm" trailingIcon={RiArrowDownSLine} accessibilityLabel={`Date: ${rangeTitle}`}>
          {rangeTitle}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {DATE_RANGES.map((r) => (
          <DropdownMenuCheckboxItem key={r.id} checked={range === r.id} onCheckedChange={() => setRange(r.id)}>
            {r.title}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <View style={{ flex: 1 }}>
      <AiPageHeader title="Library" query={query} onQuery={setQuery} placeholder="Search chats and files" actions={ready ? dateMenu : null} />
      {!ready ? (
        <SignedOutState icon={RiBookOpenLine} title="Sign in with Oxy to see your chats and files" description="Your Library keeps the chats you had with Alia in Astro and the files Chat made." />
      ) : (
        <>
          <View style={{ alignSelf: "center", marginBottom: 12 }}>
            <SegmentedControl label="Library" type="tabs" value={view} onValueChange={(v: string) => setView(v as LibraryView)}>
              <SegmentedControlItem value="chats">
                <SegmentedControlItemText>Chats</SegmentedControlItemText>
              </SegmentedControlItem>
              <SegmentedControlItem value="files">
                <SegmentedControlItemText>Files</SegmentedControlItemText>
              </SegmentedControlItem>
            </SegmentedControl>
          </View>
          <LibraryResults view={view} query={query} range={range} windowId={windowId} />
        </>
      )}
    </View>
  );
}

function useResults(query: string, range: DateRange) {
  const conversations = useLibrary((s) => s.conversations);
  const index = useLibrary((s) => s.index);
  return useMemo(() => {
    const now = Date.now();
    const typed = dateInQuery(query, now);
    const span = intersect(rangeSpan(range, now), typed.span);
    return { now, chats: searchChats(conversations, index, typed.text, span), files: searchFiles(conversations, index, typed.text, span), searching: !!typed.text || !!span };
  }, [conversations, index, query, range]);
}

function LibraryResults({ view, query, range, windowId }: { view: LibraryView; query: string; range: DateRange; windowId: string }) {
  const { colors } = useTheme();
  const listing = useLibrary((s) => s.listing && !s.loadedAt);
  const scanning = useLibrary((s) => s.scanning);
  const error = useLibrary((s) => s.error);
  const { now, chats, files, searching } = useResults(query, range);
  const [note, setNote] = useState<string | null>(null);

  if (listing) return <Loading variant="spinner" style={{ marginTop: 40 }} />;
  const items = view === "chats" ? chats : files;
  const status = error ?? note ?? (scanning > 0 ? `Reading ${scanning} chat${scanning === 1 ? "" : "s"} for search…` : null);
  return (
    <ScrollView contentContainerStyle={{ alignItems: "center", paddingTop: 4, paddingBottom: 40 }}>
      <View style={[PAGE_COLUMN, { gap: 8 }]}>
        {status ? (
          <Text variant="caption-1-medium" style={{ color: colors.textSecondary, textAlign: "center" }}>
            {status}
          </Text>
        ) : null}
        {items.length === 0 ? (
          <View style={{ paddingTop: 60 }}>
            <EmptyState
              icon={searching ? RiSearchLine : view === "chats" ? RiChat3Line : RiFileList3Line}
              title={searching ? "Nothing matches your search" : view === "chats" ? "No chats yet" : "No files yet"}
              description={
                searching
                  ? "Search looks in chat titles and messages, the links in them and the files Chat made."
                  : view === "chats"
                    ? "Chats you have with Alia in Astro appear here."
                    : "Reports, decks, dashboards, tables and code Chat makes appear here."
              }
            />
          </View>
        ) : view === "chats" ? (
          groupByDay(chats, now).map((group) => (
            <Section key={group.label} label={group.label}>
              {group.items.map((hit) => (
                <ChatRow key={hit.id} hit={hit} now={now} windowId={windowId} onNote={setNote} />
              ))}
            </Section>
          ))
        ) : (
          groupByDay(files, now).map((group) => (
            <Section key={group.label} label={group.label}>
              {group.items.map((hit) => (
                <FileRow key={`${hit.conversationId}:${hit.id}`} hit={hit} now={now} windowId={windowId} />
              ))}
            </Section>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6, marginTop: 6 }}>
      <Text variant="caption-1-medium" style={{ color: colors.textSecondary, paddingHorizontal: 4 }}>
        {label}
      </Text>
      <Card border="hairline" radius="radius-12" clipContent>
        {children}
      </Card>
    </View>
  );
}

function Glyph({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={{ width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: colors.backgroundTertiary }}>{children}</View>;
}

function When({ at, now }: { at: number; now: number }) {
  const { colors } = useTheme();
  return (
    <Text variant="caption-1-medium" style={{ color: colors.textSecondary }}>
      {shortDate(at, now)}
    </Text>
  );
}

function ChatRow({ hit, now, windowId, onNote }: { hit: ChatHit; now: number; windowId: string; onNote: (note: string | null) => void }) {
  const { colors } = useTheme();
  const files = useLibrary((s) => s.index[hit.id]?.files.length ?? 0);
  const remove = async () => {
    const { confirmed } = await confirm({ title: `Delete “${hit.title}”?`, message: "It's deleted from your Alia account everywhere.", confirmTitle: "Delete", destructive: true });
    if (!confirmed) return;
    try {
      await deleteLibraryChat(hit.id);
      closeDeletedChat(windowId, hit.id);
      onNote(null);
    } catch (e) {
      onNote(aliaErrorMessage(e, "That chat couldn't be deleted."));
    }
  };
  const subtitle = [hit.match === "url" ? `Link: ${hit.snippet}` : hit.snippet, files ? `${files} file${files === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ");
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingRight: 8 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Item
          accessibilityRole="button"
          accessibilityLabel={`Open ${hit.title}`}
          onPress={() => openLibraryChat(windowId, hit.id)}
          leading={
            <Glyph>
              <RiChat3Line width={18} height={18} fill={colors.icon} />
            </Glyph>
          }
          title={hit.title}
          {...(subtitle ? { subtitle } : {})}
          subtitleNumberOfLines={1}
          trailing={<When at={hit.at} now={now} />}
        />
      </View>
      <DropdownMenu>
        <DropdownMenuTrigger asChild label="More" style={{ alignSelf: "center" }}>
          <Button appearance="plain" tone="neutral" size="sm" iconOnly leadingIcon={RiMoreFill} accessibilityLabel="More" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onPress={() => openLibraryChat(windowId, hit.id)}>Open in Chat</DropdownMenuItem>
          {hit.url ? <DropdownMenuItem onPress={() => useBrowser.getState().newTab(windowId, { url: hit.url! })}>Open Link</DropdownMenuItem> : null}
          <DropdownMenuItem onPress={() => void copyText(hit.title)}>Copy Title</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem tone="danger" onPress={() => void remove()}>
            Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </View>
  );
}

function FileRow({ hit, now, windowId }: { hit: FileHit; now: number; windowId: string }) {
  const { colors } = useTheme();
  const KindGlyph = KIND_GLYPH[hit.kind];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingRight: 8 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Item
          accessibilityRole="button"
          accessibilityLabel={`Open ${hit.title}`}
          onPress={() => openLibraryFile(windowId, hit.conversationId, hit.id)}
          leading={
            <Glyph>
              <KindGlyph width={18} height={18} fill={colors.icon} />
            </Glyph>
          }
          title={hit.title}
          subtitle={`${hit.detail} · ${hit.chatTitle}`}
          subtitleNumberOfLines={1}
          trailing={<When at={hit.at} now={now} />}
        />
      </View>
      <DropdownMenu>
        <DropdownMenuTrigger asChild label="More" style={{ alignSelf: "center" }}>
          <Button appearance="plain" tone="neutral" size="sm" iconOnly leadingIcon={RiMoreFill} accessibilityLabel="More" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onPress={() => openLibraryFile(windowId, hit.conversationId, hit.id)}>Open</DropdownMenuItem>
          <DropdownMenuItem onPress={() => openLibraryChat(windowId, hit.conversationId)}>Show Chat</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </View>
  );
}
