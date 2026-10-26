const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../extension/hardware.js'),'utf8');
test('GPU information is read once and its temporary context is released; output labels remain honest',async()=>{
 let contexts=0,released=0,enumerated=0,changed=0;
 const c=vm.createContext({document:{createElement:()=>({getContext:()=>{contexts++;return{getExtension:name=>name==='WEBGL_debug_renderer_info'?{UNMASKED_RENDERER_WEBGL:1}:{loseContext:()=>released++},getParameter:()=> 'ANGLE (NVIDIA, NVIDIA GeForce RTX Test, Direct3D11)'};}})},navigator:{mediaDevices:{enumerateDevices:async()=>{enumerated++;return[{kind:'audiooutput',deviceId:'default',label:'Default speakers'}];}}},dispatchEvent:()=>changed++,Event:class{}});
 vm.runInContext(source,c);const first=c.HDROLED_HARDWARE.get();assert.equal(first.graphicsName,'NVIDIA GeForce RTX Test');assert.equal(first.audioOutput,null);assert.equal(first.audioDriverName,null);
 c.HDROLED_HARDWARE.get();assert.equal(contexts,1);assert.equal(released,1);
 assert.equal(enumerated,0);assert.equal(changed,0);assert.equal(first.audioDriverName,null);
});
test('restricted hardware APIs degrade to unavailable without permissions or failures',async()=>{
 const c=vm.createContext({document:{createElement:()=>({getContext:()=>{throw Error('blocked');}})},navigator:{}});vm.runInContext(source,c);
 assert.equal(c.HDROLED_HARDWARE.get().graphicsName,null);assert.equal(c.HDROLED_HARDWARE.get().audioDriverName,null);
});
test('GPU names exclude backend, shader, PCI identifiers and generic hidden renderers',()=>{
 const c=vm.createContext({});vm.runInContext(source,c);const clean=c.HDROLED_HARDWARE.cleanGraphicsName;
 assert.equal(clean('ANGLE (Intel, Intel(R) UHD Graphics 630 (0x00003E92) Direct3D11 vs_5_0 ps_5_0, D3D11)'),'Intel(R) UHD Graphics 630');
 assert.equal(clean('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060, OpenGL 4.5)'),'NVIDIA GeForce RTX 3060');assert.equal(clean('WebKit WebGL'),null);
});
