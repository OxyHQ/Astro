/**
 * Alia AI Sidebar Panel for Astro Browser
 *
 * Lightweight vanilla TypeScript chat panel that communicates with
 * the Alia API via SSE streaming. Designed as a browser sidebar
 * panel inspired by Comet/Perplexity's sidecar UI.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string;
  createdAt: number;
}

interface PageContext {
  url: string;
  title: string;
  selectedText?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_URL = "https://api.alia.onl";
const MODEL = "alia-v1";
const FLUSH_INTERVAL_MS = 50;

// SVG icon constants
const ALIA_LOGO_SVG = `<svg viewBox="0 0 163 169" fill="currentColor" class="w-5 h-5">
  <g transform="translate(0,169) scale(0.1,-0.1)" stroke="none">
    <path d="M936 1454 c37 -22 114 -116 114 -139 0 -4 22 -44 49 -89 75 -124 89 -148 112 -191 24 -45 87 -153 207 -357 101 -171 120 -228 102 -293 -17 -62 -61 -120 -110 -145 -91 -47 -434 -36 -566 18 -136 55 -246 148 -315 267 -77 132 -94 192 -93 335 1 141 25 223 107 362 30 51 66 114 81 140 67 119 199 158 312 92z"/>
    <path d="M361 586 c108 -45 154 -170 101 -273 -34 -65 -83 -93 -162 -93 -81 0 -124 21 -165 81 -25 37 -30 54 -30 104 0 50 5 67 30 105 52 76 148 109 226 76z"/>
  </g>
</svg>`;

const SEND_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
  <path d="M5 12h14M12 5l7 7-7 7"/>
</svg>`;

const STOP_ICON_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
  <rect x="6" y="6" width="12" height="12" rx="2"/>
</svg>`;

const NEW_CHAT_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
  <path d="M12 5v14M5 12h14"/>
</svg>`;

const PAGE_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 shrink-0">
  <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"/>
  <path d="M3.6 9h16.8M3.6 15h16.8"/>
  <path d="M12 3a15 15 0 0 1 4 9 15 15 0 0 1-4 9 15 15 0 0 1-4-9 15 15 0 0 1 4-9z"/>
</svg>`;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let messages: ChatMessage[] = [];
let isStreaming = false;
let abortController: AbortController | null = null;
let accessToken: string | null = null;
let pageContext: PageContext | null = null;

// Streaming batch state
let pendingContent = "";
let pendingReasoning = "";
let flushTimer: ReturnType<typeof setTimeout> | null = null;

// ---------------------------------------------------------------------------
// DOM References
// ---------------------------------------------------------------------------

let messagesContainer: HTMLElement;
let inputTextarea: HTMLTextAreaElement;
let sendButton: HTMLButtonElement;
let pageContextBar: HTMLElement;
let pageContextText: HTMLElement;
let welcomeSection: HTMLElement;

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `msg-${crypto.randomUUID()}`;
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/** Minimal markdown to HTML (handles bold, italic, code, links, lists, blockquotes, headings) */
function renderMarkdown(text: string): string {
  let html = escapeHtml(text);

  // Code blocks (triple backtick)
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_match, _lang, code) => `<pre><code>${code.trim()}</code></pre>`,
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>',
  );

  // Headings (### to h4, ## to h3, # to h2)
  html = html.replace(
    /^### (.+)$/gm,
    '<strong style="font-size:0.95em">$1</strong>',
  );
  html = html.replace(
    /^## (.+)$/gm,
    '<strong style="font-size:1.05em">$1</strong>',
  );
  html = html.replace(
    /^# (.+)$/gm,
    '<strong style="font-size:1.1em">$1</strong>',
  );

  // Blockquotes
  html = html.replace(
    /^&gt; (.+)$/gm,
    "<blockquote>$1</blockquote>",
  );

  // Unordered lists
  html = html.replace(/^[*-] (.+)$/gm, "<li>$1</li>");
  html = html.replace(
    /(<li>[\s\S]*?<\/li>)/g,
    (match) => `<ul>${match}</ul>`,
  );
  // Clean up consecutive ul tags
  html = html.replace(/<\/ul>\s*<ul>/g, "");

  // Line breaks (double newline = paragraph, single newline = <br>)
  html = html.replace(/\n\n/g, "</p><p>");
  html = html.replace(/\n/g, "<br>");

  // Wrap in paragraph if not already wrapped
  if (!html.startsWith("<")) {
    html = `<p>${html}</p>`;
  }

  return html;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// ---------------------------------------------------------------------------
