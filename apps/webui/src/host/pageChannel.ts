import type { MediaCommand, NowPlaying, PictureInPictureState, WebNotification, WebViewProps } from "@astro-browser-real/astrocore";
import pageScript from "../../../../packages/astrocore/ios/page_script.js?raw";
import { cefServices } from "./services";
import { callTab } from "./tabBridge";

declare const chrome: { send(method: string, args?: unknown[]): void };

type Dict = Record<string, unknown>;
type Theme = { color: string | null; source: string | null };
type FrameNowPlaying = NowPlaying & { frame: number };

const TEXT = 1024;
const LONG_TEXT = 4096;
const SELECTION_TEXT = 4000;
const SHORT_TEXT = 64;
const ICON_TEXT = 1 << 20;
const MAX_ACTIONS = 32;
const MAX_NOTIFICATIONS = 500;
const MAX_PINCH = 100;
const LINK_DROP_GAP_MS = 1000;
const PLAYBACK_STATES = new Set(["none", "paused", "playing"]);
const SCROLL_STATES = new Set(["down", "up", "top"]);
const WEB_PAGE = /^https?:/i;

export const startPageScript = () => chrome.send("astroPageScript", [pageScript]);

const isDict = (value: unknown): value is Dict => !!value && typeof value === "object" && !Array.isArray(value);
const text = (d: Dict, key: string, max: number) => (typeof d[key] === "string" ? [...(d[key] as string)].slice(0, max).join("") : null);
const finite = (d: Dict | null | undefined, key: string) => (d && typeof d[key] === "number" && Number.isFinite(d[key]) ? (d[key] as number) : null);
const flag = (d: Dict, key: string) => d[key] === true;

