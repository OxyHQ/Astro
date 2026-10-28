import { Symbol } from "@astro-browser/shell";
import { POWER_LEVELS } from "@alia.onl/sdk/model";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Text, View } from "react-native";
import { aliaErrorMessage, useAliaReady } from "../../../ai/alia/api";
import { ALIA_CONNECTORS_URL, APPS, connectUrl, disconnect, refreshApps, useApps, type AppEntry, type Connection } from "../../../ai/apps/apps";
import { BRIEF_TIMES, formatBriefTime, morningBriefOf } from "../../../ai/work/home";
import { setProfileMorningBrief, startMorningBrief } from "../../../ai/work/homeState";
import { focus } from "../../../lib/actions";
import { useTheme } from "../../../lib/theme";
import { signInWithOxy } from "../../../oxy/session";
import { useBrowser } from "../../../store/browser";
import { resolveWindowId } from "../../../store/model";
import { POWER_LEVEL_OPTIONS } from "../../chat/powerLevels";
import { openInternalPage } from "../../pages/urls";
import { Button, Group, PopUp, Row, SectionHeader, Toggle } from "../controls";

const NO_CONNECTIONS: Connection[] = [];

export function browserWindow(): string | null {
  const id = resolveWindowId(useBrowser.getState(), null);
  if (!id) return null;
  focus(id);
  return id;
}

export function openInBrowser(url: string) {
  const id = browserWindow();
  if (id) useBrowser.getState().newTab(id, { url });
}

const SIGNED_OUT = "Your Oxy account";

export function SignedOutRow({ description }: { description: string }) {
  return (
    <Group>
      <Row title={SIGNED_OUT} description={description}>
        <Button title="Sign In with Oxy…" kind="primary" onPress={() => void signInWithOxy()} />
      </Row>
    </Group>
  );
}

export function AppsPane() {
  const ready = useAliaReady();
  const loading = useApps((s) => s.loading && s.loadedAt === null);
  useEffect(() => {
    if (ready) void refreshApps();
  }, [ready]);

  return (
    <View>
      <SectionHeader
        anchor="apps.connections"
        description={`Chat uses these when you ask, through your Alia account, so a connection made here works in the Alia app too. Inbox, Nilo and the other Oxy apps need nothing: Chat already reaches them with your Oxy account.${loading ? " Loading your connections…" : ""}`}
      />
      {ready ? (
        <Group>
          {APPS.map((app) => (
            <AppConnectionRow key={app.id} app={app} />
          ))}
          <Row anchor="apps.manage">
            <Button title="Open Apps…" onPress={() => openInternalPage("apps", browserWindow())} />
          </Row>
        </Group>
      ) : (
        <SignedOutRow description="Sign in with your Oxy account to connect Gmail, Google Calendar, Notion and more to Chat." />
      )}
      <MorningBriefSection signedIn={!!ready} />
      <NewChatSection />
    </View>
  );
}

const broken = (c: Connection) => /error|expired|reauth/i.test(c.status);
const awaitingSignIn = (app: AppEntry, c: Connection) => app.kind === "mcp" && !/running|active/i.test(c.status);