// Auth (receives token from Astro browser via postMessage or chrome.runtime)
// ---------------------------------------------------------------------------

function initAuth(): void {
  // Try to get token from chrome storage (Astro browser integration)
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.get(["oxyAccessToken"], (result: Record<string, string>) => {
      if (result["oxyAccessToken"]) {
        accessToken = result["oxyAccessToken"];
      }
    });
  }

  // Listen for token updates from the host browser
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.data?.type === "oxy-token") {
      accessToken = event.data.token;
    }
    if (event.data?.type === "page-context") {
      pageContext = {
        url: event.data.url ?? "",
        title: event.data.title ?? "",
        selectedText: event.data.selectedText,
      };
      updatePageContextBar();
    }
  });
}

// ---------------------------------------------------------------------------
// Page Context
// ---------------------------------------------------------------------------

function updatePageContextBar(): void {
  if (!pageContext?.url) {
    pageContextBar.classList.add("hidden");
    return;
  }

  pageContextBar.classList.remove("hidden");

  const displayTitle =
    pageContext.title || new URL(pageContext.url).hostname;
  const truncated =
    displayTitle.length > 48
      ? displayTitle.slice(0, 48) + "..."
      : displayTitle;

  pageContextText.textContent = truncated;
}

function buildPageContextMessage(): string {
  if (!pageContext?.url) return "";

  let ctx = `[Browsing Context]\nPage: ${pageContext.title || "Unknown"}\nURL: ${pageContext.url}`;
  if (pageContext.selectedText) {
    ctx += `\nSelected text: "${pageContext.selectedText.slice(0, 2000)}"`;
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function createMessageElement(msg: ChatMessage): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.id = `msg-${msg.id}`;
  wrapper.className = `animate-fade-in-up ${msg.role === "user" ? "flex justify-end" : "flex justify-start"}`;

  if (msg.role === "user") {
    const bubble = document.createElement("div");
    const bgClass = isDark()
      ? "bg-dark-surface-elevated text-dark-text"
      : "bg-oxy-surface text-oxy-text";
    bubble.className = `max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm leading-relaxed shadow-xs ${bgClass}`;
    bubble.textContent = msg.content;
    wrapper.appendChild(bubble);
  } else {
    // Assistant message
    const container = document.createElement("div");
    container.className = "max-w-full w-full space-y-1.5";

    // Thinking section (if exists)
    if (msg.thinking) {
      const thinkingEl = document.createElement("div");
      const thinkBg = isDark()
        ? "border-dark-border text-dark-text-tertiary"
        : "border-oxy-border-light text-oxy-text-tertiary";
      thinkingEl.className = `thinking-section pl-3 border-l-2 mb-2 ${thinkBg}`;
      thinkingEl.textContent = msg.thinking;
      container.appendChild(thinkingEl);
    }

    // Content
    const contentEl = document.createElement("div");
    const textClass = isDark()
      ? "text-dark-text"
      : "text-oxy-text";
    contentEl.className = `message-content text-sm leading-relaxed ${textClass}`;

    if (msg.content) {
      contentEl.innerHTML = renderMarkdown(msg.content);
    } else {
      // Typing indicator
      contentEl.innerHTML = `
        <div class="flex items-center gap-1 py-1">
          <span class="typing-dot w-1.5 h-1.5 rounded-full bg-oxy-primary"></span>
          <span class="typing-dot w-1.5 h-1.5 rounded-full bg-oxy-primary"></span>
          <span class="typing-dot w-1.5 h-1.5 rounded-full bg-oxy-primary"></span>
        </div>
      `;
    }
    container.appendChild(contentEl);

    // Timestamp
    const timeEl = document.createElement("div");
    const timeClass = isDark()
      ? "text-dark-text-tertiary"
      : "text-oxy-text-tertiary";
    timeEl.className = `text-[10px] mt-1 ${timeClass}`;
    timeEl.textContent = formatTime(msg.createdAt);
    container.appendChild(timeEl);

    wrapper.appendChild(container);
  }

  return wrapper;
}

function renderAllMessages(): void {
  messagesContainer.innerHTML = "";

  if (messages.length === 0) {
    welcomeSection.classList.remove("hidden");
    return;
  }

  welcomeSection.classList.add("hidden");

  for (const msg of messages) {
    messagesContainer.appendChild(createMessageElement(msg));
  }

  scrollToBottom();
}

function updateLastAssistantMessage(): void {
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg || lastMsg.role !== "assistant") return;

  const existing = document.getElementById(`msg-${lastMsg.id}`);
  if (existing) {
    const newEl = createMessageElement(lastMsg);
    existing.replaceWith(newEl);
  }

  scrollToBottom();
}

