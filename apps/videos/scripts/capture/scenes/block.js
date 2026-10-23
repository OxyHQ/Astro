let tabId;
const open = () => ac.pageState.setState((p) => ({ popover: Object.assign({}, p.popover, { [tabId]: "siteControls" }) }));
const toggle = () => roots().flatMap((r) => fibers(r.current, (f) => f.type && f.type.name === "SiteControls")).flatMap((sc) => fibers(sc.child, (f) => f.memoizedProps && typeof f.memoizedProps.onChange === "function" && typeof f.memoizedProps.value === "boolean")).pop();
then(() => { unsplit(); st().updateSettings({ showFullUrl: false }); return goProfile("default"); });
then(() => { tabId = st().newTab(W, { url: "http://lexicon.example/" }); return sleep(9000).then(() => picShown()).then(() => snap("page")); });
then(() => { open(); return sleep(1500).then(() => snap("controls")); });
then(() => { const t = toggle(); if (!t) throw new Error("no blocker switch"); t.memoizedProps.onChange(false); return sleep(9000).then(() => snapLive("off", 600)); });
then(() => {
  const A = animated(); const timing = A.timing; const spring = A.spring;
  A.timing = (v, cfg) => timing(v, Object.assign({}, cfg, { duration: (cfg.duration || 0) * 12 }));
  A.spring = (v, cfg) => timing(v, Object.assign({}, { toValue: cfg.toValue, duration: 300 * 12, useNativeDriver: cfg.useNativeDriver }));
  const t = toggle(); t.memoizedProps.onChange(true);
  return snapLive("on", 9000).then(() => { A.timing = timing; A.spring = spring; });
});
then(() => sleep(2000).then(() => snapLive("onRest", 400)));
then(() => { ac.pageState.setState((p) => ({ popover: Object.assign({}, p.popover, { [tabId]: null }) })); st().closeTab(tabId); return sleep(500); });
return finish({ tabId });
