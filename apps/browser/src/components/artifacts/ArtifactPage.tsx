import { Symbol } from "@astro-browser/shell";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { alia, aliaErrorMessage, useAliaReady } from "../../ai/alia/api";
import {
  artifactUrl,
  KIND_ICON,
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
import { useTheme } from "../../lib/theme";
import { signInWithOxy, useOxySession } from "../../oxy/session";
import { useBrowser } from "../../store/browser";
import { Button, useFormColors } from "../settings/controls";
import { tabDestination } from "../pages/urls";
import { ArtifactBodyView, Presenter } from "./ArtifactView";
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
  const theme = useTheme();
  const colors = useFormColors();
  const url = useBrowser((s) => (s.tabs[tabId] ? tabDestination(s.tabs[tabId]!) : ""));
  const windowId = useBrowser((s) => s.tabs[tabId]?.windowId ?? "");
  const where = parseArtifactUrl(url);
  const ready = useAliaReady();
  const available = useOxySession((s) => s.available);
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
      <Centered title={available ? "Sign in with Oxy to open this artifact" : "Artifacts aren't available on this Mac yet"}>
        {available && <Button title="Sign In with Oxy…" kind="primary" onPress={() => void signInWithOxy()} />}
      </Centered>
    );
  if (!artifact) return error ? <Centered title={error} /> : <ActivityIndicator style={{ marginTop: 80 }} />;

  const index = versions.indexOf(artifact);
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

  const exportMenu = async () => {
    const { showMenu } = await import("@astro-browser/shell");
    const dom = exportsAvailable();
    const choice = await showMenu([
      { id: "pdf", title: "Save as PDF…" },
      ...(dom
        ? [
            { id: "png", title: "Save as Image" },
            { id: "copyImage", title: "Copy as Image" },
            { id: "html", title: "Save as Web Page" },
            { id: "md", title: "Save as Markdown" },
          ]
        : []),
      { id: "copyMd", title: "Copy as Markdown" },
    ]);
    switch (choice) {
      case "pdf":
        return void run(() => printArtifact(windowId, artifact), "Opened it for printing: choose Save as PDF.");
      case "png":
        return void run(() => saveArtifactImage(artifact), "Saved to Downloads.");
      case "copyImage":
        return void run(() => copyArtifactImage(artifact), "Copied as an image.");
      case "html":
        return void run(() => saveArtifactHtml(artifact), "Saved to Downloads.");
      case "md":
        return void run(() => saveArtifactMarkdown(artifact), "Saved to Downloads.");
      case "copyMd":
        return void run(() => copyArtifactMarkdown(artifact), "Copied as Markdown.");
    }
  };

  return (
    <View ref={rootRef} style={{ flex: 1 }}>
      <View style={{ height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 20, gap: 10 }}>
        <Symbol name={KIND_ICON[artifact.body.kind]} size={14} color={theme.icon} style={{ width: 18, height: 18 }} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "600", color: theme.textPrimary }}>
            {artifact.title}
          </Text>
          <Text style={{ fontSize: 11.5, color: theme.textSecondary }}>
            {KIND_LABEL[artifact.body.kind]}
            {versions.length > 1 ? ` · Version ${index + 1} of ${versions.length}` : ""}
          </Text>
        </View>
        {versions.length > 1 && (
          <View style={{ flexDirection: "row", gap: 2 }}>
            <IconAction icon="chevron.left" label="Previous Version" disabled={index <= 0} onPress={() => showVersion(versions[index - 1])} />
            <IconAction icon="chevron.right" label="Next Version" disabled={index >= versions.length - 1} onPress={() => showVersion(versions[index + 1])} />
          </View>
        )}
        {artifact.body.kind === "deck" && <Button title="Present" icon="play.fill" onPress={() => setPresenting(0)} />}
        <Button title={comments.length ? `Comments (${comments.length})` : "Comment"} icon="bubble.left" onPress={() => setPanel((p) => !p)} />
        <Button
          title="Open in Chat"
          icon="sparkles"
          onPress={() => openChat({ windowId, prompt: "", source: "artifact", conversationId: artifact.conversationId })}
        />
        <Button title="Share" icon="square.and.arrow.up" onPress={() => void run(() => shareConversationLink(artifact.conversationId), "Link copied. It opens this chat on alia.onl for 7 days.")} />
        <Button title="Export" icon="arrow.down.doc" onPress={() => void exportMenu()} />
      </View>
      {note ? (
        <Text style={{ paddingHorizontal: 20, paddingBottom: 6, fontSize: 12.5, color: theme.accent }} onPress={() => setNote(null)}>
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
          <View style={{ width: 300, borderLeftWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.separator, padding: 14, gap: 10 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: theme.textPrimary }}>Comments</Text>
            <Text style={{ fontSize: 12, color: theme.textSecondary }}>Select text to comment on it. Alia applies them all at once in a new version.</Text>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8 }}>
              {comments.map((c) => (
                <View key={c.id} style={{ padding: 10, borderRadius: 10, backgroundColor: colors.group, gap: 4 }}>
                  {c.quote ? (
                    <Text numberOfLines={3} style={{ fontSize: 12, fontStyle: "italic", color: theme.textSecondary }}>
                      “{c.quote}”
                    </Text>
                  ) : null}
                  <Text style={{ fontSize: 13, color: theme.textPrimary }}>{c.text}</Text>
                  <Text accessibilityRole="button" onPress={() => setComments((all) => all.filter((x) => x.id !== c.id))} style={{ fontSize: 12, color: theme.accent }}>
                    Remove
                  </Text>
                </View>
              ))}
              {composing !== null || panel ? (
                <View style={{ gap: 6 }}>
                  {composing ? (
                    <Text numberOfLines={3} style={{ fontSize: 12, fontStyle: "italic", color: theme.textSecondary }}>
                      “{composing}”
                    </Text>
                  ) : null}
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder={composing ? "Your comment" : "A comment on the whole thing"}
                    placeholderTextColor={theme.textTertiary}
                    multiline
                    autoFocus={composing !== null}
                    enableFocusRing={false}
                    style={{
                      minHeight: 64,
                      padding: 8,
                      borderRadius: 8,
                      fontSize: 13,
                      color: theme.textPrimary,
                      backgroundColor: colors.field,
                      borderWidth: StyleSheet.hairlineWidth * 2,
                      borderColor: colors.fieldBorder,
                      textAlignVertical: "top",
                    }}
                  />
                  <View style={{ flexDirection: "row", gap: 6, justifyContent: "flex-end" }}>
                    {composing !== null && <Button title="Cancel" onPress={() => (setComposing(null), setDraft(""))} />}
                    <Button title="Add Comment" disabled={!draft.trim()} onPress={addComment} />
                  </View>
                </View>
              ) : null}
            </ScrollView>
            <Button title={revising ? "Revising…" : `Apply ${comments.length || ""} Comment${comments.length === 1 ? "" : "s"}`.replace("  ", " ")} kind="primary" disabled={!comments.length || !!revising} onPress={applyComments} />
          </View>
        )}
      </View>
      {quote && composing === null && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setComposing(quote.text);
            setPanel(true);
          }}
          style={{
            position: "absolute",
            left: Math.max(8, quote.x - 48),
            top: Math.max(8, quote.y - 36),
            height: 28,
            paddingHorizontal: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            borderRadius: 8,
            backgroundColor: theme.dark ? "#2f2c31" : "#FFFFFF",
            boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
          }}
        >
          <Symbol name="bubble.left" size={11} color={theme.icon} style={{ width: 14, height: 14 }} />
          <Text style={{ fontSize: 12.5, fontWeight: "600", color: theme.textPrimary }}>Comment</Text>
        </Pressable>
      )}
      {presenting !== null && artifact.body.kind === "deck" && (
        <Presenter slides={artifact.body.slides} start={presenting} onClose={() => setPresenting(null)} onLink={openLink} />
      )}
    </View>
  );
}

function IconAction({ icon, label, onPress, disabled }: { icon: string; label: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={{ width: 26, height: 26, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.35 : 1 }}
    >
      <Symbol name={icon} size={12} color={theme.icon} style={{ width: 16, height: 16 }} />
    </Pressable>
  );
}

function Centered({ title, children }: { title: string; children?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingBottom: 80 }}>
      <Symbol name="doc.text" size={28} color={theme.textTertiary} style={{ width: 40, height: 40 }} />
      <Text style={{ fontSize: 15, fontWeight: "500", color: theme.textSecondary, textAlign: "center", maxWidth: 420 }}>{title}</Text>
      {children}
    </View>
  );
}
