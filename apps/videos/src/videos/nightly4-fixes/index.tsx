import type { CSSProperties } from "react";
import { AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { color, font, loadFonts } from "../../lib/ac-launch/theme";
import segments from "./segments.json";

loadFonts();

interface Event {
  t: number;
  x?: number;
  y?: number;
  down?: number;
  up?: number;
  hide?: number;
  mark?: string;
}

interface Segment {
  file: string;
  inS: number;
  outS: number;
  cam: number[];
  title: string;
  body: string;
  events: Event[];
}

const FPS = 60;
const TITLE = Math.round(2.6 * FPS);
const OUTRO = 0;
const SOURCE = { w: 1360, h: 860 };
const BOX = { x: 80, y: 120, w: 1360, h: 860 };
const CURSOR_PX_PER_PT = 2.72;
const CURSOR_TIP = { x: 18, y: 16 };
const VERSION = "0.2.39-nightly.4";

const all = segments as Segment[];
const lengths = all.map((s) => Math.round((s.outS - s.inS) * FPS));
const starts = lengths.map((_, i) => TITLE + lengths.slice(0, i).reduce((a, b) => a + b, 0));
const total = TITLE + lengths.reduce((a, b) => a + b, 0) + OUTRO;

export const meta = { width: 1920, height: 1080, fps: FPS, durationInFrames: total };

const label: CSSProperties = {
  fontFamily: font.mono,
  fontWeight: 460,
  fontStretch: "87.5%",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  fontSize: 20,
  color: color.ink2,
};

function pointerAt(events: Event[], t: number) {
  let at: Event | null = null;
  let pressed = false;
  for (const e of events) {
    if (e.t > t) break;
    if (e.hide) at = null;
    else if (e.x !== undefined && e.y !== undefined) at = e;
    if (e.down) pressed = true;
    if (e.up) pressed = false;
  }
  return at ? { x: at.x ?? 0, y: at.y ?? 0, pressed } : null;
}

function Keycap({ events, t }: { events: Event[]; t: number }) {
  const shown = events.filter((e) => e.mark?.startsWith("⌘") && t >= e.t && t < e.t + 1.3);
  if (!shown.length) return null;
  const e = shown[shown.length - 1];
  const k = t - e.t;
  const opacity = interpolate(k, [0, 0.12, 1.1, 1.3], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lift = interpolate(k, [0, 0.18], [14, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <div
      style={{
        position: "absolute",
        left: BOX.x + BOX.w / 2,
        top: BOX.y + BOX.h - 130 + lift,
        transform: "translateX(-50%)",
        opacity,
        padding: "16px 30px",
        borderRadius: 18,
        background: color.ink,
        color: color.paper,
        fontFamily: font.poster,
        fontWeight: 760,
        fontSize: 56,
        lineHeight: 1,
        boxShadow: "0 18px 40px rgba(22,19,15,0.28)",
      }}
    >
      {e.mark}
    </div>
  );
}

function Shot({ seg, index, length }: { seg: Segment; index: number; length: number }) {
  const frame = useCurrentFrame();
  const t = seg.inS + frame / FPS;
  const [cx, cy, cw] = seg.cam;
  const k = BOX.w / cw;
  const fade = interpolate(frame, [0, 9, length - 6, length], [0, 1, 1, 0.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const settle = interpolate(frame, [0, 24], [1.025, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const p = pointerAt(seg.events, t);
  const textIn = (delay: number) => ({
    opacity: interpolate(frame, [delay, delay + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    transform: `translateY(${interpolate(frame, [delay, delay + 18], [18, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })}px)`,
  });
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: BOX.x,
          top: BOX.y,
          width: BOX.w,
          height: BOX.h,
          overflow: "hidden",
          borderRadius: 22,
          background: color.paperDeep,
          boxShadow: "0 30px 70px rgba(22,19,15,0.16), 0 0 0 1px rgba(22,19,15,0.10)",
          opacity: fade,
        }}
      >
        <div style={{ position: "absolute", inset: 0, transform: `scale(${settle})`, transformOrigin: "50% 50%" }}>
          <OffthreadVideo
            src={staticFile(`footage/nightly4/${seg.file}.mov`)}
            startFrom={Math.round(seg.inS * FPS)}
            endAt={Math.round(seg.outS * FPS) + 2}
            muted
            style={{ position: "absolute", left: -cx * k, top: -cy * k, width: SOURCE.w * k, height: SOURCE.h * k }}
          />
          {p ? (
            <Img
              src={staticFile("brand/cursor-arrow.png")}
              style={{
                position: "absolute",
                left: (p.x - cx) * k - (CURSOR_TIP.x * k) / CURSOR_PX_PER_PT,
                top: (p.y - cy) * k - (CURSOR_TIP.y * k) / CURSOR_PX_PER_PT,
                width: (112 * k) / CURSOR_PX_PER_PT,
                height: (160 * k) / CURSOR_PX_PER_PT,
                transform: `scale(${p.pressed ? 0.86 : 1})`,
                transformOrigin: `${CURSOR_TIP.x / 1.12}% ${CURSOR_TIP.y / 1.6}%`,
              }}
            />
          ) : null}
        </div>
      </div>
      <Keycap events={seg.events} t={t} />
      <div style={{ position: "absolute", left: 1480, top: BOX.y, width: 370 }}>
        <div style={{ ...label, color: color.blue, ...textIn(4) }}>
          Fix {String(index + 1).padStart(2, "0")} / {String(all.length).padStart(2, "0")}
        </div>
        <div
          style={{
            marginTop: 26,
            fontFamily: font.poster,
            fontWeight: 850,
            fontStretch: "75%",
            textTransform: "uppercase",
            letterSpacing: "0.02em",
            fontSize: 62,
            lineHeight: 0.98,
            color: color.ink,
            ...textIn(8),
          }}
        >
          {seg.title}
        </div>
        <div style={{ marginTop: 28, height: 3, width: 64, background: color.stamp, ...textIn(10) }} />
        <div style={{ marginTop: 28, fontFamily: font.serif, fontSize: 31, lineHeight: 1.32, color: color.ink, ...textIn(14) }}>{seg.body}</div>
      </div>
    </AbsoluteFill>
  );
}

function Title() {
  const frame = useCurrentFrame();
  const rise = (delay: number) => ({
    opacity: interpolate(frame, [delay, delay + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    transform: `translateY(${interpolate(frame, [delay, delay + 22], [28, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })}px)`,
  });
  const out = interpolate(frame, [TITLE - 10, TITLE], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 140, opacity: out }}>
      <div style={{ ...label, fontSize: 26, color: color.blue, ...rise(2) }}>Nightly · today’s fixes</div>
      <div
        style={{
          marginTop: 20,
          fontFamily: font.poster,
          fontWeight: 860,
          fontStretch: "75%",
          fontSize: 230,
          lineHeight: 0.9,
          color: color.ink,
          ...rise(6),
        }}
      >
        Astro
      </div>
      <div style={{ marginTop: 18, fontFamily: font.poster, fontWeight: 700, fontStretch: "87.5%", fontSize: 92, color: color.stamp, ...rise(12) }}>
        {VERSION}
      </div>
      <Img
        src={staticFile("brand/app-icon.png")}
        style={{ position: "absolute", right: 170, top: 300, width: 480, height: 480, ...rise(10) }}
      />
    </AbsoluteFill>
  );
}

function Header() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [TITLE - 6, TITLE + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: BOX.x, top: 52, right: 70, display: "flex", justifyContent: "space-between", opacity }}>
      <div style={{ ...label, color: color.ink }}>Astro {VERSION}</div>
      <div style={label}>Captured in a hidden test instance</div>
    </div>
  );
}

export default function Video() {
  return (
    <AbsoluteFill style={{ background: color.paper }}>
      <Sequence durationInFrames={TITLE}>
        <Title />
      </Sequence>
      <Header />
      {all.map((seg, i) => (
        <Sequence key={seg.file} from={starts[i]} durationInFrames={lengths[i] + (i === all.length - 1 ? OUTRO : 0)}>
          <Shot seg={seg} index={i} length={lengths[i] + (i === all.length - 1 ? OUTRO : 0)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
