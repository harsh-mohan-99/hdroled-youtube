(function () {
  'use strict';
  const H = HDROLED, api = HDROLED_EXT, $ = id => document.getElementById(id);
  let settings = H.normalizeSettings(), ready = false, revision = 0, writes = 0;
  function controls() {
    $('enabled').disabled = !ready;
    $('enabled').setAttribute('aria-pressed', String(settings.enabled));
    $('enabled-label').textContent = settings.enabled ? 'HDROLED enabled' : 'Enable HDROLED';
    $('enabled-state').textContent = settings.enabled ? 'ON' : 'OFF';
    $('compare').disabled = !ready || !settings.enabled || writes > 0;
    $('compare').setAttribute('aria-pressed', String(settings.bypass));
    $('compare-label').textContent = settings.bypass ? 'Back to HDROLED' : 'Show original';
  }
  function error(text) { $('save-status').textContent = text; $('save-status').hidden = !text; }
  async function refresh() {
    if (writes) return;
    const id = revision;
    try {
      const [tab] = await api.tabs.query({ active: true, currentWindow: true });
      if (id !== revision || writes) return;
      const response = await api.tabs.sendMessage(tab.id, { type: 'HDROLED_STATUS' }, { frameId: 0 });
      if (id !== revision || writes) return;
      if (!response?.ok) throw Error('No YouTube connection');
      settings = H.normalizeSettings(response);
      const mode = H.MODES[!settings.enabled ? 'off' : settings.bypass ? 'original' : !response.pageApplied ? 'partial' : 'active'];
      $('connection-title').textContent = mode.label;
      $('connection-detail').textContent = mode.detail;
      $('picture-dot').classList.toggle('active', settings.enabled && !settings.bypass && response.pageApplied);
      $('source-size').textContent = `Screen ${response.screenWidth} × ${response.screenHeight}` +
        (response.width ? ` · Video ${response.width} × ${response.height}` : ' · Start a YouTube video');
      const sound = !settings.enabled || settings.bypass ? 'Original sound · processing bypassed' :
        response.audioEnhanced ? 'Boost active · Bass +4 dB · Dialogue +2.5 dB · Peaks controlled' :
          response.audioWaiting ? 'Click the playing video once to activate sound' :
            response.audioBlocked ? 'Original sound · this source cannot be processed' : 'Waiting for YouTube audio';
      $('audio-status').textContent = sound;
      controls();
    } catch (_) {
      if (id !== revision) return;
      $('connection-title').textContent = 'Open a YouTube page';
      $('connection-detail').textContent = 'YouTube only. Refresh the tab after installing or updating.';
      $('audio-status').textContent = 'Sound unchanged · no connected player';
      $('source-size').textContent = 'Screen and source resolution appear when connected';
      $('picture-dot').classList.remove('active');
      controls();
    }
  }
  async function save(next) {
    const id = ++revision;
    settings = H.normalizeSettings(next); writes++; controls(); error('');
    try { await api.storage.local.set({ [H.STORAGE_KEY]: settings }); }
    catch (_) { if (id === revision) error('Could not save. Try again.'); }
    finally { writes--; }
    if (!writes) { controls(); await refresh(); }
  }
  $('enabled').addEventListener('click', () => save({ enabled: !settings.enabled, bypass: false }));
  $('compare').addEventListener('click', () => save({ ...settings, bypass: !settings.bypass }));
  addEventListener('focus', () => { if (ready) void refresh(); });
  (async () => {
    try { settings = H.normalizeSettings((await api.storage.local.get(H.STORAGE_KEY))[H.STORAGE_KEY]); }
    catch (_) { error('Saved settings unavailable.'); }
    ready = true; controls(); await refresh();
  })();
})();
