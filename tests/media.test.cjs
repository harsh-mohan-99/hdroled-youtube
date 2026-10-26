const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../extension');
class Element{constructor(){this.isConnected=true;this.paused=false;this.videoWidth=1920;this.videoHeight=1080;this.values=new Map();this.style={getPropertyValue:k=>this.values.get(k)?.v||'',getPropertyPriority:k=>this.values.get(k)?.p||'',setProperty:(k,v,p='')=>this.values.set(k,{v,p}),removeProperty:k=>this.values.delete(k)};}matches(){return true;}}
function fixture(){const html=new Element(),video=new Element(),full=new Element(),sounds=[],queries=[];html.style.setProperty('filter','opacity(0.95)','important');
 const document={documentElement:html,fullscreenElement:null,pictureInPictureElement:null,querySelectorAll:s=>{queries.push(s);return[video];}};
 const win={};win.top=win;const c=vm.createContext({window:win,document,getComputedStyle:e=>({filter:e.style.getPropertyValue('filter')||'none'}),screen:{width:1920,height:1080},HDROLED_AUDIO:{applyAll:(m,on,level)=>{sounds.push({on,level});return{state:on?'enhanced':'original',enhanced:on?1:0,blocked:0,waiting:0};}}});
 for(const f of ['shared.js','media.js']){if(fs.existsSync(path.join(root,f)))vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c);}
 assert.ok(c.HDROLED_CREATE_MEDIA,'media adapter is not implemented yet');return{html,video,full,document,sounds,queries,api:c.HDROLED_CREATE_MEDIA()};}
test('page grade remains single-pass, composes prior filters and applies independent sound strengths',()=>{
 const f=fixture();const s=f.api.apply({pictureEnabled:true,soundEnabled:true,strength:50,soundStrength:35});
 assert.equal(s.pageApplied,true);assert.equal(f.html.style.getPropertyValue('filter'),'opacity(0.95) contrast(1.04) saturate(1.05) brightness(1.0125)');
 assert.equal(f.video.style.getPropertyValue('filter'),'');assert.equal(f.sounds.at(-1).level,35);assert.equal(f.queries.length,1);
 f.api.apply({pictureEnabled:true,soundEnabled:true,strength:0,soundStrength:35});assert.equal(f.html.style.getPropertyValue('filter'),'opacity(0.95)');assert.equal(f.sounds.at(-1).on,true);
});
test('fullscreen and Original restore exact prior styles without retaining a previous page grade',()=>{
 const f=fixture();f.api.apply({pictureEnabled:true,soundEnabled:true,strength:60,soundStrength:60});f.document.fullscreenElement=f.full;
 f.api.apply({pictureEnabled:true,soundEnabled:true,strength:60,soundStrength:60});assert.equal(f.html.style.getPropertyValue('filter'),'opacity(0.95)');assert.match(f.full.style.getPropertyValue('filter'),/^contrast/);
 f.api.reset();assert.equal(f.full.style.getPropertyValue('filter'),'');assert.equal(f.html.style.getPropertyPriority('filter'),'important');assert.equal(f.sounds.at(-1).on,false);
});
