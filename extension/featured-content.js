(function(){
 'use strict';if(!['www.youtube.com','m.youtube.com'].includes(location.hostname)||window.top!==window||globalThis.__hdroledFeaturedPage)return;globalThis.__hdroledFeaturedPage=true;
 const api=HDROLED_EXT,F=HDROLED_FEATURED,media=HDROLED_CREATE_MEDIA(),notices=HDROLED_CREATE_NOTICES();let panel=null;
 let context=null,snapshot=null,status=null,generation=0,navigating=false,scheduled=false,waiting=false,lastHref=location.href,timer=null,nextSample=0,retryTimer=null,attempts=0,initializing=false;
 const tracker=new F.SlowTracker(Date.now()),same=(a,b)=>a&&b&&a.key===b.key&&a.epoch===b.epoch;
 const currentTitle=()=>String(document.title||context?.key||'YouTube').replace(/^\(\d+\)\s*/, '').replace(/\s*[-–—]\s*YouTube\s*$/, '').slice(0,200);
 function stopMonitor(){if(timer!==null)clearInterval(timer);timer=null;tracker.reset(Date.now());}
 async function act(action){
  if(!context||!snapshot)return;const c={...context},g=generation;
  try{const answer=await api.runtime.sendMessage({type:'HDROLED_UPDATE',tabId:c.tabId,context:c,revision:snapshot.state.revision,action});if(g===generation&&answer?.ok)accept(answer);}catch(_){}
 }
 function tick(){
  const v=media.video(),now=Date.now(),late=Math.max(0,now-nextSample);nextSample=now+2000;
  if(!v||!snapshot||!context||document.visibilityState!=='visible'||v.paused||v.ended||v.seeking||waiting||v.readyState<3){syncMonitor();return;}
  let quality=null;try{quality=v.getVideoPlaybackQuality?.();}catch(_){}
  const result=tracker.sample({now,source:v.currentSrc||v.src||'',currentTime:v.currentTime,totalFrames:quality?.totalVideoFrames??null,droppedFrames:quality?.droppedVideoFrames??null,visible:true,paused:false,seeking:false,waiting:false,readyState:v.readyState,lateness:late});
  if(result.slow)void act({type:'slow',reason:result.reason,dropRate:result.dropRate,lateness:result.lateness});
  else if(result.healthy)void act({type:'recover'});
 }
 function syncMonitor(){
  const v=media.video(),run=Boolean(context&&snapshot&&!navigating&&document.visibilityState==='visible'&&v&&!v.paused&&!v.ended&&!v.seeking&&!waiting&&v.readyState>=3);
  if(!run){stopMonitor();return;}
  if(timer===null){tracker.reset(Date.now());nextSample=Date.now()+2000;timer=setInterval(tick,2000);}
 }
 function apply(force=true){
  if(!snapshot||!context||navigating||F.pageKey(location.href)!==context.key)return {ok:false};
  context={...context,label:currentTitle()};snapshot={...snapshot,context:{...context}};
  if(force||!status)status={...media.apply(snapshot.state.settings),revision:snapshot.state.revision};
  if(document.visibilityState==='visible')notices.show(snapshot,act);else notices.clear();panel?.accept({...snapshot,media:status});syncMonitor();return status;
 }
 function accept(answer,force=false){
  if(!answer?.ok||!same(answer.context,context)||F.pageKey(location.href)!==context.key)return {ok:false};
  if(snapshot&&answer.state.revision<snapshot.state.revision)return {ok:false};
  const changed=!snapshot||answer.state.revision!==snapshot.state.revision;context={...answer.context,initialStrength:context.initialStrength};snapshot=answer;
  return apply(force||changed);
 }
 function invalidate(){generation++;context=null;snapshot=null;status=null;attempts=0;initializing=false;panel?.disconnect();if(retryTimer!==null)clearTimeout(retryTimer);retryTimer=null;stopMonitor();notices.clear();media.reset();}
 async function handshake(g){
  if(g!==generation||!context||snapshot||initializing)return;initializing=true;attempts++;
  const c={...context};try{const answer=await api.runtime.sendMessage({type:'HDROLED_HELLO',key:c.key,epoch:c.epoch});if(g===generation)accept(answer);}catch(_){}
  finally{
   if(g===generation){initializing=false;
    if(!snapshot&&attempts<4){retryTimer=setTimeout(()=>{retryTimer=null;void handshake(g);},[500,1500,4000][attempts-1]);}
    else if(!snapshot&&document.visibilityState==='visible')notices.show({state:{notice:{id:c.epoch+':connection',kind:'warning',text:'HDROLED could not reconnect. Refresh this YouTube tab to retry.'}}},()=>{});
   }
  }
 }
 async function connect(){
  navigating=false;invalidate();lastHref=location.href;const key=F.pageKey(lastHref);if(!key)return;
  const g=generation;context={key,epoch:crypto.randomUUID(),url:lastHref,label:currentTitle(),initialStrength:F.initialStrength(globalThis.navigator||{})};
  await handshake(g);
 }
 function route(){if(navigating)return false;const key=F.pageKey(location.href);lastHref=location.href;if(!context||key!==context.key){void connect();}return Boolean(context&&key===context.key);}
 function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;if(!route()||!snapshot)return;const current=apply();if(current.ok)void api.runtime.sendMessage({type:'HDROLED_MEDIA',context,revision:snapshot.state.revision,media:current}).catch(()=>{});});}
 api.runtime.onMessage.addListener((m,sender,reply)=>{
  if(sender?.id&&api.runtime.id&&sender.id!==api.runtime.id)return false;
  if(m?.type==='HDROLED_IDENTIFY'){if(!route()){reply({ok:false});return false;}reply({ok:true,...context,label:currentTitle(),url:location.href});return false;}
  if(m?.type==='HDROLED_RECONNECT'){void connect();reply({ok:true});return false;}
  if(m?.type==='HDROLED_APPLY'){reply(accept({ok:true,context:m.context,state:m.state,customAvailable:m.customAvailable},true));return false;}
  if(m?.type==='HDROLED_SHOW_PANEL'){
   if(!route()||!context||m.context&&(!same(m.context,context)||m.context.tabId!==context.tabId)){reply({ok:false});return false;}
   const id=context.tabId??m.tabId;if(!Number.isInteger(id)){reply({ok:false});return false;}
   const view=snapshot?{...snapshot,media:status}:{ok:false,context:{...context,tabId:id,label:currentTitle()}};
   panel=panel||HDROLED_CREATE_PANEL();const opened=panel.show(view);
   if(opened&&snapshot&&m.edit&&same(m.edit.context,context)&&m.edit.context.tabId===id)void panel.change({type:'patch',patch:m.edit.patch});
   reply({ok:opened});return false;
  }
  return false;
 });
 for(const e of ['loadedmetadata','emptied','seeking','seeked'])document.addEventListener(e,()=>{tracker.reset(Date.now());schedule();},true);
 for(const e of ['play','playing','canplay'])document.addEventListener(e,()=>{waiting=false;schedule();},true);
 for(const e of ['waiting','stalled'])document.addEventListener(e,()=>{waiting=true;stopMonitor();},true);
 for(const e of ['pause','ended','resize','fullscreenchange','enterpictureinpicture','leavepictureinpicture','visibilitychange'])document.addEventListener(e,schedule,true);
 document.addEventListener('yt-navigate-start',()=>{navigating=true;invalidate();},true);
 document.addEventListener('yt-navigate-finish',()=>{void connect();},true);
 document.addEventListener('yt-update-title',schedule,true);
 const title=document.querySelector('title');if(title)new MutationObserver(schedule).observe(title,{childList:true,subtree:true,characterData:true});
 addEventListener('popstate',()=>{navigating=false;route();});addEventListener('hashchange',()=>{route();});
 addEventListener('pagehide',()=>{navigating=true;invalidate();});addEventListener('pageshow',e=>{if(e.persisted)void connect();});
 addEventListener('hdroled-audio',schedule);
 addEventListener('hdroled-hardware',schedule);
 for(const event of ['pointerdown','keydown'])document.addEventListener(event,()=>{if(context&&!snapshot&&!initializing&&attempts>=4){attempts=0;void handshake(generation);}},true);
 new MutationObserver(records=>{
  if(location.href!==lastHref&&!navigating)route();
  if(records.some(record=>[...record.addedNodes,...record.removedNodes].some(n=>n.nodeType===1&&(n.matches?.('video,audio')||n.querySelector?.('video,audio')))))schedule();
 }).observe(document.documentElement,{childList:true,subtree:true});
 void connect();
})();
