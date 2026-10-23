import { startSunrise } from "./clock";

function afterFirstPaint(callback: () => void) {
  requestAnimationFrame(() => {
    if ("requestIdleCallback" in window) requestIdleCallback(callback, { timeout: 500 });
    else setTimeout(callback, 60);
  });
}

function onceOnScreen(callback: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(callback));
}

function boot(hero: HTMLElement) {
  const canvas = hero.querySelector<HTMLCanvasElement>("[data-meadow-canvas]");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!canvas || !("WebGL2RenderingContext" in window)) return;

  afterFirstPaint(() => {
    import("./scene")
      .then(({ createMeadow }) => {
        createMeadow({
          canvas,
          hero,
          hint: hero.querySelector<HTMLElement>("[data-sun-hint]"),
          reducedMotion,
          onFirstFrame() {
            onceOnScreen(() => {
              hero.dataset.meadow = "ready";
              startSunrise(hero);
            });
          },
        });
      })
      .catch(() => {});
  });
}

const hero = document.querySelector<HTMLElement>("[data-meadow]");
if (hero) boot(hero);
