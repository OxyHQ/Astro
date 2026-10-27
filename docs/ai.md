# AI in Astro

Astro's AI follows Oxy's two paths (`~/Oxy/docs/kaana-inference.md`, `~/Oxy/oxy/docs/inference/request-routing.md`):

```text
one-shot feature   Astro -> kaana.ai (Oxy grants it) -> provider      apps/browser/src/ai/ (this page)
Chat               Astro -> Alia -> Oxy -> Kaana                      apps/browser/src/ai/chat/ (the Chat section)
```

Astro never holds a provider key, never names a model, never retries, fails over or switches models: Kaana retries
and fails over along the routes Oxy signed. Astro asks for a **power level** (`instant`), never a model name. Kaana's
only origin is `https://kaana.ai`.

Every AI feature needs Sign in with Oxy (`apps/browser/src/oxy/`). Signed out, each one falls back to what Astro did
before it existed, and offers sign-in where Dia shows the AI. It runs on every platform from the
same code; on macOS the engine call is in `AstroCoreEngineCalls.swift`.

## One-shot features

Bounded requests with no conversation state. One client, `ai/inference.ts` `oneShot(feature, { instructions, input,
maxOutputTokens })`: `POST https://kaana.ai/v1/responses` with `Authorization: Bearer oxy_session:<Astro's public client id>:<the Oxy
session's access token>` (Kaana forwards only the bearer to Oxy, so the client id rides in it; the token is read on every
request), and the body `{ model: "instant", input, maxOutputTokens, labels: { app: "astro", feature } }` (`ai/kaana.ts`;
Kaana's schema is strict, so the level goes in `model`, never `routingProfile`). At most two requests in flight.

What it does with a refusal (it never retries):

| Refusal | Astro |
|---|---|
| `authentication_failed`, `permission_denied`, `policy_violation`, `insufficient_scope`, `model_not_found`, `insufficient_balance`, `spending_limit_exceeded`, `commercial_permission_denied` | stops every one-shot feature until the account changes, and says why in Settings › Oxy Account › Astro AI |
| `quota_exceeded`, or any `retryable: true` code | pauses them for `retryAfterMs` (15 min if none is given) |
| anything else | that one feature falls back for that one item |

Incognito windows and profiles never send anything. The prompts, the parsers and the limits are in `ai/oneShotPrompts.ts`
(tests: `ai/oneShot.test.mjs`).

| Feature | When | Sends | Falls back to | Undo |
|---|---|---|---|---|
| **Tab group name + emoji** (`ai/groupNaming.ts`) | a group you haven't named, 1.5 s after its tabs settle (3 s while one is loading); again only when its set of sites changes (host + first path segment) | up to 12 titles and hosts; ≤ 64 tokens back | `store/groupNames.ts`, the title heuristic, which shows at once and stays while the AI thinks | a name you give always wins; clearing it brings the AI name back |
| **Pinned tab title** (`ai/pinnedTitles.ts`) | the moment you pin a tab whose title you haven't changed (waits up to 30 s for its title) | the title and the URL's host and path; ≤ 24 tokens back | the page's title | the tab menu's Reset Name |
| **Tidy Downloads** (`ai/tidyDownloads.ts`) | a download that finished while Astro watched it | the file name, its type and where it came from; ≤ 48 tokens back | the name Chrome gave it | the row's ↶ button and its menu's Restore Original Name |
| **YouTube summary** (`ai/pagePrompts.ts`, `ai/youtubeTranscript.ts`) | a video you've watched for 4 s, only while Chat exists; the transcript comes from the page: the caption track (`fmt=json3`) if YouTube serves it, else YouTube's own transcript panel, opened invisibly (opacity 0, out of the layout) and closed again, since YouTube now answers a bare `get_transcript` with `FAILED_PRECONDITION` and an empty `timedtext` without its proof-of-origin token | the title and the transcript, trimmed to 24 000 characters with a timestamp every 30 s; ≤ 512 tokens back | Chat reads the page itself | — |

The name, title and file name each arrive with a shimmer (`components/ai/TextShimmer.tsx`): a highlight copy of the
text swept left to right through a 56 pt soft-edged window in 1.1 s, white in dark mode. The group's emoji takes its
icon unless you picked one.

**Renaming a download** is an engine call, `ac_downloads_rename` (`ac_downloads.cc`, `{ id, name, tidy }`): Chrome's own
`DownloadItem::Rename`, so the file on disk and its history entry change together. It renames only a finished download,
to a bare file name (no path, no leading dot), and only to tidy it (`tidy: true`) or back to the name it had before; the
engine remembers that name on the item (`tidiedFrom`, reported with the download) for as long as Astro runs.

**Settings** › Oxy Account › Astro AI: one switch per feature (`aiGroupNames`, `aiPinnedTitles`, `aiTidyDownloads`,
`aiCommandBarChat`, `aiVideoSummaries`), all on. They're off and greyed while signed out.

## The command bar's router

`packages/core/src/inputRoute.ts` `routeInput(text)`: `site`, `search` or `chat`, decided on the device by rules, in
0.7 µs per call (`inputRoute.test.ts` measures it on every run), so the bar is never slower than before. A network
classifier, even at `instant`, would add a round trip to every keystroke. A URL is a site; search syntax (`site:`,
quotes, `-word`) is a search; a question (a wh-word or an auxiliary with a `?`, or with four words or more), an
assistant request ("can you…", "help me…", "explain…", "write me a…"), or nine words or more is Chat; the rest is a
search. English, Spanish, French, German and Italian.

With Chat available (`useChatRoute`), the bar gains a Chat row after the search row, and a `chat` input makes it the
first row, so ↩ asks Chat; ⌃⌘↩ (Ctrl+Alt+Enter on Windows and Linux) always asks Chat. Signed out, the first row stays
what it was and the Chat row reads "Sign in with Oxy to ask Chat"; choosing it signs in, then asks.

The promoted prompts are command-bar actions while Chat exists: Summarize This Page, Summarize This Video (YouTube),
Explain Like I'm 5, Quiz Me, Proofread (not on code hosts), Review Code (code hosts), Find Citations. Each opens Chat with
its prompt and the page; the video's comes with the pre-made summary and the transcript.

## Opening Chat from elsewhere: `ai/chatEntry.ts`

The one-shot features reach Chat through one hook, so neither side imports the other:

```ts
registerChatOpener((entry: ChatEntry) => void): () => void   // the Chat panel registers it, once per page
openChat(entry): boolean                                       // false while nothing is registered
type ChatEntry = { windowId; prompt; source: "commandBar" | "promptAction" | "videoSummary";
                   page?: { tabId; url; title; transcript?; summary? } }
```

While nothing is registered, the bar shows no Chat row and no prompt actions, and no summary is made.

## Production status

- The session lane on the Kaana grant API, with Astro's terms (`astro-kaana-session`: `responses`, `instant` only, 8 000
  input and 512 output tokens, USD 0.004 a request, 200 a person and 10 000 an application a UTC day, paid by Astro's
  owner), is OxyHQ/oxy#2006 with ADR 0050, option (b): Astro's session is Oxy's shared device session (ADR 0029), which
  names no application, so the bearer carries Astro's public client id and Oxy accepts it only for an application with
  reviewed `product_session` terms. Until it is deployed Kaana refuses the request, Astro stops the features for the
  session and Settings says so.
