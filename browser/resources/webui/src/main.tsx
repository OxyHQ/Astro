// Astro's internal pages, as ONE app.
//
// Every astro:// page the browser owns -- settings today, history, downloads,
// extensions, bookmarks and the panels next -- is a route in this single Vite +
// Tailwind + Bloom app, not an app of its own. They share one shell, one design
// system and one bundle; a fix to a row or a colour lands in all of them at
// once, which is the whole reason for building them on Bloom rather than on
// each page's own stylesheet.
//
// The route is the HOST, because that is what Chromium navigates to:
// astro://settings and astro://history are separate origins served the same
// bytes by the same C++ controller (see //astro/browser/webui). The path
// segments below the host belong to the page.

import './global.css';

import {createRoot} from 'react-dom/client';
import {BloomThemeProvider} from '@oxyhq/bloom/theme';

import {SettingsPage} from './pages/settings/settings-page.tsx';

const PAGES: Record<string, () => React.JSX.Element> = {
  settings: SettingsPage,
  // Temporary. Chromium's own settings keeps serving astro://settings until
  // this page covers what it covers; deleting this line and the matching host
  // in //astro/common/url_constants.h IS the cutover.
  'settings-next': SettingsPage,
};

function resolvePage(): () => React.JSX.Element {
  const page = PAGES[location.hostname];
  if (!page) {
    // Not a soft failure with a friendly placeholder. A host reaching this
    // bundle means a C++ WebUIConfig was registered for a page this app does
    // not implement, and a placeholder would ship as if the page existed.
    throw new Error(
        `no astro:// page is registered for host "${location.hostname}"; ` +
        `add it to PAGES in main.tsx, or stop registering a WebUIConfig ` +
        `for it in //astro/browser/webui/astro_web_ui_configs.cc`);
  }
  return page;
}

const container = document.getElementById('root');
if (!container) {
  // A missing root means the HTML and this bundle have drifted apart; the page
  // would come up blank with nothing in the console to say why.
  throw new Error('#root is missing from the document');
}

const Page = resolvePage();
createRoot(container).render(
    <BloomThemeProvider mode="system" colorPreset="oxy">
      <Page />
    </BloomThemeProvider>);