function scrollToBottom(): void {
  requestAnimationFrame(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

// ---------------------------------------------------------------------------
// Streaming flush
// ---------------------------------------------------------------------------

function flushPendingUpdates(): void {
  const content = pendingContent;
  const reasoning = pendingReasoning;
  if (!content && !reasoning) return;

  pendingContent = "";
  pendingReasoning = "";

  const last = messages[messages.length - 1];
  if (last?.role === "assistant") {
    if (content) last.content += content;
    if (reasoning) last.thinking = (last.thinking ?? "") + reasoning;
    updateLastAssistantMessage();
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushPendingUpdates();
  }, FLUSH_INTERVAL_MS);
}

// ---------------------------------------------------------------------------
// Send message
// ---------------------------------------------------------------------------

async function sendMessage(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed || isStreaming) return;

  if (!accessToken) {
    // For development/testing, allow unauthenticated usage
    // In production, the Astro browser provides the token
    console.warn("No access token available. Attempting request without auth.");
  }

  // Hide welcome, show chat
  welcomeSection.classList.add("hidden");

  // Create user message
  const userMsg: ChatMessage = {
    id: generateId(),
    role: "user",
    content: trimmed,
    createdAt: Date.now(),
  };

  // Create assistant placeholder
  const assistantMsg: ChatMessage = {
    id: generateId(),
    role: "assistant",
    content: "",
    createdAt: Date.now(),
  };

  messages.push(userMsg, assistantMsg);
  renderAllMessages();

  // Clear input
  inputTextarea.value = "";
  inputTextarea.style.height = "auto";
  updateSendButton();

  isStreaming = true;
  updateSendButton();

  // Build API messages
  const apiMessages: Array<{ role: string; content: string }> = [];

  // Add page context as system message
  const ctxMessage = buildPageContextMessage();
  if (ctxMessage) {
    apiMessages.push({
      role: "system",
      content: `You are Alia, the AI assistant in the Astro browser by Oxy. ${ctxMessage}`,
    });
  } else {
    apiMessages.push({
      role: "system",
      content:
        "You are Alia, the AI assistant in the Astro browser by Oxy. Help the user with whatever they need. Be concise and helpful.",
    });
  }

  // Include conversation history (skip system messages, limit to last 20 exchanges)
  const historyLimit = Math.max(0, messages.length - 2 - 40);
  for (let i = historyLimit; i < messages.length - 2; i++) {
    const msg = messages[i];
    if (msg && msg.role !== "system") {
      apiMessages.push({ role: msg.role, content: msg.content });
    }
  }

  apiMessages.push({ role: "user", content: trimmed });

  const controller = new AbortController();
  abortController = controller;

  // Reset batch state
  pendingContent = "";
  pendingReasoning = "";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  try {
    const response = await fetch(`${API_URL}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: MODEL,
        messages: apiMessages,
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`API error ${response.status}: ${body.slice(0, 200)}`);
    }

    // Non-streaming fallback
    if (!response.body || typeof response.body.getReader !== "function") {
      const json = await response.json();
      const content = json.choices?.[0]?.message?.content ?? "";
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") {
        last.content = content;
        updateLastAssistantMessage();
      }
      return;
    }

    // Stream SSE
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentEventType = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          // Track named SSE event type
          if (line.startsWith("event: ")) {
            currentEventType = line.slice(7).trim();
            continue;
          }

          // Reset event type on empty line (SSE boundary)
          if (line === "") {
            currentEventType = "";
            continue;
          }

          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith("data: ")) continue;
          const data = trimmedLine.slice(6);
          if (data === "[DONE]") {
            currentEventType = "";
            continue;
          }

          try {
            const parsed = JSON.parse(data);

            // Named SSE events (Alia extensions)
            if (currentEventType) {
              switch (currentEventType) {
                case "alia.reasoning": {
                  const reasoningContent = parsed.content;
                  if (reasoningContent) {
                    pendingReasoning += reasoningContent;
                    scheduleFlush();
                  }
                  currentEventType = "";
                  continue;
                }
                default:
                  currentEventType = "";
                  continue;
              }
            }

            // Standard OpenAI-format SSE
            const choice = parsed.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta;
            if (!delta) continue;

            // Reasoning
            if (delta.reasoning) {
              pendingReasoning += delta.reasoning;
              scheduleFlush();
            }

            // Text content
            if (delta.content) {
              pendingContent += delta.content;
              scheduleFlush();
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") return;
    const errorMessage =
      err instanceof Error ? err.message : "Something went wrong";
    console.error("Alia panel error:", errorMessage);

    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && !last.content) {
      last.content =
        "I'm having trouble connecting right now. Please try again.";
      updateLastAssistantMessage();
    }
  } finally {
    flushPendingUpdates();
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    isStreaming = false;
    abortController = null;
    updateSendButton();
  }
}

function stopStreaming(): void {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  flushPendingUpdates();
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  isStreaming = false;
  updateSendButton();
}

function clearChat(): void {
  stopStreaming();
  messages = [];
  renderAllMessages();
}

// ---------------------------------------------------------------------------
// UI Updates
// ---------------------------------------------------------------------------

function updateSendButton(): void {
  const hasText = inputTextarea.value.trim().length > 0;

  if (isStreaming) {
    sendButton.innerHTML = STOP_ICON_SVG;
    sendButton.title = "Stop generating";
    sendButton.className = buttonActiveClass();
    sendButton.onclick = stopStreaming;
  } else {
    sendButton.innerHTML = SEND_ICON_SVG;
    sendButton.title = "Send message";
    sendButton.onclick = () => sendMessage(inputTextarea.value);
    if (hasText) {
      sendButton.className = buttonActiveClass();
    } else {
      sendButton.className = buttonInactiveClass();
    }
  }
}

function buttonActiveClass(): string {
  return "flex items-center justify-center w-8 h-8 rounded-full bg-oxy-primary text-white hover:bg-oxy-primary-dark transition-colors duration-150 shrink-0 cursor-pointer";
}

function buttonInactiveClass(): string {
  return isDark()
    ? "flex items-center justify-center w-8 h-8 rounded-full bg-dark-surface-elevated text-dark-text-tertiary transition-colors duration-150 shrink-0 cursor-default"
    : "flex items-center justify-center w-8 h-8 rounded-full bg-oxy-border-light text-oxy-text-tertiary transition-colors duration-150 shrink-0 cursor-default";
}

// ---------------------------------------------------------------------------
// Quick actions (welcome suggestions)
// ---------------------------------------------------------------------------

function handleSuggestion(text: string): void {
  inputTextarea.value = text;
  sendMessage(text);
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

function buildUI(): void {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <!-- Header -->
    <header id="panel-header" class="flex items-center justify-between px-4 py-3 border-b shrink-0
      ${isDark() ? "border-dark-border bg-dark-bg" : "border-oxy-border bg-oxy-bg"}">
      <div class="flex items-center gap-2.5">
        <div class="text-oxy-primary">${ALIA_LOGO_SVG}</div>
        <span class="font-semibold text-sm tracking-tight ${isDark() ? "text-dark-text" : "text-oxy-text"}">Alia</span>
        <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full
          ${isDark() ? "bg-dark-surface-elevated text-dark-text-tertiary" : "bg-oxy-hover text-oxy-text-tertiary"}">AI</span>
      </div>
      <div class="flex items-center gap-1">
        <button id="new-chat-btn" title="New conversation"
          class="flex items-center justify-center w-7 h-7 rounded-lg transition-colors duration-150 cursor-pointer
          ${isDark() ? "text-dark-text-secondary hover:bg-dark-hover" : "text-oxy-text-secondary hover:bg-oxy-hover"}">
          ${NEW_CHAT_ICON_SVG}
        </button>
      </div>
    </header>

    <!-- Page Context Bar -->
    <div id="page-context-bar" class="hidden px-4 py-2 border-b shrink-0
      ${isDark() ? "border-dark-border bg-dark-surface" : "border-oxy-border-light bg-oxy-surface"}">
      <div class="flex items-center gap-2 text-xs cursor-pointer group" id="page-context-trigger">
        <span class="${isDark() ? "text-dark-text-tertiary" : "text-oxy-text-tertiary"}">${PAGE_ICON_SVG}</span>
        <span id="page-context-text" class="truncate
          ${isDark() ? "text-dark-text-secondary group-hover:text-dark-text" : "text-oxy-text-secondary group-hover:text-oxy-text"}
          transition-colors duration-150"></span>
        <span class="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0
          ${isDark() ? "text-oxy-primary-light bg-dark-surface-elevated" : "text-oxy-primary bg-oxy-hover"}">Ask about page</span>
      </div>
    </div>

    <!-- Welcome Section -->
    <div id="welcome-section" class="flex-1 flex flex-col items-center justify-center px-6 gap-6 overflow-hidden">
      <div class="flex flex-col items-center gap-3">
        <div class="text-oxy-primary opacity-80 w-10 h-10 flex items-center justify-center">
          ${ALIA_LOGO_SVG.replace('class="w-5 h-5"', 'class="w-10 h-10"')}
        </div>
        <h2 class="text-lg font-semibold tracking-tight ${isDark() ? "text-dark-text" : "text-oxy-text"}">Ask Alia anything</h2>
        <p class="text-xs text-center leading-relaxed max-w-[240px]
          ${isDark() ? "text-dark-text-secondary" : "text-oxy-text-secondary"}">
          Your AI assistant in Astro. Ask questions, summarize pages, write code, and more.
        </p>
      </div>
      <div class="flex flex-col gap-2 w-full max-w-[280px]" id="suggestions">
        <button class="suggestion-btn text-left px-3.5 py-2.5 rounded-xl text-xs leading-snug transition-all duration-150 border cursor-pointer
          ${isDark()
            ? "border-dark-border bg-dark-surface text-dark-text-secondary hover:bg-dark-hover hover:border-dark-border hover:text-dark-text"
            : "border-oxy-border-light bg-oxy-surface text-oxy-text-secondary hover:bg-oxy-hover hover:border-oxy-border hover:text-oxy-text"}
        " data-suggestion="Summarize this page for me">
          <span class="font-medium ${isDark() ? "text-dark-text" : "text-oxy-text"}">Summarize this page</span>
          <br><span class="opacity-70">Get a quick overview of the current page</span>
        </button>
        <button class="suggestion-btn text-left px-3.5 py-2.5 rounded-xl text-xs leading-snug transition-all duration-150 border cursor-pointer
          ${isDark()
            ? "border-dark-border bg-dark-surface text-dark-text-secondary hover:bg-dark-hover hover:border-dark-border hover:text-dark-text"
            : "border-oxy-border-light bg-oxy-surface text-oxy-text-secondary hover:bg-oxy-hover hover:border-oxy-border hover:text-oxy-text"}
        " data-suggestion="What are the key points of this article?">
          <span class="font-medium ${isDark() ? "text-dark-text" : "text-oxy-text"}">Key takeaways</span>
          <br><span class="opacity-70">Extract the most important information</span>
        </button>
        <button class="suggestion-btn text-left px-3.5 py-2.5 rounded-xl text-xs leading-snug transition-all duration-150 border cursor-pointer
          ${isDark()
            ? "border-dark-border bg-dark-surface text-dark-text-secondary hover:bg-dark-hover hover:border-dark-border hover:text-dark-text"
            : "border-oxy-border-light bg-oxy-surface text-oxy-text-secondary hover:bg-oxy-hover hover:border-oxy-border hover:text-oxy-text"}
        " data-suggestion="Explain this in simple terms">
          <span class="font-medium ${isDark() ? "text-dark-text" : "text-oxy-text"}">Explain simply</span>
          <br><span class="opacity-70">Break down complex content into plain language</span>
        </button>
      </div>
    </div>

    <!-- Messages Container -->
    <div id="messages-container" class="flex-1 overflow-y-auto px-4 py-4 space-y-4"></div>

    <!-- Input Area -->
    <div id="input-area" class="shrink-0 px-3 pb-3 pt-2">
      <div class="flex items-end gap-2 rounded-2xl border px-3.5 py-2.5 transition-colors duration-150
        ${isDark()
          ? "border-dark-border bg-dark-surface focus-within:border-oxy-primary/50"
          : "border-oxy-border bg-oxy-surface focus-within:border-oxy-primary/50"}
        focus-within:shadow-[0_0_0_1px_rgba(196,110,222,0.15)]">
        <textarea id="input-textarea"
          placeholder="Ask anything..."
          rows="1"
          class="flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none min-h-[20px] max-h-[120px]
            ${isDark() ? "text-dark-text placeholder-dark-text-tertiary" : "text-oxy-text placeholder-oxy-text-tertiary"}"
        ></textarea>
        <button id="send-btn" title="Send message"
          class="${buttonInactiveClass()}">
          ${SEND_ICON_SVG}
        </button>
      </div>
      <p class="text-center text-[10px] mt-2 ${isDark() ? "text-dark-text-tertiary" : "text-oxy-text-tertiary"}">
        Alia by <span class="text-oxy-primary font-medium">Oxy</span> &middot; AI can make mistakes
      </p>
    </div>
  `;

  // Cache DOM refs
  messagesContainer = document.getElementById("messages-container") as HTMLElement;
  inputTextarea = document.getElementById("input-textarea") as HTMLTextAreaElement;
  sendButton = document.getElementById("send-btn") as HTMLButtonElement;
  pageContextBar = document.getElementById("page-context-bar") as HTMLElement;
  pageContextText = document.getElementById("page-context-text") as HTMLElement;
  welcomeSection = document.getElementById("welcome-section") as HTMLElement;

  // Event listeners
  inputTextarea.addEventListener("input", () => {
    updateSendButton();
  });

  inputTextarea.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isStreaming) {
        stopStreaming();
      } else {
        sendMessage(inputTextarea.value);
      }
    }
  });

  document.getElementById("new-chat-btn")?.addEventListener("click", clearChat);

  // Suggestion buttons
  document.querySelectorAll(".suggestion-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const suggestion = (btn as HTMLElement).dataset["suggestion"];
      if (suggestion) handleSuggestion(suggestion);
    });
  });

  // Page context "ask about page" trigger
  document.getElementById("page-context-trigger")?.addEventListener("click", () => {
    if (pageContext?.title) {
      const prompt = `Tell me about this page: ${pageContext.title}`;
      inputTextarea.value = prompt;
      sendMessage(prompt);
    }
  });

  // Focus input
  inputTextarea.focus();
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  buildUI();

  // Notify host that panel is ready
  window.parent?.postMessage({ type: "alia-panel-ready" }, "*");
});