- Refusals: `authentication_failed` (401) is retried once, and only with a token the SDK has refreshed since; a second
  one stops the features. `quota_exceeded` (200 a person a day) and `rate_limited` pause them; everything else in the
  table above.
- On Windows and Linux the interface reaches `kaana.ai` through the engine's `astroFetch` (no cookies);
  `ac_account_fetch.cc` should list `kaana.ai` with the other account hosts.

## Testing

- `node --test packages/core/src/inputRoute.test.ts` (routes and latency), `npm test` in `apps/browser`
  (`ai/oneShot.test.mjs`: the request Kaana gets, no retries, the stop and the pause).
- In a running Windows or Linux build, `globalThis.astro.oneShot` holds the call log (`status.getState().calls`:
  feature, ms, Kaana's `latencyMs`, request id, model) and `setTestEndpoint(url, bearer)` for a fake Kaana. It takes only
  a localhost URL and its own bearer, used instead of the session's, and leaves the account alone. Never fake the
  `account` in `useOxySession` in an instance that can reach production: the calendar then polls production Nilo with no
  session (2026-10-27, a test did, and Nilo logged a refusal every 20–30 s). Run test instances with
  `--host-resolver-rules="MAP api.oxy.so ~NOTFOUND, MAP api.nilo.so ~NOTFOUND, MAP api.alia.onl ~NOTFOUND, MAP kaana.ai ~NOTFOUND"`.

## Chat

Chat is a conversation, so it goes through Alia: `Astro -> Alia (api.alia.onl/v1) -> Oxy -> Kaana`. Astro is an Alia
embedding host like Homiio or Mercaria (Alia `docs/agent-embedding.md`): it uses `@alia.onl/sdk`'s data layer
(`@alia.onl/sdk/runtime` and `/model`: the turn stream, Stop through `POST /v1/chat/turns/:id/cancel`, edit, regenerate,
retry, conversations) and draws the conversation itself with Bloom's own chat components: the panel is an `AppShell`
bounded panel holding `AiChatContainer` (`PageHeader` with a `ButtonGroup` and a `DropdownMenu`, `AiChatThread`, the
composer in its `PageFooter`) on a `Surface`; turns are `AiChatUserMessage` / `AiChatAssistantMessage` with
`AgentThinking`, `AgentLogToolCalls`, `Markdown`, `CodeBlock`, chart cards and `Chip`s; the composer is `ComposerPill` in a
`ComposerLoader`, with `SuggestionList` for @-mentions and `/`, `ChipRow` context chips, `ComposerBanner` while editing and
`Questionnaire` for tool approvals; history is `AgentChatHistory`, the empty chat an `EmptyState` with suggestions. Where
Bloom lacked something, it was added there (Bloom 15.54.0: `AgentChatHistory` search, sections, paging and
`framed={false}`; `Questionnaire` `detail` and `footer={false}`), never drawn in Astro. It names itself `app: "astro"`, so its conversations are labelled
and its history lists only them. Astro never names a model: the composer's level picker sends Alia's power levels
(`auto` … `ultra`, the SDK's `POWER_LEVELS`; saved as `chatPowerLevel`).

### Where it lives

| What | Where |
| --- | --- |
| Per-window state: open, placement, conversation, draft, context chips, asks | `ai/chat/state.ts`, `ai/chat/actions.ts` (no SDK import: runs on macOS too) |
| What the model is told about the browser (the turn's `clientContext`) | `ai/chat/clientContext.ts`, `ai/chat/pageContext.ts` |
| Tools Astro performs for Alia (host tools) and their approvals | `ai/chat/hostTools.ts`, `components/chat/ToolApproval.tsx` |
| The panel: header, thread, composer, history | `components/chat/` (`ChatPanel`, `ChatThread`, `ChatComposer`, `ChatHistory`, `ChatCode`) |
| Where the panel shows: sidebar, floating, tab | `components/chat/ChatSlots.tsx` (`ChatSidebar`, `ChatFloating` in `App.tsx`; `ChatTabSlot` for `astro://chat`): geometry and motion only; the material is `components/chat/ChatFrame.tsx`, a Bloom `Surface` that keeps one tree in every placement, so moving never remounts the panel |
| The SDK's provider and the portal (Windows, Linux) | `apps/webui/src/host/chat.tsx`, mounted inside `OxyRoot` by `OxyLayer` |
| Streaming over the engine | `apps/webui/src/host/fetch.ts` `engineStreamFetch` → `astroAccountStream` (`ac_account_fetch.cc`) |
| Ask in the page's context menu | `apps/webui/src/host/selectionMenu.ts` → `astroSelectionMenu` (`ac_selection_menu.cc`; the hook in `RenderViewContextMenu`, `engine/astrocore/apply.sh`) |
| Capture Area, Screenshot of Full Page | `components/chat/capture.ts`; the overlay `apps/webui/src/host/areaCapture.tsx`; `captureFullPage` in `apps/webui/src/shims/WebView.tsx` |
| Charts in replies | `components/chat/charts.ts` (Alia's `canvas` tool), `ChatChart.tsx` (Bloom's chart cards) |

The SDK hooks need the one `OxyProvider` (`useOxy`) and its React Query client, which live in the Oxy layer. So
`ChatHost` renders each window's panel inside that tree and portals it into a container `div` it owns; the slots
(sidebar, floating, chat tab) only register an element, and the container moves between them with `appendChild`. The
React tree never remounts, so a reply keeps streaming while the panel moves from the sidebar to a floating window or a
tab. The interface page can't fetch the web itself, so the turn's stream goes through the engine:
`astroAccountStream(id, url, method, headers, body)` answers with the status and headers, then fires
`astro-account-stream` events (`{ data: base64 }`, `{ done }`, `{ error }`); `astroAccountStreamCancel(id)` stops it.
Only the account hosts (`api.oxy.so`, `api.nilo.so`, `api.alia.onl`, loopback) are reachable this way. Every request
body crosses `chrome.send` as base64 of its bytes (`astroFetch`, `astroAccountFetch`, `astroAccountStream`), and the
engine uploads exactly those bytes: a body read as text turned a PDF's 56 810 bytes into 105 724. The page's CSP lets it
read `data:` and `blob:` URLs, which is how Oxy's SDK reads a file before it uploads it to Oxy Files.

### What it does

- **Opening it.** ⌘E / Ctrl+E (View › Chat) toggles it; ⌃⌘E (Focus Chat) moves the keyboard between the page and the
  composer; the toolbar's ✦ button at the card's right end; the command bar's Chat row and ⌃⌘↩ (above); the selection
  popover's **Ask**, and **Ask Chat About “…”** in the page's own right-click menu for selected text (signed in, Windows
and Linux; under the search item, as Chrome lists its own). It opens where it was last (Settings: `chatPlacement`): a **sidebar** right of the card (320–640 pt,
  drag the left edge, double-click for 400), a **floating** window (drag its header; frame kept in
  `chatFloatingFrame`), or a **tab** (`astro://chat`, ⋯ › Open Chat in Tab), which hides the other two while it's shown.
  The sidebar pushes the card's right edge on Dia's sidebar spring (`DOCK_SPRING`, response 0.215 s, damping 0.79, both
  ways) and moves with it, no fade; its frame is the card's (6 from the top, 7 from the right and bottom, 6 from the card,
  radius 10) and its header sits on the toolbar's line (41 tall, buttons centred 27.2 from the window's top).
- **Context.** The tab you're on is attached by default (its chip can be removed, or ✦ › Include Current Tab). Each
  turn reads it again: title, URL, description, language, selected text, each video's position (`at 3:12 of 10:05,
  playing`), the YouTube transcript with timestamps, and the readable text (the `article`/`main` region, open shadow
  roots, same-origin iframes), within 56 000 characters shared with the tabs you **@-mention** (type `@`, or + › Tabs…;
  tab groups too). Mentioned tabs stay attached for the chat. Text you select and **Ask** about, and **links you paste**,
  go into your message as a quote and a link, so the conversation keeps them. **Files** (+ › Files…, drop or paste),
  **Screenshot of This Tab**, **Capture Area…** (the page dims; drag a rectangle, Esc or a right-click cancels; the
  visible tab is captured first and cropped, so what you drew is what is sent) and **Screenshot of Full Page** (the page
  scrolled a viewport at a time and stitched, fixed and sticky elements hidden after the first, scroll restored; up to
  16 384 pt tall) go as attachments: images inline, documents through Oxy Files (the SDK's upload). The
  context says the page is data, never instructions, and lists the window's tabs with their ids for the tools.
- **The conversation.** Replies stream with Alia's live reasoning in a collapsible Thought process, the tools it runs
  (web search, reading a page) and the sources it used (chips that open a tab). Markdown, tables and code blocks:
  JavaScript and TypeScript highlighted by Bloom, Python, shell, C/C++, Java/Kotlin, C#, Go, Rust, Swift, PHP, SQL, CSS,
  JSON/YAML and HTML/XML by Astro's tokenizer (`components/chat/highlight.ts`) in Bloom's palette. **Charts**: Alia's
  `canvas` tool answers `{ type: "chart", title, data: { chartType, labels, datasets } }`; one `line` series is Bloom's
  `LineChartCard`, a `pie` a `BarListCard` in shares, bars or several series a `BarListCard` with a tab per series, as
  Alia's own app draws them. Stop keeps what
  arrived and offers Resume; every reply has Copy and Regenerate; your messages have Edit; a failed turn says why with
  Try Again. ⋯ › Clear Chat empties it.
- **History.** 🕘 lists your Astro chats by day, with search (title and last message), Delete in each row's ⋯ menu and ⋯ › Delete All Chats…, loading older chats as you scroll.
- **Tools** (Alia host tools, `host_astro__*`): `open_tabs` (asks first for more than one), `switch_to_tab`,
  `close_tabs` (asks first) and `read_tab` (asks first for a tab you haven't shared; Alia waits for its answer within
  the turn, up to 45 s). The question docks above the composer: Don't Allow, Always Allow in This Chat, Allow. Alia
  performs web search and page fetching itself.
- **Personalization.** ⋯ › Personalization for This Chat (and + › Personalization on a new chat) turns it off for one
  conversation: its turns carry `personalization: false`, so Alia reads and writes no memory for them.

### Alia's side

Alia (#913, SDK 22.2.0, in production since 2026-10-27) carries the two contracts Chat needed beyond the SDK's
original surface: host tools declared `awaitsResult`, whose action carries the `turnId` and whose answer the SDK posts to
`POST /v1/chat/turns/:turnId/host-results` (≤ 100 000 characters, 45 s, held in Postgres across replicas), and the
per-turn `personalization: false`. Alia #914 made the SDK's raw TypeScript type-check under Astro's
`noUncheckedIndexedAccess`.

### Skills

A skill is Alia's: an [Agent Skill](https://agentskills.io) in the person's Alia account (Alia `docs/skills.mdx`), so
the same skills run in Astro, the Alia app and any other client. Astro draws them and sends them; Alia stores, versions
and runs them.

| What | Alia | Astro |
| --- | --- | --- |
| Your skills (the shelf) | `GET /skills/installed`; `PATCH /skills/:id/install { enabled, autoInvoke }`; `DELETE …/install` | `astro://skills`, rows with **On** and **Automatic** |
| Gallery | `GET /skills?query=` (public skills: Alia's built-ins, the registry, and what people publish); `POST /skills/:id/install` | `astro://skills/gallery`: search, **Add**, **Try**, copy link |
| Skill Builder | `POST /skills/generate` (a draft `SKILL.md` from a sentence, saves nothing); `POST /skills`; `POST /skills/:id/versions` | `astro://skills/new`: describe it and **Write It for Me**, or write the name, `/command`, when to use it and the steps; **Save and Try** |
| Publish and share | `PATCH /skills/:id { visibility: "public" }` puts it in everyone's Gallery; the link is `https://alia.onl/skills/<id>` | the row's ⋯ › Publish to Gallery, Copy Link |
| Running one | the turn's `skillIds` (the SDK's `skillNames`): its instructions are prepended for that message | `/` in the composer, or a message that starts with `/name` |

- **`/` in the composer** lists your enabled skills, then Astro's own commands, filtered as you type (↑↓, ↩ or Tab picks,
  Esc closes). The pick becomes a chip above the composer; the message is sent with `skillNames: [name]` and the chip goes
  with it. Sending a chip with no text runs the skill on what's attached (the tab you're on, by default).
