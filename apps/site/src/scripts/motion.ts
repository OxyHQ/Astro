const reveal = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      reveal.unobserve(e.target);
    }
  },
  { threshold: 0 },
);
for (const el of document.querySelectorAll("[data-reveal]")) reveal.observe(el);

const settle = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      settle.unobserve(e.target);
    }
  },
  { rootMargin: "0px 0px -18% 0px" },
);
for (const el of document.querySelectorAll("[data-settle]")) settle.observe(el);
