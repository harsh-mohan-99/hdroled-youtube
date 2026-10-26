const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../extension');
const load = (name, context) => vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context, { filename: name });

test('version 1.2 packages request storage and YouTube-only static access', () => {
  for (const filename of [path.join(root, 'manifest.json'), path.resolve(__dirname, '../manifests/firefox.json')]) {
    const manifest = JSON.parse(fs.readFileSync(filename, 'utf8'));
    assert.equal(manifest.version, '1.2.0');
    assert.deepEqual(manifest.permissions, ['storage']);
    assert.deepEqual(manifest.content_scripts[0].matches, ['https://www.youtube.com/*', 'https://m.youtube.com/*']);
    assert.equal(manifest.content_scripts[0].all_frames, false);
    assert.equal(manifest.host_permissions, undefined);
    assert.equal(manifest.background, undefined);
    assert.equal(manifest.web_accessible_resources, undefined);
    for (const name of [...manifest.content_scripts[0].js, 'popup.js']) new vm.Script(fs.readFileSync(path.join(root, name), 'utf8'));
  }
});

function audioFixture(state = 'running') {
  const nodes = []; let attached = 0;
  function node(kind) {
    const item = { kind, targets: [], connect(next) { this.targets.push(next); }, disconnect() { this.targets = []; } };
    for (const key of ['gain', 'frequency', 'Q', 'threshold', 'knee', 'ratio', 'attack', 'release']) item[key] = { value: 0 };
    nodes.push(item); return item;
  }
  class Context {
    constructor() { this.state = state; this.destination = node('destination'); }
    addEventListener() {} resume() { return new Promise(() => {}); }
    createBiquadFilter() { return node('eq'); } createDynamicsCompressor() { return node('compressor'); }
    createGain() { return node('gain'); } createMediaElementSource() { attached++; return node('source'); }
  }
  const context = vm.createContext({ AudioContext: Context, URL,
    location: { origin: 'https://www.youtube.com', href: 'https://www.youtube.com/watch?v=test' },
    document: { addEventListener() {} }, dispatchEvent() {}, Event: class {} });
  load('audio.js', context);
  return { api: context.HDROLED_AUDIO, nodes, attached: () => attached };
}

test('sound boost retains bass/dialogue EQ and uses greater make-up gain with gentler compression', () => {
  const f = audioFixture();
  assert.equal(f.api.applyAll([{ currentSrc: 'blob:https://www.youtube.com/example', isConnected: true }], true).enhanced, 1);
  assert.ok(f.nodes.some(n => n.type === 'lowshelf' && n.frequency.value === 105 && n.gain.value === 4));
  assert.ok(f.nodes.some(n => n.type === 'peaking' && n.frequency.value === 2200 && n.gain.value === 2.5));
  assert.equal(f.nodes.find(n => n.kind === 'gain').gain.value, 1.6);
  const compressors = f.nodes.filter(n => n.kind === 'compressor');
  assert.equal(compressors[0].ratio.value, 2.2);
  assert.equal(compressors[1].threshold.value, -3);
});

test('original bypasses every EQ/gain/compressor node and re-enable reuses the source', () => {
  const f = audioFixture(), video = { currentSrc: 'blob:https://www.youtube.com/example', isConnected: true };
  f.api.applyAll([video], true); const source = f.nodes.find(n => n.kind === 'source');
  assert.equal(source.targets[0].kind, 'eq');
  assert.equal(f.api.applyAll([video], false).state, 'original');
  assert.equal(source.targets[0].kind, 'destination');
  f.api.applyAll([video], true); assert.equal(f.attached(), 1);
});

test('suspended audio never takes over native playback; DRM and unsafe sources stay unprocessed', () => {
  const f = audioFixture('suspended');
  assert.equal(f.api.applyAll([{ currentSrc: 'blob:https://www.youtube.com/a' }], true).state, 'gesture');
  assert.equal(f.attached(), 0);
  const normal = audioFixture();
  assert.equal(normal.api.applyAll([{ currentSrc: 'https://other.example/clip.mp4' }], true).blocked, 1);
  assert.equal(normal.api.applyAll([{ currentSrc: 'blob:https://www.youtube.com/a', mediaKeys: {} }], true).blocked, 1);
  assert.equal(normal.attached(), 0);
});

