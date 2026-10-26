const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('close/reopen reuses the page client so delayed old acknowledgements cannot replace the newest edit',async()=>{
 let mounts=0,releases,disposed=0;const copy=x=>JSON.parse(JSON.stringify(x)),writes=[],documentEvents={},root=path.resolve(__dirname,'../extension');
 class Node{constructor(){this.style={setProperty(){}};this.children=[];this.classList={toggle(){}};this.offsetHeight=500;}append(...nodes){for(const n of nodes){n.remove();n.parent=this;this.children.push(n);}}remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}get isConnected(){return Boolean(this.parent)||this===document.documentElement;}attachShadow(){return new Node();}setAttribute(){}addEventListener(){}removeEventListener(){}focus(){}getBoundingClientRect(){return{width:380,height:500};}}
 const document={createElement:()=>new Node(),documentElement:new Node(),activeElement:null,addEventListener:(name,fn)=>documentEvents[name]=fn,removeEventListener(){}};
 let model={ok:true,context:{tabId:1,key:'watch:a',epoch:'a1'},state:{revision:0,settings:{strength:60,soundStrength:60}}},mounted;
 const c=vm.createContext({document,innerWidth:1280,innerHeight:720,addEventListener(){},removeEventListener(){},HDROLED_PANEL_TEMPLATE:{html:'',css:''},HDROLED_MOUNT_UI:options=>{
  mounts++;const client=c.HDROLED_CREATE_CLIENT({get:async()=>copy(model),update:async req=>{writes.push(req.action.patch.strength);Object.assign(model.state.settings,req.action.patch);model.state.revision++;const answer=copy(model);if(writes.length===1)await new Promise(r=>releases=r);return answer;}});client.accept(options.initialSnapshot);
  mounted={accept:client.accept,change:client.change,cancelFade(){},disconnect:client.disconnect,dispose(){disposed++;client.disconnect();}};return mounted;
 }});
 for(const name of ['client.js','panel.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),c);
 const panel=c.HDROLED_CREATE_PANEL();panel.show(copy(model));const first=panel.change({type:'patch',patch:{strength:10}});await new Promise(setImmediate);const old=panel.change({type:'patch',patch:{strength:90}});
 panel.close();assert.equal(disposed,0);const full=new Node();document.documentElement.append(full);document.fullscreenElement=full;documentEvents.fullscreenchange();assert.equal(full.children.length,0,'fullscreen must not reopen closed controls');
 panel.show(copy(model));assert.equal(full.children.length,1,'explicit reopen uses fullscreen parent');const newest=panel.change({type:'patch',patch:{strength:80}});releases();await Promise.all([first,old,newest]);
 assert.equal(mounts,1);assert.equal(model.state.settings.strength,80);assert.deepEqual(writes,[10,80]);
});