- **The command bar**: typing `/` lists the same rows (`/name — Title`); `/name words` runs it on the words with the
  current tab attached (`components/omnibox/chatRoute.ts` `slashBarRows`). The bar also has Skills, New Skill and Skills
  Gallery.
- **Automatic** (Dia's auto-fire) is the install's `autoInvoke`: Alia lists the skill in the turn's skill index and the
  model loads it (`loadSkill`) when a request matches its description, without the `/`. Off, the skill runs only when
  chosen.
- **Multi-step**: a skill's instructions are steps the model follows in one turn with its tools (read the page, search,
  ask, write); the builder's placeholder is a numbered list.
- **Save as Skill** on a message you sent opens the builder with it as the description and the steps.
- Signed out, the page offers Sign in with Oxy and `/` lists nothing. The pages call Alia through `ai/alia/api.ts`, the
  SDK's `useAliaApi()` (the person's Oxy session, its refresh and 401 replay), registered by `apps/webui/src/host/chat.tsx`
  so a page outside the SDK's provider can use it.

**Astro's commands** sit in the same list. They aren't Alia skills: they add what Astro knows to the turn's context.

| Command | Sends |
| --- | --- |
| `/research` | the message with `deepResearch: true` (Alia's deep research: many searches, a sourced report) |
| `/start-my-day` | **Start My Day**: today's meetings from Nilo (`live/calendar.ts`), pinned and open tabs, yesterday's pages; asks for the schedule, what needs you (Alia reaches Inbox and the other Oxy apps herself), where you left off and headlines |
| `/prep` | the next meeting (title, time, place, link, organizer, guests, description) and pages from the last two weeks whose title or address shares its words or guests |
| `/recap` | the last meeting and the pages you visited during it (5 min before to 10 min after) |

The calendar runs them for one meeting: hovering a meeting in the Live Calendar card shows **Prep** (or **Recap** once
it's over), and the next-meeting alert has **Prepare with Chat**; both send the command with that meeting's occurrence
instead of the next or last one.

The builders are pure (`ai/work/brief.ts`, tests in `brief.test.mjs`); `ai/work/gather.ts` reads the stores. Without a
calendar in Astro, the context says so and asks Alia to read it with her own calendar tools.

### Artifacts

An artifact is what Alia's `canvas` tool drew in a reply (Alia `docs/integrations.mdx` › The canvas), or a file
`generateFile` wrote: a **report** (`markdown`, or `artifact` without a language), a **deck** (`deck`), a **dashboard**
(`dashboard`), a **table** or **code**. Charts stay in the thread. Astro keeps no copy: the tool call's result is in
the conversation Alia stores, so an artifact tab reopens from its address after a restart.

| What | Where |
| --- | --- |
| Reading tool results into artifacts, versions, the revision request, Markdown | `ai/artifacts/artifacts.ts` (tests: `artifacts.test.mjs`) |
| The standalone page (exports, print) | `ai/artifacts/html.ts` |
| The card in the reply, the tab, the drawing of each kind | `components/artifacts/` (`ArtifactCard`, `ArtifactPage`, `ArtifactView`) |
| Exports, share | `components/artifacts/exports.ts` |

- **Opening.** A card under the reply (kind, title, size) opens it; a new one opens by itself when it arrives (the SDK's
  `onToolResult`). The tab is `astro://artifact?c=<conversation>&id=<tool call>`. Without it in memory (a restart), the
  page reads the conversation (`GET /v1/conversations/:id`) and takes the canvas results from its messages. The tab
  page is registered by the webui's Chat host (`components/pages/registry.ts`), inside Bloom's theme; macOS shows that
  Chat isn't available there yet.
- **Kinds.** A report is Bloom's Markdown; a deck is 16:9 slides with their notes and **Present** (one slide at a time,
  ← →, Esc); a dashboard is stat tiles, charts (bar, line, pie), tables and notes; a table and code are drawn as such.
- **Versions.** A later canvas call in the same chat with the same kind and title is a new version: the header says
  "Version 2 of 3" with ‹ ›, and a tab showing the old one moves to the new one.
- **Comments → batched edits.** Select text and **Comment**, or comment on the whole thing; the panel keeps them
  until **Apply Comments**, which sends one turn to that chat: the numbered comments with their quotes as the message,
  and the current version (its canvas data) with what to do in the turn's context: call the canvas again, same type and
  title, change nothing else. The tab moves to the new version when it arrives.
- **Share** mints Alia's link to the chat (`POST /v1/conversations/:id/share`, 7 days, `https://alia.onl/shared/<token>`)
  and copies it. Alia's shared page shows the conversation's text, never tool results, so the artifact itself isn't
  on it.
- **Export**: Save as PDF… (the artifact as a standalone page in a new tab, then the tab's Print; on Linux that is the
  system dialog's Print to File), Save as Image and Copy as Image (the page drawn through an SVG `foreignObject` onto a
  canvas at 2×, 900 pt wide), Save as Web Page (one self-contained `.html`, the counterpart of Dia's `.diaart`), Save
  as Markdown and Copy as Markdown. Saves go through Chrome's downloads, so they land in Downloads and the Downloads list.
- Decks and dashboards need Alia **#915** (the canvas tool's `deck` and `dashboard` types, validated, and the SDK
  drawing them in the Alia app). Until it ships, Alia can make reports, tables and code; Astro draws all five.

### Connected apps

`astro://apps` (`components/pages/AppsPage.tsx`, `ai/apps/apps.ts`): the apps Chat can use, through Alia's own
connections, so a connection made in Astro works in the Alia app and back.

| App | Alia | How it connects |
| --- | --- | --- |
| Inbox, Nilo and the other Oxy apps | first party (`oxy_<app>__*` tools) | nothing to connect: the page says so |
| Gmail | channel account (`POST /accounts/gmail/connect`, `GET /accounts`, `DELETE /accounts/:id`) | Google's consent in a tab; Alia's callback finishes it |
| Google Calendar, Google Drive | OAuth integrations (`GET /integrations/:service/oauth-url`, `POST /integrations/:service/complete`) | consent in a tab, finished by Astro (below) |
| Notion, GitHub, Linear | remote MCP connectors (`POST /mcp/install { registryId }`, `POST /mcp/:id/oauth/start`, `POST /mcp/oauth/complete`) | the same |
| Slack, and Alia's other connectors | stdio MCP servers that take a token | **Set Up in Alia…** opens `alia.onl/settings/connectors` |

- **Finishing OAuth.** Alia's callbacks hand the code to its web app (`alia.onl/settings/integrations?…int_oauth_code`,
  `…/settings/connectors?…mcp_oauth_code`), which finishes with the person's session. Astro watches its tabs for those
  addresses while a connect it started is pending (15 min, `ai/apps/oauthReturn.ts`), finishes the link itself with the
  Oxy session (Alia checks the state was issued to that person), and goes back to the Apps tab with "Connected". Only
  `https://alia.onl` matches.
