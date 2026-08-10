// Astro's mark, as a component.
//
// One copy for the whole app rather than an inline `<svg>` per page, which is
// what the two pages this replaces had: byte-identical path data pasted into
// `webui/alia/src/alia-panel.ts` and `webui/whats-new/src/index.html`, one of
// them with the size overridden by a string replacement on the markup.
//
// The path data is `branding/astro-logo-colored.svg` verbatim, transform
// included. Chromium's own logo pipeline reads that directory too
// (`tools/apply-branding.sh`), so the mark a page draws and the mark the
// installer writes come from one source rather than from two that agree today.
//
// The colour is the CALLER's, never the file's. The committed SVG carries
// `fill="#c46ede"`, and a hard-coded oxy fuchsia is exactly what the port
// exists to remove: a page that keeps its own palette does not re-theme when
// the browser does.

import Svg, {G, Path} from 'react-native-svg';

/**
 * The two subpaths of `branding/astro-logo-colored.svg`, and the transform its
 * `<g>` carries.
 *
 * The transform is kept rather than baked into the coordinates. Pre-multiplying
 * it would produce numbers no diff could ever be checked against the branding
 * file again, for the sake of one attribute.
 */
const MARK_PATHS = [
  'M936 1454 c37 -22 114 -116 114 -139 0 -4 22 -44 49 -89 75 -124 89 -148 ' +
    '112 -191 24 -45 87 -153 207 -357 101 -171 120 -228 102 -293 -17 -62 -61 ' +
    '-120 -110 -145 -91 -47 -434 -36 -566 18 -136 55 -246 148 -315 267 -77 132 ' +
    '-94 192 -93 335 1 141 25 223 107 362 30 51 66 114 81 140 67 119 199 158 ' +
    '312 92z',
  'M361 586 c108 -45 154 -170 101 -273 -34 -65 -83 -93 -162 -93 -81 0 -124 ' +
    '21 -165 81 -25 37 -30 54 -30 104 0 50 5 67 30 105 52 76 148 109 226 76z',
] as const;

const MARK_TRANSFORM = 'translate(0,169) scale(0.1,-0.1)';

export interface AstroMarkProps {
  /** Edge length in CSS pixels. The mark is not square; this is its height. */
  size: number;
  /** A resolved colour, never a class: SVG fills do not come from className. */
  fill: string;
}

export function AstroMark({size, fill}: AstroMarkProps) {
  // The viewBox is the branding file's own, so the aspect ratio is the mark's
  // rather than a square it would be squashed into.
  return (
    <Svg width={(size * 163) / 169} height={size} viewBox="0 0 163 169">
      <G transform={MARK_TRANSFORM} fill={fill}>
        {MARK_PATHS.map(path => (
          <Path key={path} d={path} />
        ))}
      </G>
    </Svg>
  );
}
