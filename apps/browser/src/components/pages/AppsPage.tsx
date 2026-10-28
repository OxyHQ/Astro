import { Admonition } from "@oxy.so/bloom/admonition";
import { Button } from "@oxy.so/bloom/button";
import { Card } from "@oxy.so/bloom/card";
import { Chip } from "@oxy.so/bloom/chip";
import type { BloomIconComponent } from "@oxy.so/bloom/icons";
import { RiCalendarLine } from "@oxy.so/bloom/icons/RiCalendarLine";
import { RiChat3Line } from "@oxy.so/bloom/icons/RiChat3Line";
import { RiCheckboxCircleLine } from "@oxy.so/bloom/icons/RiCheckboxCircleLine";
import { RiCodeSSlashLine } from "@oxy.so/bloom/icons/RiCodeSSlashLine";
import { RiFileTextLine } from "@oxy.so/bloom/icons/RiFileTextLine";
import { RiFolderLine } from "@oxy.so/bloom/icons/RiFolderLine";
import { RiMailLine } from "@oxy.so/bloom/icons/RiMailLine";
import { RiPuzzleLine } from "@oxy.so/bloom/icons/RiPuzzleLine";
import { Loading } from "@oxy.so/bloom/loading";
import { useTheme } from "@oxy.so/bloom/theme";
import { Text } from "@oxy.so/bloom/typography";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { aliaErrorMessage, useAliaReady } from "../../ai/alia/api";
import { ALIA_CONNECTORS_URL, APPS, connectUrl, disconnect, refreshApps, useApps, type AppEntry, type Connection } from "../../ai/apps/apps";
import { useBrowser } from "../../store/browser";
import { AiPageHeader, PAGE_COLUMN, SignedOutState } from "./AiPageChrome";
import { internalQuery, tabDestination } from "./urls";

const APP_ICONS: Record<string, BloomIconComponent> = {
  envelope: RiMailLine,
  calendar: RiCalendarLine,
  folder: RiFolderLine,
  "doc.text": RiFileTextLine,
  "chevron.left.forwardslash.chevron.right": RiCodeSSlashLine,
  "checkmark.circle": RiCheckboxCircleLine,
  "bubble.left": RiChat3Line,
};

export function AppsPage({ tabId }: { tabId: string }) {
  const { colors } = useTheme();
  const url = useBrowser((s) => (s.tabs[tabId] ? tabDestination(s.tabs[tabId]!) : ""));
  const windowId = useBrowser((s) => s.tabs[tabId]?.windowId ?? "");
  const ready = useAliaReady();
  const loading = useApps((s) => s.loading && !s.loadedAt);
  const [query, setQuery] = useState("");
  const outcome = internalQuery(url);

  useEffect(() => {
    if (ready) void refreshApps();
  }, [ready, url]);

  const shown = APPS.filter((a) => !query || `${a.name} ${a.description}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <View style={{ flex: 1 }}>
      <AiPageHeader title="Apps" query={query} onQuery={setQuery} placeholder="Search apps" />
      {!ready ? (
        <SignedOutState icon={RiPuzzleLine} title="Sign in with Oxy to connect apps to Chat" />
      ) : (
        <ScrollView contentContainerStyle={{ alignItems: "center", paddingTop: 4, paddingBottom: 40 }}>
          <View style={[PAGE_COLUMN, { gap: 10 }]}>
            {outcome === "connected" && <Admonition type="tip">Connected. Chat can use it now.</Admonition>}
            {outcome === "failed" && <Admonition type="error">That app couldn't be connected. Try again.</Admonition>}
            <Admonition type="info">
              Your Oxy apps are built in. Inbox, Nilo and the rest of Oxy are part of Alia, under your Oxy account: Chat reads and acts in them without connecting anything.
            </Admonition>
            {loading ? <Loading variant="spinner" style={{ marginTop: 30 }} /> : shown.map((app) => <AppRow key={app.id} app={app} windowId={windowId} />)}
            <Text variant="body-2-regular" style={{ color: colors.textSecondary, marginTop: 6 }}>
              Chat acts in a connected app with the account you connected, and only when you ask. Alia keeps the connection; disconnect it here or in Alia.
            </Text>
            <View style={{ flexDirection: "row" }}>
              <Button appearance="plain" tone="accent" size="sm" onPress={() => useBrowser.getState().newTab(windowId, { url: ALIA_CONNECTORS_URL })}>
                More Connectors in Alia…
              </Button>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const NO_CONNECTIONS: Connection[] = [];
const broken = (c: Connection) => /error|expired|reauth/i.test(c.status);
const signedOut = (app: AppEntry, c: Connection) => app.kind === "mcp" && !/running|active/i.test(c.status);

function AppRow({ app, windowId }: { app: AppEntry; windowId: string }) {
  const { colors } = useTheme();
  const connections = useApps((s) => s.connections[app.id] ?? NO_CONNECTIONS);
  const configured = useApps((s) => (app.kind === "integration" ? s.configured[app.service] !== false : true));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Icon = APP_ICONS[app.icon] ?? RiPuzzleLine;

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
    <Card border="hairline" style={{ padding: 14 }} contentStyle={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: colors.backgroundTertiary }}>
          <Icon width={18} height={18} fill={colors.icon} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="body-semibold">{app.name}</Text>
          <Text variant="body-2-regular" style={{ color: colors.textSecondary }}>
            {app.description}
          </Text>
        </View>
        {!configured ? (
          <Text variant="caption-1-medium" style={{ color: colors.textTertiary }}>
            Not available yet
          </Text>
        ) : !app.oauth ? (
          <Button appearance="outline" tone="neutral" size="sm" onPress={() => useBrowser.getState().newTab(windowId, { url: ALIA_CONNECTORS_URL })}>
            Set Up in Alia…
          </Button>
        ) : connections.length && !many ? null : (
          <Button
            appearance={connections.length ? "outline" : "solid"}
            tone={connections.length ? "neutral" : "accent"}
            size="sm"
            loading={busy}
            disabled={busy}
            onPress={() => void connect()}
          >
            {busy ? "Opening…" : connections.length ? "Add Account" : "Connect"}
          </Button>
        )}
      </View>
      {connections.map((c) => (
        <View key={c.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 46 }}>
          <Text variant="body-2-regular" numberOfLines={1} style={{ flexShrink: 1 }}>
            {c.label}
          </Text>
          <Chip size="sm" variant="subtle" color={broken(c) ? "error" : signedOut(app, c) ? "warning" : "success"}>
            {broken(c) ? "Needs reconnecting" : signedOut(app, c) ? "Not signed in" : "Connected"}
          </Chip>
          <View style={{ flex: 1 }} />
          {signedOut(app, c) && (
            <Button appearance="outline" tone="neutral" size="sm" onPress={() => void connect()}>
              Reconnect
            </Button>
          )}
          <Button appearance="plain" tone="neutral" size="sm" disabled={busy} onPress={() => void remove(c)}>
            Disconnect
          </Button>
        </View>
      ))}
      {error ? (
        <Text variant="caption-1-medium" style={{ color: colors.error, paddingLeft: 46 }}>
          {error}
        </Text>
      ) : null}
    </Card>
  );
}
