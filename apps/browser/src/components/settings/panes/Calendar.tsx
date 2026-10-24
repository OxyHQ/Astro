import { Text, View } from "react-native";
import { useTheme } from "../../../lib/theme";
import { connectCalendar, setCalendarHidden, useCalendar, type CalendarAccess } from "../../../live/calendar";
import { ALERT_LEADS, type CalendarInfo } from "../../../live/meetings";
import { signOutOfOxy, useOxySession, type OxyAccount } from "../../../oxy/session";
import { updateCalendarSettings, useLive } from "../../../live/store";
import { useBrowser } from "../../../store/browser";
import { Button, Checkbox, Group, PopUp, Row, SectionHeader, Toggle } from "../controls";

export function CalendarPane() {
  const theme = useTheme();
  const settings = useLive((s) => s.calendar);
  const { access, calendars } = useCalendar();
  const autoGroup = useBrowser((s) => s.settings.autoGroupMeetingTabs);
  const account = useOxySession((s) => s.account);
  const connected = access === "connected" || access === "fixture";
  const owned = calendars.filter((c) => c.owned);
  const others = calendars.filter((c) => !c.owned);

  return (
    <View>
      <SectionHeader
        title="Live Calendar"
        description="Pin Google Calendar, Outlook, iCloud or Notion Calendar to see your day when you hover it, a countdown to your next meeting, and alerts with a Join button before meetings start. Events come from your Nilo calendar: sign in with your Oxy account to connect it."
      />
      <Group>
        <Row anchor="calendar.access" description={accessDescription(access, account, calendars.length)}>
          {access === "connected" ? (
            <Button title="Sign Out" onPress={() => void signOutOfOxy()} />
          ) : access === "signedOut" ? (
            <Button title="Connect Calendar…" kind="primary" onPress={() => void connectCalendar()} />
          ) : null}
        </Row>
      </Group>

      <SectionHeader title="Meeting alerts" />
      <Group>
        <Row anchor="calendar.nextAlert">
          <PopUp value={settings.alertLead} options={ALERT_LEADS.map((l) => ({ value: l.value, title: l.title, separatorBefore: l.value === "start" }))} onChange={(v) => updateCalendarSettings({ alertLead: v })} minWidth={170} />
        </Row>
        <Row anchor="calendar.alertCondition">
          <PopUp
            value={settings.alertCondition}
            options={[
              { value: "always", title: "Always" },
              { value: "activeOnly", title: "Only When Active" },
            ]}
            disabled={settings.alertLead === "never"}
            onChange={(v) => updateCalendarSettings({ alertCondition: v })}
            minWidth={170}
          />
        </Row>
      </Group>

      <SectionHeader title="Pinned calendar" />
      <Group>
        <Row anchor="calendar.preview">
          <Toggle value={settings.showPreview} onChange={(v) => updateCalendarSettings({ showPreview: v })} />
        </Row>
        <Row anchor="calendar.timeToNext">
          <Toggle value={settings.showTimeToNext} onChange={(v) => updateCalendarSettings({ showTimeToNext: v })} />
        </Row>
      </Group>

      <SectionHeader title="Meetings" />
      <Group>
        <Row anchor="calendar.autoGroup">
          <Toggle value={autoGroup} onChange={(v) => useBrowser.getState().updateSettings({ autoGroupMeetingTabs: v })} />
        </Row>
      </Group>

      {calendars.length ? (
        <>
          <SectionHeader title="Active calendars" description="Meetings from unchecked calendars don't show or alert." />
          <Group>
            {owned.length ? <CalendarList title="My Calendars" calendars={owned} hidden={settings.hiddenCalendarIds} /> : null}
            {others.length ? <CalendarList title="Other Calendars" calendars={others} hidden={settings.hiddenCalendarIds} /> : null}
          </Group>
        </>
      ) : connected ? (
        <Text style={{ marginTop: 12, fontSize: 12, color: theme.textSecondary }}>No calendars found. In Nilo, a database with a Calendar view is a calendar.</Text>
      ) : null}
    </View>
  );
}

function accessDescription(access: CalendarAccess, account: OxyAccount | null, count: number): string {
  const calendarCount = count === 1 ? "1 calendar" : `${count} calendars`;
  switch (access) {
    case "fixture":
      return "Development build: using calendar-fixture.json";
    case "connected":
      return account ? `Signed in as ${account.name}${account.handle && account.handle !== account.name ? ` (@${account.handle})` : ""} · ${calendarCount}` : calendarCount;
    case "pending":
      return "Checking your Oxy account…";
    case "signedOut":
      return "Not connected. Connecting signs you in with your Oxy account.";
    case "unavailable":
      return "Sign in with Oxy isn't available in this build yet.";
  }
}

function CalendarList({ title, calendars, hidden }: { title: string; calendars: CalendarInfo[]; hidden: string[] }) {
  const theme = useTheme();
  return (
    <View style={{ paddingVertical: 6 }}>
      <Text style={{ fontSize: 11, fontWeight: "600", color: theme.textSecondary, marginLeft: 12, marginBottom: 2 }}>{title}</Text>
      {calendars.map((c) => (
        <Row
          key={c.id}
          icon={<View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c.color }} />}
          title={<Checkbox value={!hidden.includes(c.id)} onChange={(v) => setCalendarHidden(c.id, !v)} label={c.title} />}
          description={c.account}
        />
      ))}
    </View>
  );
}
