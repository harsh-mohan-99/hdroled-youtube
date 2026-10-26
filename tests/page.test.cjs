const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../extension');
async function fixture(visible='visible'){const events={},intervals=new Map(),timeouts=new Map(),hellos=[],applied=[],notices=[],panels=[],panelUpdates=[],observers=[];let listener,id=0,epoch=0,now=0;
 const video={isConnected:true,paused:false,ended:false,seeking:false,readyState:4,currentTime:0,currentSrc:'blob:one',getVideoPlaybackQuality:()=>({totalVideoFrames:100,droppedVideoFrames:0})};
 const titleNode={},location={hostname:'www.youtube.com',href:'https://www.youtube.com/watch?v=a'},document={title:'Video A',visibilityState:visible,documentElement:{},querySelector:()=>titleNode,addEventListener:(name,fn)=>events[name]=fn};const win={};win.top=win;
 const c=vm.createContext({URL,location,document,window:win,crypto:{randomUUID:()=>String(++epoch)},Date:{now:()=>now},queueMicrotask,MutationObserver:class{constructor(fn){this.fn=fn;}observe(target){observers.push({target,fn:this.fn});}},
 addEventListener:(name,fn)=>events[name]=fn,setInterval:fn=>{intervals.set(++id,fn);return id;},clearInterval:i=>intervals.delete(i),setTimeout:fn=>{timeouts.set(++id,fn);return id;},clearTimeout:i=>timeouts.delete(i),
 HDROLED_EXT:{runtime:{id:'self',onMessage:{addListener:fn=>listener=fn},sendMessage:async m=>{if(m.type==='HDROLED_HELLO')return new Promise(resolve=>hellos.push({m,resolve}));return{ok:true};}}},
 HDROLED_CREATE_MEDIA:()=>({apply:s=>{applied.push({...s});return{ok:true,pageApplied:s.pictureEnabled,audioEnhanced:0};},reset:()=>applied.push({reset:true}),video:()=>video}),
 HDROLED_CREATE_NOTICES:()=>({show:s=>notices.push(s.state.notice),clear(){}}),HDROLED_CREATE_PANEL:()=>({show:s=>{panels.push(s);return true;},accept:s=>panelUpdates.push(s),disconnect(){}})});
 for(const file of ['shared.js','featured.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
 const file=path.join(root,'featured-content.js');assert.ok(fs.existsSync(file),'Featured content integration is not implemented');vm.runInContext(fs.readFileSync(file,'utf8'),c);
 await new Promise(setImmediate);
 function answer(n){const h=hellos[n],state=c.HDROLED_FEATURED.createState(h.m.key,{},now);h.resolve({ok:true,context:{tabId:1,key:h.m.key,epoch:h.m.epoch},state});}
 const message=m=>new Promise(resolve=>listener(m,{id:'self'},resolve));
 return{events,intervals,timeouts,hellos,applied,notices,video,location,document,answer,message,panels,panelUpdates,titleNode,observers,clock:v=>now=v};}
test('a late page initialization never applies after navigation to another video',async()=>{
 const f=await fixture();f.events['yt-navigate-start']();f.location.href='https://www.youtube.com/watch?v=b';f.events['yt-navigate-finish']();await new Promise(setImmediate);
 assert.equal(f.hellos.length,2);f.answer(0);await new Promise(setImmediate);assert.equal(f.applied.filter(s=>!s.reset).length,0);
 f.answer(1);await new Promise(setImmediate);assert.equal(f.applied.at(-1).strength,67.5);assert.equal(f.notices.length,1);
 const old=await f.message({type:'HDROLED_APPLY',context:{tabId:1,key:'watch:a',epoch:f.hellos[0].m.epoch},state:{revision:99,settings:{strength:100}}});assert.equal(old.ok,false);assert.equal(f.applied.at(-1).strength,67.5);
});
test('sampling stops in hidden/paused pages and resumes only during usable playback',async()=>{
 const f=await fixture();f.answer(0);await new Promise(setImmediate);assert.equal(f.intervals.size,1);
 f.document.visibilityState='hidden';f.events.visibilitychange();await new Promise(setImmediate);assert.equal(f.intervals.size,0);
 f.document.visibilityState='visible';f.events.visibilitychange();await new Promise(setImmediate);assert.equal(f.intervals.size,1);
 f.video.paused=true;f.events.pause();await new Promise(setImmediate);assert.equal(f.intervals.size,0);
 f.video.paused=false;f.events.playing();await new Promise(setImmediate);assert.equal(f.intervals.size,1);
});
test('small startup notices wait until a background YouTube tab becomes visible',async()=>{
 const f=await fixture('hidden');f.answer(0);await new Promise(setImmediate);assert.equal(f.notices.length,0);
 f.document.visibilityState='visible';f.events.visibilitychange();await new Promise(setImmediate);assert.equal(f.notices.length,1);
});
test('a transient initialization failure retries without requiring page navigation',async()=>{
 const f=await fixture();f.hellos[0].resolve({ok:false,code:'ERROR'});await new Promise(setImmediate);
 assert.equal(f.timeouts.size,1);const [id,fn]=f.timeouts.entries().next().value;f.timeouts.delete(id);fn();await new Promise(setImmediate);
 assert.equal(f.hellos.length,2);f.answer(1);await new Promise(setImmediate);assert.equal(f.applied.at(-1).strength,67.5);
});
test('opening the page panel does not wait for its initial settings handshake',async()=>{
 const f=await fixture();assert.equal((await f.message({type:'HDROLED_SHOW_PANEL',tabId:1})).ok,true);assert.equal(f.panels[0].ok,false);
 f.answer(0);await new Promise(setImmediate);assert.equal(f.panelUpdates.at(-1).ok,true);
});
test('page popup opens only for the current context and tracks a late title mutation',async()=>{
 const f=await fixture();f.answer(0);await new Promise(setImmediate);const i=await f.message({type:'HDROLED_IDENTIFY'}),context={tabId:1,key:i.key,epoch:i.epoch};
 assert.equal((await f.message({type:'HDROLED_SHOW_PANEL',context})).ok,true);assert.equal(f.panels.length,1);
 assert.equal((await f.message({type:'HDROLED_SHOW_PANEL',context:{...context,epoch:'old'}})).ok,false);
 f.document.title='The next movie - YouTube';const titleObserver=f.observers.find(o=>o.target===f.titleNode);assert.ok(titleObserver);titleObserver.fn([]);await new Promise(setImmediate);
 assert.equal(f.panelUpdates.at(-1).context.label,'The next movie');assert.equal((await f.message({type:'HDROLED_IDENTIFY'})).label,'The next movie');
});
