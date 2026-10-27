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
maxOutputTokens })`: `POST https://kaana.ai/v1/responses` with the Oxy session's access token as the bearer, read on every
request, and the body `{ model: "instant", input, maxOutputTokens, labels: { app: "astro", feature } }` (`ai/kaana.ts`;
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

- Oxy can't serve these requests yet. The Oxy edge accepts no user session; the session lane on the Kaana grant API,
  with Astro's terms (`astro-kaana-session`: `responses`, `instant` only, 8 000 input and 512 output tokens, USD 0.004 a
  request, 200 a person and 10 000 a day), is draft PR OxyHQ/oxy#2006 with ADR 0050, waiting on the owner. Astro is
  `first_party`, so its session is Oxy's shared device session (ADR 0029), which names no application; ADR 0050 lists
  how it could name Astro. Until then Kaana answers `permission_denied`, Astro stops the features for the session and
  Settings says so.
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

