const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function fixture(){
 const c=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension/fade.js'),'utf8'),c);
 let id=0;const timers=new Map(),events=[];
 const fade=c.HDROLED_CREATE_FADE(value=>events.push(value),{setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id)});
 return {fade,events,run(){for(const fn of [...timers.values()])fn();timers.clear();}};
}
test('picture slider fades continuously during drag and restores on release or cancel',()=>{
 const {fade,events,run}=fixture();fade.start();fade.input();run();assert.deepEqual(events,[true]);fade.end();assert.deepEqual(events,[true,false]);
 fade.start();fade.end();assert.deepEqual(events,[true,false,true,false]);
});
test('keyboard changes restore after idle; disposal always restores and cancels timers',()=>{
 const {fade,events,run}=fixture();fade.input();assert.deepEqual(events,[true]);run();assert.deepEqual(events,[true,false]);
 fade.input();fade.dispose();run();assert.deepEqual(events,[true,false,true,false]);fade.input();assert.deepEqual(events,[true,false,true,false]);
});
