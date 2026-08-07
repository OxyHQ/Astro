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
const sheet = new CSSStyleSheet();
sheet.replaceSync(css);

class AstroSwitch extends HTMLElement {
  static observedAttributes = ['checked', 'disabled'];

  #root: Root | null = null;

  connectedCallback(): void {
    if (this.#root) {
      return;
    }
    const shadow = this.attachShadow({mode: 'open'});
    shadow.adoptedStyleSheets = [sheet];
    const mount = document.createElement('div');
    shadow.append(mount);
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
    this.#root?.render(createElement(
        BloomThemeProvider, null,
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