class Element {
  constructor() {
    this.isConnected = true; this.paused = false; this.videoWidth = 1920; this.videoHeight = 1080; this.values = new Map(); this.changed = [];
    this.style = {
      getPropertyValue: key => this.values.get(key)?.value || '', getPropertyPriority: key => this.values.get(key)?.priority || '',
      setProperty: (key, value, priority = '') => { this.values.set(key, { value, priority }); this.changed.push(key); },
      removeProperty: key => { this.values.delete(key); this.changed.push(key); }
    };
  }
  matches(selector) { return selector.includes('video'); }
}
async function pageFixture(hostname = 'www.youtube.com', initial = { enabled: true, bypass: false }) {
  const html = new Element(), video = new Element(), fullscreen = new Element(), sounds = [], soundLevels = [], queries = [], events = {};
  html.style.setProperty('background-color', 'white'); html.style.setProperty('filter', 'opacity(0.95)', 'important');
  let saved = initial, listener;
  const win = {}; win.top = win;
  const document = { documentElement: html, fullscreenElement: null, pictureInPictureElement: null,
    querySelectorAll: selector => { queries.push(selector); return [video]; }, addEventListener: (name, fn) => { events[name] = fn; },
    createElement() { throw Error('No page overlay or recoloring stylesheet allowed'); } };
  const context = vm.createContext({ window: win, document, location: { hostname },
    HDROLED_EXT: { storage: { local: { get: async () => ({ hdroledSettings: saved }) }, onChanged: { addListener: fn => { listener = fn; } } }, runtime: { onMessage: { addListener() {} } } },
    HDROLED_AUDIO: { applyAll: (media, on, strength) => { sounds.push(on); soundLevels.push(strength); return { state: on ? 'enhanced' : 'original', enhanced: on ? media.length : 0, blocked: 0, waiting: 0 }; } },
    getComputedStyle: node => ({ filter: node.style.getPropertyValue('filter') || 'none' }), screen: { width: 1366, height: 768 },
    addEventListener() {}, queueMicrotask, MutationObserver: class { observe() {} } });
  load('shared.js', context); load('content.js', context); await new Promise(setImmediate);
  return { html, video, fullscreen, document, events, sounds, soundLevels, queries, context,
    status: () => context.HDROLED_PAGE_STATUS(),
    async change(value) { saved = value; listener({ hdroledSettings: {} }, 'local'); await new Promise(setImmediate); } };
}

test('page grade preserves page backgrounds, composes prior filter and avoids double-grading videos', async () => {
  const f = await pageFixture(); assert.equal((await f.status()).pageApplied, true);
  assert.equal(f.html.style.getPropertyValue('background-color'), 'white');
  assert.match(f.html.style.getPropertyValue('filter'), /^opacity\(0.95\) contrast/);
  assert.equal(f.video.style.getPropertyValue('filter'), '');
  assert.deepEqual(f.html.changed.slice(2), ['filter']);
});
test('original restores exact picture state and audio; fullscreen transfers the grade once', async () => {
  const f = await pageFixture(); await f.change({ enabled: true, bypass: true });
  assert.equal(f.html.style.getPropertyValue('filter'), 'opacity(0.95)'); assert.equal(f.html.style.getPropertyPriority('filter'), 'important');
  assert.equal(f.sounds.at(-1), false);
  await f.change({ enabled: true, bypass: false }); f.document.fullscreenElement = f.fullscreen;
  f.events.fullscreenchange(); await new Promise(setImmediate);
  assert.equal(f.html.style.getPropertyValue('filter'), 'opacity(0.95)'); assert.match(f.fullscreen.style.getPropertyValue('filter'), /^contrast/);
});
test('the runtime guard does nothing outside YouTube even if invoked manually', async () => {
  const f = await pageFixture('example.com'); assert.equal(f.context.HDROLED_PAGE_STATUS, undefined);
  assert.equal(f.html.style.getPropertyValue('filter'), 'opacity(0.95)'); assert.equal(f.sounds.length, 0);
});

test('popup exposes independent boosts, labeled picture strength and original comparison', () => {
  const html = fs.readFileSync(path.join(root, 'popup.html'), 'utf8'), css = fs.readFileSync(path.join(root, 'popup.css'), 'utf8');
  assert.equal((html.match(/<button\b/g) || []).length, 3);
  assert.match(html, /id="picture"/); assert.match(html, /id="sound"/);
  assert.match(html, /for="strength"/); assert.match(html, /type="range"/);
  assert.match(html, /v1\.2/); assert.match(html, /Harsh Mohan Sahani/); assert.match(html, /Made with Codex/);
  assert.match(css, /prefers-reduced-motion/);
});

