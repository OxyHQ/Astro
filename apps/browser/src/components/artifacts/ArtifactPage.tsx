import { Button } from "@oxy.so/bloom/button";
import { ButtonGroup, ButtonGroupItem } from "@oxy.so/bloom/button-group";
import { Card } from "@oxy.so/bloom/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@oxy.so/bloom/dropdown-menu";
import { EmptyState } from "@oxy.so/bloom/empty-state";
import { RiArrowLeftSLine } from "@oxy.so/bloom/icons/RiArrowLeftSLine";
import { RiArrowRightSLine } from "@oxy.so/bloom/icons/RiArrowRightSLine";
import { RiChat3Line } from "@oxy.so/bloom/icons/RiChat3Line";
import { RiDownloadLine } from "@oxy.so/bloom/icons/RiDownloadLine";
import { RiFileTextLine } from "@oxy.so/bloom/icons/RiFileTextLine";
import { RiPlayLine } from "@oxy.so/bloom/icons/RiPlayLine";
import { RiShare2Line } from "@oxy.so/bloom/icons/RiShare2Line";
import { RiSparklingLine } from "@oxy.so/bloom/icons/RiSparklingLine";
import { Loading } from "@oxy.so/bloom/loading";
import { Textarea } from "@oxy.so/bloom/textarea";
import { useTheme } from "@oxy.so/bloom/theme";
import { Text } from "@oxy.so/bloom/typography";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { alia, aliaErrorMessage, useAliaReady } from "../../ai/alia/api";
import {
  artifactUrl,
  KIND_LABEL,
  parseArtifactUrl,
  rememberArtifacts,
  revisionRequest,
  useArtifacts,
  versionsOf,
  type ArtifactComment,
  type StoredArtifact,
} from "../../ai/artifacts/artifacts";
import { openChat } from "../../ai/chatEntry";
import { signInWithOxy } from "../../oxy/session";
import { useBrowser } from "../../store/browser";
import { tabDestination } from "../pages/urls";
import { ArtifactBodyView, Presenter } from "./ArtifactView";
import { KIND_GLYPH } from "./glyphs";
import {
  copyArtifactImage,
  copyArtifactMarkdown,
  exportsAvailable,
  printArtifact,
  saveArtifactHtml,
  saveArtifactImage,
  saveArtifactMarkdown,
  shareConversationLink,
} from "./exports";

const loads = new Map<string, Promise<void>>();

export function loadConversationArtifacts(conversationId: string): Promise<void> {
  const known = loads.get(conversationId);
  if (known) return known;
  const run = alia()
    .get<{ messages?: { id: string; role: string; toolInvocations?: never[] }[] }>(`/v1/conversations/${encodeURIComponent(conversationId)}`)
    .then((r) => rememberArtifacts(conversationId, r.data?.messages ?? []))
    .finally(() => setTimeout(() => loads.delete(conversationId), 5_000));
  loads.set(conversationId, run);
  return run;
}

let commentSeq = 0;

