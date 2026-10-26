const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../extension'),clone=x=>JSON.parse(JSON.stringify(x));
function fixture(memory={session:{},local:{}}){
 const identities=new Map(),windows=new Map(),created=[],applied=[],panels=[];let time=100000,gate=null,fail=false;
 const area=name=>({get:async key=>({[key]:clone(memory[name][key]??null)}),set:async data=>{if(fail){fail=false;throw Error('quota');}if(gate){const g=gate;gate=null;await g;}Object.assign(memory[name],clone(data));},remove:async key=>{delete memory[name][key];}});
 const api={storage:{session:area('session'),local:area('local')},runtime:{getURL:p=>'chrome-extension://test/'+p,sendMessage:async()=>{}},action:{enable:async()=>{},disable:async()=>{}},
 tabs:{sendMessage:async(id,m)=>{const i=identities.get(id);if(!i)throw Error('no page');if(m.type==='HDROLED_IDENTIFY')return {ok:true,...i};if(m.type==='HDROLED_SHOW_PANEL'){panels.push({id,...m});return {ok:true};}if(m.type==='HDROLED_APPLY'){applied.push({id,epoch:m.context.epoch});return i.epoch===m.context.epoch?{ok:true,pageApplied:m.state.settings.pictureEnabled&&!m.state.settings.bypass&&m.state.settings.strength>0,audioEnhanced:m.state.settings.soundEnabled&&!m.state.settings.bypass?1:0}: {ok:false};}throw Error(m.type);}},
 windows:{get:async id=>{if(!windows.has(id))throw Error('closed');return windows.get(id);},update:async id=>windows.get(id),remove:async id=>windows.delete(id),create:async data=>{created.push(data);const w={id:created.length};windows.set(w.id,w);return w;}}};
 const c=vm.createContext({URL});for(const name of ['shared.js','featured.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),c);
 if(fs.existsSync(path.join(root,'coordinator.js')))vm.runInContext(fs.readFileSync(path.join(root,'coordinator.js'),'utf8'),c);
 assert.ok(c.HDROLED_CREATE_COORDINATOR,'Coordinator not implemented yet');
 const controller=c.HDROLED_CREATE_COORDINATOR(api,()=>time),ui={url:'chrome-extension://test/popup.html'};
 const page=id=>({frameId:0,tab:{id},url:identities.get(id)?.url});
 const route=(id,key,epoch)=>identities.set(id,{key,epoch,url:'https://www.youtube.com/watch?v='+key.split(':')[1],label:key});
 const hello=async(id,key,epoch)=>{route(id,key,epoch);return controller.handle({type:'HDROLED_HELLO',key,epoch},page(id));};
 const update=(snapshot,action,sender=ui)=>controller.handle({type:'HDROLED_UPDATE',tabId:snapshot.context.tabId,context:snapshot.context,revision:snapshot.state.revision,action},sender);
 return {memory,api,controller,ui,page,route,hello,update,identities,created,windows,applied,panels,advance:n=>time+=n,blockNext:()=>{let release;gate=new Promise(r=>release=r);return release;},failNext:()=>{fail=true;},clearFailure:()=>{fail=false;}};
}
test('two tabs and page revisits retain independent boost levels; old generations cannot write',async()=>{
 const f=fixture();let a=await f.hello(1,'watch:a','a1'),other=await f.hello(2,'watch:a','other');
 a=await f.update(a,{type:'patch',patch:{strength:84}});assert.equal(a.state.settings.strength,84);assert.equal(other.state.settings.strength,67.5);
 const b=await f.hello(1,'watch:b','b1');assert.equal(b.state.settings.strength,67.5);
 const stale=await f.update(a,{type:'patch',patch:{strength:2}});assert.equal(stale.code,'STALE');
 a=await f.hello(1,'watch:a','a2');assert.equal(a.state.settings.strength,84);assert.equal(a.state.manualHold,true);
 assert.equal((await f.update(a,{type:'compare'})).state.settings.bypass,true);
});
test('session state survives coordinator restart and is bounded/removed on tab close',async()=>{
 const f=fixture();let a=await f.hello(1,'watch:a','a1');await f.update(a,{type:'patch',patch:{soundStrength:25}});
 const g=fixture(f.memory);g.route(1,'watch:a','a1');a=await g.controller.handle({type:'HDROLED_GET',tabId:1},g.ui);assert.equal(a.state.settings.soundStrength,25);
 for(let i=0;i<22;i++)await g.hello(1,'watch:v'+i,'e'+i);
 assert.equal(Object.keys(g.memory.session['hdroledFeaturedTab:1'].states).length,20);
 await g.controller.removeTab(1);assert.equal(g.memory.session['hdroledFeaturedTab:1'],undefined);
});
test('a delayed old-page write never applies to a page reached during the storage write',async()=>{
 const f=fixture(),a=await f.hello(1,'watch:a','a1');const release=f.blockNext();
 const pending=f.update(a,{type:'patch',patch:{strength:99}});await new Promise(setImmediate);
 f.route(1,'watch:b','b1');release();const old=await pending;assert.equal(old.code,'STALE');
 const b=await f.controller.handle({type:'HDROLED_HELLO',key:'watch:b',epoch:'b1'},f.page(1));assert.equal(b.state.settings.strength,67.5);
 assert.equal(f.applied.at(-1).epoch,'b1');
 const restored=await f.hello(1,'watch:a','a2');assert.equal(restored.state.settings.strength,67.5);
});
test('conflicts, untrusted senders and failed storage writes are not acknowledged as success',async()=>{
 const f=fixture(),a=await f.hello(1,'watch:a','a1');const b=await f.update(a,{type:'patch',patch:{strength:70}});
 assert.equal((await f.update(a,{type:'patch',patch:{strength:80}})).code,'CONFLICT');
 assert.equal((await f.update(b,{type:'preset',preset:'original'},{url:'https://evil.example'})).code,'FORBIDDEN');
 f.failNext();assert.equal((await f.update(b,{type:'patch',patch:{strength:90}})).ok,false);
 const latest=await f.controller.handle({type:'HDROLED_GET',tabId:1},f.ui);assert.equal(latest.state.settings.strength,70);
});
test('HDROLED opens controls inside the bound page without creating browser windows',async()=>{
 const f=fixture(),a=await f.hello(7,'watch:a','a1');
 for(let i=0;i<2;i++)assert.equal((await f.controller.handle({type:'HDROLED_OPEN_PANEL',tabId:7,context:a.context},f.ui)).ok,true);
 assert.equal(f.created.length,0);assert.equal(f.panels.length,2);assert.equal(f.panels[0].id,7);assert.equal(f.panels[0].context.epoch,'a1');
 f.route(7,'watch:b','b1');assert.equal((await f.controller.handle({type:'HDROLED_OPEN_PANEL',tabId:7,context:a.context},f.ui)).code,'STALE');
 assert.equal(f.panels.length,2);
});
test('page slowdown requests cannot overwrite manual settings or another tab',async()=>{
 const f=fixture();let a=await f.hello(1,'watch:a','a1');await f.hello(2,'watch:b','b1');
 a=await f.update(a,{type:'slow',dropRate:.06},f.page(1));assert.ok(a.state.settings.strength>65&&a.state.settings.strength<67.5);assert.equal(a.state.settings.pictureEnabled,true);
 a=await f.update(a,{type:'patch',patch:{strength:72,pictureEnabled:true}});f.advance(40000);
 a=await f.update(a,{type:'slow'},f.page(1));assert.equal(a.state.settings.strength,72);assert.equal(a.state.manualHold,true);
 const b=await f.controller.handle({type:'HDROLED_GET',tabId:2},f.ui);assert.equal(b.state.settings.strength,67.5);
});
test('embedded controls may edit their own page but cannot address another tab',async()=>{
 const f=fixture(),a=await f.hello(7,'watch:a','a1');await f.hello(8,'watch:b','b1');
 assert.equal((await f.controller.handle({type:'HDROLED_GET',tabId:7},f.page(7))).ok,true);
 assert.equal((await f.update(a,{type:'patch',patch:{strength:38}},f.page(7))).state.settings.strength,38);
 assert.equal((await f.controller.handle({type:'HDROLED_GET',tabId:8},f.page(7))).code,'FORBIDDEN');
 assert.equal((await f.controller.handle({type:'HDROLED_OPEN_PANEL',tabId:7,context:a.context},f.page(7))).code,'FORBIDDEN');
});
test('automatic preference changes during navigation never alter the next page',async()=>{
 const f=fixture(),a=await f.hello(1,'watch:a','a1'),release=f.blockNext();
 const pending=f.update(a,{type:'auto',enabled:false});await new Promise(setImmediate);f.route(1,'watch:b','b1');release();
 assert.equal((await pending).code,'STALE');assert.equal(f.memory.local.hdroledFeaturedDefaults?.custom,undefined);
});
test('late YouTube title changes refresh the toolbar label without changing boost state',async()=>{
 const f=fixture(),a=await f.hello(1,'watch:a','a1');f.identities.get(1).label='Actual playing video';
 const b=await f.controller.handle({type:'HDROLED_GET',tabId:1},f.ui);assert.equal(b.context.label,'Actual playing video');assert.equal(b.state.revision,a.state.revision);
});
test('reconnection does not disable the toolbar popup',async()=>{
 const f=fixture();let disabled=0;f.api.action.disable=async()=>disabled++;await f.hello(1,'watch:a','a1');await f.controller.markLoading(1);assert.equal(disabled,0);
});
