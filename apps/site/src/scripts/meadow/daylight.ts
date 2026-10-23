import { directionFrom, type Framing, LIGHT_PEAK, MOONLIGHT_ELEVATION, moonPath, SHADOW_AZIMUTHS, sunPath } from "./layout";

export const DAWN_P = 0.06;
export const MORNING_P = 0.3;
export const GOLDEN_P = 0.84;

type Rgb = [number, number, number];

interface Key {
  p: number;
  horizon: string;
  low: string;
  mid: string;
  top: string;
  glow: string;
  glowStrength: number;
  key: Rgb;
  ambient: number;
  haze: number;
  mist: number;
  night: number;
}

const NIGHT: Omit<Key, "p"> = {
  horizon: "#2c416c",
  low: "#25375f",
  mid: "#1b2a50",
  top: "#111b38",
  glow: "#3b4f86",
  glowStrength: 0,
  key: [0.34, 0.5, 0.72],
  ambient: 0.62,
  haze: 1.4e-4,
  mist: 7e-4,
  night: 1,
};

const KEYS: Key[] = [
  { p: 0, ...NIGHT },
  { p: 0.06, horizon: "#e6998b", low: "#c98190", mid: "#9a83a8", top: "#7c85ab", glow: "#ff8a5c", glowStrength: 0.42, key: [0.95, 0.42, 0.26], ambient: 0.82, haze: 1.9e-4, mist: 1.2e-3, night: 0 },
  { p: 0.14, horizon: "#f4b08a", low: "#e3a8a0", mid: "#b8a7bd", top: "#919abb", glow: "#ffa064", glowStrength: 0.45, key: [1.35, 0.78, 0.46], ambient: 0.9, haze: 1.6e-4, mist: 7e-4, night: 0 },
  { p: 0.3, horizon: "#f7e5c2", low: "#f3e8d4", mid: "#e1e4dc", top: "#bccfd9", glow: "#ffcf7c", glowStrength: 0.26, key: [2.05, 1.62, 1.08], ambient: 1, haze: 1.1e-4, mist: 1.5e-4, night: 0 },
  { p: 0.58, horizon: "#f4ead6", low: "#ebe8dc", mid: "#d6e0e0", top: "#aec7d7", glow: "#ffe0a0", glowStrength: 0.2, key: [2.25, 1.92, 1.42], ambient: 1.05, haze: 1e-4, mist: 1e-4, night: 0 },
  { p: 0.84, horizon: "#f8c47c", low: "#f2cd9c", mid: "#e2bfa4", top: "#b9b0b6", glow: "#ffb35a", glowStrength: 0.5, key: [2.15, 1.3, 0.58], ambient: 0.95, haze: 1.6e-4, mist: 3e-4, night: 0 },
  { p: 0.92, horizon: "#ef9070", low: "#c96f76", mid: "#b36871", top: "#5d5281", glow: "#ff7a4f", glowStrength: 0.55, key: [1.05, 0.44, 0.3], ambient: 0.74, haze: 1.8e-4, mist: 8e-4, night: 0.15 },
  { p: 1, ...NIGHT },
];

const linear = (hex: string): Rgb => {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((c) => (c / 255) ** 2.2) as Rgb;
};
const LINEAR = KEYS.map((key) => ({
  horizon: linear(key.horizon),
  low: linear(key.low),
  mid: linear(key.mid),
  top: linear(key.top),
  glow: linear(key.glow),
}));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const smooth = (t: number) => t * t * (3 - 2 * t);
const degrees = (value: number) => (value * Math.PI) / 180;
const KEY_HANDOVER = 0.16;

export interface Daylight {
  sunDir: [number, number, number];
  sunElevation: number;
  keyDir: [number, number, number];
  keyColor: Rgb;
  keyElevation: number;
  moonDir: [number, number, number];
  moonElevation: number;
  skyHorizon: Rgb;
  skyLow: Rgb;
  skyMid: Rgb;
  skyTop: Rgb;
  glow: Rgb;
  ambient: number;
  haze: number;
  mist: number;
  night: number;
  shadowMix: [number, number, number, number];
  topLuminance: number;
}

export function daylightAt(p: number, framing: Framing, moon = 0.5): Daylight {
  const clamped = Math.min(1, Math.max(0, p));
  let index = 0;
  while (index < KEYS.length - 2 && KEYS[index + 1].p <= clamped) index++;
  const a = KEYS[index];
  const b = KEYS[index + 1];
  const t = smooth((clamped - a.p) / Math.max(1e-6, b.p - a.p));
  const la = LINEAR[index];
  const lb = LINEAR[index + 1];
  const night = mix(a.night, b.night, t);
  const sun = sunPath(clamped, framing.sunPeak, framing.sunCeiling, framing.sunSweep);
  const sunDir = directionFrom(sun.azimuth, sun.elevation);
  const lightSun = sunPath(clamped, LIGHT_PEAK);
  const moonSky = moonPath(moon, framing);
  const moonAzimuth = degrees(30) + (degrees(6) - degrees(30)) * Math.min(1, Math.max(0, moon));
  const moonElevation = degrees(-5) + (MOONLIGHT_ELEVATION + degrees(5)) * moonSky.arc;
  const moonDir = directionFrom(moonSky.azimuth, moonSky.elevation);
  const keyIsMoon = night > 0.5;
  const keyStrength = keyIsMoon ? smooth(Math.min(1, (night - 0.5) / KEY_HANDOVER)) : smooth(Math.min(1, (0.5 - night) / KEY_HANDOVER));
  const keyAzimuth = keyIsMoon ? moonAzimuth : lightSun.azimuth;
  const keyElevation = keyIsMoon ? moonElevation : lightSun.elevation;
  const glowStrength = mix(a.glowStrength, b.glowStrength, t);
  const skyTop = mixRgb(la.top, lb.top, t);
  return {
    sunDir,
    sunElevation: sun.elevation,
    keyDir: directionFrom(keyAzimuth, keyElevation),
    keyColor: mixRgb(a.key, b.key, t).map((c) => c * keyStrength) as Rgb,
    keyElevation,
    moonDir,
    moonElevation: moonSky.elevation,
    skyHorizon: mixRgb(la.horizon, lb.horizon, t),
    skyLow: mixRgb(la.low, lb.low, t),
    skyMid: mixRgb(la.mid, lb.mid, t),
    skyTop,
    glow: mixRgb(la.glow, lb.glow, t).map((c) => c * glowStrength) as Rgb,
    ambient: mix(a.ambient, b.ambient, t),
    haze: mix(a.haze, b.haze, t),
    mist: mix(a.mist, b.mist, t),
    night,
    shadowMix: shadowWeights(keyAzimuth),
    topLuminance: 0.2126 * skyTop[0] + 0.7152 * skyTop[1] + 0.0722 * skyTop[2],
  };
}

function shadowWeights(azimuth: number): [number, number, number, number] {
  const weights: [number, number, number, number] = [0, 0, 0, 0];
  if (azimuth >= SHADOW_AZIMUTHS[0]) {
    weights[0] = 1;
    return weights;
  }
  for (let i = 0; i < SHADOW_AZIMUTHS.length - 1; i++) {
    const high = SHADOW_AZIMUTHS[i];
    const low = SHADOW_AZIMUTHS[i + 1];
    if (azimuth <= high && azimuth >= low) {
      const t = (high - azimuth) / (high - low);
      weights[i] = 1 - t;
      weights[i + 1] = t;
      return weights;
    }
  }
  weights[3] = 1;
  return weights;
}