export function ArtifactPage({ tabId }: { tabId: string }) {
  const { colors } = useTheme();
  const url = useBrowser((s) => (s.tabs[tabId] ? tabDestination(s.tabs[tabId]!) : ""));
  const windowId = useBrowser((s) => s.tabs[tabId]?.windowId ?? "");
  const where = parseArtifactUrl(url);
  const ready = useAliaReady();
  const all = useArtifacts((s) => s.byId);
  const versions = useMemo(() => (where ? versionsOf(all, where.conversationId, where.id) : []), [all, where?.conversationId, where?.id]);
  const artifact = versions.find((v) => v.id === where?.id) ?? null;
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [comments, setComments] = useState<ArtifactComment[]>([]);
  const [panel, setPanel] = useState(false);
  const [quote, setQuote] = useState<{ text: string; x: number; y: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [composing, setComposing] = useState<string | null>(null);
  const [presenting, setPresenting] = useState<number | null>(null);
  const [revising, setRevising] = useState<{ after: number } | null>(null);
  const rootRef = useRef<View>(null);
  const contentRef = useRef<View>(null);

  useEffect(() => {
    if (!where || !ready || artifact) return;
    let live = true;
    loadConversationArtifacts(where.conversationId).catch((e) => live && setError(aliaErrorMessage(e, "This artifact couldn't be loaded.")));
    return () => {
      live = false;
    };
  }, [where?.conversationId, where?.id, ready, !!artifact]);

  useEffect(() => {
    const t = useBrowser.getState().tabs[tabId];
    const title = artifact?.title ?? "Artifact";
    if (t && t.title !== title) useBrowser.getState().updateTab(tabId, { title });
  }, [artifact?.title, tabId]);

  useEffect(() => {
    if (!revising || !where) return;
    const newest = versions.at(-1);
    if (newest && newest.order > revising.after) {
      setRevising(null);
      setNote("The new version is here.");
      useBrowser.getState().navigate(tabId, artifactUrl(where.conversationId, newest.id));
    }
  }, [versions, revising]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const up = () => {
      const node = contentRef.current as unknown as HTMLElement | null;
      const root = rootRef.current as unknown as HTMLElement | null;
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? "";
      if (!node || !root || !selection || !text || !selection.anchorNode || !node.contains(selection.anchorNode)) return setQuote(null);
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      const base = root.getBoundingClientRect();
      setQuote({ text: text.slice(0, 600), x: rect.left - base.left + rect.width / 2, y: rect.top - base.top });
    };
    document.addEventListener("mouseup", up);
    return () => document.removeEventListener("mouseup", up);
  }, []);

  if (!where) return <Centered title="This artifact's address isn't complete." />;
  if (!ready)
    return (
      <Centered title="Sign in with Oxy to open this artifact">
        {{ label: "Sign In with Oxy…", onPress: () => void signInWithOxy() }}
      </Centered>
    );
  if (!artifact) return error ? <Centered title={error} /> : <Loading variant="spinner" style={{ marginTop: 80 }} />;

  const index = versions.indexOf(artifact);
  const Glyph = KIND_GLYPH[artifact.body.kind];
  const openLink = (link: string) => useBrowser.getState().newTab(windowId, { url: link });
  const showVersion = (v: StoredArtifact | undefined) => v && useBrowser.getState().navigate(tabId, artifactUrl(v.conversationId, v.id));
  const run = async (work: () => Promise<unknown> | unknown, done: string) => {
    setNote(null);
    try {
      await work();
      setNote(done);
    } catch (e) {
      setNote(aliaErrorMessage(e, "That didn't work."));
    }
  };

  const addComment = () => {
    const text = draft.trim();
    if (!text) return;
    setComments((c) => [...c, { id: `c${++commentSeq}`, quote: composing ?? "", text }]);
    setDraft("");
    setComposing(null);
    setQuote(null);
    window.getSelection?.()?.removeAllRanges();
  };

  const applyComments = () => {
    if (!comments.length) return;
    const request = revisionRequest(artifact, comments);
    const sent = openChat({ windowId, prompt: request.prompt, source: "artifact", conversationId: artifact.conversationId, context: request.context });
    if (!sent) return setNote("Chat isn't available.");
    setRevising({ after: versions.at(-1)?.order ?? artifact.order });
    setComments([]);
    setNote(`Sent ${comments.length === 1 ? "your comment" : `${comments.length} comments`} to Chat. The new version opens here when it's ready.`);
  };

  const dom = exportsAvailable();
  return (
    <View ref={rootRef} style={{ flex: 1 }}>
      <View style={{ height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 20, gap: 10 }}>
        <Glyph width={18} height={18} fill={colors.icon} />
        <View style={{ flex: 1 }}>
          <Text variant="body-semibold" numberOfLines={1}>
            {artifact.title}
          </Text>
          <Text variant="caption-1-regular" style={{ color: colors.textSecondary }}>
            {KIND_LABEL[artifact.body.kind]}
            {versions.length > 1 ? ` · Version ${index + 1} of ${versions.length}` : ""}
          </Text>
        </View>
        {versions.length > 1 && (
          <ButtonGroup>
            <ButtonGroupItem iconOnly leadingIcon={RiArrowLeftSLine} accessibilityLabel="Previous Version" disabled={index <= 0} onPress={() => showVersion(versions[index - 1])} />
            <ButtonGroupItem
              iconOnly
              leadingIcon={RiArrowRightSLine}
              accessibilityLabel="Next Version"
              disabled={index >= versions.length - 1}
              onPress={() => showVersion(versions[index + 1])}
            />
          </ButtonGroup>
        )}
        {artifact.body.kind === "deck" && (
          <Button appearance="outline" tone="neutral" size="sm" leadingIcon={RiPlayLine} onPress={() => setPresenting(0)}>
            Present
          </Button>
        )}
        <Button appearance="outline" tone="neutral" size="sm" leadingIcon={RiChat3Line} onPress={() => setPanel((p) => !p)}>
          {comments.length ? `Comments (${comments.length})` : "Comment"}
        </Button>
        <Button
          appearance="outline"
          tone="neutral"
          size="sm"
          leadingIcon={RiSparklingLine}
          onPress={() => openChat({ windowId, prompt: "", source: "artifact", conversationId: artifact.conversationId })}
        >
          Open in Chat
        </Button>
        <Button
          appearance="outline"
          tone="neutral"
          size="sm"
          leadingIcon={RiShare2Line}
          onPress={() => void run(() => shareConversationLink(artifact.conversationId), "Link copied. It opens this chat on alia.onl for 7 days.")}
        >
          Share
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild label="Export" style={{ alignSelf: "center" }}>
            <Button appearance="outline" tone="neutral" size="sm" leadingIcon={RiDownloadLine}>
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onPress={() => void run(() => printArtifact(windowId, artifact), "Opened it for printing: choose Save as PDF.")}>Save as PDF…</DropdownMenuItem>
            {dom ? (
              <>
                <DropdownMenuItem onPress={() => void run(() => saveArtifactImage(artifact), "Saved to Downloads.")}>Save as Image</DropdownMenuItem>
                <DropdownMenuItem onPress={() => void run(() => copyArtifactImage(artifact), "Copied as an image.")}>Copy as Image</DropdownMenuItem>
                <DropdownMenuItem onPress={() => void run(() => saveArtifactHtml(artifact), "Saved to Downloads.")}>Save as Web Page</DropdownMenuItem>
                <DropdownMenuItem onPress={() => void run(() => saveArtifactMarkdown(artifact), "Saved to Downloads.")}>Save as Markdown</DropdownMenuItem>
              </>
            ) : null}
            <DropdownMenuItem onPress={() => void run(() => copyArtifactMarkdown(artifact), "Copied as Markdown.")}>Copy as Markdown</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </View>
      {note ? (
        <Text variant="body-2-medium" style={{ paddingHorizontal: 20, paddingBottom: 6, color: colors.primary }} onPress={() => setNote(null)}>
          {note}
        </Text>
      ) : null}
      <View style={{ flex: 1, flexDirection: "row" }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 16, paddingHorizontal: 20 }}>
          <View ref={contentRef} style={{ width: "100%", maxWidth: artifact.body.kind === "dashboard" ? 1080 : 820 }}>
            <ArtifactBodyView body={artifact.body} onLink={openLink} />
          </View>
        </ScrollView>
        {(panel || composing !== null) && (
          <View style={{ width: 300, borderLeftWidth: 1, borderColor: colors.borderLight, padding: 14, gap: 10 }}>
            <Text variant="body-semibold">Comments</Text>
            <Text variant="caption-1-regular" style={{ color: colors.textSecondary }}>
              Select text to comment on it. Alia applies them all at once in a new version.
            </Text>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8 }}>
              {comments.map((c) => (
                <Card key={c.id} appearance="subtle" style={{ padding: 10 }} contentStyle={{ gap: 4 }}>
                  {c.quote ? (
                    <Text variant="caption-1-regular" numberOfLines={3} style={{ fontStyle: "italic", color: colors.textSecondary }}>
                      “{c.quote}”
                    </Text>
                  ) : null}
                  <Text variant="body-2-regular">{c.text}</Text>
                  <View style={{ flexDirection: "row" }}>
                    <Button appearance="plain" tone="accent" size="xs" onPress={() => setComments((all) => all.filter((x) => x.id !== c.id))}>
                      Remove
                    </Button>
                  </View>
                </Card>
              ))}
              <View style={{ gap: 6 }}>
                {composing ? (
                  <Text variant="caption-1-regular" numberOfLines={3} style={{ fontStyle: "italic", color: colors.textSecondary }}>
                    “{composing}”
                  </Text>
                ) : null}
                <Textarea
                  label={composing ? "Your comment" : "A comment on the whole thing"}
                  placeholder={composing ? "Your comment" : "A comment on the whole thing"}
                  value={draft}
                  onValueChange={setDraft}
                  rows={3}
                  autoFocus={composing !== null}
                />
                <View style={{ flexDirection: "row", gap: 6, justifyContent: "flex-end" }}>
                  {composing !== null && (
                    <Button appearance="outline" tone="neutral" size="sm" onPress={() => (setComposing(null), setDraft(""))}>
                      Cancel
                    </Button>
                  )}
                  <Button appearance="subtle" tone="neutral" size="sm" disabled={!draft.trim()} onPress={addComment}>
                    Add Comment
                  </Button>
                </View>
              </View>
            </ScrollView>
            <Button appearance="solid" tone="accent" size="sm" loading={!!revising} disabled={!comments.length || !!revising} onPress={applyComments}>
              {revising ? "Revising…" : `Apply ${comments.length || ""} Comment${comments.length === 1 ? "" : "s"}`.replace("  ", " ")}
            </Button>
          </View>
        )}
      </View>
      {quote && composing === null && (
        <View style={{ position: "absolute", left: Math.max(8, quote.x - 48), top: Math.max(8, quote.y - 40) }}>
          <Button
            appearance="solid"
            tone="neutral"
            size="sm"
            leadingIcon={RiChat3Line}
            onPress={() => {
              setComposing(quote.text);
              setPanel(true);
            }}
          >
            Comment
          </Button>
        </View>
      )}
      {presenting !== null && artifact.body.kind === "deck" && (
        <Presenter slides={artifact.body.slides} start={presenting} onClose={() => setPresenting(null)} onLink={openLink} />
      )}
    </View>
  );
}

function Centered({ title, children }: { title: string; children?: { label: string; onPress: () => void } }) {
  return (
    <View style={{ flex: 1, justifyContent: "center", paddingBottom: 80 }}>
      <EmptyState icon={RiFileTextLine} title={title} {...(children ? { action: children } : {})} />
    </View>
  );
}