test('public runtime has no external runtime scripts or PC-control payloads', () => {
  for (const name of fs.readdirSync(root)) assert.ok(!/\.ps1$|\.cmd$|original-display|session\.json/i.test(name));
  const html = fs.readFileSync(path.join(root, 'popup.html'), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    assert.ok(!/^(https?:|\/|\.\.)/.test(match[1])); assert.ok(fs.existsSync(path.join(root, match[1])));
  }
});

async function popupFixture(initial = { enabled: true, bypass: false }, setOverride, responseOverride = {}) {
  const ids = ['picture', 'picture-state', 'sound', 'sound-state', 'strength', 'strength-value', 'strength-hint', 'sound-strength', 'sound-strength-value', 'sound-strength-hint', 'compare', 'compare-label', 'save-status', 'connection-title', 'connection-detail', 'source-size', 'audio-status', 'picture-dot', 'sound-dot'];
  const elements = Object.fromEntries(ids.map(id => [id, { textContent: '', hidden: false, attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; }, addEventListener(name, fn) { this[name] = fn; },
    classList: { values: new Set(), toggle(name, on) { if (on) this.values.add(name); else this.values.delete(name); }, remove(name) { this.values.delete(name); } } }]));
  let saved = initial; const messages = [];
  const context = vm.createContext({ document: { getElementById: id => elements[id] }, addEventListener() {},
    HDROLED_EXT: { storage: { local: { get: async () => ({ hdroledSettings: saved }), set: async data => { if (setOverride) await setOverride(data); saved = data.hdroledSettings; } } },
      tabs: { query: async () => [{ id: 9, get url() { throw Error('No URL permission needed'); } }],
        sendMessage: async (id, message, options) => {
          messages.push({ id, message, options });
          const s = context.HDROLED.normalizeSettings(saved);
          return { ok: true, ...s, pageApplied: s.pictureEnabled && s.strength > 0 && !s.bypass, width: 1920, height: 1080,
            screenWidth: 1366, screenHeight: 768, audioEnhanced: s.soundEnabled && s.soundStrength > 0 && !s.bypass ? 1 : 0, audioWaiting: 0, audioBlocked: 0, ...responseOverride };
        } } } });
  load('shared.js', context); load('popup.js', context); await new Promise(setImmediate);
  return { elements, messages, saved: () => saved };
}
test('popup preserves separate choices and strength through original comparison and reopen', async () => {
  const f = await popupFixture(); const { elements, messages } = f;
  assert.equal(elements['picture-state'].textContent, 'ON'); assert.match(elements['audio-status'].textContent, /Boost active/);
  assert.equal(messages[0].options.frameId, 0);
  await elements.strength.input({ target: { value: '40' } });
  assert.equal(f.saved().strength, 40);
  await elements.picture.click(); assert.equal(f.saved().pictureEnabled, false); assert.equal(f.saved().soundEnabled, true);
  await elements.compare.click(); assert.equal(f.saved().bypass, true); assert.match(elements['audio-status'].textContent, /Original sound/);
  assert.equal(elements['compare-label'].textContent, 'Back to HDROLED');
  await elements.compare.click(); assert.equal(f.saved().pictureEnabled, false); assert.equal(f.saved().soundEnabled, true); assert.equal(f.saved().strength, 40);
  const reopened = await popupFixture(f.saved());
  assert.equal(reopened.elements['picture-state'].textContent, 'OFF'); assert.equal(reopened.elements['sound-state'].textContent, 'ON');
  assert.equal(reopened.elements['strength-value'].textContent, '40%');
  await elements.sound.click(); assert.equal(f.saved().enabled, false); assert.equal(elements.compare.disabled, true);
});

