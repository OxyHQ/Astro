// The props react-native-web adds to React Native's own.
//
// `react-native` resolves to react-native-web at build time (the Vite plugin
// aliases it) but to React Native's TYPES at check time, because that is the
// package whose `types` field tsc finds. react-native-web's `View` accepts
// `href` and renders a real `<a>` when it is given one; React Native's
// `ViewProps` has no such field, so the two disagree and only the type side
// says so.
//
// This matters more than a missing type. Without `href` the alternative is a
// Pressable that calls `location.assign`, which looks identical and is not:
// middle-click, ctrl-click, "open in new tab", "copy link address" and the
// status bar preview all come from the element being an anchor. A link on the
// new tab page that cannot be opened in a background tab is a link that is
// broken for the way people use a new tab page.
//
// Declared rather than cast. `as any` at each call site would hide exactly the
// same disagreement in seven places instead of naming it once here.

import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    /**
     * Renders the View as an `<a>` with this address. Web only; React Native
     * ignores it, which is correct — there is no anchor on a phone.
     */
    href?: string | undefined;
    hrefAttrs?:
      | {
          download?: string | boolean | undefined;
          rel?: string | undefined;
          target?: string | undefined;
        }
      | undefined;
  }
}
