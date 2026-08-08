import css from './global.css?inline';
import {createRoot, type Root} from 'react-dom/client';
import {createElement} from 'react';
import {BloomThemeProvider} from '@oxyhq/bloom/theme';
import {SettingsListGroup, Switch} from '@oxyhq/bloom';
import {Search} from '@oxyhq/bloom/search';
import {ContentPanel} from '@oxyhq/bloom/content-panel';

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

/**
 * Chromium's settings search box, rendered as Bloom's Search.
 *
 * The control is not decoration here: settings filters its whole page from it.
 * Chromium's cr-toolbar-search-field announces changes with a `search-changed`
 * event carrying the query, and settings_ui listens for exactly that -- so this
 * element emits the same event with the same shape, and the search engine on
 * the other side needs no knowledge that the input was replaced.
 */
class AstroSearch extends HTMLElement {
  static observedAttributes = ['value', 'placeholder'];

  #root: Root | null = null;

  connectedCallback(): void {
    if (this.#root) {
      return;
    }
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
    const root = this.#root;
    this.#root = null;
    queueMicrotask(() => root?.unmount());
  }

  attributeChangedCallback(): void {
    this.#render();
  }

  get value(): string {
    return this.getAttribute('value') ?? '';
  }

  set value(next: string) {
    if (next) {
      this.setAttribute('value', next);
    } else {
      this.removeAttribute('value');
    }
  }

  // The rest of cr-toolbar-search-field's surface, as settings uses it: the
  // page syncs the box from the URL, focuses it on Ctrl+F, and asks whether it
  // has focus. Replacing the component without these leaves a search box that
  // takes typing and ignores a bookmarked ?search= URL.

  getValue(): string {
    return this.value;
  }

  setValue(next: string, noEvent?: boolean): void {
    if (noEvent) {
      this.value = next;
      return;
    }
    this.#emit(next);
  }

  showAndFocus(): void {
    this.#input()?.focus();
  }

  isSearchFocused(): boolean {
    const input = this.#input();
    if (!input) {
      return false;
    }
    // document.activeElement stops at the shadow boundary and reports the host
    // -- settings-ui -- for anything inside it. Ask the input's own root.
    const root = input.getRootNode() as Document | ShadowRoot;
    return root.activeElement === input;
  }

  // Bloom's Search renders a react-native-web TextInput, which is an <input>.
  // Read from the DOM rather than holding a React ref: refs do not resolve to
  // the DOM node on web for className'd react-native-css components.
  #input(): HTMLInputElement | null {
    return this.querySelector('input');
  }

  #emit(next: string): void {
    this.value = next;
    // The name and payload Chromium's own search field uses. Anything else
    // would render a search box that looks right and filters nothing.
    this.dispatchEvent(new CustomEvent(
        'search-changed', {detail: next, bubbles: true, composed: true}));
  }

  #render(): void {
    this.#root?.render(createElement(
        BloomThemeProvider,
        {mode: 'system', colorPreset: 'oxy'},
        createElement(Search, {
          value: this.value,
          placeholder: this.getAttribute('placeholder') ?? 'Search settings',
          onChangeText: (next: string) => this.#emit(next),
          onClearText: () => this.#emit(''),
        })));
  }
}

if (!customElements.get('astro-search')) {
  customElements.define('astro-search', AstroSearch);
}

/**
 * A settings section, rendered as Bloom's SettingsListGroup.
 *
 * Chromium's settings page draws every section the same way: a heading, then a
 * rounded card holding the rows. That is precisely Bloom's grouped section, so
 * this element IS one -- the card's radius, surface colour and spacing come
 * from Bloom rather than from a stylesheet imitating it.
 *
 * Unlike the other two elements here, this one owns a shadow root. It has to:
 * a slot only exists inside one, and the rows it groups are Chromium's own
 * elements, which stay exactly where they are and keep their own behaviour.
 * A single default slot, so the rows arrive as one block and Chromium's own
 * row separators keep drawing between them -- Bloom's per-child dividers would
 * be a second set on top.
 */
class AstroGroup extends HTMLElement {
  static observedAttributes = ['group-title', 'footer'];

  #root: Root | null = null;

  connectedCallback(): void {
    if (this.#root) {
      return;
    }
    installStyles();
    const shadow = this.attachShadow({mode: 'open'});
    shareStylesWith(shadow);
    if (!syncing) {
      syncing = true;
      startStyleSync();
    }
    const mount = document.createElement('div');
    shadow.append(mount);
    this.#root = createRoot(mount);
    this.#render();
  }

  disconnectedCallback(): void {
    const root = this.#root;
    this.#root = null;
    queueMicrotask(() => root?.unmount());
  }

  attributeChangedCallback(): void {
    this.#render();
  }

  #render(): void {
    this.#root?.render(createElement(
        BloomThemeProvider,
        {mode: 'system', colorPreset: 'oxy'},
        createElement(
            SettingsListGroup,
            {
              title: this.getAttribute('group-title') || undefined,
              footer: this.getAttribute('footer') || undefined,
            },
            createElement('slot', null))));
  }
}

if (!customElements.get('astro-group')) {
  customElements.define('astro-group', AstroGroup);
}

/**
 * A framed content pane, rendered as Bloom's ContentPanel.
 *
 * The same component and the same framing Alia's settings layout uses for its
 * two panes: a rounded, bordered surface with the page background showing
 * between them. Astro's settings is the same shape -- a section column beside a
 * content column -- so it is the same component rather than a second stylesheet
 * arriving at the same look.
 *
 * `framed` is forced on. ContentPanel's default is responsive (full-bleed below
 * `md`), and Chromium already swaps the menu column for a drawer at its own
 * breakpoint, so leaving both to decide would give two disagreeing answers
 * about what "narrow" means.
 */
class AstroPanel extends HTMLElement {
  #root: Root | null = null;

  connectedCallback(): void {
    if (this.#root) {
      return;
    }
    installStyles();
    const shadow = this.attachShadow({mode: 'open'});
    shareStylesWith(shadow);
    if (!syncing) {
      syncing = true;
      startStyleSync();
    }
    const mount = document.createElement('div');
    // The panel is a column in a flex row and has to be able to shrink; a
    // React root in a plain div would otherwise size to its content.
    mount.style.display = 'flex';
    mount.style.flex = '1';
    mount.style.minWidth = '0';
    mount.style.height = '100%';
    shadow.append(mount);
    this.#root = createRoot(mount);
    this.#root.render(createElement(
        BloomThemeProvider,
        {mode: 'system', colorPreset: 'oxy'},
        createElement(
            ContentPanel,
            {
              framed: true,
              // The page colour, not the card colour -- the same override Alia
              // makes for its own two panes. The grouped sections inside are
              // cards; on a card-coloured panel they would be white on white.
              surfaceClassName: 'bg-background',
            },
            createElement('slot', null))));
  }

  disconnectedCallback(): void {
    const root = this.#root;
    this.#root = null;
    queueMicrotask(() => root?.unmount());
  }
}

if (!customElements.get('astro-panel')) {
  customElements.define('astro-panel', AstroPanel);
}
