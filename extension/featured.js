(function(root){
 'use strict';
 const H=root.HDROLED,copy=value=>JSON.parse(JSON.stringify(value));
 function initialStrength(info={}){
  const cores=Number(info.hardwareConcurrency)||0,memory=Number(info.deviceMemory)||0;
  if(!cores&&!memory)return 67.5;
  const score=(v,fallback)=>v>0?Math.min(1,Math.log2(Math.min(32,v)+1)/Math.log2(17)):fallback;
  return Math.round((55+25*(.7*score(cores,.65)+.3*score(memory,.65)))*10)/10;
 }
 function pageKey(value){try{
  const u=new URL(value);if(u.protocol!=='https:'||!['www.youtube.com','m.youtube.com'].includes(u.hostname))return null;
  const id=u.searchParams.get('v');if(u.pathname==='/watch'&&id&&/^[\w-]{1,64}$/.test(id))return 'watch:'+id;
  const match=u.pathname.match(/^\/(shorts|live)\/([\w-]{1,64})(?:\/|$)/);if(match)return match[1]+':'+match[2];
  return 'page:'+u.pathname+(u.pathname==='/results'?'?q='+encodeURIComponent((u.searchParams.get('search_query')||'').slice(0,200)):'');
 }catch(_){return null;}}
 function notice(s,kind,text,now){s.notice={id:s.key+':'+s.revision+':'+now,kind,text};return s;}
 function createState(key,prefs={},now=Date.now()){
  const strength=Number.isFinite(prefs.initialStrength)?Math.round(Math.max(20,Math.min(85,prefs.initialStrength))*10)/10:67.5;
  const s={key,schema:2,qualityTarget:strength,settings:H.normalizeSettings({pictureEnabled:true,soundEnabled:true,strength,soundStrength:60}),revision:0,autoEnabled:true,manualHold:false,lastAuto:0,lastWarning:0};
  return notice(s,'startup','Page adjusted · video '+strength.toFixed(1)+'% · browser hardware estimate.',now);
 }
 function transition(previous,a,now=Date.now()){
  const s=copy(previous);s.revision++;
  if(a.type==='patch'){
   const patch={};for(const k of ['pictureEnabled','soundEnabled','strength','soundStrength'])if(Object.hasOwn(a.patch||{},k))patch[k]=a.patch[k];
   s.settings=H.normalizeSettings({...s.settings,...patch,bypass:false});s.manualHold=true;s.notice=null;return s;
  }
  if(a.type==='compare'){s.settings.bypass=!s.settings.bypass;return s;}
  if(a.type==='auto'){s.autoEnabled=a.enabled===true;if(s.autoEnabled)s.manualHold=false;return s;}
  if(a.type==='dismiss'){if(s.notice?.id!==a.id)return previous;s.notice=null;return s;}
  if(a.type==='slow'){
   if(s.lastWarning&&now-s.lastWarning<30000)return previous;
   s.lastWarning=now;
   if(!s.autoEnabled||s.manualHold||s.settings.bypass)return notice(s,'warning','Playback slowed · your manual boost levels were kept.',now);
   if(!s.settings.pictureEnabled||s.settings.strength<=20)return notice(s,'warning','Playback slowed · video '+s.settings.strength.toFixed(1)+'% · level kept.',now);
   const pressure=Math.max(1,Math.min(10,(Number(a.dropRate)||.05)/.05),Math.min(8,(Number(a.lateness)||0)/250));
   const before=s.settings.strength,after=Math.round(Math.max(20,before*(1-Math.min(.03,.0075*Math.sqrt(pressure))))*10)/10;s.settings.strength=after;s.lastAuto=now;
   return notice(s,'slow','Page adjusted · video '+before.toFixed(1)+' → '+after.toFixed(1)+'% · reduced '+(before-after).toFixed(1)+' points.',now);
  }
  if(a.type==='recover'){
   const target=s.qualityTarget??s.settings.strength;
   if(!s.autoEnabled||s.manualHold||s.settings.bypass||!s.settings.pictureEnabled||s.settings.strength>=target||now-s.lastAuto<15000)return previous;
   const before=s.settings.strength;s.settings.strength=Math.round(Math.min(target,before+Math.max(.1,(target-before)*.25))*10)/10;s.lastAuto=now;
   return notice(s,'quality','Quality recovered · video '+before.toFixed(1)+' → '+s.settings.strength.toFixed(1)+'%.',now);
  }
  throw Error('Unknown action');
 }
 class SlowTracker{
  constructor(now=Date.now()){this.reset(now);}
  reset(now){this.warmUntil=now+10000;this.previous=null;this.bad=0;this.good=0;this.episode=false;this.lastSlow=0;this.lastHealthy=now;this.pressure=[];}
  sample(s){
   const valid=s.visible&&!s.paused&&!s.seeking&&!s.waiting&&s.readyState>=3&&Number.isFinite(s.currentTime);
   if(!valid){this.reset(s.now);return {slow:false};}
   const p=this.previous;this.previous={...s};
   if(!p||s.source!==p.source||s.currentTime<=p.currentTime){this.bad=0;this.good=0;if(p&&s.source!==p.source)this.warmUntil=s.now+10000;return {slow:false};}
   const total=s.totalFrames-p.totalFrames,dropped=s.droppedFrames-p.droppedFrames;
   if(Number.isFinite(s.totalFrames)&&Number.isFinite(p.totalFrames)&&(total<0||dropped<0)){this.reset(s.now);return {slow:false};}
   if(s.now<this.warmUntil){this.bad=0;return {slow:false};}
   const frames=Number.isFinite(s.totalFrames)&&Number.isFinite(p.totalFrames)&&total>=30&&dropped>=0&&dropped<=total&&dropped/total>=.05;
   const lag=Number.isFinite(s.lateness)&&s.lateness>=250;
   const measured=Number.isFinite(s.totalFrames)&&Number.isFinite(p.totalFrames)&&total>=30,stable=(!measured||dropped/total<=.01)&&(!Number.isFinite(s.lateness)||s.lateness<80);
   if(frames||lag){this.bad++;this.good=0;this.pressure.push({dropRate:frames?dropped/total:0,lateness:lag?s.lateness:0});if(this.pressure.length>3)this.pressure.shift();}else{this.bad=0;this.pressure=[];this.good=stable?this.good+1:0;if(this.good>=3)this.episode=false;}
   if(this.bad>=3&&(!this.episode||s.now-this.lastSlow>=30000)){this.episode=true;this.lastSlow=s.now;return {slow:true,reason:frames?'frames':'responsiveness',dropRate:this.pressure.reduce((sum,p)=>sum+p.dropRate,0)/this.pressure.length,lateness:this.pressure.reduce((sum,p)=>sum+p.lateness,0)/this.pressure.length};}
   if(this.good>=15&&s.now-this.lastHealthy>=15000){this.lastHealthy=s.now;return {slow:false,healthy:true};}
   return {slow:false};
  }
 }
 root.HDROLED_FEATURED=Object.freeze({copy,initialStrength,pageKey,createState,transition,SlowTracker});
})(globalThis);