- Each app lists its accounts (Gmail and Google can have several: **Add Account**), each with **Disconnect**; a
  connector that lost its sign-in says so and offers **Reconnect**. An integration Alia hasn't configured reads "Not
  available yet".
- These routes (`/skills`, `/integrations`, `/mcp`, `/accounts`, `/suggestions`) are Alia's own, outside `/v1`: they
  answer Alia's origins only to a browser, and Astro reaches them through the engine (`astroAccountFetch`, no Origin).
- **Write actions with approval** (Dia's "Always allow for this chat") aren't possible for these apps: Alia runs every
  tool under the person's authority and asks for nothing (Alia ADR 0020 §3: no approval events). Astro asks only for
  its own host tools (open and close tabs, read a tab).
- Entry points: the command bar's Connect Apps, the panel's ⋯ › Connected Apps….

### Suggestions

A new chat offers, above the composer (`ai/work/suggestions.ts`):

- **Proactive commands** from the calendar: *Prepare for "…"* when a meeting starts within the hour, *Recap "…"* within
  90 minutes after one ends, and *Start My Day* before noon until it has run that day (`ai/work/briefDay.ts`).
- The tab's prompts (Summarize This Page, Explain Like I'm 5, Quiz Me…).
- Alia's welcome suggestions (`POST /suggestions/welcome`), ranked for the tab: its title, host and description go as
  `clientContext` (4 KB), which Alia matches against each suggestion's tags.

