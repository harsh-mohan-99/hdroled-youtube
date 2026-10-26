const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture(){const c=vm.createContext({});const file=path.resolve(__dirname,'../extension/client.js');if(fs.existsSync(file))vm.runInContext(fs.readFileSync(file,'utf8'),c);assert.ok(c.HDROLED_CREATE_CLIENT,'UI client not implemented');
 let state={ok:true,context:{tabId:1,key:'watch:a',epoch:'a1'},state:{revision:0,settings:{strength:60,soundStrength:60}}};const writes=[],errors=[];let release;
 const transport={get:async()=>JSON.parse(JSON.stringify(state)),update:async req=>{writes.push(req);if(writes.length===1)await new Promise(r=>release=r);if(req.context.epoch!==state.context.epoch)return{ok:false,code:'STALE'};state.state.settings={...state.state.settings,...(req.action.patch||{})};state.state.revision++;return JSON.parse(JSON.stringify(state));}};
 const client=c.HDROLED_CREATE_CLIENT(transport,()=>{},e=>errors.push(e));return{client,writes,errors,release:()=>release(),route:()=>{state={ok:true,context:{tabId:1,key:'watch:b',epoch:'b1'},state:{revision:0,settings:{strength:60,soundStrength:60}}};client.accept(JSON.parse(JSON.stringify(state)));}};}
test('rapid slider inputs are coalesced and the final picture/sound values are preserved',async()=>{
 const f=fixture();await f.client.refresh();const a=f.client.change({type:'patch',patch:{strength:10}});await new Promise(setImmediate);
 const b=f.client.change({type:'patch',patch:{strength:40}}),d=f.client.change({type:'patch',patch:{strength:86,soundStrength:35}});f.release();await Promise.all([a,b,d]);
 assert.equal(f.writes.length,2);assert.equal(f.client.snapshot().state.settings.strength,86);assert.equal(f.client.snapshot().state.settings.soundStrength,35);
});
test('a navigation during a slider write drops unsent old-page inputs and ignores late acknowledgements',async()=>{
 const f=fixture();await f.client.refresh();const a=f.client.change({type:'patch',patch:{strength:10}});await new Promise(setImmediate);const b=f.client.change({type:'patch',patch:{strength:99}});
 f.route();f.release();await Promise.all([a,b]);assert.equal(f.client.snapshot().context.key,'watch:b');assert.equal(f.client.snapshot().state.settings.strength,60);assert.equal(f.writes.length,1);
});
