const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../extension');
const load = (name, context) => vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context, { filename: name });

test('version 1.0 packages request storage and YouTube-only static access', () => {
  for (const filename of [path.join(root, 'manifest.json'), path.resolve(__dirname, '../manifests/firefox.json')]) {
    const manifest = JSON.parse(fs.readFileSync(filename, 'utf8'));
    assert.equal(manifest.version, '1.0.0');
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
}
async function pageFixture(hostname = 'www.youtube.com') {
  const html = new Element(), video = new Element(), fullscreen = new Element(), sounds = [], events = {};
  html.style.setProperty('background-color', 'white'); html.style.setProperty('filter', 'opacity(0.95)', 'important');
  let saved = { enabled: true, bypass: false }, listener;
  const win = {}; win.top = win;
  const document = { documentElement: html, fullscreenElement: null, pictureInPictureElement: null,
    querySelectorAll: () => [video], addEventListener: (name, fn) => { events[name] = fn; },
    createElement() { throw Error('No page overlay or recoloring stylesheet allowed'); } };
  const context = vm.createContext({ window: win, document, location: { hostname },
    HDROLED_EXT: { storage: { local: { get: async () => ({ hdroledSettings: saved }) }, onChanged: { addListener: fn => { listener = fn; } } }, runtime: { onMessage: { addListener() {} } } },
    HDROLED_AUDIO: { applyAll: (media, on) => { sounds.push(on); return { state: on ? 'enhanced' : 'original', enhanced: on ? media.length : 0, blocked: 0, waiting: 0 }; } },
    getComputedStyle: node => ({ filter: node.style.getPropertyValue('filter') || 'none' }), screen: { width: 1366, height: 768 },
    addEventListener() {}, queueMicrotask, MutationObserver: class { observe() {} } });
  load('shared.js', context); load('content.js', context); await new Promise(setImmediate);
  return { html, video, fullscreen, document, events, sounds, context,
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

test('popup exposes two controls, version/creator attribution and reduced-motion support', () => {
  const html = fs.readFileSync(path.join(root, 'popup.html'), 'utf8'), css = fs.readFileSync(path.join(root, 'popup.css'), 'utf8');
  assert.equal((html.match(/<button\b/g) || []).length, 2);
  assert.match(html, /v1\.0/); assert.match(html, /Harsh Mohan Sahani/); assert.match(html, /Made with Codex/);
  assert.match(css, /prefers-reduced-motion/);
});

test('public runtime has no external runtime scripts or PC-control payloads', () => {
  for (const name of fs.readdirSync(root)) assert.ok(!/\.ps1$|\.cmd$|original-display|session\.json/i.test(name));
  const html = fs.readFileSync(path.join(root, 'popup.html'), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    assert.ok(!/^(https?:|\/|\.\.)/.test(match[1])); assert.ok(fs.existsSync(path.join(root, match[1])));
  }
});

test('popup compares picture and sound together using only top-frame YouTube messaging', async () => {
  const ids = ['enabled', 'enabled-label', 'enabled-state', 'compare', 'compare-label', 'save-status', 'connection-title', 'connection-detail', 'source-size', 'audio-status', 'picture-dot'];
  const elements = Object.fromEntries(ids.map(id => [id, { textContent: '', hidden: false, attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; }, addEventListener(name, fn) { this[name] = fn; },
    classList: { toggle() {}, remove() {} } }]));
  let saved = { enabled: true, bypass: false }; const messages = [];
  const context = vm.createContext({ document: { getElementById: id => elements[id] }, addEventListener() {},
    HDROLED_EXT: { storage: { local: { get: async () => ({ hdroledSettings: saved }), set: async data => { saved = data.hdroledSettings; } } },
      tabs: { query: async () => [{ id: 9, get url() { throw Error('No URL permission needed'); } }],
        sendMessage: async (id, message, options) => {
          messages.push({ id, message, options });
          return { ok: true, ...saved, pageApplied: saved.enabled && !saved.bypass, width: 1920, height: 1080,
            screenWidth: 1366, screenHeight: 768, audioEnhanced: saved.enabled && !saved.bypass ? 1 : 0, audioWaiting: 0, audioBlocked: 0 };
        } } } });
  load('shared.js', context); load('popup.js', context); await new Promise(setImmediate);
  assert.equal(elements['enabled-state'].textContent, 'ON'); assert.match(elements['audio-status'].textContent, /Boost active/);
  assert.equal(messages[0].options.frameId, 0);
  await elements.compare.click(); assert.equal(saved.bypass, true); assert.match(elements['audio-status'].textContent, /Original sound/);
  assert.equal(elements['compare-label'].textContent, 'Back to HDROLED');
  await elements.enabled.click(); assert.equal(saved.enabled, false); assert.equal(elements['enabled-state'].textContent, 'OFF');
});
