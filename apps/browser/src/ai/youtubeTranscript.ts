import type { TranscriptLine } from "./oneShotPrompts";

export type TranscriptResult = { videoId: string; title: string; language: string; lines: TranscriptLine[] } | { error: string };

export const transcriptScript = (videoId: string) => `
const wanted = ${JSON.stringify(videoId)};
const finish = (value) => post('result', JSON.stringify(value));
const fromJson3 = (data) => (data && data.events ? data.events : [])
  .filter((e) => e.segs)
  .map((e) => ({ startMs: e.tStartMs || 0, text: e.segs.map((s) => s.utf8 || '').join('').replace(/\\n/g, ' ') }))
  .filter((l) => l.text.trim());
const panelParams = (data) => {
  const panels = (data && data.engagementPanels) || [];
  for (const panel of panels) {
    const content = panel.engagementPanelSectionListRenderer && panel.engagementPanelSectionListRenderer.content;
    const endpoint = content && content.continuationItemRenderer && content.continuationItemRenderer.continuationEndpoint;
    const params = endpoint && endpoint.getTranscriptEndpoint && endpoint.getTranscriptEndpoint.params;
    if (params) return params;
  }
  return null;
};
const watchData = () => {
  const flexy = document.querySelector('ytd-watch-flexy');
  const candidates = [flexy && flexy.data, flexy && flexy.__data && flexy.__data.data, window.ytInitialData];
  for (const data of candidates) {
    const id = data && data.currentVideoEndpoint && data.currentVideoEndpoint.watchEndpoint && data.currentVideoEndpoint.watchEndpoint.videoId;
    if (id === wanted) return data;
  }
  return null;
};
(async () => {
  try {
    const player = document.querySelector('#movie_player');
    const response = player && typeof player.getPlayerResponse === 'function' ? player.getPlayerResponse() : window.ytInitialPlayerResponse;
    const details = response && response.videoDetails;
    if (!details || details.videoId !== wanted) return finish({ error: 'not ready' });
    const tracks = (response.captions && response.captions.playerCaptionsTracklistRenderer && response.captions.playerCaptionsTracklistRenderer.captionTracks) || [];
    const page = (document.documentElement.lang || navigator.language || 'en').slice(0, 2);
    const ranked = tracks.slice().sort((a, b) => {
      const score = (t) => (t.kind === 'asr' ? 0 : 2) + ((t.languageCode || '').startsWith(page) ? 1 : 0);
      return score(b) - score(a);
    });
    const track = ranked[0];
    const base = { videoId: wanted, title: details.title || document.title, language: (track && track.languageCode) || '' };
    if (track && track.baseUrl) {
      const reply = await fetch(track.baseUrl + '&fmt=json3', { credentials: 'include' }).catch(() => null);
      const body = reply && reply.ok ? await reply.text() : '';
      const lines = body ? fromJson3(JSON.parse(body)) : [];
      if (lines.length) return finish({ ...base, lines });
    }
    const panel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
    if (!panel || !panelParams(watchData())) return finish({ error: tracks.length ? 'transcript unavailable' : 'no captions' });
    const visibility = panel.getAttribute('visibility');
    const style = panel.style.cssText;
    const hidden = visibility !== 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED';
    if (hidden) {
      panel.style.cssText = style + ';position:fixed!important;left:0!important;top:0!important;width:400px!important;height:600px!important;opacity:0!important;z-index:-1!important;pointer-events:none!important';
      panel.setAttribute('visibility', 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED');
    }
    let segments = [];
    for (let i = 0; i < 50 && !segments.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      segments = [...panel.querySelectorAll('ytd-transcript-segment-renderer')];
    }
    const at = (stamp) => (stamp || '').trim().split(':').reduce((ms, part) => ms * 60 + (Number(part) || 0), 0) * 1000;
    const lines = segments
      .map((s) => ({ startMs: at(s.querySelector('.segment-timestamp') && s.querySelector('.segment-timestamp').textContent), text: ((s.querySelector('.segment-text') && s.querySelector('.segment-text').textContent) || '').replace(/\\s+/g, ' ').trim() }))
      .filter((l) => l.text);
    if (hidden) {
      panel.setAttribute('visibility', visibility || 'ENGAGEMENT_PANEL_VISIBILITY_HIDDEN');
      panel.style.cssText = style;
    }
    finish(lines.length ? { ...base, lines } : { error: 'transcript unavailable' });
  } catch (error) {
    finish({ error: String(error && error.message || error) });
  }
})();
`;
