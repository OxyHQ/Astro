[["default", "t1"], ["work", "t7"], ["travel", "t14"], ["side", "t21"], ["weekend", "t23"]].forEach(([pid, shown]) => {
  then(() => goProfile(pid));
  Object.values(st().tabs).filter((t) => t.profileId === pid).forEach((t) => then(() => { st().activate(t.id); return sleep(2500); }));
  then(() => { st().activate(shown); return sleep(1000); });
});
then(() => goProfile("default"));
then(() => sleep(1000).then(() => snap("warm")));
return finish({ titles: Object.values(st().tabs).map((t) => [t.id, t.title]), toasts: ac.toasts ? Object.keys(ac.toasts) : null });