function AppConnectionRow({ app }: { app: AppEntry }) {
  const theme = useTheme();
  const connections = useApps((s) => s.connections[app.id] ?? NO_CONNECTIONS);
  const configured = useApps((s) => (app.kind === "integration" ? s.configured[app.service] !== false : true));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(aliaErrorMessage(e, failure));
    } finally {
      setBusy(false);
    }
  };
  const connect = () =>
    run(async () => {
      if (!app.oauth) return openInBrowser(ALIA_CONNECTORS_URL);
      openInBrowser(await connectUrl(app));
    }, `${app.name} can't be connected right now.`);

  const first = connections[0];
  const needsSignIn = first && (broken(first) || awaitingSignIn(app, first));
  const detail = error
    ? error
    : !configured
      ? "Not available yet"
      : connections.length
        ? connections.map((c) => (broken(c) || awaitingSignIn(app, c) ? `${c.label} · needs sign-in` : c.label)).join(", ")
        : app.description;
  return (
    <Row
      icon={<Symbol name={app.icon} size={14} color={theme.icon} style={{ width: 20, height: 20 }} />}
      title={app.name}
      description={<Text style={{ fontSize: 11.5, marginTop: 2, color: error ? "#FF453A" : theme.textSecondary, lineHeight: 15 }}>{detail}</Text>}
    >
      {!configured ? null : needsSignIn ? (
        <Button title="Reconnect…" disabled={busy} onPress={() => void connect()} />
      ) : connections.length && app.kind !== "mcp" ? (
        <Button title="Add Account…" disabled={busy} onPress={() => void connect()} />
      ) : null}
      {configured && first ? (
        <Button title="Disconnect" kind="destructive" disabled={busy} onPress={() => void run(() => disconnect(app, first), "It couldn't be disconnected.")} />
      ) : configured ? (
        <Button title={app.oauth ? "Connect…" : "Set Up in Alia…"} disabled={busy} onPress={() => void connect()} />
      ) : null}
    </Row>
  );
}

export function runMorningBrief(profileId: string) {
  const id = browserWindow();
  if (id) startMorningBrief(id, profileId);
}

function MorningBriefSection({ signedIn }: { signedIn: boolean }) {
  const profiles = useBrowser(useShallow((s) => s.profileOrder.map((id) => s.profiles[id]!).filter(Boolean)));
  return (
    <>
      <SectionHeader
        anchor="apps.morningBrief"
        description="Once a day, after the time you pick, the New Tab page offers Start My Day: today's meetings, what needs you, where you left off and the headlines. Each profile has its own. It sends nothing until you open it."
      />
      <Group>
        {profiles.map((p) => (
          <MorningBriefRow key={p.id} profileId={p.id} name={profiles.length > 1 ? p.name : "Morning Brief"} signedIn={signedIn} />
        ))}
      </Group>
    </>
  );
}

export function MorningBriefControls({ profileId, signedIn }: { profileId: string; signedIn: boolean }) {
  const brief = morningBriefOf(useBrowser((s) => s.profiles[profileId]?.morningBrief));
  return (
    <>
      <PopUp
        value={brief.at}
        options={BRIEF_TIMES.map((t) => ({ value: t, title: `After ${formatBriefTime(t)}` }))}
        disabled={!brief.enabled}
        onChange={(at) => setProfileMorningBrief(profileId, { at })}
        minWidth={120}
      />
      <Button title="Start My Day" disabled={!signedIn} onPress={() => runMorningBrief(profileId)} />
      <Toggle value={brief.enabled} onChange={(enabled) => setProfileMorningBrief(profileId, { enabled })} />
    </>
  );
}

function MorningBriefRow({ profileId, name, signedIn }: { profileId: string; name: string; signedIn: boolean }) {
  return (
    <Row title={name} description={signedIn ? undefined : "Needs your Oxy account."}>
      <MorningBriefControls profileId={profileId} signedIn={signedIn} />
    </Row>
  );
}

const PLACEMENTS = [
  { value: "sidebar" as const, title: "Sidebar" },
  { value: "floating" as const, title: "Floating Window" },
];

function NewChatSection() {
  const placement = useBrowser((s) => s.settings.chatPlacement);
  const level = useBrowser((s) => s.settings.chatPowerLevel);
  const update = useBrowser((s) => s.updateSettings);
  const current = (POWER_LEVELS as readonly string[]).includes(level) ? level : "auto";
  return (
    <>
      <SectionHeader title="New Chat" />
      <Group>
        <Row anchor="apps.chatPlacement">
          <PopUp value={placement} options={PLACEMENTS} onChange={(v) => update({ chatPlacement: v })} minWidth={150} />
        </Row>
        <Row anchor="apps.chatPowerLevel">
          <PopUp value={current} options={POWER_LEVEL_OPTIONS.map((o) => ({ value: o.id, title: o.label }))} onChange={(v) => update({ chatPowerLevel: v })} minWidth={150} />
        </Row>
      </Group>
    </>
  );
}
