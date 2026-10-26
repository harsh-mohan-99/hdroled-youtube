const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../extension');
const load=(name,c)=>vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),c,{filename:name});
test('Featured 2.0 manifests use only storage, YouTube access and the correct background form',()=>{
 for(const [file,firefox] of [['manifest.json',false],['../manifests/firefox.json',true]]){
  const m=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
  assert.equal(m.version,'2.0.0');assert.deepEqual(m.permissions,['storage']);
  assert.deepEqual(m.content_scripts[0].matches,['https://www.youtube.com/*','https://m.youtube.com/*']);
  assert.equal(m.content_scripts[0].all_frames,false);assert.equal(m.host_permissions,undefined);assert.equal(m.web_accessible_resources,undefined);
  if(firefox)assert.ok(m.background.scripts.includes('background.js'));else assert.equal(m.background.service_worker,'background.js');
  for(const f of new Set([...m.content_scripts[0].js,...(m.background.scripts||['background.js']),'ui.js','client.js']))new vm.Script(fs.readFileSync(path.join(root,f),'utf8'));
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