### macOS

The same code as Windows and Linux. Every window root mounts one OxyProvider (`oxy/OxyWindowHost.tsx`, after the first
window, like the webui page's `host/oxy.tsx`), with Bloom's portal outlet teleported over the window and the Chat host
(`oxy/ChatHost.tsx`, shared with `apps/webui/src/host/chat.tsx`). The windows share one JS runtime, so each provider
publishes its session to `oxy/session.ts`, which shows the focused window's (sign-in and the account dialog open there),
and a sign-in or sign-out in one window reloads the others' providers, as storage events do between webui pages. The
Chat panel keeps one tree while it moves between the sidebar, the floating window and a tab: `Portal`/`PortalHost`
(`packages/shell`, `Portal.swift`) move its native views into the slot, as the webui host moves its DOM node. Streaming
is Expo's `expo/fetch`. On macOS Metro maps `expo-secure-store` to Astro's keychain (`oxy/secureStore.ts`) and
`expo-blur` to `VisualEffect` (`oxy/expoBlur.tsx`), which have no macOS pods; Bloom's classes compile from
`oxy/bloom.css` through NativeWind.

### Testing it

- `npm test` in `apps/browser`: `ai/chat/chat.test.mjs` (state, asks, context chips, personalization carry-over, pasted
  links, mentions, the turn context), `components/chat/highlight.test.mjs`, `components/chat/charts.test.mjs`,
  `ai/skills/skills.test.mjs` (slugs, the `/` list, `/name` parsing, the Alia routes the shelf calls),
  `ai/work/brief.test.mjs` (brief, prep, recap), `ai/artifacts/artifacts.test.mjs` (canvas results to artifacts,
  versions, addresses, the revision request, exports), `ai/apps/apps.test.mjs` (the apps list, connecting, finishing
  OAuth once and only after a connect) and `ai/work/suggestions.test.mjs`.
- A Windows or Linux build against a local stack: `ASTRO_OXY_API_URL`, `ASTRO_NILO_API_URL`, `ASTRO_ALIA_API_URL` and
  `ASTRO_KAANA_URL` move together (`apps/webui/vite.config.ts` refuses a mix, so a local session never reaches a
  production origin; point one you don't run at a closed port such as `http://127.0.0.1:9`). `globalThis.astro.chat` is the chat store and `astro.oxy` the session;
  `astro.skills`, `astro.apps` and `astro.artifacts` are the stores above.
  Launch it with `--host-resolver-rules="MAP api.oxy.so ~NOTFOUND, MAP api.nilo.so ~NOTFOUND, MAP api.alia.onl ~NOTFOUND,
  MAP kaana.ai ~NOTFOUND"` so nothing can reach production.
- Keys and the context menu are tested with real input on a private Xvfb (XTest): a CDP key event never reaches the
  engine's accelerator path, and Chromium's context menu is a native window CDP can't see. On 2026-10-27, with the page
  focused, Ctrl+E closed and reopened Chat and the page saw only the Control key; a right-click on selected text offered
  Ask Chat About “Photosynthesis”, which opened Chat with the selection attached.
