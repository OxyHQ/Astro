import type { AliaHostAction, AliaHostOutcome, AliaHostToolDefinition, AliaHostTools } from "@alia.onl/sdk/runtime";
import { closeTab } from "../../lib/actions";
import { useBrowser } from "../../store/browser";
import { activeTabId, viewTabIds } from "../../store/model";
import { AGENT_TOOL_NAMES, agentToolDefinitions, runAgentTool, tabIsShared } from "../agent/tools";
import { consentToShare, shareStateOf } from "../safety/consent";
import { redactForModel } from "../safety/policy";
import { approve, chatKey } from "./approvals";
import { readPage } from "./pageContext";
import { windowChat } from "./state";

export { answerApproval, dropApprovals, useApprovals, type Approval, type ApprovalKind } from "./approvals";

const TAB_IDS = { type: "array", items: { type: "string" }, minItems: 1, maxItems: 20, description: "Tab ids from the list of open tabs." };

const DEFINITIONS: AliaHostToolDefinition[] = [
  {
    name: "open_tabs",
    description:
      "Open one or more web pages in new tabs of the person's browser window, next to the tab they are on. The person is asked first when more than one tab would open.",
    inputSchema: {
      type: "object",
      properties: {
        urls: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 10, description: "Absolute http(s) URLs." },
        background: { type: "boolean", description: "Open without switching to the new tab." },
      },
      required: ["urls"],
      additionalProperties: false,
    },
  },
  {
    name: "switch_to_tab",
    description: "Show one of the person's open tabs, by its id from the list of open tabs.",
    inputSchema: { type: "object", properties: { tabId: { type: "string" } }, required: ["tabId"], additionalProperties: false },
  },
  {
    name: "close_tabs",
    description: "Close some of the person's open tabs, by their ids from the list of open tabs. The person is asked to confirm first.",
    inputSchema: { type: "object", properties: { tabIds: TAB_IDS }, required: ["tabIds"], additionalProperties: false },
  },
];

const READ_TAB: AliaHostToolDefinition = {
  name: "read_tab",
  description:
    "Read the text of one of the person's open tabs (its title, address, selected text, video position and page text), by its id from the list of open tabs. The person is asked first for a tab they haven't shared.",
  inputSchema: { type: "object", properties: { tabId: { type: "string" } }, required: ["tabId"], additionalProperties: false },
  awaitsResult: true,
};

const isWebUrl = (url: unknown): url is string => typeof url === "string" && /^https?:\/\//i.test(url);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

function windowTab(windowId: string, tabId: unknown) {
  const s = useBrowser.getState();
  return typeof tabId === "string" && viewTabIds(s, windowId).includes(tabId) ? s.tabs[tabId] : undefined;
}

const describe = (tab: { id: string; title: string; customTitle: string | null; url: string }) => ({
  tabId: tab.id,
  title: tab.customTitle || tab.title || tab.url,
  url: tab.url,
});

async function run(windowId: string, action: AliaHostAction): Promise<AliaHostOutcome> {
  const conversation = windowChat(windowId).conversationId;
  const input = action.input ?? {};
  switch (action.name) {
    case "open_tabs": {
      const urls = strings(input.urls).filter(isWebUrl).slice(0, 10);
      if (!urls.length) return { outcome: "rejected", detail: "No http(s) URL to open." };
      if (
        urls.length > 1 &&
        !(await approve(
          windowId,
          "open",
          urls.map((url) => ({ title: url, url })),
          conversation,
        ))
      )
        return { outcome: "rejected", detail: "The person declined." };
      const s = useBrowser.getState();
      const opener = activeTabId(s, windowId);
      let last: string | undefined;
      for (const url of urls) last = useBrowser.getState().newTab(windowId, { url, background: true, ...(opener ? { openerId: opener } : {}) });
      if (last && input.background !== true) useBrowser.getState().activate(last);
      return { outcome: "applied", detail: `Opened ${urls.length} tab${urls.length > 1 ? "s" : ""}.` };
    }
    case "switch_to_tab": {
      const tab = windowTab(windowId, input.tabId);
      if (!tab) return { outcome: "stale", detail: "That tab isn't open in this window any more." };
      useBrowser.getState().activate(tab.id);
      return { outcome: "applied", detail: `Showing “${tab.customTitle || tab.title}”.` };
    }
    case "close_tabs": {
      const tabs = strings(input.tabIds).flatMap((id) => {
        const tab = windowTab(windowId, id);
        return tab ? [tab] : [];
      });
      if (!tabs.length) return { outcome: "stale", detail: "None of those tabs is open in this window." };
      if (!(await approve(windowId, "close", tabs.map(describe), conversation))) return { outcome: "rejected", detail: "The person declined." };
      for (const tab of tabs) if (useBrowser.getState().tabs[tab.id]) closeTab(tab.id);
      return { outcome: "applied", detail: `Closed ${tabs.length} tab${tabs.length > 1 ? "s" : ""}.` };
    }
    case "read_tab": {
      const tab = windowTab(windowId, input.tabId);
      if (!tab) return { outcome: "stale", detail: "That tab isn't open in this window any more." };
      const share = shareStateOf(tab.url, chatKey(windowId, conversation));
      if (share.state === "blocked") return { outcome: "rejected", detail: `${share.sensitivity?.host ?? "This site"} is blocked for AI by the person's organization.` };
      if (share.state === "withheld") {
        if (!(await consentToShare(windowId, conversation, describe(tab)))) return { outcome: "rejected", detail: "The person didn't share this site." };
      } else if (!tabIsShared(windowId, tab.id) && !(await approve(windowId, "read", [describe(tab)], conversation))) {
        return { outcome: "rejected", detail: "The person declined." };
      }
      const page = await readPage(tab.id);
      if (!page) return { outcome: "failed", detail: "The tab couldn't be read." };
      return { outcome: "inline", detail: `Read “${page.title}”.`, result: { ...page, text: redactForModel(page.text).text, selection: redactForModel(page.selection).text } };
    }
  }
  if (AGENT_TOOL_NAMES.has(action.name)) return runAgentTool(windowId, action);
  return { outcome: "rejected", detail: `Unknown tool ${action.name}.` };
}

export function astroHostTools(windowId: string): AliaHostTools {
  return {
    definitions: [...DEFINITIONS, READ_TAB, ...agentToolDefinitions()],
    execute: (action) => run(windowId, action),
  };
}
