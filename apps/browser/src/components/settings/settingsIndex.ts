import { DEVICE, DEVICES, ON_MAC, SYSTEM_UNLOCK } from "../../lib/device";
import { prepare, type Searchable } from "./searchMatch";
import type { SettingsPane } from "./windows";

export const PANES: { id: SettingsPane; title: string; icon: string }[] = [
  { id: "account", title: "Oxy Account", icon: "person.crop.circle" },
  { id: "general", title: "General", icon: "gearshape" },
  { id: "profiles", title: "Profiles", icon: "person.2" },
  { id: "apps", title: "Apps", icon: "app.badge" },
  { id: "skills", title: "Skills", icon: "sparkles" },
  { id: "personalization", title: "Personalization", icon: "face.smiling" },
  { id: "sync", title: "Sync", icon: "arrow.triangle.2.circlepath" },
  { id: "tabs", title: "Tabs", icon: "square.on.square" },
  { id: "appearance", title: "Appearance", icon: "circle.lefthalf.filled" },
  { id: "privacy", title: "Privacy & Security", icon: "hand.raised" },
  { id: "passwords", title: "Passwords", icon: "key" },
  { id: "autofill", title: "Autofill", icon: "creditcard" },
  { id: "extensions", title: "Extensions", icon: "puzzlepiece.extension" },
  { id: "search", title: "Search Engine", icon: "magnifyingglass" },
  { id: "shortcuts", title: "Keyboard Shortcuts", icon: "keyboard" },
  { id: "liveFolders", title: "Live Folders", icon: "dot.radiowaves.left.and.right" },
  { id: "calendar", title: "Calendar", icon: "calendar" },
  { id: "advanced", title: "Advanced", icon: "slider.horizontal.3" },
];

type Row = { title: string; description?: string; keywords?: string[] };
type Section = { section: string; rows: Record<string, Row> };

const APP = "Astro";

