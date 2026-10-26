(function(){
  'use strict';if(!['www.youtube.com','m.youtube.com'].includes(location.hostname))return;if(globalThis.__hdroledPageV6)return;globalThis.__hdroledPageV6=true;
  const H=HDROLED,api=HDROLED_EXT,originals=new Map(),isTopFrame=window.top===window;
  let settings=H.normalizeSettings(),revision=0,latest=Promise.resolve(),scheduled=false;
  function restore(element,record){
    if(element.style.getPropertyValue('filter')!==record.applied||element.style.getPropertyPriority('filter')!=='important')return;
    if(record.value)element.style.setProperty('filter',record.value,record.priority);else element.style.removeProperty('filter');
  }
  function refresh(){
    const pictureOn=settings.pictureEnabled&&settings.strength>0&&!settings.bypass;
    const soundOn=settings.soundEnabled&&settings.soundStrength>0&&!settings.bypass;
    // Grade the final page once. Children, videos and iframe documents must not
    // receive a second grade; no backgrounds, text colors or overlay nodes change.
    const target=pictureOn&&isTopFrame?(document.fullscreenElement||document.documentElement):null;
    for(const[element,record]of originals)if(element!==target||!element.isConnected){restore(element,record);originals.delete(element);}
    let pageApplied=false;
    if(target){
      const value=target.style.getPropertyValue('filter'),priority=target.style.getPropertyPriority('filter');let record=originals.get(target);
      if(!record||value!==record.applied||priority!=='important'){
        const base=getComputedStyle(target).filter;
        record={value,priority,applied:'',base:base&&base!=='none'?base+' ':''};originals.set(target,record);
      }
      const filter=record.base+H.pictureFilter(settings.strength);
      if(value!==filter||priority!=='important'){
        target.style.setProperty('filter',filter,'important');record.applied=target.style.getPropertyValue('filter');
      }
      pageApplied=getComputedStyle(target).filter===record.applied;
    }
    const videos=[...document.querySelectorAll('video')],media=videos.filter(video=>video.matches('#movie_player video, #player video.html5-main-video, ytd-reel-video-renderer video, ytm-reel-video-renderer video'));
    const audio=HDROLED_AUDIO.applyAll(media,soundOn,settings.soundStrength),selected=videos.find(v=>!v.paused)||videos[0];
    return {ok:true,...settings,mode:!settings.enabled?'off':settings.bypass?'original':pictureOn&&isTopFrame&&!pageApplied?'partial':'active',
      pageApplied,pageInherited:pictureOn&&!isTopFrame,videoCount:videos.length,mediaCount:media.length,
      audio:audio.state,audioEnhanced:audio.enhanced,audioBlocked:audio.blocked,audioWaiting:audio.waiting,
      width:selected?.videoWidth||0,height:selected?.videoHeight||0,screenWidth:screen.width,screenHeight:screen.height,
      pictureInPicture:Boolean(document.pictureInPictureElement),pictureTarget:target===document.fullscreenElement&&target?'fullscreen':'page'};
  }
  function read(){const id=++revision;latest=Promise.resolve().then(()=>api.storage.local.get(H.STORAGE_KEY)).then(result=>{if(id===revision){settings=H.normalizeSettings(result[H.STORAGE_KEY]);return refresh();}}).catch(()=>{});return latest;}
  async function fresh(){read();let completed,status;do{completed=latest;status=await completed;}while(completed!==latest);return status||refresh();}
  globalThis.HDROLED_PAGE_STATUS=fresh;
  api.runtime.onMessage.addListener((message,_sender,reply)=>{if(message?.type==='HDROLED_STATUS'){fresh().then(reply).catch(()=>reply({ok:false}));return true;}});
  api.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&Object.hasOwn(changes,H.STORAGE_KEY))void read();});
  function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;refresh();});}
  for(const event of ['loadedmetadata','resize','play','playing','emptied','fullscreenchange','enterpictureinpicture','leavepictureinpicture'])document.addEventListener(event,schedule,true);
  addEventListener('hdroled-audio',schedule);
  new MutationObserver(records=>{if(records.some(record=>[...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1&&(node.matches?.('video,audio')||node.querySelector?.('video,audio')))))schedule();})
    .observe(document.documentElement,{childList:true,subtree:true});
  void read();
})();
