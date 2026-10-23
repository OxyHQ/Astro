import posters from "../assets/hero/posters.json";

type Tone = "light" | "dark";
type FrameName = "wider" | "wide" | "laptop" | "mid" | "tall";
type StateName = "dawn" | "morning";

interface Captured {
  state: string;
  frame: string;
  width: number;
  height: number;
  files: { file: string; width: number; height: number }[];
  lqip: string;
  tones: Record<string, { tone: string; halo: number }>;
  sky: string;
  headerHalo: number;
}

const urls = import.meta.glob<string>("../assets/hero/*.webp", { query: "?url", import: "default", eager: true });

const FRAMES: Record<FrameName, { media: string[]; horizon: string }> = {
  tall: { media: ["(max-aspect-ratio: 9/10) and (max-width: 820px)"], horizon: "67%" },
  mid: {
    media: ["(min-aspect-ratio: 9001/10000) and (max-aspect-ratio: 13/10)", "(max-aspect-ratio: 9/10) and (min-width: 820.01px)"],
    horizon: "65%",
  },
  laptop: { media: ["(min-aspect-ratio: 13001/10000) and (max-aspect-ratio: 8/5) and (max-width: 1716px)"], horizon: "65%" },
  wide: {
    media: [
      "(min-aspect-ratio: 8001/5000) and (max-aspect-ratio: 16/9) and (max-width: 1991px)",
      "(min-aspect-ratio: 13001/10000) and (max-aspect-ratio: 8/5) and (min-width: 1716.01px) and (max-width: 1991px)",
    ],
    horizon: "65%",
  },
  wider: { media: ["(min-aspect-ratio: 16001/9000)", "(min-aspect-ratio: 13001/10000) and (min-width: 1991.01px)"], horizon: "65%" },
};
const STATES: Record<StateName, string> = {
  dawn: "(prefers-reduced-motion: no-preference)",
  morning: "(prefers-reduced-motion: reduce)",
};

export interface HeroPoster {
  key: string;
  media: string;
  src: string;
  srcset: string;
  sizes: string;
  width: number;
  height: number;
  horizon: string;
  lqip: string;
  fallback: boolean;
  tones: Record<string, [Tone, string]>;
  sky: Tone;
  headerHalo: string;
}

const halo = (value: number) => (Math.round(value / 0.05) * 0.05).toFixed(2);

export const HERO_POSTERS: HeroPoster[] = (posters as Captured[]).map((poster) => {
  const frame = FRAMES[poster.frame as FrameName];
  const files = [...poster.files].sort((a, b) => a.width - b.width);
  const url = (file: string) => urls[`../assets/hero/${file}`];
  const aspect = poster.width / poster.height;
  return {
    key: `${poster.state}-${poster.frame}`,
    media: frame.media.map((query) => `${STATES[poster.state as StateName]} and ${query}`).join(", "),
    src: url(files[files.length - 1].file),
    srcset: files.map((file) => `${url(file.file)} ${file.width}w`).join(", "),
    sizes: `max(100vw, ${Math.ceil(aspect * 100)}vh)`,
    width: poster.width,
    height: poster.height,
    horizon: frame.horizon,
    lqip: poster.lqip,
    fallback: poster.state === "dawn" && poster.frame === "wide",
    tones: Object.fromEntries(Object.entries(poster.tones).map(([group, value]) => [group, [value.tone as Tone, halo(value.halo)]])),
    sky: poster.sky as Tone,
    headerHalo: halo(poster.headerHalo),
  };
});

export const HERO_POSTER_FALLBACK = HERO_POSTERS.find((poster) => poster.fallback)!;

const posterRule = (poster: HeroPoster) =>
  `.hero-poster{background-image:url("${poster.lqip}");background-position:50% ${poster.horizon}}.hero-poster img{object-position:50% ${poster.horizon}}`;

export const HERO_POSTER_CSS = [posterRule(HERO_POSTER_FALLBACK), ...HERO_POSTERS.map((poster) => `@media ${poster.media}{${posterRule(poster)}}`)].join("");