test('settings migrate old switches, clamp numeric strength and generate neutral-to-full filters', () => {
  const c = vm.createContext({}); load('shared.js', c); const H = c.HDROLED;
  assert.equal(H.normalizeSettings({ enabled: true }).pictureEnabled, true);
  assert.equal(H.normalizeSettings({ enabled: true }).soundEnabled, true);
  assert.equal(H.normalizeSettings({ enabled: false }).pictureEnabled, false);
  assert.equal(H.normalizeSettings({ enabled: true, pictureEnabled: false }).pictureEnabled, false);
  assert.equal(H.normalizeSettings({ strength: 999 }).strength, 100);
  assert.equal(H.normalizeSettings({ strength: -20 }).strength, 0);
  assert.equal(H.normalizeSettings({ strength: NaN }).strength, 100);
  assert.equal(H.normalizeSettings({ strength: 'invalid' }).strength, 100);
  assert.equal(H.pictureFilter(0), '');
  assert.equal(H.pictureFilter(50), 'contrast(1.04) saturate(1.05) brightness(1.0125)');
  assert.equal(H.pictureFilter(100), H.FILTER);
});

test('picture intensity changes do not stack filters and never adjust sound boost', async () => {
  const f = await pageFixture();
  await f.change({ pictureEnabled: true, soundEnabled: false, strength: 50 });
  assert.equal(f.html.style.getPropertyValue('filter'), 'opacity(0.95) contrast(1.04) saturate(1.05) brightness(1.0125)');
  assert.equal(f.sounds.at(-1), false);
  await f.change({ pictureEnabled: true, soundEnabled: true, strength: 25 });
  assert.equal((f.html.style.getPropertyValue('filter').match(/contrast/g) || []).length, 1);
  assert.equal(f.sounds.at(-1), true);
  await f.change({ pictureEnabled: true, soundEnabled: true, strength: 0 });
  assert.equal(f.html.style.getPropertyValue('filter'), 'opacity(0.95)');
  assert.equal(f.sounds.at(-1), true); assert.equal((await f.status()).pageApplied, false);
});

test('sound-only boost and picture-only boost restore independently, including fullscreen original', async () => {
  const f = await pageFixture('www.youtube.com', { pictureEnabled: false, soundEnabled: true, strength: 60 });
  assert.equal(f.html.style.getPropertyValue('filter'), 'opacity(0.95)'); assert.equal(f.sounds.at(-1), true);
  await f.change({ pictureEnabled: true, soundEnabled: false, strength: 60 });
  assert.equal(f.sounds.at(-1), false); assert.equal((await f.status()).pageApplied, true);
  f.document.fullscreenElement = f.fullscreen; f.events.fullscreenchange(); await new Promise(setImmediate);
  assert.equal(f.fullscreen.style.getPropertyValue('filter'), 'contrast(1.048) saturate(1.06) brightness(1.015)');
  await f.change({ pictureEnabled: true, soundEnabled: false, strength: 60, bypass: true });
  assert.equal(f.fullscreen.style.getPropertyValue('filter'), ''); assert.equal(f.sounds.at(-1), false);
  await f.change({ pictureEnabled: true, soundEnabled: false, strength: 60, bypass: false });
  assert.match(f.fullscreen.style.getPropertyValue('filter'), /contrast\(1.048\)/); assert.equal(f.sounds.at(-1), false);
});

test('rapid slider changes and switch clicks persist in order without losing the final choice', async () => {
  const releases = [], f = await popupFixture(undefined, () => new Promise(resolve => releases.push(resolve)));
  const first = f.elements.strength.input({ target: { value: '15' } });
  const last = f.elements.strength.input({ target: { value: '72' } });
  const sound = f.elements.sound.click();
  await new Promise(setImmediate); assert.equal(releases.length, 1);
  releases[0](); await new Promise(setImmediate); assert.equal(releases.length, 2);
  releases[1](); await new Promise(setImmediate); assert.equal(releases.length, 3);
  releases[2](); await Promise.all([first, last, sound]);
  assert.equal(f.saved().strength, 72); assert.equal(f.saved().soundEnabled, false); assert.equal(f.saved().pictureEnabled, true);
});

test('a rejected settings write reports failure and leaves the saved selection intact', async () => {
  const f = await popupFixture(undefined, async () => { throw Error('Storage unavailable'); });
  await f.elements.picture.click();
  assert.equal(f.saved().enabled, true); assert.equal(f.elements['picture-state'].textContent, 'ON');
  assert.match(f.elements['save-status'].textContent, /Could not save/);
});

