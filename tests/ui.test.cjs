const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../extension'),clone=x=>JSON.parse(JSON.stringify(x));
async function fixture(){
 const elements=new Map(),events=new Map(),messages=[];let release,opened=0;
 const element=id=>{if(!elements.has(id))elements.set(id,{id,disabled:false,hidden:false,textContent:'',value:'',classList:{toggle(){}},setAttribute(k,v){this[k]=v;},addEventListener(k,fn){(this.events||(this.events={}))[k]=fn;},removeEventListener(){}});return elements.get(id);};
 const context=vm.createContext({URL,document:{querySelector:s=>element(s.slice(1))},setTimeout,clearTimeout,addEventListener:(k,fn)=>events.set(k,fn),removeEventListener(){}});
 for(const file of ['shared.js','featured.js','client.js','fade.js','ui.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
 let state={ok:true,context:{tabId:7,key:'watch:a',epoch:'a1',label:'Video A'},state:context.HDROLED_FEATURED.createState('watch:a'),media:{ok:true,revision:0}};
 const api={tabs:{sendMessage:async(id,m)=>{messages.push({id,...m});return{ok:true};}},runtime:{onMessage:{addListener(){},removeListener(){}},sendMessage:async m=>{if(m.type==='HDROLED_GET')return clone(state);if(m.type==='HDROLED_UPDATE'){await new Promise(r=>release=r);state={...state,state:{...state.state,revision:1,settings:{...state.state.settings,...m.action.patch}}};return clone(state);}return{ok:false};}}};
 const ui=context.HDROLED_MOUNT_UI({api,tabId:7,initialSnapshot:state,onOpened:()=>opened++});await new Promise(setImmediate);
 return{ui,element,messages,opened:()=>opened,release:()=>release?.(),click:id=>element(id).events.click(),tick:()=>new Promise(setImmediate)};
}
test('saving a boost setting never disables the logo or delays opening the page controls',async()=>{
 const f=await fixture();f.click('picture');await f.tick();
 try{assert.equal(f.element('brand-button').disabled,false);void f.click('brand-button');await f.tick();assert.equal(f.messages[0]?.type,'HDROLED_SHOW_PANEL');assert.deepEqual(clone(f.messages[0].edit.patch),{pictureEnabled:false});assert.equal(f.opened(),1);}finally{f.release();await f.ui.settle();f.ui.dispose();}
});
test('unavailable hardware rows are hidden and fractional levels appear in controls',async()=>{
 const f=await fixture();assert.equal(f.element('graphics-row').hidden,true);assert.equal(f.element('audio-row').hidden,true);assert.match(f.element('strength-value').textContent,/\d+\.\d%/);f.ui.dispose();
});
