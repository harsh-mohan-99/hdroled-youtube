(function () {
  'use strict';
  const H = HDROLED, api = HDROLED_EXT, $ = id => document.getElementById(id);
  let settings = H.normalizeSettings(), ready = false, revision = 0, writes = 0, saveQueue = Promise.resolve();
  function controls() {
    for (const [id, key] of [['picture', 'pictureEnabled'], ['sound', 'soundEnabled']]) {
      $(id).disabled = !ready;
      $(id).setAttribute('aria-pressed', String(settings[key]));
      $(id + '-state').textContent = settings[key] ? 'ON' : 'OFF';
    }
    $('strength').disabled = !ready;
    $('strength').value = String(settings.strength);
    $('strength').setAttribute('aria-valuetext', settings.strength + '% picture effect');
    $('strength-value').textContent = settings.strength + '%';
    $('strength-hint').textContent = settings.bypass ? 'Original preview · your strength is saved.' :
      !settings.pictureEnabled ? 'Saved for when Display / video is on.' :
        settings.strength === 0 ? 'Original picture · sound keeps its own switch.' : '0% original · 100% full HDROLED picture effect';
    $('sound-strength').disabled = !ready;
    $('sound-strength').value = String(settings.soundStrength);
    $('sound-strength').setAttribute('aria-valuetext', settings.soundStrength + '% sound boost');
    $('sound-strength-value').textContent = settings.soundStrength + '%';
    $('sound-strength-hint').textContent = settings.bypass ? 'Original preview · your sound level is saved.' :
      !settings.soundEnabled ? 'Saved for when Sound boost is on.' : '0% original sound · 100% full boost';
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
      const active = settings.pictureEnabled && settings.strength > 0 && !settings.bypass && response.pageApplied;
      $('connection-title').textContent = settings.bypass ? 'Original picture · compare on' :
        !settings.pictureEnabled ? 'Picture boost is off' : settings.strength === 0 ? 'Original picture · 0% effect' :
          active ? `Picture active · ${settings.strength}%` : 'Picture effect not applied';
      $('connection-detail').textContent = settings.bypass ? 'Your picture and sound choices are saved.' :
        !settings.pictureEnabled ? 'Display / video and sound work independently.' :
          settings.strength === 0 ? 'Raise opacity to bring back the color effect.' :
            active ? 'HDROLED color effect applied to the YouTube page.' : 'Refresh YouTube and try the picture switch again.';
      $('picture-dot').classList.toggle('active', Boolean(active));
      $('source-size').textContent = `Screen ${response.screenWidth} × ${response.screenHeight}` +
        (response.width ? ` · Video ${response.width} × ${response.height}` : ' · Start a YouTube video');
      const percent = settings.soundStrength / 100, db = value => Number((value * percent).toFixed(2));
      const sound = !settings.soundEnabled || settings.bypass || settings.soundStrength === 0 ? 'Original sound · processing bypassed' :
        response.audioEnhanced ? `Boost active · ${settings.soundStrength}% · Bass +${db(4)} dB · Dialogue +${db(2.5)} dB · Peaks controlled` :
          response.audioWaiting ? 'Click the playing video once to activate sound' :
            response.audioBlocked ? 'Original sound · this source cannot be processed' : 'Waiting for YouTube audio';
      $('audio-status').textContent = sound;
      $('sound-dot').classList.toggle('active', Boolean(settings.soundEnabled && settings.soundStrength > 0 && !settings.bypass && response.audioEnhanced > 0));
      controls();
    } catch (_) {
      if (id !== revision) return;
      $('connection-title').textContent = 'Open a YouTube page';
      $('connection-detail').textContent = 'Refresh after updating. If the popup will not open, pause the video and retry.';
      $('audio-status').textContent = 'Sound unchanged · no connected player';
      $('source-size').textContent = 'Screen and source resolution appear when connected';
      $('picture-dot').classList.remove('active');
      $('sound-dot').classList.remove('active');
      controls();
    }
  }
  async function save(next) {
    const id = ++revision, snapshot = H.normalizeSettings(next);
    settings = snapshot; writes++; controls(); error('');
    // Preserve the final slider value even if storage writes finish at different speeds.
    const task = saveQueue.catch(() => {}).then(() => api.storage.local.set({ [H.STORAGE_KEY]: snapshot }));
    saveQueue = task;
    try { await task; }
    catch (_) { if (id === revision) error('Could not save. Try again.'); }
    finally { writes--; }
    if (!writes) { controls(); await refresh(); }
  }
  $('picture').addEventListener('click', () => save({ ...settings, pictureEnabled: !settings.pictureEnabled, bypass: false }));
  $('sound').addEventListener('click', () => save({ ...settings, soundEnabled: !settings.soundEnabled, bypass: false }));
  $('strength').addEventListener('input', event => save({ ...settings, strength: Number(event.target.value) }));
  $('sound-strength').addEventListener('input', event => save({ ...settings, soundStrength: Number(event.target.value) }));
  $('compare').addEventListener('click', () => save({ ...settings, bypass: !settings.bypass }));
  addEventListener('focus', () => { if (ready) void refresh(); });
  (async () => {
    try { settings = H.normalizeSettings((await api.storage.local.get(H.STORAGE_KEY))[H.STORAGE_KEY]); }
    catch (_) { error('Saved settings unavailable.'); }
    ready = true; controls(); await refresh();
  })();
})();
