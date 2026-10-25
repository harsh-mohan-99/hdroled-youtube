(function(){
  'use strict';if(!['www.youtube.com','m.youtube.com'].includes(location.hostname))return;if(globalThis.__hdroledPageV5)return;globalThis.__hdroledPageV5=true;
  const H=HDROLED,api=HDROLED_EXT,originals=new Map(),isTopFrame=window.top===window;
  let settings=H.normalizeSettings(),revision=0,latest=Promise.resolve(),scheduled=false;
  function restore(element,record){
    if(element.style.getPropertyValue('filter')!==record.applied||element.style.getPropertyPriority('filter')!=='important')return;
    if(record.value)element.style.setProperty('filter',record.value,record.priority);else element.style.removeProperty('filter');
  }
  function refresh(){
    const on=settings.enabled&&!settings.bypass;
    // Grade the final page once. Children, videos and iframe documents must not
    // receive a second grade; no backgrounds, text colors or overlay nodes change.
    const target=on&&isTopFrame?(document.fullscreenElement||document.documentElement):null;
    for(const[element,record]of originals)if(element!==target||!element.isConnected){restore(element,record);originals.delete(element);}
    let pageApplied=false;
    if(target){
      const value=target.style.getPropertyValue('filter'),priority=target.style.getPropertyPriority('filter');let record=originals.get(target);
      if(!record||value!==record.applied||priority!=='important'){
        const base=getComputedStyle(target).filter;
        record={value,priority,applied:'',filter:(base&&base!=='none'?base+' ':'')+H.FILTER};originals.set(target,record);
      }
      if(!record.applied||value!==record.applied||priority!=='important'){
        target.style.setProperty('filter',record.filter,'important');record.applied=target.style.getPropertyValue('filter');
      }
      pageApplied=getComputedStyle(target).filter===record.applied;
    }
    const videos=[...document.querySelectorAll('video')],media=[...document.querySelectorAll('#movie_player video, #player video.html5-main-video, ytd-reel-video-renderer video, ytm-reel-video-renderer video')];
    const audio=HDROLED_AUDIO.applyAll(media,on),selected=videos.find(v=>!v.paused)||videos[0];
    return {ok:true,...settings,mode:!settings.enabled?'off':settings.bypass?'original':isTopFrame&&!pageApplied?'partial':'active',
      pageApplied,pageInherited:on&&!isTopFrame,videoCount:videos.length,mediaCount:media.length,
      audio:audio.state,audioEnhanced:audio.enhanced,audioBlocked:audio.blocked,audioWaiting:audio.waiting,
      width:selected?.videoWidth||0,height:selected?.videoHeight||0,screenWidth:screen.width,screenHeight:screen.height,
      pictureInPicture:Boolean(document.pictureInPictureElement),pictureTarget:target===document.fullscreenElement&&target?'fullscreen':'page'};
  }
  function read(){const id=++revision;latest=Promise.resolve().then(()=>api.storage.local.get(H.STORAGE_KEY)).then(result=>{if(id===revision){settings=H.normalizeSettings(result[H.STORAGE_KEY]);refresh();}}).catch(()=>{});return latest;}
  async function fresh(){read();let completed;do{completed=latest;await completed;}while(completed!==latest);return refresh();}
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
