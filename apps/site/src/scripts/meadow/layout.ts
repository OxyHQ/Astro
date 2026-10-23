export const TERRAIN_NEAR = 1;
export const TERRAIN_FAR = 16000;
export const TERRAIN_WIDTH = 6;
export const TERRAIN_SLOPE = 1.05;
export const HEIGHT_MIN = -60;
export const HEIGHT_RANGE = 2300;

export const GRASS_SEGMENTS = 6;
export const GRASS_NEAR = 1.5;
export const GRASS_FAR = 46;
export const GRASS_ROOT_WIDTH = 0.3;
export const GRASS_DEPTH_CURVE = 0.62;

export const CAMERA_HEIGHT = 0.72;
export const SUN_RADIUS = (2.5 * Math.PI) / 180;
export const SHADOW_AZIMUTHS = [34, 10, -18, -46].map((deg) => (deg * Math.PI) / 180);

const degrees = (value: number) => (value * Math.PI) / 180;
const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export interface Framing {
  verticalFov: number;
  pitch: number;
  yaw: number;
  sunPeak: number;
  sunCeiling: number;
  sunSweep: number;
  sunRadius: number;
  hillScale: number;
  moonRise: number;
  moonSet: number;
  moonPeak: number;
}

export const LIGHT_PEAK = degrees(26);
export const LIGHT_MOON_PEAK = degrees(14);
export const MOONLIGHT_ELEVATION = degrees(34);
const SUN_SET_DEPTH = degrees(6);
const MOON_SET_DEPTH = degrees(6);
const STACKED_SUN_SCALE = 0.8;
const STACKED_HILL_SCALE = 0.7;
const STACKED_FOV = degrees(72);
const STACKED_RISE = 1.9;

export function framingFor(aspect: number, clear = 0, horizon = 0): Framing {
  const wide = smooth(0.55, 1.45, aspect);
  if (aspect >= 0.9 || clear < 0.3 || clear > 0.85) {
    const verticalFov = degrees(62 + (40 - 62) * wide);
    const tanHalf = Math.tan(verticalFov / 2);
    const horizonNdc = -0.4 + 0.1 * wide;
    const sunPeak = degrees(27 - 1 * wide);
    const across = tanHalf * Math.max(aspect, 0.9);
    return {
      verticalFov,
      pitch: Math.atan(-horizonNdc * tanHalf),
      yaw: 0,
      sunPeak,
      sunCeiling: sunPeak,
      sunSweep: 1,
      sunRadius: SUN_RADIUS,
      hillScale: 1,
      moonRise: Math.atan(0.86 * across),
      moonSet: Math.atan(0.36 * across),
      moonPeak: LIGHT_MOON_PEAK,
    };
  }
  const verticalFov = STACKED_FOV;
  const tanHalf = Math.tan(verticalFov / 2);
  const horizonNdc = 1 - 2 * Math.max(clear + 0.1, Math.min(horizon, clear + (1 - clear) * 0.5));
  const pitch = Math.atan(-horizonNdc * tanHalf);
  const sunRadius = SUN_RADIUS * STACKED_SUN_SCALE;
  const sunNdc = 1 - 2 * (clear + (sunRadius / tanHalf / 2) * 1.25 + 0.006);
  const ceiling = Math.max(degrees(4), pitch + Math.atan(sunNdc * tanHalf));
  return {
    verticalFov,
    pitch,
    yaw: 0,
    sunPeak: (ceiling + SUN_SET_DEPTH) * STACKED_RISE,
    sunCeiling: ceiling,
    sunRadius,
    hillScale: STACKED_HILL_SCALE,
    sunSweep: Math.min(1, Math.max(0.3, Math.atan(0.38 * tanHalf * aspect) / degrees(10))),
    moonRise: Math.atan(0.78 * tanHalf * aspect),
    moonSet: Math.atan(0.3 * tanHalf * aspect),
    moonPeak: Math.min(LIGHT_MOON_PEAK, ceiling),
  };
}

export function sunPath(p: number, peak: number, ceiling = peak, sweep = 1) {
  const arc = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, p))));
  return {
    azimuth: (degrees(16.2) + (degrees(-4.6) - degrees(16.2)) * p) * sweep,
    elevation: Math.min(ceiling, -SUN_SET_DEPTH + peak * arc ** 0.8),
  };
}

export function moonPath(moon: number, framing: Framing) {
  const m = Math.min(1, Math.max(0, moon));
  const arc = Math.sin(Math.PI * m) ** 0.6;
  return {
    azimuth: framing.moonRise + (framing.moonSet - framing.moonRise) * m,
    elevation: -MOON_SET_DEPTH + (framing.moonPeak + MOON_SET_DEPTH) * arc,
    arc,
  };
}

export function directionFrom(azimuth: number, elevation: number): [number, number, number] {
  return [Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation)];
}