test('sound level scales EQ and gain, zero bypasses processing and full strength restores the previous boost', () => {
  const f = audioFixture(), video = { currentSrc: 'blob:https://www.youtube.com/a', isConnected: true };
  f.api.applyAll([video], true, 50);
  assert.equal(f.nodes.find(n => n.type === 'lowshelf').gain.value, 2);
  assert.equal(f.nodes.find(n => n.type === 'peaking' && n.frequency.value === 2200).gain.value, 1.25);
  assert.equal(f.nodes.find(n => n.kind === 'gain').gain.value, 1.3);
  assert.equal(f.api.applyAll([video], true, 0).state, 'original');
  assert.equal(f.nodes.find(n => n.kind === 'source').targets[0].kind, 'destination');
  f.api.applyAll([video], true, 100);
  assert.equal(f.nodes.find(n => n.type === 'lowshelf').gain.value, 4);
  assert.equal(f.nodes.find(n => n.kind === 'gain').gain.value, 1.6);
  assert.equal(f.attached(), 1);
});

test('sound strength is bounded, defaults to the existing boost and remains independent of video opacity', async () => {
  const c = vm.createContext({}); load('shared.js', c); const H = c.HDROLED;
  assert.equal(H.normalizeSettings({ enabled: true }).soundStrength, 100);
  assert.equal(H.normalizeSettings({ soundStrength: 999 }).soundStrength, 100);
  assert.equal(H.normalizeSettings({ soundStrength: -1 }).soundStrength, 0);
  assert.equal(H.normalizeSettings({ soundStrength: NaN }).soundStrength, 100);
  const f = await pageFixture();
  await f.change({ pictureEnabled: true, soundEnabled: true, strength: 60, soundStrength: 35 });
  const picture = f.html.style.getPropertyValue('filter');
  assert.equal(f.soundLevels.at(-1), 35); assert.equal(f.sounds.at(-1), true);
  await f.change({ pictureEnabled: true, soundEnabled: true, strength: 60, soundStrength: 0 });
  assert.equal(f.sounds.at(-1), false); assert.equal(f.html.style.getPropertyValue('filter'), picture);
});

test('popup saves sound level through off/on, original comparison and reopening', async () => {
  const f = await popupFixture();
  await f.elements['sound-strength'].input({ target: { value: '40' } });
  assert.equal(f.saved().soundStrength, 40); assert.equal(f.saved().strength, 100);
  assert.equal(f.elements['sound-strength-value'].textContent, '40%');
  await f.elements.sound.click(); await f.elements.sound.click();
  assert.equal(f.saved().soundStrength, 40);
  await f.elements.compare.click(); await f.elements.compare.click();
  const reopened = await popupFixture(f.saved());
  assert.equal(reopened.saved().soundStrength, 40);
  assert.equal(reopened.elements['sound-strength-value'].textContent, '40%');
  await f.elements['sound-strength'].input({ target: { value: '0' } });
  assert.match(f.elements['audio-status'].textContent, /Original sound/);
});

test('sound indicator reflects confirmed processing and clears for bypass, zero, off or unavailable audio', async () => {
  const active = await popupFixture();
  const green = f => f.elements['sound-dot'].classList.values.has('active');
  assert.equal(green(active), true);
  await active.elements.compare.click(); assert.equal(green(active), false);
  await active.elements.compare.click(); assert.equal(green(active), true);
  await active.elements['sound-strength'].input({ target: { value: '0' } }); assert.equal(green(active), false);
  await active.elements['sound-strength'].input({ target: { value: '75' } }); assert.equal(green(active), true);
  await active.elements.sound.click(); assert.equal(green(active), false);
  const waiting = await popupFixture(undefined, undefined, { audioEnhanced: 0, audioWaiting: 1 });
  assert.equal(green(waiting), false); assert.match(waiting.elements['audio-status'].textContent, /Click/);
  const blocked = await popupFixture(undefined, undefined, { audioEnhanced: 0, audioBlocked: 1 });
  assert.equal(green(blocked), false);
  const disconnected = await popupFixture(undefined, undefined, { ok: false });
  assert.equal(green(disconnected), false);
});

test('100 popup status requests use one enhancement pass and one media scan per request', async t => {
  const f = await pageFixture(), sounds = f.sounds.length, queries = f.queries.length;
  const start = performance.now();
  for (let i = 0; i < 100; i++) assert.equal((await f.status()).ok, true);
  const counts = { requests: 100, enhancementPasses: f.sounds.length - sounds, mediaScans: f.queries.length - queries };
  t.diagnostic(JSON.stringify({ ...counts, harnessMilliseconds: Number((performance.now() - start).toFixed(2)) }));
  assert.deepEqual(counts, { requests: 100, enhancementPasses: 100, mediaScans: 100 });
});
