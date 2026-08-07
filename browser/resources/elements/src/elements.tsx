import css from './global.css?inline';
import {createRoot, type Root} from 'react-dom/client';
import {createElement} from 'react';
import {BloomThemeProvider} from '@oxyhq/bloom/theme';
import {Switch} from '@oxyhq/bloom';

// Bloom's components, as custom elements Chromium's Polymer WebUI can use.
//
// Each element owns a shadow root, adopts the Bloom/Tailwind stylesheet into
// it, and mounts a React root. The stylesheet has to be adopted PER ELEMENT:
// react-native-css emits real CSS classes on web, and a class in a shadow root
// resolves against that root's own styles, not the document's. A document-level
// stylesheet would leave every layout utility inert while colours still applied
// -- the page would look almost right, which is the worst way for this to fail.
// The stylesheet goes into the HOST DOCUMENT, once, not into a shadow root.
//
// react-native-web generates its atomic classes at RUNTIME (`r-1loqt21`,
// `css-g5y9jx`) and injects them into document.head. A component rendered
// inside a shadow root therefore carries class names that resolve to nothing:
// measured, the switch's thumb rendered with a transparent background and the
// track as a flat pill, because every react-native-web rule lived one DOM tree
// away from the element using it.
//
// This is what the Oxy console does implicitly by rendering into the page. The
// element does the same, so Bloom behaves here exactly as it does there.
let stylesInstalled = false;

/**
 * Make the document's stylesheets reachable from a shadow root.
 *
 * react-native-web builds its atomic classes at RUNTIME and appends them to a
 * single <style id="react-native-stylesheet"> in document.head. Chromium's
 * settings controls are Polymer components, so anything embedded in one lives
 * inside a shadow root -- and document stylesheets do not cross that boundary.
 *
 * The rules were all present and correctly ordered: `.css-g5y9jx` sets a
 * transparent background at index 5, `.r-14lw9ot` sets white at index 125, and
 * later wins. They simply never applied, because they were one DOM tree away
 * from the element carrying the classes. The Oxy console never meets this: its
 * whole app renders in the document.
 *
 * So the sheet is adopted into each host shadow root, and re-adopted as
 * react-native-web appends to it -- it grows lazily, the first time a component
 * uses a style, which is after this element first mounts.
 */
const adoptedRoots = new Map<ShadowRoot, {sheet: CSSStyleSheet; count: number}>();

/** Serialise every document stylesheet that carries rules we need. */
function collectDocumentCss(): {text: string; count: number} {
  let text = '';
  let count = 0;
  for (const sheet of Array.from(document.styleSheets)) {
    const owner = sheet.ownerNode as Element | null;
    const id = owner?.id ?? '';
    const isOurs = id === 'react-native-stylesheet' ||
        (owner?.hasAttribute?.('data-astro-bloom') ?? false);
    if (!isOurs) {
      continue;
    }
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      // A cross-origin sheet cannot be read. Ours never are, so this is a
      // sheet we did not mean to copy.
      continue;
    }
    for (const rule of Array.from(rules)) {
      text += rule.cssText + '\n';
      count++;
    }
  }
  return {text, count};
}

function shareStylesWith(root: ShadowRoot): void {
  const existing = adoptedRoots.get(root);
  const {text, count} = collectDocumentCss();
  if (existing) {
    if (count !== existing.count) {
      existing.sheet.replaceSync(text);
      existing.count = count;
    }
    return;
  }

  const sheet = new CSSStyleSheet();
  sheet.replaceSync(text);
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  adoptedRoots.set(root, {sheet, count});
}

/**
 * Keep every adopted copy current.
 *
 * react-native-web adds its rules through CSSOM insertRule, NOT by writing into
 * the <style> element's text -- so the node's textContent stays empty and a
 * MutationObserver on document.head never fires. Both were tried: reading
 * textContent produced an empty sheet, and observing the DOM produced no
 * callbacks at all.
 *
 * The rule COUNT is the signal instead. It only grows, and only when a
 * component renders a style for the first time, so this settles within a frame
 * or two of a page's controls appearing and then stops doing anything.
 */
function startStyleSync(): void {
  const tick = () => {
    for (const root of adoptedRoots.keys()) {
      shareStylesWith(root);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

let syncing = false;

function installStyles(): void {
  if (stylesInstalled) {
    return;
  }
  stylesInstalled = true;
  const style = document.createElement('style');
  style.setAttribute('data-astro-bloom', '');
  style.textContent = css;
  document.head.append(style);
}

class AstroSwitch extends HTMLElement {
  static observedAttributes = ['checked', 'disabled'];

  #root: Root | null = null;

  connectedCallback(): void {
    if (this.#root) {
      return;
    }
    // No shadow root. Encapsulation would cut the component off from the
    // react-native-web runtime styles it needs; Bloom's own classes and
    // react-native-web's hashed atomic classes provide the isolation instead.
    installStyles();
    const root = this.getRootNode();
    if (root instanceof ShadowRoot) {
      shareStylesWith(root);
      if (!syncing) {
        syncing = true;
        startStyleSync();
      }
    }
    const mount = document.createElement('div');
    this.append(mount);
    this.#root = createRoot(mount);
    this.#render();
  }

  disconnectedCallback(): void {
    // Unmount on the next task: Polymer detaches and re-attaches nodes while
    // re-rendering a list, and unmounting synchronously inside that would tear
    // down a root React is still committing to.
    const root = this.#root;
    this.#root = null;
    queueMicrotask(() => root?.unmount());
  }

  attributeChangedCallback(): void {
    this.#render();
  }

  get checked(): boolean {
    return this.hasAttribute('checked');
  }

  set checked(value: boolean) {
    this.toggleAttribute('checked', value);
  }

  #render(): void {
    // Exactly what the Oxy console mounts. Bloom writes its palette to the
    // document and owns the --color-* namespace, which is safe here because
    // Chromium's own tokens no longer read through it -- the indirection they
    // used resolved to nothing on a WebUI page and was removed at its source
    // in cr_shared_vars.css. Anything less than that was a workaround, and two
    // of them were tried and deleted: stripping the provider's writes with a
    // MutationObserver, and rewriting :root in its stylesheet.
    this.#root?.render(createElement(
        BloomThemeProvider,
        {mode: 'system', colorPreset: 'oxy'},
        createElement(Switch, {
          value: this.checked,
          disabled: this.hasAttribute('disabled'),
          onValueChange: (next: boolean) => {
            this.checked = next;
            // Polymer's two-way binding listens for a `change` event carrying
            // the new value, so this is what makes `checked="{{...}}"` work
            // against a component Polymer knows nothing about.
            this.dispatchEvent(new CustomEvent(
                'change', {detail: next, bubbles: true, composed: true}));
          },
        })));
  }
}

if (!customElements.get('astro-switch')) {
  customElements.define('astro-switch', AstroSwitch);
}
