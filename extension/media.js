(function(root){
 'use strict';root.HDROLED_CREATE_MEDIA=function(){
  const H=root.HDROLED,originals=new Map(),top=window.top===window;let selected=null;
  function restore(element,record){if(element.style.getPropertyValue('filter')!==record.applied||element.style.getPropertyPriority('filter')!=='important')return;if(record.value)element.style.setProperty('filter',record.value,record.priority);else element.style.removeProperty('filter');}
  function apply(value){
   const s=H.normalizeSettings(value),picture=s.pictureEnabled&&s.strength>0&&!s.bypass,sound=s.soundEnabled&&s.soundStrength>0&&!s.bypass;
   const target=picture&&top?(document.fullscreenElement||document.documentElement):null;
   for(const[e,r]of originals)if(e!==target||!e.isConnected){restore(e,r);originals.delete(e);}
   let pageApplied=false;
   if(target){
    const value=target.style.getPropertyValue('filter'),priority=target.style.getPropertyPriority('filter');let r=originals.get(target);
    if(!r||value!==r.applied||priority!=='important'){const base=getComputedStyle(target).filter;r={value,priority,applied:'',base:base&&base!=='none'?base+' ':''};originals.set(target,r);}
    const filter=r.base+H.pictureFilter(s.strength);if(value!==filter||priority!=='important'){target.style.setProperty('filter',filter,'important');r.applied=target.style.getPropertyValue('filter');}
    pageApplied=getComputedStyle(target).filter===r.applied;
   }
   const videos=[...document.querySelectorAll('video')],media=videos.filter(v=>v.matches('#movie_player video, #player video.html5-main-video, ytd-reel-video-renderer video, ytm-reel-video-renderer video'));
   selected=media.find(v=>!v.paused)||media[0]||null;
   const audio=HDROLED_AUDIO.applyAll(media,sound,s.soundStrength);
   return {ok:true,...s,...root.HDROLED_HARDWARE?.get(),pageApplied,videoCount:videos.length,audio:audio.state,audioEnhanced:audio.enhanced,audioWaiting:audio.waiting,audioBlocked:audio.blocked,width:selected?.videoWidth||0,height:selected?.videoHeight||0,screenWidth:screen.width,screenHeight:screen.height,pictureInPicture:Boolean(document.pictureInPictureElement)};
  }
  return {apply,reset:()=>apply({pictureEnabled:false,soundEnabled:false,strength:0,soundStrength:0}),video:()=>selected?.isConnected?selected:null};
 };
})(globalThis);
