import { track, type Props } from "./track";

function onTrackedClick(e: MouseEvent) {
  const el = (e.target as Element | null)?.closest<HTMLElement>("[data-track]");
  if (!el) return;
  const props: Props = {};
  for (const [k, v] of Object.entries(el.dataset)) {
    if (k.startsWith("track") && k !== "track" && v !== undefined) {
      const name = k.slice(5).replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`).replace(/^_/, "");
      props[name] = v;
    }
  }
  const leaves = el instanceof HTMLAnchorElement && el.origin !== location.origin && !el.hasAttribute("download");
  track(el.dataset.track!, props, leaves ? { send_instantly: true } : undefined);
}
document.addEventListener("click", onTrackedClick, { capture: true });

const sections = document.querySelectorAll<HTMLElement>("[data-shot]");
if (sections.length) {
  const seen = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        seen.unobserve(e.target);
        track("section_viewed", { section: (e.target as HTMLElement).dataset.shot ?? null });
      }
    },
    { threshold: 0.35 },
  );
  for (const s of sections) seen.observe(s);
}

const sentRef = new URLSearchParams(location.search).get("ref");
if (sentRef === "mac" || sentRef === "share" || sentRef === "email") {
  let seen = false;
  try {
    seen = sessionStorage.getItem("ac:mac_link_visit") === "1";
    sessionStorage.setItem("ac:mac_link_visit", "1");
  } catch {}
  if (!seen) track("mac_link_visit", { ref: sentRef, device: document.documentElement.dataset.device ?? null });
}

const { device, os } = document.documentElement.dataset;
if (device === "other") {
  let seen = false;
  try {
    seen = sessionStorage.getItem("ac:non_mac_visit") === "1";
    sessionStorage.setItem("ac:non_mac_visit", "1");
  } catch {}
  if (!seen) track("non_mac_visit", { os: os ?? null });
}