const parse = (json: string): unknown => {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const originOf = (url: string) => {
  try {
    const origin = new URL(url).origin;
    return origin === "null" ? null : origin;
  } catch {
    return null;
  }
};

function nowPlayingState(d: Dict, frame: number): FrameNowPlaying {
  const state = text(d, "playbackState", SHORT_TEXT);
  const actions = (Array.isArray(d.actions) ? d.actions : []).filter((a): a is string => typeof a === "string" && a.length <= SHORT_TEXT).slice(0, MAX_ACTIONS);
  const duration = finite(d, "duration");
  return {
    frame,
    title: text(d, "title", TEXT) ?? "",
    artist: text(d, "artist", TEXT) ?? "",
    album: text(d, "album", TEXT) ?? "",
    artwork: text(d, "artwork", ICON_TEXT),
    playbackState: (state && PLAYBACK_STATES.has(state) ? state : "none") as NowPlaying["playbackState"],
    position: Math.max(finite(d, "position") ?? 0, 0),
    duration: duration !== null && duration >= 0 ? duration : null,
    playbackRate: finite(d, "playbackRate") ?? 1,
    timestamp: finite(d, "timestamp") ?? 0,
    hasVideo: flag(d, "hasVideo"),
    actions,
    controllable: flag(d, "controllable"),
  };
}

function selectionState(d: Dict) {
  const selected = text(d, "text", SELECTION_TEXT);
  const rect = isDict(d.rect) ? d.rect : null;
  const [x, y, width, height] = ["x", "y", "width", "height"].map((key) => finite(rect, key));
  if (selected === null || x === null || y === null || width === null || height === null) return null;
  return { text: selected, rect: { x, y, width, height } };
}

export class PageChannel {
  private nowPlaying = new Map<number, FrameNowPlaying>();
  private nowPlayingFrame: number | null = null;
  private notificationFrames = new Map<string, number>();
  private linkDropAt = 0;
  theme: Theme | null = null;
  pinchScale = 1;

  constructor(
    private ref: () => string | null,
    private props: { current: WebViewProps },
    private browserId: number,
    private url: () => string,
    private visible: () => boolean,
    private changed: (what: "theme" | "zoom") => void,
  ) {}

  private call(kind: string, data: unknown, frame?: number | null) {
    const ref = this.ref();
    if (ref) void callTab(ref, "callPage", { kind, json: JSON.stringify(data), ...(frame != null ? { frame } : {}) });
  }

  announce() {
    this.call("announce", {});
  }

  private reset() {
    const had = this.nowPlaying.size > 0;
    this.nowPlaying.clear();
    this.nowPlayingFrame = null;
    if (had) this.props.current.onNowPlaying?.(null);
  }

  private async hello(d: Dict | null, frame: number, main: boolean) {
    const frameUrl = (d && text(d, "url", 8192)) || this.url();
    const origin = originOf(main ? frameUrl : this.url());
    let blockAutoplay = false;
    if (origin && WEB_PAGE.test(origin)) {
      const settings = (await cefServices.getSiteSettings(this.props.current.profile ?? "", origin).catch(() => ({}))) as Dict;
      const autoplay = isDict(settings.autoplay) ? settings.autoplay : null;
      blockAutoplay = autoplay?.value === "block";
    }
    this.call("config", blockAutoplay ? { blockAutoplay: true } : {}, frame);
  }

  private emitNowPlaying() {
    const rank = (frame: number | null) => {
      const np = frame === null ? undefined : this.nowPlaying.get(frame);
      return (np?.controllable ? 2 : 0) + (np?.playbackState === "playing" ? 1 : 0);
    };
    for (const frame of this.nowPlaying.keys()) if (rank(frame) > rank(this.nowPlayingFrame)) this.nowPlayingFrame = frame;
    const state = this.nowPlayingFrame === null ? undefined : this.nowPlaying.get(this.nowPlayingFrame);
    if (!state) return this.props.current.onNowPlaying?.(null);
    const { frame: _frame, ...rest } = state;
    this.props.current.onNowPlaying?.(rest);
  }

  handle(kind: string, json: string, frame: number, main: boolean) {
    const data = parse(json);
    const d = isDict(data) ? data : null;
    const p = this.props.current;
    if (kind === "hello") {
      if (main) {
        this.reset();
        if (this.theme) {
          this.theme = null;
          this.changed("theme");
        }
      }
      void this.hello(d, frame, main);
    } else if (kind === "selection" && main) {
      p.onPageMessage?.("selection", d ? selectionState(d) : null);
    } else if (kind === "scroll" && main && d) {
      const state = text(d, "state", 8);
      if (state && SCROLL_STATES.has(state)) p.onPageMessage?.("scroll", { state });
    } else if (kind === "linkDrop" && main && d) {
      const url = text(d, "url", 8192) ?? "";
      const now = performance.now();
      if (this.visible() && WEB_PAGE.test(url) && now - this.linkDropAt > LINK_DROP_GAP_MS) {
        this.linkDropAt = now;
        p.onOpenWindow?.({ url, disposition: "foreground", userGesture: true });
      }
    } else if (kind === "nowPlaying") {
      if (d) {
        this.nowPlaying.set(frame, nowPlayingState(d, frame));
        this.nowPlayingFrame = frame;
      } else {
        this.nowPlaying.delete(frame);
        this.nowPlayingFrame = this.nowPlaying.keys().next().value ?? null;
      }
      this.emitNowPlaying();
    } else if (kind === "theme" && main && d) {
      this.theme = { color: text(d, "color", SHORT_TEXT), source: text(d, "source", 32) };
      this.changed("theme");
    } else if (kind === "pinch" && main && d) {
      const scale = finite(d, "scale");
      if (scale === null || scale <= 0) return;
      this.pinchScale = Math.min(scale, MAX_PINCH);
      this.changed("zoom");
    } else if (kind === "pip" && d && typeof d.active === "boolean") {
      const state: PictureInPictureState = { kind: d.kind === "document" ? "document" : "video", active: d.active };
      p.onPictureInPicture?.(state);
    } else if (kind === "notification" && d) {
      const id = text(d, "id", 128);
      const title = text(d, "title", TEXT);
      const origin = originOf(this.url());
      if (!id || title === null || !origin) return;
      if (this.notificationFrames.size > MAX_NOTIFICATIONS) this.notificationFrames.clear();
      this.notificationFrames.set(id, frame);
      const notification: WebNotification = {
        id,
        title,
        body: text(d, "body", LONG_TEXT) ?? "",
        icon: text(d, "icon", ICON_TEXT),
        tag: text(d, "tag", TEXT) ?? "",
        silent: flag(d, "silent"),
        requireInteraction: flag(d, "requireInteraction"),
        origin,
        browserId: this.browserId,
        isMainFrame: main,
      };
      p.onNotification?.(notification);
    } else if (kind === "notificationClose" && d) {
      const id = text(d, "id", 128);
      if (!id) return;
      this.notificationFrames.delete(id);
      p.onNotificationClose?.(id);
    }
  }

  mediaCommand(action: MediaCommand | "enterpictureinpicture", seconds = 0) {
    this.call("media", { action, seconds }, this.nowPlayingFrame);
  }

  notificationAction(id: string, action: "click" | "close") {
    const frame = this.notificationFrames.get(id);
    if (frame === undefined) return;
    if (action !== "click") this.notificationFrames.delete(id);
    this.call("notification", { id, action }, frame);
  }

  crashed() {
    this.reset();
  }
}
