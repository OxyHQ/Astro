import { Symbol } from "@astro-browser/shell";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { aliaErrorMessage, useAliaReady } from "../../ai/alia/api";
import { ALIA_CONNECTORS_URL, APPS, connectUrl, disconnect, refreshApps, useApps, type AppEntry, type Connection } from "../../ai/apps/apps";
import { useTheme } from "../../lib/theme";
import { signInWithOxy, useOxySession } from "../../oxy/session";
import { useBrowser } from "../../store/browser";
import { Button, useFormColors } from "../settings/controls";
import { PAGE_WIDTH, PageHeader } from "./PageLayout";
import { internalQuery, tabDestination } from "./urls";

export function AppsPage({ tabId }: { tabId: string }) {
  const theme = useTheme();
  const colors = useFormColors();
  const url = useBrowser((s) => (s.tabs[tabId] ? tabDestination(s.tabs[tabId]!) : ""));
  const windowId = useBrowser((s) => s.tabs[tabId]?.windowId ?? "");
  const ready = useAliaReady();
  const available = useOxySession((s) => s.available);
  const loading = useApps((s) => s.loading && !s.loadedAt);
  const [query, setQuery] = useState("");
  const outcome = internalQuery(url);

  useEffect(() => {
    if (ready) void refreshApps();
  }, [ready, url]);

  const shown = APPS.filter((a) => !query || `${a.name} ${a.description}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <View style={{ flex: 1 }}>
      <PageHeader title="Apps" query={query} onQuery={setQuery} placeholder="Search apps" />
      {!ready ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingBottom: 80 }}>
          <Symbol name="puzzlepiece" size={28} color={theme.textTertiary} style={{ width: 40, height: 40 }} />
          <Text style={{ fontSize: 15, fontWeight: "500", color: theme.textSecondary }}>
            {available ? "Sign in with Oxy to connect apps to Chat" : "Apps aren't available on this Mac yet"}
          </Text>
          {available && <Button title="Sign In with Oxy…" kind="primary" onPress={() => void signInWithOxy()} />}
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ alignItems: "center", paddingTop: 4, paddingBottom: 40 }}>
          <View style={{ width: PAGE_WIDTH - 32, maxWidth: "100%", gap: 10 }}>
            {outcome === "connected" && <Banner text="Connected. Chat can use it now." tone="good" />}
            {outcome === "failed" && <Banner text="That app couldn't be connected. Try again." tone="bad" />}
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                padding: 14,
                borderRadius: 12,
                backgroundColor: colors.group,
                borderWidth: StyleSheet.hairlineWidth * 2,
                borderColor: colors.groupBorder,
              }}
            >
              <Symbol name="sparkles" size={14} color={theme.icon} style={{ width: 20, height: 20 }} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontSize: 13.5, fontWeight: "600", color: theme.textPrimary }}>Your Oxy apps are built in</Text>
                <Text style={{ fontSize: 12.5, lineHeight: 17, color: theme.textSecondary }}>
                  Inbox, Nilo and the rest of Oxy are part of Alia, under your Oxy account: Chat reads and acts in them without connecting anything.
                </Text>
              </View>
            </View>
            {loading ? (
              <ActivityIndicator style={{ marginTop: 30 }} />
            ) : (
              shown.map((app) => <AppRow key={app.id} app={app} windowId={windowId} />)
            )}
            <Text style={{ fontSize: 12, lineHeight: 17, color: theme.textSecondary, marginTop: 6 }}>
              Chat acts in a connected app with the account you connected, and only when you ask. Alia keeps the connection; disconnect it here or in Alia.
            </Text>
            <View style={{ flexDirection: "row" }}>
              <Button title="More Connectors in Alia…" kind="plain" onPress={() => useBrowser.getState().newTab(windowId, { url: ALIA_CONNECTORS_URL })} />
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Banner({ text, tone }: { text: string; tone: "good" | "bad" }) {
  const colors = useFormColors();
  return (
    <View style={{ padding: 10, borderRadius: 10, backgroundColor: tone === "good" ? "rgba(43,182,115,0.14)" : "rgba(229,72,77,0.14)" }}>
      <Text style={{ fontSize: 13, color: tone === "good" ? "#1f9a5f" : colors.destructive }}>{text}</Text>
    </View>
  );
}

const NO_CONNECTIONS: Connection[] = [];

function AppRow({ app, windowId }: { app: AppEntry; windowId: string }) {
  const theme = useTheme();
  const colors = useFormColors();
  const connections = useApps((s) => s.connections[app.id] ?? NO_CONNECTIONS);
  const configured = useApps((s) => (app.kind === "integration" ? s.configured[app.service] !== false : true));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const url = await connectUrl(app);
      useBrowser.getState().newTab(windowId, { url });
    } catch (e) {
      setError(aliaErrorMessage(e, `${app.name} can't be connected right now.`));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: Connection) => {
    setBusy(true);
    setError(null);
    try {
      await disconnect(app, c);
    } catch (e) {
      setError(aliaErrorMessage(e, "It couldn't be disconnected."));
    } finally {
      setBusy(false);
    }
  };

  const many = app.kind !== "mcp";
  return (
    <View
      style={{
        padding: 14,
        gap: 8,
        borderRadius: 12,
        backgroundColor: colors.group,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: colors.groupBorder,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
          }}
        >
          <Symbol name={app.icon} size={14} color={theme.icon} style={{ width: 18, height: 18 }} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: theme.textPrimary }}>{app.name}</Text>
          <Text style={{ fontSize: 12.5, color: theme.textSecondary }}>{app.description}</Text>
        </View>
        {!configured ? (
          <Text style={{ fontSize: 12, color: theme.textTertiary }}>Not available yet</Text>
        ) : !app.oauth ? (
          <Button title="Set Up in Alia…" onPress={() => useBrowser.getState().newTab(windowId, { url: ALIA_CONNECTORS_URL })} />
        ) : connections.length && !many ? null : (
          <Button title={busy ? "Opening…" : connections.length ? "Add Account" : "Connect"} kind={connections.length ? "default" : "primary"} disabled={busy} onPress={() => void connect()} />
        )}
      </View>
      {connections.map((c) => (
        <View key={c.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 46 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: /error|expired|reauth/i.test(c.status) ? colors.destructive : "#2BB673" }} />
          <Text style={{ flex: 1, fontSize: 12.5, color: theme.textPrimary }}>
            {c.label}
            {/error|expired|reauth/i.test(c.status) ? <Text style={{ color: colors.destructive }}> · needs reconnecting</Text> : null}
          </Text>
          {app.kind === "mcp" && !/running|active/i.test(c.status) && <Button title="Reconnect" onPress={() => void connect()} />}
          <Button title="Disconnect" kind="plain" disabled={busy} onPress={() => void remove(c)} />
        </View>
      ))}
      {error ? <Text style={{ fontSize: 12, color: colors.destructive, paddingLeft: 46 }}>{error}</Text> : null}
    </View>
  );
}
