type Option = { value: string; label: string; hint?: string; disabled?: boolean };
type Control =
  | { kind: "choice"; id: string; label: string; value: string; options: Option[] }
  | { kind: "action"; id: string; label: string; hint: string; on?: boolean };
type Outbound = { type: "astro-demo:ready" } | { type: "astro-demo:engaged" } | { type: "astro-demo:controls"; controls: Control[] };

const DESKTOP_LOGICAL_WIDTH = 1100;
const PHONE_LOGICAL_WIDTH = 640;
const PHONE_BOX_WIDTH = 400;
const DESKTOP_BOX_WIDTH = 860;
const REVEAL_FALLBACK_MS = 1500;
const NUDGE_DELAY_MS = 900;
const FAR_SCREENS = 1;

const root = document.querySelector<HTMLElement>("[data-demo]");
const stage = root?.querySelector<HTMLElement>("[data-demo-stage]");
const poster = root?.querySelector<HTMLElement>("[data-demo-poster]");
const bar = document.querySelector<HTMLElement>("[data-demo-controls]");
const tilt = root?.closest<HTMLElement>("[data-settle]");
const settles = matchMedia("(prefers-reduced-motion: no-preference)");

function afterSettling(el: HTMLElement | null | undefined, run: () => void) {
  if (!el || !settles.matches) return run();
  const wait = () => {
    const moving = el.getAnimations().filter((a) => a.playState === "running");
    if (!moving.length) return run();
    void Promise.allSettled(moving.map((a) => a.finished)).then(run);
  };
  if (el.classList.contains("in")) return wait();
  const watch = new MutationObserver(() => {
    if (!el.classList.contains("in")) return;
    watch.disconnect();
    requestAnimationFrame(wait);
  });
  watch.observe(el, { attributes: true, attributeFilter: ["class"] });
}

function minLogicalWidth(boxWidth: number) {
  const t = Math.min(1, Math.max(0, (boxWidth - PHONE_BOX_WIDTH) / (DESKTOP_BOX_WIDTH - PHONE_BOX_WIDTH)));
  return PHONE_LOGICAL_WIDTH + t * (DESKTOP_LOGICAL_WIDTH - PHONE_LOGICAL_WIDTH);
}

function fit(frame: HTMLIFrameElement, box: HTMLElement) {
  const { width, height } = box.getBoundingClientRect();
  if (!width || !height) return;
  const logicalWidth = Math.max(width, minLogicalWidth(width));
  const scale = width / logicalWidth;
  frame.style.width = `${logicalWidth}px`;
  frame.style.height = `${height / scale}px`;
  frame.style.transform = `scale(${scale})`;
  box.style.setProperty("--demo-scale", String(scale));
}

function title(label: string, hint?: string) {
  return hint ? `${label} (${hint})` : label;
}

function button(control: Control, option?: Option) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "demo-control";
  el.dataset.track = "demo_control";
  el.dataset.trackControl = control.id;
  if (option) {
    el.setAttribute("role", "radio");
    el.dataset.value = option.value;
    el.dataset.trackValue = option.value;
    el.textContent = option.label;
    el.title = title(`${control.label}: ${option.label}`, option.hint);
  } else if (control.kind === "action") {
    el.textContent = control.label;
    el.title = title(control.label, control.hint);
  }
  el.addEventListener("mousedown", (e) => e.preventDefault());
  return el;
}

