import type { SystemCalendar } from "@astro-browser/shell";
import { openExternalURL } from "@astro-browser/shell";
import { Text, View } from "react-native";
import { CALENDAR_ACCOUNTS, CALENDAR_ADD_ACCOUNTS, CALENDAR_PRIVACY, CALENDAR_PRIVACY_URL, ON_MAC } from "../../../lib/device";
import { useTheme } from "../../../lib/theme";
import { connectCalendar, setCalendarHidden, useCalendar } from "../../../live/calendar";
import { ALERT_LEADS } from "../../../live/meetings";
import { updateCalendarSettings, useLive } from "../../../live/store";
import { useBrowser } from "../../../store/browser";
import { Button, Checkbox, Group, PopUp, Row, SectionHeader, Toggle } from "../controls";

export function CalendarPane() {
  const theme = useTheme();
  const settings = useLive((s) => s.calendar);
  const { access, calendars } = useCalendar();
  const autoGroup = useBrowser((s) => s.settings.autoGroupMeetingTabs);
  const connected = access === "fullAccess" || access === "fixture";
  const denied = access === "denied" || access === "restricted";
  const owned = calendars.filter((c) => c.owned);
  const others = calendars.filter((c) => !c.owned);

  return (
    <View>
      <SectionHeader
        title="Live Calendar"
        description={`Pin Google Calendar, Outlook, iCloud or Notion Calendar to see your day when you hover it, a countdown to your next meeting, and alerts with a Join button before meetings start. Events come from ${CALENDAR_ACCOUNTS}.`}
      />
      <Group>
        <Row
          anchor="calendar.access"
          description={
            access === "fixture"
              ? "Development build: using calendar-fixture.json"
              : connected
                ? `Connected · ${calendars.length === 1 ? "1 calendar" : `${calendars.length} calendars`}`
                : access === "restricted" && !CALENDAR_PRIVACY
                  ? "No calendar service found. Astro reads the calendars Evolution Data Server keeps, which GNOME Calendar and Evolution use."
                  : denied
                    ? `Astro isn't allowed to read your calendars. Allow it in ${CALENDAR_PRIVACY}.`
                    : "Not connected"
          }
        >
          {connected ? null : denied && CALENDAR_PRIVACY_URL ? (
            <Button title={ON_MAC ? "Open System Settings" : "Open Settings"} onPress={() => void openExternalURL(CALENDAR_PRIVACY_URL)} />
          ) : (
            <Button title={denied ? "Try Again" : "Connect Calendar…"} kind="primary" onPress={() => void connectCalendar()} />
          )}
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
        <Text style={{ marginTop: 12, fontSize: 12, color: theme.textSecondary }}>No calendars found. {CALENDAR_ADD_ACCOUNTS}</Text>
      ) : null}
    </View>
  );
}

function CalendarList({ title, calendars, hidden }: { title: string; calendars: SystemCalendar[]; hidden: string[] }) {
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
