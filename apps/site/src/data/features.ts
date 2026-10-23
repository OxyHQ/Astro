import type { ImageMetadata } from "astro";
import type { Loop } from "../components/Shot.astro";
import type { Hour } from "../components/Plate.astro";
import addressToolbar from "../assets/shots/address-toolbar.webp";
import addressSidebar from "../assets/shots/address-sidebar.webp";
import split from "../assets/shots/split.webp";
import personal from "../assets/shots/profile-personal.webp";
import work from "../assets/shots/profile-work.webp";
import sideProject from "../assets/shots/profile-side-project.webp";
import extensions from "../assets/shots/extensions.webp";
import privacy from "../assets/shots/privacy.webp";
import pip from "../assets/shots/pip.webp";
import pipPoster from "../assets/shots/pip-loop-poster.webp";
import pipMp4 from "../assets/shots/pip-loop.mp4";
import pipWebm from "../assets/shots/pip-loop.webm";
import littleAstro from "../assets/shots/little-astro.webp";
import tabGroup from "../assets/shots/tab-group.webp";

interface Feature {
  id: string;
  title: string;
  body: string;
  shots: ImageMetadata[];
  alt: string;
  hour: Hour;
  sun: { x: number; y: number };
  flip?: boolean;
  panel?: boolean;
  loop?: Loop;
}

export const features: Feature[] = [
  {
    id: "address-bar",
    title: "Lose the toolbar.",
    body: "Move the address bar into the sidebar and the page runs all the way to the top of the window.",
    shots: [addressToolbar, addressSidebar],
    alt: "Two Astro windows on the same Wikipedia page: behind, the address bar in a toolbar above the page; in front, the address bar in the sidebar under the traffic lights and the page running to the top of the window.",
    hour: "morning",
    sun: { x: 0.18, y: 0.18 },
  },
  {
    id: "split",
    title: "Two pages, one window.",
    body: "Drag a tab onto the page. Up to three panes, side by side or stacked.",
    shots: [split],
    alt: "Astro in split view: MDN on the left, Wikipedia on the right, both in one window.",
    hour: "morning",
    sun: { x: 0.8, y: 0.14 },
    flip: true,
  },
  {
    id: "mini-player",
    title: "Refuses to leave the picture.",
    body: "Switch tabs mid-video and it floats along in the corner. Go back to its tab and it slips back into the page.",
    shots: [pip],
    alt: "Astro on Wikipedia’s article about Big Buck Bunny, while the film keeps playing in a small floating window at the bottom right. Its tab, muted, is in the sidebar, with a player at the foot of the sidebar.",
    hour: "noon",
    sun: { x: 0.5, y: 0.1 },
    loop: { mp4: pipMp4, webm: pipWebm, poster: pipPoster, rect: { x: 2170, y: 1384, w: 672, h: 378 } },
  },
  {
    id: "profiles",
    title: "Work stays at work.",
    body: "Each profile keeps its own logins, history, extensions and colour. Swipe the sidebar to switch.",
    shots: [sideProject, work, personal],
    alt: "Three Astro windows, one per profile, each tinted in its colour with its name next to the window buttons: Side project in orange, Work in blue and, in front, Personal in plum, its New Tab page showing the painted hills in plum.",
    hour: "noon",
    sun: { x: 0.86, y: 0.2 },
    flip: true,
  },
  {
    id: "extensions",
    title: "Your extensions come along.",
    body: "The Chrome Web Store just works, its button says Add to Astro, and Sync takes them to your other Macs.",
    shots: [extensions],
    alt: "Dark Reader’s page on the Chrome Web Store, open in Astro, with an Add to Astro button.",
    hour: "golden",
    sun: { x: 0.2, y: 0.3 },
  },
  {
    id: "privacy",
    title: "Ads and trackers stay out.",
    body: "The full uBlock Origin is built in, not the Lite one. Cookie banners included. Google’s pings are compiled out. Crash reports are opt-in and never carry your sites or searches.",
    shots: [privacy],
    alt: "Astro’s Privacy & Security settings: switches to block ads, trackers and cookie banners, and the number of filter rules loaded.",
    hour: "golden",
    sun: { x: 0.78, y: 0.4 },
    flip: true,
  },
];

export const duo: Feature[] = [
  {
    id: "little-astro",
    title: "Little Astro.",
    body: "⌥⌘N opens a small window with one page and no sidebar. For a quick look that doesn’t need a tab.",
    shots: [littleAstro],
    alt: "A Little Astro window: a small window with a thin bar in the profile’s colour above Wikipedia’s article on John Constable, and no sidebar.",
    hour: "golden",
    sun: { x: 0.82, y: 0.22 },
  },
  {
    id: "tab-groups",
    title: "Groups on contact.",
    body: "Drop a tab on a tab and they’re a group, named for you.",
    shots: [tabGroup],
    alt: "Astro’s sidebar with a new tab group called Wikipedia, made by dropping one Wikipedia tab onto another. The Hay Wain is open on the right.",
    hour: "golden",
    sun: { x: 0.2, y: 0.26 },
    flip: true,
  },
];

export const extras: { title: string; body: string }[] = [
  { title: "Moves in for you", body: "Bookmarks, history, passwords and logins from Chrome, Safari, Firefox, Arc, Dia and five more. Arc’s spaces, pinned tabs and themes too." },
  { title: "Paints like Arc", body: "Gradient themes per profile: up to three colours, some grain, some blur." },
  { title: "Syncs through your iCloud", body: "End-to-end encrypted, in a folder in your own iCloud Drive, so even Apple only sees gibberish. No server of ours in the middle." },
  { title: "Command bar", body: "⌘L finds tabs, history and bookmarks, does your sums, and knows doc.new and 16 friends." },
  { title: "Updates itself", body: "Quietly, then shows you what changed." },
  { title: "Tidies up", body: "⌥⌘K sweeps the tabs you haven’t touched into Recently Cleaned." },
  { title: "Clean links", body: "Copy a link and the tracking junk stays behind." },
  { title: "Keeps secrets", body: "Passwords and passkeys per profile, and a strong new password when you sign up somewhere." },
  { title: "Naps when you do", body: "Background tabs past your latest five freeze, and sleep after half an hour." },
  { title: "Knows your shortcuts", body: "Chrome’s and Dia’s. Where they disagree, Dia’s wins." },
  { title: "Now in glass", body: "Pinned tabs and the address bar in Liquid Glass, on macOS 26." },
  { title: "Sits still", body: "Idles under half a percent of CPU with a tab open." },
  { title: "Nightly, if you dare", body: "Settings › General puts you on Nightly: every fix the day it’s ready, and every stable release too." },
];
