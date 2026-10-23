type Layer = { el: HTMLElement; dx: number; dy: number };
type Stage = { el: HTMLElement; layers: Layer[]; x: number; y: number; gx: number; gy: number };

const motion = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
const SETTLE_MS = 220;
const stages = new Map<Element, Stage>();
for (const el of document.querySelectorAll<HTMLElement>("[data-tilt]")) {
  const layers = [...el.querySelectorAll<HTMLElement>("[data-depth]")]
    .filter((layer) => layer.closest("[data-tilt]") === el)
    .map((layer) => {
      const [dx = 0, dy = 0] = (layer.dataset.depth ?? "").split(",").map(Number);
      return { el: layer, dx, dy };
    });
  if (layers.length) stages.set(el, { el, layers, x: 0, y: 0, gx: 0, gy: 0 });
}

const shown = new Set<Stage>();
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      const stage = stages.get(e.target);
      if (!stage) continue;
      if (e.isIntersecting) shown.add(stage);
      else {
        shown.delete(stage);
        stage.el.classList.remove("leaning");
      }
    }
  },
  { rootMargin: "120px 0px" },
);
for (const el of stages.keys()) io.observe(el);

const clamp = (v: number) => Math.max(-1, Math.min(1, v));
let pointer: { x: number; y: number } | null = null;
let frame = 0;
let last = 0;

function paint(stage: Stage) {
  for (const { el, dx, dy } of stage.layers) el.style.translate = `${(stage.x * dx).toFixed(2)}px ${(stage.y * dy).toFixed(2)}px`;
}

function tick(now: number) {
  frame = 0;
  const dt = last ? Math.min(64, now - last) : 16;
  last = now;
  for (const stage of shown) {
    if (!pointer) {
      stage.gx = 0;
      stage.gy = 0;
      continue;
    }
    const r = stage.el.getBoundingClientRect();
    stage.gx = clamp((pointer.x - (r.left + r.width / 2)) / (innerWidth / 2));
    stage.gy = clamp((pointer.y - (r.top + r.height / 2)) / (innerHeight / 2));
  }
  const k = 1 - Math.exp(-dt / SETTLE_MS);
  let moving = false;
  for (const stage of shown) {
    if (!stage.el.classList.contains("leaning")) stage.el.classList.add("leaning");
    const ex = stage.gx - stage.x;
    const ey = stage.gy - stage.y;
    if (Math.abs(ex) < 0.002 && Math.abs(ey) < 0.002) {
      if (ex || ey) {
        stage.x = stage.gx;
        stage.y = stage.gy;
        paint(stage);
      }
      continue;
    }
    stage.x += ex * k;
    stage.y += ey * k;
    paint(stage);
    moving = true;
  }
  if (moving) frame = requestAnimationFrame(tick);
  else last = 0;
}

function wake() {
  if (!frame && shown.size) frame = requestAnimationFrame(tick);
}

addEventListener(
  "pointermove",
  (e) => {
    if (e.pointerType !== "mouse" || !motion.matches) return;
    pointer = { x: e.clientX, y: e.clientY };
    wake();
  },
  { passive: true },
);
document.documentElement.addEventListener("pointerleave", () => {
  pointer = null;
  wake();
});
motion.addEventListener("change", () => {
  if (motion.matches) return;
  pointer = null;
  for (const stage of stages.values()) {
    stage.x = stage.y = stage.gx = stage.gy = 0;
    for (const { el } of stage.layers) el.style.removeProperty("translate");
  }
});
