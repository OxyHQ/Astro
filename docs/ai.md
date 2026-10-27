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
before it existed, and offers sign-in where Dia shows the AI. macOS can't mount the Oxy SDK yet (Legacy architecture),
so today the AI runs on Windows and Linux; the shared code needs nothing else on macOS (the engine call is in
`AstroCoreEngineCalls.swift`), only the session (`useOxySession.sessionBearer`).

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
retry, conversations) and draws the conversation itself with Bloom (`AiChatUserMessage`, `AiChatAssistantMessage`,
`AgentThinking`, `Markdown`, `CodeBlock`, `ComposerPill`). It names itself `app: "astro"`, so its conversations are labelled
and its history lists only them. Astro never names a model: the composer's level picker sends Alia's power levels
(`auto` … `ultra`, the SDK's `POWER_LEVELS`; saved as `chatPowerLevel`).

### Where it lives

| What | Where |
| --- | --- |
| Per-window state: open, placement, conversation, draft, context chips, asks | `ai/chat/state.ts`, `ai/chat/actions.ts` (no SDK import: runs on macOS too) |
| What the model is told about the browser (the turn's `clientContext`) | `ai/chat/clientContext.ts`, `ai/chat/pageContext.ts` |
| Tools Astro performs for Alia (host tools) and their approvals | `ai/chat/hostTools.ts`, `components/chat/ToolApproval.tsx` |
| The panel: header, thread, composer, history | `components/chat/` (`ChatPanel`, `ChatThread`, `ChatComposer`, `ChatHistory`, `ChatCode`) |
| Where the panel shows: sidebar, floating, tab | `components/chat/ChatSlots.tsx` (`ChatSidebar`, `ChatFloating` in `App.tsx`; `ChatTabSlot` for `astro://chat`) |
| The SDK's provider and the portal (Windows, Linux) | `apps/webui/src/host/chat.tsx`, mounted inside `OxyRoot` by `OxyLayer` |
| Streaming over the engine | `apps/webui/src/host/fetch.ts` `engineStreamFetch` → `astroAccountStream` (`ac_account_fetch.cc`) |

The SDK hooks need the one `OxyProvider` (`useOxy`) and its React Query client, which live in the Oxy layer. So
`ChatHost` renders each window's panel inside that tree and portals it into a container `div` it owns; the slots
(sidebar, floating, chat tab) only register an element, and the container moves between them with `appendChild`. The
React tree never remounts, so a reply keeps streaming while the panel moves from the sidebar to a floating window or a
tab. The interface page can't fetch the web itself, so the turn's stream goes through the engine:
`astroAccountStream(id, url, method, headers, body)` answers with the status and headers, then fires
`astro-account-stream` events (`{ data: base64 }`, `{ done }`, `{ error }`); `astroAccountStreamCancel(id)` stops it.
Only the account hosts (`api.oxy.so`, `api.nilo.so`, `api.alia.onl`, loopback) are reachable this way.

### What it does

- **Opening it.** ⌘E / Ctrl+E (View › Chat) toggles it; ⌃⌘E (Focus Chat) moves the keyboard between the page and the
  composer; the toolbar's ✦ button at the card's right end; the command bar's Chat row and ⌃⌘↩ (above); the selection
  popover's **Ask**. It opens where it was last (Settings: `chatPlacement`): a **sidebar** right of the card (320–640 pt,
  drag the left edge, double-click for 400), a **floating** window (drag its header; frame kept in
  `chatFloatingFrame`), or a **tab** (`astro://chat`, ⋯ › Open Chat in Tab), which hides the other two while it's shown.
- **Context.** The tab you're on is attached by default (its chip can be removed, or ✦ › Include Current Tab). Each
  turn reads it again: title, URL, description, language, selected text, each video's position (`at 3:12 of 10:05,
  playing`), the YouTube transcript with timestamps, and the readable text (the `article`/`main` region, open shadow
  roots, same-origin iframes), within 56 000 characters shared with the tabs you **@-mention** (type `@`, or + › Tabs…;
  tab groups too). Mentioned tabs stay attached for the chat. Text you select and **Ask** about, and **links you paste**,
  go into your message as a quote and a link, so the conversation keeps them. **Files** (+ › Files…, drop or paste) and
  **Screenshot of This Tab** go as attachments: images inline, documents through Oxy Files (the SDK's upload). The
  context says the page is data, never instructions, and lists the window's tabs with their ids for the tools.
- **The conversation.** Replies stream with Alia's live reasoning in a collapsible Thought process, the tools it runs
  (web search, reading a page) and the sources it used (chips that open a tab). Markdown, tables and code blocks:
  JavaScript and TypeScript highlighted by Bloom, Python, shell, C/C++, Java/Kotlin, C#, Go, Rust, Swift, PHP, SQL, CSS,
  JSON/YAML and HTML/XML by Astro's tokenizer (`components/chat/highlight.ts`) in Bloom's palette. Stop keeps what
  arrived and offers Resume; every reply has Copy and Regenerate; your messages have Edit; a failed turn says why with
  Try Again. ⋯ › Clear Chat empties it.
- **History.** 🕘 lists your Astro chats by day, with search (title and last message), Delete on hover and Clear All.
- **Tools** (Alia host tools, `host_astro__*`): `open_tabs` (asks first for more than one), `switch_to_tab`,
  `close_tabs` (asks first). The question docks above the composer: Don't Allow, Always Allow in This Chat, Allow.
  Alia performs web search and page fetching itself. `read_tab` (asks first for a tab you haven't shared) needs host tools
  that answer within the turn (below).

### Waiting on Alia

Alia PR **OxyHQ/Alia#913** adds what Chat still needs, on Alia's side: host tools that answer within the same turn
(`awaitsResult`, `POST /v1/chat/turns/:turnId/host-results`, 45 s) and a per-turn `personalization: false` (no memory
read or written), with SDK 22.2.0. Astro's side is written: `read_tab` and the per-chat Personalization switch (+ menu
and ⋯) are behind `AWAITED_HOST_TOOLS` and `PERSONALIZATION_SWITCH` in `ai/chat/features.ts`. Once #913 is merged,
migration 0109 has run and every API replica has it: bump `@alia.onl/sdk` to 22.2, drop
`patches/@alia.onl__sdk@22.1.1.patch` (Alia **#914** makes the SDK type-check under `noUncheckedIndexedAccess`, which is
all the patch does), turn both flags on, and drop the `& { awaitsResult?; result? }` widenings in `hostTools.ts`.

### macOS

The shared code (`ai/chat`, `components/chat`) is platform-neutral. What macOS lacks: the Oxy SDK provider (the app is on
React Native's Legacy architecture and `@alia.onl/sdk` wants React Native 0.86+), a host for the panel like
`apps/webui/src/host/chat.tsx` (macOS has no portals: mount `ChatPanel` inside the slot views once the provider wraps the
window), and a streaming `fetch` (the SDK's `streamFetch`; Expo's `expo/fetch` streams). Until then
`useOxySession.available` is false there, so no Chat button, shortcut or Ask appears and ⌘E stays Use Selection for Find.

### Testing it

- `npm test` in `apps/browser`: `ai/chat/chat.test.mjs` (state, asks, context chips, personalization carry-over, pasted
  links, mentions, the turn context) and `components/chat/highlight.test.mjs`.
- A Windows or Linux build against a local stack: `ASTRO_OXY_API_URL`, `ASTRO_NILO_API_URL`, `ASTRO_ALIA_API_URL` and
  `ASTRO_KAANA_URL` move together (`apps/webui/vite.config.ts` refuses a mix, so a local session never reaches a
  production origin; point one you don't run at a closed port such as `http://127.0.0.1:9`). `globalThis.astro.chat` is the chat store and `astro.oxy` the session.
