import { Text, View } from "react-native";
import { useTheme } from "../../../lib/theme";
import { connectCalendar, openNiloCalendarSubscriptions, setCalendarHidden, useCalendar, type CalendarAccess } from "../../../live/calendar";
import { ALERT_LEADS, type CalendarInfo } from "../../../live/meetings";
import { useOxySession, type OxyAccount } from "../../../oxy/session";
import { updateCalendarSettings, useLive } from "../../../live/store";
import { useBrowser } from "../../../store/browser";
import { Button, Checkbox, Group, PopUp, Row, SectionHeader, Toggle } from "../controls";
import { useSettingsNav } from "../windows";

export function CalendarPane() {
  const theme = useTheme();
  const settings = useLive((s) => s.calendar);
  const { access, calendars } = useCalendar();
  const autoGroup = useBrowser((s) => s.settings.autoGroupMeetingTabs);
  const account = useOxySession((s) => s.account);
  const go = useSettingsNav((s) => s.go);
  const connected = access === "connected" || access === "fixture";
  const owned = calendars.filter((c) => c.owned);
  const subscribed = calendars.filter((c) => c.subscribed);
  const others = calendars.filter((c) => !c.owned && !c.subscribed);

  return (
    <View>
      <SectionHeader
        title="Live Calendar"
        description="Your meetings come from your Nilo calendar, through your Oxy account. Hover a pinned calendar tab, like Google Calendar, Outlook or Notion Calendar, to see the rest of your day, with a countdown to your next meeting. Alerts with a Join button come before meetings start."
      />
      <Group>
        <Row anchor="calendar.access" description={accessDescription(access, account, calendars.length)}>
          {access === "signedOut" ? <Button title="Sign In with Oxy…" kind="primary" onPress={() => void connectCalendar()} /> : null}
          {access !== "fixture" ? <Button title="Oxy Account…" onPress={() => go("account")} /> : null}
        </Row>
        {access === "connected" ? (
          <Row title="Google, Outlook or iCloud calendar" description="Subscribe to it in Nilo with its secret iCal address. Nilo keeps it up to date, read-only.">
            <Button title="Add Calendar…" onPress={openNiloCalendarSubscriptions} />
          </Row>
        ) : null}
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
            {subscribed.length ? <CalendarList title="Subscribed Calendars" calendars={subscribed} hidden={settings.hiddenCalendarIds} /> : null}
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
      return account ? `${calendarCount} from ${account.name}${account.handle && account.handle !== account.name ? ` (@${account.handle})` : ""}’s Oxy account` : calendarCount;
    case "pending":
      return "Checking your Oxy account…";
    case "signedOut":
      return "Sign in with your Oxy account to show your Nilo calendar. It’s the same account for all of Astro.";
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
          description={c.subscribed ? `${c.account} · subscribed, read-only` : c.account}
        />
      ))}
    </View>
  );
}
