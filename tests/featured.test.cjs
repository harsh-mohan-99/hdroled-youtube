const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../extension');
const load=(name,c)=>vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),c,{filename:name});
function core(){const c=vm.createContext({URL});load('shared.js',c);if(fs.existsSync(path.join(root,'featured.js')))load('featured.js',c);assert.ok(c.HDROLED_FEATURED,'Featured core is not implemented yet');return c.HDROLED_FEATURED;}
test('page identities ignore tracking and timestamps but separate actual YouTube videos',()=>{
 const F=core();assert.equal(F.pageKey('https://www.youtube.com/watch?v=one&t=40&list=x'),'watch:one');
 assert.equal(F.pageKey('https://m.youtube.com/shorts/two?feature=share'),'shorts:two');
 assert.equal(F.pageKey('https://www.youtube.com/live/three'),'live:three');
 assert.equal(F.pageKey('https://example.com/watch?v=one'),null);
 assert.notEqual(F.pageKey('https://www.youtube.com/results?search_query=cat'),F.pageKey('https://www.youtube.com/results?search_query=dog'));
});
test('hardware hints choose conservative initial opacity; manual edits take priority',()=>{
 const F=core(),low=F.initialStrength({hardwareConcurrency:2,deviceMemory:2}),medium=F.initialStrength({hardwareConcurrency:4,deviceMemory:8}),high=F.initialStrength({hardwareConcurrency:16,deviceMemory:8});assert.ok(low<medium&&medium<high);assert.ok(!Number.isInteger(medium));assert.equal(F.initialStrength({}),67.5);
 let s=F.createState('watch:a',{initialStrength:50},1000);assert.equal(s.preset,undefined);assert.equal(s.settings.strength,50);assert.equal(s.settings.soundStrength,60);
 s=F.transition(s,{type:'patch',patch:{strength:83}},2000);assert.equal(s.manualHold,true);assert.equal(s.settings.soundStrength,60);
 const warning=F.transition(s,{type:'slow',reason:'frames'},40000);assert.equal(warning.settings.strength,83);assert.equal(warning.notice.kind,'warning');
});
test('slowdown reduces opacity without disabling either effect; manual priority and resume remain',()=>{
 const F=core();let s=F.createState('watch:a',{},0);s=F.transition(s,{type:'slow'},40000);
 assert.ok(s.settings.strength<67.5&&s.settings.strength>65);assert.equal(s.settings.pictureEnabled,true);assert.equal(s.settings.soundStrength,60);assert.match(s.notice.text,/\d+\.\d/);
 s=F.transition(s,{type:'patch',patch:{strength:60}},41000);assert.equal(s.manualHold,true);assert.equal(s.settings.strength,60);
 s=F.transition(s,{type:'auto',enabled:true},42000);assert.equal(s.manualHold,false);
 s=F.transition(s,{type:'patch',patch:{soundStrength:22}},43000);const later=F.transition(s,{type:'slow'},80000);assert.equal(later.settings.soundStrength,22);
});
test('Original comparison preserves settings and suspends automatic changes',()=>{
 const F=core();let s=F.createState('watch:a',{},0);s=F.transition(s,{type:'compare'},1000);
 s=F.transition(s,{type:'slow'},40000);assert.equal(s.settings.bypass,true);assert.equal(s.settings.strength,67.5);
 s=F.transition(s,{type:'compare'},41000);assert.equal(s.settings.bypass,false);assert.equal(s.manualHold,false);
});
test('automatic adjustments stop at 20 percent and never mutate another page or switch off picture',()=>{
 const F=core(),b=F.createState('watch:b',{},0);let a=F.createState('watch:a',{initialStrength:40},0);
 for(let i=1;i<=300;i++)a=F.transition(a,{type:'slow',dropRate:.25},i*40000);
 assert.equal(a.settings.strength,20);assert.equal(a.settings.pictureEnabled,true);assert.equal(b.settings.strength,67.5);
 assert.equal(F.PRESETS,undefined);assert.throws(()=>F.transition(b,{type:'preset',preset:'performance'},0));
});
test('fractional strengths survive state updates and recovery restores quality without overriding manual choices',()=>{
 const F=core();let s=F.createState('watch:a',{initialStrength:73.7});assert.equal(s.settings.strength,73.7);
 const mild=F.transition(s,{type:'slow',dropRate:.06,lateness:30},40000),severe=F.transition(s,{type:'slow',dropRate:.25,lateness:700},40000);assert.ok(mild.settings.strength>severe.settings.strength);assert.ok(mild.settings.strength>70);
 const recovered=F.transition(mild,{type:'recover'},60000);assert.ok(recovered.settings.strength>mild.settings.strength);assert.ok(recovered.settings.strength<=73.7);
 s=F.transition(s,{type:'patch',patch:{strength:63.7,soundStrength:41.3}},70000);assert.equal(s.settings.strength,63.7);assert.equal(s.settings.soundStrength,41.3);assert.equal(F.transition(s,{type:'recover'},90000).settings.strength,63.7);
});
function sample(now,total,dropped,extra={}){return {now,totalFrames:total,droppedFrames:dropped,currentTime:now/1000,source:'one',visible:true,paused:false,seeking:false,waiting:false,readyState:4,lateness:0,...extra};}
test('slowdown tracker requires warmup and sustained evidence, and emits once until recovery',()=>{
 const F=core(),t=new F.SlowTracker(0);t.sample(sample(10000,0,0));
 assert.equal(t.sample(sample(12000,100,10)).slow,false);assert.equal(t.sample(sample(14000,200,20)).slow,false);
 assert.equal(t.sample(sample(16000,300,30)).slow,true);assert.equal(t.sample(sample(18000,400,40)).slow,false);
 for(let i=1;i<=3;i++)t.sample(sample(18000+i*2000,400+i*100,40));
 assert.equal(t.sample(sample(26000,800,50)).slow,false);t.sample(sample(28000,900,60));assert.equal(t.sample(sample(30000,1000,70)).slow,true);
});
test('hidden/paused/seeking/buffering, counter resets and inadequate frame samples do not trigger fallback',()=>{
 const F=core();for(const invalid of [{visible:false},{paused:true},{seeking:true},{waiting:true},{readyState:2}]){
  const t=new F.SlowTracker(0);for(let i=1;i<=8;i++)assert.equal(t.sample(sample(i*2000,i*100,i*20,{...invalid,lateness:1000})).slow,false);
 }
 const t=new F.SlowTracker(0);t.sample(sample(10000,1000,100));assert.equal(t.sample(sample(12000,5,1)).slow,false);
 const q=new F.SlowTracker(0);for(let i=1;i<=8;i++)assert.equal(q.sample(sample(i*2000,i*5,i)).slow,false);
 const lag=new F.SlowTracker(0);lag.sample(sample(10000,null,null));lag.sample(sample(12000,null,null,{lateness:400}));lag.sample(sample(14000,null,null,{lateness:400}));assert.equal(lag.sample(sample(16000,null,null,{lateness:400})).slow,true);
});
test('quality recovery requires sustained healthy samples, not merely drops below the slowdown threshold',()=>{
 const F=core(),healthy=new F.SlowTracker(0),borderline=new F.SlowTracker(0);let recovered=false;
 for(let i=5;i<=25;i++){recovered=healthy.sample(sample(i*2000,i*100,0)).healthy||recovered;assert.ok(!borderline.sample(sample(i*2000,i*100,i*4)).healthy);}
 assert.equal(recovered,true);
});
