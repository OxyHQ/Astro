import './style.css';
import {getAll, onChanged, type Pref} from './prefs.ts';
import {SECTIONS, sectionFor, labelFor} from './catalog.ts';
import {controlFor} from './controls.ts';

const ALL_ID = 'all';

let allPrefs: Pref[] = [];
let activeSection = SECTIONS[0]!.id;
let query = '';

function prefsFor(sectionId: string): Pref[] {
  const matching = sectionId === ALL_ID
      ? allPrefs
      : allPrefs.filter(pref => sectionFor(pref.key)?.id === sectionId);
  if (!query) {
    return matching;
  }
  const needle = query.toLowerCase();
  return matching.filter(
      pref => pref.key.toLowerCase().includes(needle) ||
              labelFor(pref.key).toLowerCase().includes(needle));
}

function buildSidebar(): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'w-60 shrink-0 py-4 pr-2';

  const entries = [...SECTIONS.map(s => ({id: s.id, title: s.title})),
                   {id: ALL_ID, title: 'All settings'}];

  for (const entry of entries) {
    const count = prefsFor(entry.id).length;
    const item = document.createElement('button');
    const selected = entry.id === activeSection;
    item.className =
        'w-full flex items-center justify-between gap-2 text-left ' +
        'rounded-lg px-3 py-2 text-sm transition-colors ' +
        (selected ? 'bg-violet-500/15 text-violet-200'
                  : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200');

    const title = document.createElement('span');
    title.textContent = entry.title;

    const badge = document.createElement('span');
    badge.className = 'text-[11px] tabular-nums ' +
        (selected ? 'text-violet-300/70' : 'text-neutral-600');
    badge.textContent = String(count);

    item.append(title, badge);
    item.addEventListener('click', () => {
      activeSection = entry.id;
      render();
    });
    nav.append(item);
  }
  return nav;
}

function buildContent(): HTMLElement {
  const main = document.createElement('main');
  main.className = 'flex-1 min-w-0 py-4';

  const prefs = prefsFor(activeSection);
  const heading = document.createElement('h2');
  heading.className = 'text-lg font-medium mb-3 px-1';
  heading.textContent =
      activeSection === ALL_ID
          ? 'All settings'
          : SECTIONS.find(s => s.id === activeSection)?.title ?? '';
  main.append(heading);

  if (prefs.length === 0) {
    // An empty section is stated, not left blank. A blank panel is what a
    // broken page looks like.
    const empty = document.createElement('p');
    empty.className = 'text-sm text-neutral-500 px-1';
    empty.textContent = query
        ? `Nothing here matches “${query}”.`
        : 'This browser exposes no preferences in this section.';
    main.append(empty);
    return main;
  }

  const card = document.createElement('div');
  card.className = 'rounded-xl border border-white/10 bg-white/[0.02]';
  for (const pref of prefs.sort((a, b) => a.key.localeCompare(b.key))) {
    card.append(controlFor(pref));
  }
  main.append(card);
  return main;
}

function render(): void {
  const app = document.getElementById('app')!;
  app.replaceChildren();

  const header = document.createElement('header');
  header.className =
      'sticky top-0 z-10 backdrop-blur bg-neutral-950/80 ' +
      'border-b border-white/10';

  const bar = document.createElement('div');
  bar.className = 'max-w-6xl mx-auto px-6 py-4 flex items-center gap-6';

  const title = document.createElement('h1');
  title.className = 'text-xl font-medium shrink-0';
  title.textContent = 'Settings';

  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Search settings';
  search.value = query;
  search.className =
      'flex-1 max-w-sm bg-white/5 border border-white/10 rounded-full ' +
      'px-4 py-1.5 text-sm placeholder:text-neutral-600 ' +
      'focus:outline-none focus:border-violet-500/60';
  search.addEventListener('input', () => {
    query = search.value;
    render();
    // Re-rendering replaces the field, so the caret has to be put back or
    // typing a second character focuses nothing.
    const next = document.querySelector<HTMLInputElement>('input[type=search]');
    next?.focus();
    next?.setSelectionRange(next.value.length, next.value.length);
  });

  const total = document.createElement('span');
  total.className = 'ml-auto text-xs text-neutral-500 tabular-nums shrink-0';
  total.textContent = `${allPrefs.length} preferences`;

  bar.append(title, search, total);
  header.append(bar);

  const layout = document.createElement('div');
  layout.className = 'max-w-6xl mx-auto px-6 flex gap-6';
  layout.append(buildSidebar(), buildContent());

  app.append(header, layout);
}

async function main(): Promise<void> {
  document.documentElement.className =
      'bg-neutral-950 text-neutral-100 antialiased';
  allPrefs = await getAll();
  render();
  // The browser is the source of truth: a pref changed in another window, by a
  // policy push or from the command line must move this page too.
  onChanged(() => {
    void getAll().then(prefs => { allPrefs = prefs; render(); });
  });
}

void main();