const ROWS: Record<SettingsPane, Section[]> = {
  account: [
    {
      section: "Oxy Account",
      rows: {
        account: {
          title: "Oxy account",
          description: `One account for all of ${APP}, in every window and profile.`,
          keywords: ["sign in", "sign out", "log in", "log out", "login", "oxy", "user", "username", "avatar", "email", "manage account"],
        },
      },
    },
    {
      section: "Uses your Oxy account",
      rows: { calendar: { title: "Calendar", description: "Your Nilo calendar: the pinned calendar, meeting alerts and meeting tab groups.", keywords: ["nilo", "meetings"] } },
    },
    {
      section: "Astro AI",
      rows: {
        aiGroupNames: { title: "Name tab groups", description: "Names a group you haven’t named from its tabs, with an emoji.", keywords: ["ai", "auto name", "group name", "emoji"] },
        aiPinnedTitles: { title: "Tidy pinned tab titles", description: "Shortens a tab’s title when you pin it. Reset Name brings the original back.", keywords: ["ai", "rename", "pinned", "tidy tab titles"] },
        aiTidyDownloads: { title: "Tidy downloads", description: "Gives a finished download a clear name. Undo restores the original.", keywords: ["ai", "rename files", "downloads", "tidy"] },
        aiCommandBarChat: { title: "Send questions to Chat", description: `The command bar sends a question to Chat and a site or a search where it belongs. ${ON_MAC ? "⌃⌘↩" : "Ctrl+Alt+Enter"} always asks Chat.`, keywords: ["ai", "router", "chat", "command bar", "ask"] },
        aiVideoSummaries: { title: "Summarize YouTube videos", description: "Prepares a summary of the video you’re watching from its transcript, for Chat.", keywords: ["ai", "youtube", "transcript", "summary"] },
        agentSites: { title: "Sites Alia can use", description: "Alia clicks and types on these sites without asking first. It still asks before buying, sending, deleting or submitting.", keywords: ["ai", "agent", "computer use", "act", "permissions", "sites"] },
        aiManaged: { title: "Managed by your organization", description: "Your organization’s policy decides which sites Chat may read and whether Alia may act in your tabs.", keywords: ["ai", "policy", "dlp", "organization", "enterprise", "managed"] },
        aiSharedSites: { title: "Sensitive sites you share", description: "Banking, health and password sites stay out of Chat unless you share them. These you always share.", keywords: ["ai", "privacy", "sensitive", "banking", "health", "dlp", "share"] },
      },
    },
  ],
  general: [
    {
      section: "General",
      rows: {
        defaultBrowser: { title: "Default browser", description: `Make ${APP} your default browser.`, keywords: ["default", "set as default", "links"] },
        openAtLogin: { title: `Open ${APP} at login`, keywords: ["startup", "launch", "login items", "boot"] },
        warnBeforeQuitting: { title: "Warn before quitting", description: `Asks before ${APP} quits with ⌘Q.`, keywords: ["quit", "confirm", "cmd q"] },
        warnBeforeClosingWindow: {
          title: "Warn before closing a window with multiple tabs",
          description: "Asks before ⇧⌘W or the close button closes its tabs.",
          keywords: ["close window", "confirm"],
        },
        openLinksFrom: { title: "Open links from other apps in", keywords: ["little astro", "external links", "mini window", "discord", "slack", "mail"] },
      },
    },
    {
      section: `When quitting ${APP}:`,
      rows: {
        windowsAndTabs: {
          title: "Windows and tabs",
          description: "What you see the next time you open it. Closed windows stay in History › Recently Closed.",
          keywords: ["restore", "session", "reopen", "preserve tabs", "start fresh"],
        },
      },
    },
    {
      section: "Command bar",
      rows: { commandBarPreference: { title: "When input looks like a website", keywords: ["omnibox", "address", "url", "search", "website first"] } },
    },
    {
      section: "Updates",
      rows: {
        updateChecks: { title: "Check for updates automatically", keywords: ["update", "sparkle"] },
        autoUpdate: { title: `Automatically update ${APP}`, description: "Downloads updates in the background and installs them the next time it restarts.", keywords: ["update", "install"] },
        updateChannel: { title: "Update channel", description: "Nightly gets every fix first. Switching back to Stable never downgrades.", keywords: ["nightly", "stable", "beta"] },
        checkNow: { title: "Check for updates now", keywords: ["version", "update", "about"] },
      },
    },
    {
      section: "Import",
      rows: {
        importBrowser: {
          title: "Import from another browser",
          description: "Bookmarks, history, passwords, tabs and Arc spaces from Chrome, Arc, Safari, Firefox and more.",
          keywords: ["migrate", "switch", "transfer"],
        },
      },
    },
  ],
  profiles: [
    { section: "New windows open with", rows: { defaultProfile: { title: "Default profile", description: "Used for new windows. Links from other apps open in the profile you used last.", keywords: ["new window"] } } },
    { section: "Profiles", rows: { list: { title: "Profiles", description: "Drag to reorder. ⌃1–⌃9 switch to the first nine.", keywords: ["create profile", "new profile", "delete profile", "reorder", "work", "personal"] } } },
  ],
  apps: [
    {
      section: "Connected apps",
      rows: {
        connections: {
          title: "Connected apps",
          description: "Apps Chat can use when you ask, through your Alia account: your mail, calendar, documents and issues.",
          keywords: ["connect", "connectors", "integrations", "gmail", "google calendar", "google drive", "notion", "github", "linear", "slack", "disconnect", "reconnect"],
        },
        manage: { title: "Apps page", description: "Every app, with its accounts, on its own page.", keywords: ["manage apps", "connect apps"] },
      },
    },
    {
      section: "Morning Brief",
      rows: {
        morningBrief: {
          title: "Morning Brief",
          description: "Each profile offers Start My Day on its New Tab page once a day, after the time you pick: your meetings, what needs you, where you left off and headlines.",
          keywords: ["start my day", "brief", "daily", "morning", "summary", "new tab"],
        },
      },
    },
    {
      section: "New Chat",
      rows: {
        chatPlacement: { title: "Open Chat in", description: "Where Chat opens until you move it.", keywords: ["sidebar", "floating", "window", "placement"] },
        chatPowerLevel: { title: "Power level", description: "What a new chat starts with. Change it for one chat in its composer.", keywords: ["model", "auto", "instant", "pro", "ultra", "thinking"] },
      },
    },
  ],
  skills: [
    {
      section: "Your skills",
      rows: {
        list: {
          title: "Skills",
          description: "Saved instructions you run with / in Chat or the command bar. Automatic ones run when a request matches them.",
          keywords: ["slash commands", "shortcuts", "prompts", "automatic", "auto invoke", "enable"],
        },
      },
    },
    {
      section: "Astro's commands",
      rows: {
        commands: { title: "Astro's commands", description: "Built in: /research, /start-my-day, /prep and /recap.", keywords: ["research", "start my day", "prep", "recap", "meeting"] },
      },
    },
    {
      section: "Add skills",
      rows: {
        gallery: { title: "Skills Gallery", description: "Skills from Alia and the people who publish theirs.", keywords: ["browse skills", "install", "add skill"] },
        builder: { title: "New Skill", description: "Describe it and Astro writes it, or write it yourself.", keywords: ["create skill", "skill builder", "write skill"] },
      },
    },
  ],
  personalization: [
    {
      section: "About you",
      rows: {
        occupation: { title: "What you do", keywords: ["occupation", "job", "role", "work"] },
        location: { title: "Where you are", keywords: ["location", "city", "country"] },
        bio: { title: "About you", description: "Anything Chat should know about you to help better.", keywords: ["bio", "custom instructions", "context", "profile"] },
        interests: { title: "Interests", description: "Separated by commas.", keywords: ["topics", "hobbies"] },
      },
    },
    {
      section: "How Chat answers",
      rows: {
        language: { title: "Language", description: "The language Chat answers in.", keywords: ["response language", "translate", "english", "spanish"] },
        tone: { title: "Tone", keywords: ["style", "personality", "friendly", "professional", "concise", "casual"] },
        responseLength: { title: "Answer length", keywords: ["response length", "short", "long", "verbose", "brief answers"] },
      },
    },
    {
      section: "Memory",
      rows: {
        autoSave: { title: "Remember things from chats", description: "Chat saves what it learns about you, like your role or the people you work with.", keywords: ["memory", "save memories", "learn"] },
        recall: { title: "Use what Chat remembers", description: "Chat reads its memories of you when it answers. Turn personalization off for one chat in its ⋯ menu.", keywords: ["memory", "recall", "personalized"] },
      },
    },
    {
      section: "Saved memories",
      rows: {
        memories: { title: "Saved memories", description: "What Chat remembers about you. Forget any of them.", keywords: ["forget", "delete memory", "memories"] },
      },
    },
  ],
  sync: [
    {
      section: "Sync",
      rows: {
        sync: { title: "Sync", description: `Sync your profiles, bookmarks, history, tabs, passwords, extensions and settings across your ${DEVICES}.`, keywords: ["icloud", "recovery phrase", "devices", "turn on sync", "end to end", "encrypted"] },
        folder: { title: "Sync folder", keywords: ["icloud drive", "dropbox", "folder"] },
      },
    },
  ],
  tabs: [
    { section: "Tab layout", rows: { layout: { title: "Tab layout", description: "In the sidebar or across the top of the window.", keywords: ["vertical tabs", "horizontal tabs", "top tabs", "sidebar"] } } },
    {
      section: "Tab layout",
      rows: {
        hideToolbarWhileScrolling: {
          title: "Hide toolbar while scrolling",
          description: "Scrolling down tucks the toolbar into a thin strip with the site's name. Scroll up, or click the strip, to bring it back.",
          keywords: ["auto hide", "compact"],
        },
        showSidebarButton: { title: "Show sidebar button", description: "⌘S and View › Auto-Hide Tabs still hide and show the sidebar.", keywords: ["toggle sidebar"] },
      },
    },
    {
      section: "General",
      rows: {
        newTabOpens: {
          title: "New tab opens",
          description: "With Command Bar, ⌘T and New Tab open the command bar over the page, as in Arc. The tab appears when you pick a result; Esc leaves everything as it was.",
          keywords: ["new tab page", "command bar", "cmd t"],
        },
        newTabPosition: { title: "Add new tabs to the top", keywords: ["new tab position", "left", "bottom", "order"] },
        warnBeforeClosingLastTab: { title: "Warn before closing last tab in a Profile", keywords: ["confirm", "close tab"] },
        tabReorderHaptics: { title: "Haptic feedback when reordering tabs", keywords: ["trackpad", "vibration", "drag"] },
        extendWebsiteColor: { title: "Extend website color into tab bar", keywords: ["theme color", "tint", "colour"] },
        sidebarMediaControls: {
          title: "Show media controls in the sidebar",
          description: "When a tab you're not looking at plays sound, a player appears at the bottom of the sidebar. Pinned tabs that are playing show one when you hover them.",
          keywords: ["music", "player", "audio", "now playing"],
        },
        autoPictureInPicture: {
          title: "Automatic Picture in Picture",
          description: "A video or call you're watching pops out when you switch tabs or leave the window, and returns when you come back.",
          keywords: ["pip", "video", "floating", "mini player"],
        },
        ...(ON_MAC && {
          videoUpscaling: {
            title: "Video upscaling",
            description: "Sharpens low-resolution videos shown larger than they are, on Apple silicon. Only in the tab you're watching, never in the background, in Low Power Mode or when the Mac runs hot.",
            keywords: ["super resolution", "sharpen", "video quality"],
          },
        }),
      },
    },
    {
      section: "Tab groups",
      rows: {
        cmdClickCreatesTabGroup: { title: "⌘-clicking links creates tab groups", keywords: ["command click", "cmd click"] },
        optShiftClickOpensInGroup: {
          title: "⌥⇧-click opens tab in group",
          description: "⌥⇧-click a tab to open it in a group with the current tab. (⌥⇧-clicking a link opens it in a split.)",
          keywords: ["option shift click", "split"],
        },
        autoGroupMeetingTabs: { title: "Automatically group tabs for meetings", keywords: ["calendar", "zoom", "meet", "call"] },
      },
    },
    {
      section: "Clean up",
      rows: {
        cleanUp: {
          title: "Clean up tabs I haven't used in",
          description: "Closes tabs you haven't used (and duplicates) automatically, like the tab menu's Clean Up Daily.",
          keywords: ["archive", "auto close", "inactive tabs", "duplicates"],
        },
      },
    },
  ],
  appearance: [
    {
      section: "Appearance Theme",
      rows: { theme: { title: "Appearance Theme", description: "Also in View › Appearance. Incognito windows are always dark.", keywords: ["dark mode", "light mode", "automatic", "night", "system"] } },
    },
    { section: "Address Bar", rows: { addressBar: { title: "Address Bar", description: "In the toolbar or in the sidebar.", keywords: ["url bar", "location bar", "toolbar"] } } },
    ...(ON_MAC ? [{ section: "App Icon", rows: { appIcon: { title: "App Icon", description: "Shown in the Dock and the app switcher. The Dock keeps it after you quit.", keywords: ["dock icon", "logo"] } } }] : []),
  ],
  privacy: [
    {
      section: "Content blocking",
      rows: {
        blockAds: { title: "Block ads", keywords: ["ad blocker", "adblock", "ublock origin", "easylist"] },
        blockTrackers: { title: "Block trackers", keywords: ["tracking", "easyprivacy", "fingerprinting"] },
        blockCookieBanners: { title: "Block cookie banners", keywords: ["cookies", "consent", "gdpr", "popups"] },
        filterLists: {
          title: "Advanced Settings",
          description: "Block common components found across the web by using additional rules and filters.",
          keywords: ["filter lists", "annoyances", "malware", "regional", "ad block settings"],
        },
      },
    },
    {
      section: "Site permissions",
      rows: {
        sitePermissions: {
          title: "Site permissions",
          description: "Pop-ups, camera, location and other permissions you've set for sites.",
          keywords: ["camera", "microphone", "location", "notifications", "popups", "cookies", "javascript", "clear site data", "website settings"],
        },
      },
    },
    { section: "Apps allowed to open links", rows: { appLinks: { title: "Apps allowed to open links", description: "Sites that open another app without asking first.", keywords: ["external apps", "protocol handlers", "zoom links"] } } },
    {
      section: "Crash reports and usage",
      rows: {
        shareDiagnostics: { title: "Share anonymous crash reports and usage stats", keywords: ["telemetry", "analytics", "diagnostics", "crash"] },
        whatsSent: { title: "What's Sent", description: `Every field, and what never leaves this ${DEVICE}.`, keywords: ["telemetry", "data collection"] },
      },
    },
  ],
  passwords: [
    {
      section: "Passwords",
      rows: {
        offerToSave: {
          title: "Offer to save and fill passwords",
          description: "Offers to save a login after you sign in, and suggests saved ones when you click a login field.",
          keywords: ["password manager", "logins", "credentials", "keychain"],
        },
        importPasswords: { title: "Import passwords", description: "From a CSV exported by Chrome, Safari, Firefox, 1Password, Bitwarden…", keywords: ["csv", "logins"] },
        exportPasswords: { title: "Export passwords", description: "To a CSV file. Anyone who can open the file can read your passwords.", keywords: ["csv", "backup", "logins"] },
        managerApps: { title: "Password manager apps", keywords: ["1password", "bitwarden", "keepassxc", "proton pass"] },
      },
    },
  ],
  autofill: [
    {
      section: "Autofill",
      rows: {
        addresses: { title: "Save and fill addresses", description: "Names, addresses, email addresses and phone numbers.", keywords: ["forms", "contact", "phone", "email"] },
        cards: { title: "Save and fill credit cards", description: `Filling in or showing a card number asks for ${ON_MAC ? "Touch ID or your password" : SYSTEM_UNLOCK}.`, keywords: ["payment", "debit card", "forms"] },
      },
    },
    { section: "Addresses", rows: { addressList: { title: "Addresses", keywords: ["add address", "saved addresses"] } } },
    { section: "Credit Cards", rows: { cardList: { title: "Credit Cards", keywords: ["add card", "saved cards", "payment"] } } },
  ],
  extensions: [
    { section: "Extensions", rows: { installed: { title: "Extensions", description: "Add features to Astro with extensions from the Chrome Web Store. Each profile has its own.", keywords: ["add ons", "plugins", "installed"] } } },
    {
      section: "Add extensions",
      rows: {
        webStore: { title: "Chrome Web Store", description: "Browse the store; its Add to Astro button installs here.", keywords: ["install extension"] },
        addLink: { title: "Add from a link", description: "Paste a Chrome Web Store link or extension ID.", keywords: ["install extension", "url"] },
        unpacked: { title: "Load unpacked extension", description: "For developers: load an extension folder with a manifest.json.", keywords: ["developer mode"] },
      },
    },
  ],
  search: [
    { section: "Default search engine", rows: { defaultEngine: { title: "Default search engine", description: "Used by the command bar and the New Tab page.", keywords: ["google", "duckduckgo", "bing", "kagi", "ecosia"] } } },
    {
      section: "Other search engines",
      rows: { otherEngines: { title: "Other search engines", description: "Type a shortcut and press Tab in the command bar to search a site directly.", keywords: ["custom search", "site search", "keyword"] } },
    },
    { section: "Suggestions", rows: { suggestions: { title: "Show search suggestions", description: "Sends what you type to your search engine to suggest searches.", keywords: ["autocomplete"] } } },
  ],
  shortcuts: [
    { section: "Keyboard Shortcuts", rows: { actions: { title: "Customize keyboard shortcuts", keywords: ["hotkeys", "keybindings", "remap", "menu shortcuts"] } } },
    { section: "Extensions", rows: { extensionShortcuts: { title: "Extension shortcuts", description: "Shortcuts that extensions add, like opening their popup.", keywords: ["hotkeys"] } } },
  ],
  liveFolders: [
    {
      section: "Live folders",
      rows: { folders: { title: "Live folders", description: "Live folders refresh every few minutes; items open as tabs that stay in the folder.", keywords: ["new live folder"] } },
    },
    {
      section: "Pull Requests",
      rows: {
        github: { title: "GitHub", description: "Your open pull requests and the ones waiting for your review, with checks and conflicts.", keywords: ["pull requests", "connect"] },
        bitbucket: { title: "Bitbucket", description: "Your open pull requests on Bitbucket Cloud, with build status.", keywords: ["pull requests", "connect"] },
      },
    },
    {
      section: "Documents",
      rows: {
        notion: { title: "Notion", description: "Pages recently edited in your workspace.", keywords: ["documents", "connect"] },
        confluence: { title: "Confluence", description: "Pages you created, edited or watch.", keywords: ["documents", "atlassian", "connect"] },
        gdrive: { title: "Google Drive", description: "Documents recently changed in your Drive.", keywords: ["documents", "docs", "connect"] },
      },
    },
  ],
  calendar: [
    {
      section: "Live Calendar",
      rows: {
        access: { title: "Nilo calendar", keywords: ["connect calendar", "sign in with oxy", "nilo", "oxy account"] },
        subscribe: { title: "Google, Outlook or iCloud calendar", description: "Subscribe to it in Nilo with its secret iCal address.", keywords: ["add calendar", "subscribe", "ical", "ics", "google calendar", "outlook", "icloud"] },
      },
    },
    {
      section: "Meeting alerts",
      rows: {
        nextAlert: { title: "Show next meeting alert", keywords: ["reminder", "notification", "join"] },
        alertCondition: { title: "Show alerts", description: "With Always, alerts also appear in Notification Center while you're in another app.", keywords: ["notifications"] },
      },
    },
    {
      section: "Pinned calendar",
      rows: {
        preview: { title: "Show calendar preview", description: "Hover a pinned calendar tab to see the rest of your day.", keywords: ["hover"] },
        timeToNext: { title: "Show time to next meeting", description: "A badge on the pinned calendar tab within the hour before a meeting.", keywords: ["countdown", "badge"] },
      },
    },
    {
      section: "Meetings",
      rows: {
        autoGroup: {
          title: "Automatically group tabs for meetings",
          description: "Joining a call makes a tab group for it; links you open from the meeting join the group.",
          keywords: ["zoom", "meet", "call", "tab groups"],
        },
      },
    },
  ],
  advanced: [
    {
      section: "Browsing",
      rows: {
        showFullUrl: { title: "Show full URL in the address bar", description: "Instead of the site alone.", keywords: ["address", "url", "https"] },
        warnMovingTabs: { title: "Warn before moving tabs between profiles", description: "Some site data doesn't come along.", keywords: ["confirm"] },
        bookmarksImport: { title: "Show the Import bookmarks button", description: "On an empty bookmarks bar.", keywords: ["bookmarks bar"] },
      },
    },
    { section: "Performance", rows: { batterySaver: { title: "Battery Saver", keywords: ["energy", "low power mode", "performance", "power"] } } },
    {
      section: "Data",
      rows: {
        history: { title: "History", description: "Every page you visited, by day.", keywords: ["browsing history"] },
        downloads: { title: "Downloads", description: "Files you downloaded, with where they're saved.", keywords: ["files"] },
      },
    },
    {
      section: "Command line",
      rows: {
        cliControl: { title: "Let the astro command control Astro", keywords: ["cli", "terminal", "devtools", "automation", "remote debugging"] },
        cliInstall: { title: "The astro command", keywords: ["cli", "terminal", "install"] },
      },
    },
    {
      section: "Web engine",
      rows: {
        chromium: { title: "Chromium", keywords: ["engine", "version", "astrocore"] },
        widevine: { title: "Widevine (protected video)", keywords: ["drm", "netflix", "disney", "spotify"] },
      },
    },
    {
      section: "Source and licenses",
      rows: {
        source: { title: "Source code", description: "Astro is open source under the Apache License 2.0.", keywords: ["github", "open source"] },
        licenses: { title: "Licenses", description: "Every open-source part of the engine, with its copyright and license.", keywords: ["credits", "legal"] },
      },
    },
  ],
};

export type SettingEntry = Searchable & { pane: SettingsPane };

const paneTitle = (pane: SettingsPane) => PANES.find((p) => p.id === pane)!.title;

export const SETTINGS: SettingEntry[] = PANES.flatMap(({ id: pane }) =>
  ROWS[pane].flatMap(({ section, rows }) =>
    Object.entries(rows).map(([key, row]) => ({ id: `${pane}.${key}`, pane, paneTitle: paneTitle(pane), section, ...row })),
  ),
);

const byId = new Map(SETTINGS.map((s) => [s.id, s]));

export function setting(id: string): SettingEntry {
  const entry = byId.get(id);
  if (!entry) throw new Error(`no setting ${id}`);
  return entry;
}

export const SETTINGS_INDEX = prepare(SETTINGS);