function renderControls(frame: HTMLIFrameElement, controls: Control[], target: HTMLElement) {
  const shape = JSON.stringify(controls.map((c) => [c.id, c.kind === "choice" ? c.options.map((o) => o.value + o.label) : c.label]));
  if (target.dataset.shape !== shape) {
    target.dataset.shape = shape;
    target.replaceChildren();
    let actions: HTMLElement | null = null;
    for (const control of controls) {
      if (control.kind === "action") {
        if (!actions) {
          actions = document.createElement("div");
          actions.className = "demo-group";
          target.append(actions);
        }
        const el = button(control);
        el.addEventListener("click", () => {
          root?.setAttribute("data-engaged", "");
          if (control.id === "command" || control.id === "newTab") frame.focus();
          frame.contentWindow?.postMessage({ type: "astro-demo:control", id: control.id }, "*");
        });
        actions.append(el);
        continue;
      }
      const group = document.createElement("div");
      group.className = "demo-group";
      group.setAttribute("role", "radiogroup");
      group.setAttribute("aria-label", control.label);
      const label = document.createElement("span");
      label.className = "label demo-label";
      label.textContent = control.label;
      group.append(label);
      for (const option of control.options) {
        const el = button(control, option);
        el.addEventListener("click", () => {
          root?.setAttribute("data-engaged", "");
          frame.contentWindow?.postMessage({ type: "astro-demo:control", id: control.id, value: option.value }, "*");
        });
        group.append(el);
      }
      target.append(group);
    }
  }
  const buttons = [...target.querySelectorAll<HTMLButtonElement>("button")];
  for (const control of controls) {
    const mine = buttons.filter((b) => b.dataset.trackControl === control.id);
    if (control.kind === "action") {
      for (const b of mine) b.setAttribute("aria-pressed", String(!!control.on));
      continue;
    }
    for (const b of mine) {
      const option = control.options.find((o) => o.value === b.dataset.value);
      b.setAttribute("aria-checked", String(control.value === b.dataset.value));
      b.disabled = !!option?.disabled;
    }
  }
}

function watchForNudge(frame: HTMLIFrameElement, box: HTMLElement) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const seen = new IntersectionObserver(
    (entries) => {
      clearTimeout(timer);
      if (!entries.some((e) => e.isIntersecting)) return;
      timer = setTimeout(() => {
        seen.disconnect();
        if (root?.dataset.engaged === undefined) frame.contentWindow?.postMessage({ type: "astro-demo:nudge" }, "*");
      }, NUDGE_DELAY_MS);
    },
    { threshold: 0.6 },
  );
  seen.observe(box);
}

function restWhileFar(box: HTMLElement) {
  let top = 0;
  let bottom = 0;
  const update = () => {
    const margin = innerHeight * FAR_SCREENS;
    const far = bottom < scrollY - margin || top > scrollY + innerHeight + margin;
    if (far !== box.hasAttribute("data-far")) box.toggleAttribute("data-far", far);
  };
  const measure = () => {
    const rect = box.getBoundingClientRect();
    top = rect.top + scrollY;
    bottom = rect.bottom + scrollY;
    update();
  };
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", measure, { passive: true });
  new ResizeObserver(measure).observe(document.body);
}

function mount(box: HTMLElement, src: string) {
  const frame = document.createElement("iframe");
  frame.src = src;
  frame.title = "Astro, live: try the sidebar, split view and the command bar";
  frame.className = "demo-frame";
  box.append(frame);
  fit(frame, box);
  new ResizeObserver(() => fit(frame, box)).observe(box);
  restWhileFar(box);

  let ready = false;
  let loaded = false;
  let revealing = false;
  const reveal = () => {
    if (revealing) return;
    revealing = true;
    afterSettling(tilt, show);
  };
  const show = () => {
    if (!root || root.dataset.live === "") return;
    root.dataset.live = "";
    poster?.setAttribute("inert", "");
    if (bar) bar.hidden = false;
    document.querySelector("[data-band-lead]")?.replaceChildren("That was a demo. ");
    watchForNudge(frame, box);
  };
  frame.addEventListener("load", () => {
    loaded = true;
    if (ready) reveal();
  });
  addEventListener("message", (event: MessageEvent<Outbound>) => {
    if (event.source !== frame.contentWindow || !event.data || typeof event.data !== "object") return;
    if (event.data.type === "astro-demo:ready") {
      ready = true;
      if (loaded) reveal();
      else setTimeout(reveal, REVEAL_FALLBACK_MS);
    }
    if (event.data.type === "astro-demo:engaged") root?.setAttribute("data-engaged", "");
    if (event.data.type === "astro-demo:controls" && bar) renderControls(frame, event.data.controls, bar);
  });
}

function start() {
  if (!root || !stage || root.dataset.mounted === "") return;
  root.dataset.mounted = "";
  const src = root.dataset.demoSrc!;
  const near = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      near.disconnect();
      mount(stage, src);
    },
    { rootMargin: "100% 0px" },
  );
  near.observe(root);
}

function afterLoad(run: () => void) {
  const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(run, { timeout: 2000 }) : setTimeout(run, 200));
  if (document.readyState === "complete") idle();
  else addEventListener("load", idle, { once: true });
}

afterLoad(start);
