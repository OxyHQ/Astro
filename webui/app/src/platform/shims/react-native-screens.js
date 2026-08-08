// Web shim for `react-native-screens` (native-only navigation primitives).
//
// An empty module is not enough: consumers use NAMED imports, which are
// link-time errors in dev's raw ESM serving even though Rollup only warns
// about them in a build. Bloom's native overlay wraps content in
// FullWindowOverlay; on web, rendering straight through is the correct
// behaviour -- the document already is the full window.
export function FullWindowOverlay({children}) {
  return children;
}
