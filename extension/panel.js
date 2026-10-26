(function(root){
 'use strict';root.HDROLED_CREATE_PANEL=function(){
  let host=null,ui=null,box=null,shadow=null,closing=false,position=null,drag=null,previousFocus=null;const cleanup=[];
  function on(target,event,fn){target.addEventListener(event,fn);cleanup.push(()=>target.removeEventListener(event,fn));}
  function place(){
   if(!host)return;const w=innerWidth,h=innerHeight;
   host.style.setProperty('transform','scale('+Math.min(1,(h-16)/Math.max(1,box.offsetHeight))+')','important');host.style.setProperty('transform-origin','top left','important');
   const rect=box.getBoundingClientRect();
   position=position||{x:w-rect.width-18,y:20};
   position.x=Math.max(8,Math.min(position.x,Math.max(8,w-rect.width-8)));
   position.y=Math.max(8,Math.min(position.y,Math.max(8,h-rect.height-8)));
   host.style.setProperty('left',position.x+'px','important');host.style.setProperty('top',position.y+'px','important');
  }
  function close(){
   if(!host)return;ui.cancelFade();host.remove();drag=null;
   if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});previousFocus=null;
  }
  function show(snapshot){
   if(closing)return false;
   if(host){if(!host.isConnected){const full=document.fullscreenElement;(full&&!['VIDEO','AUDIO'].includes(full.tagName)?full:document.documentElement).append(host);}ui.accept(snapshot);box.focus({preventScroll:true});place();return true;}
   previousFocus=document.activeElement;host=document.createElement('div');host.setAttribute('data-hdroled-popup','');
   host.style.cssText='all:initial!important;position:fixed!important;z-index:2147483647!important;display:block!important;opacity:1!important;width:min(380px,calc(100vw - 16px))!important;';
   shadow=host.attachShadow({mode:'closed'});
   const style=document.createElement('style');
   style.textContent=HDROLED_PANEL_TEMPLATE.css+'\n'+
    ':host{color-scheme:dark}.panel-window{font:13px Arial,sans-serif;color:#eef5ff;background:#080b12;border:1px solid #50688b;border-radius:14px;box-shadow:0 16px 55px #0009;overflow:hidden;display:flex;flex-direction:column;outline:none}.panel-handle{display:flex;gap:8px;padding:5px 8px;background:#172338;border-bottom:1px solid #314664;flex-shrink:0}.panel-handle button{border:0;border-radius:5px;color:#d9e8ff;background:transparent;padding:5px;font:700 11px Arial,sans-serif}.panel-handle button:hover{background:#2a3e5d}.move{flex:1;text-align:left;cursor:move;touch-action:none}.close{cursor:pointer}.ui-root{width:100%;max-height:none;min-height:0;overflow:hidden}.header{gap:9px}.version{font-size:8px}.logo{flex-shrink:0}';
   style.textContent+='\n.panel-window.adjusting{background:transparent;border-color:transparent;box-shadow:none}.adjusting .ui-root,.adjusting .shell{background:transparent}.adjusting .panel-handle,.adjusting .shell>:not(.strength-control),.adjusting .sound-control{opacity:.12}.adjusting .strength-control:not(.sound-control){opacity:1;background:#11192af5;border-color:#79b5d5}.adjusting #strength{opacity:1}';
   box=document.createElement('section');box.className='panel-window';box.setAttribute('role','dialog');box.setAttribute('aria-label','HDROLED page popup');box.tabIndex=-1;
   const handle=document.createElement('div');handle.className='panel-handle';
   const move=document.createElement('button');move.type='button';move.className='move';move.textContent='⠿  Move popup';move.title='Drag to move, or use arrow keys';
   const exit=document.createElement('button');exit.type='button';exit.className='close';exit.textContent='✕';exit.setAttribute('aria-label','Close popup');
   const content=document.createElement('div');content.className='ui-root';content.innerHTML=HDROLED_PANEL_TEMPLATE.html;
   handle.append(move,exit);box.append(handle,content);shadow.append(style,box);
   const parent=document.fullscreenElement;((parent&&!['VIDEO','AUDIO'].includes(parent.tagName))?parent:document.documentElement).append(host);
   ui=HDROLED_MOUNT_UI({root:shadow,embedded:true,tabId:snapshot.context.tabId,initialSnapshot:snapshot,isVisible:()=>Boolean(host?.isConnected),onClose:close,onFade:value=>{box?.classList.toggle('adjusting',value);}});
   on(exit,'click',()=>{void close();});
   on(move,'pointerdown',e=>{if(e.button!==0)return;place();drag={id:e.pointerId,x:e.clientX-position.x,y:e.clientY-position.y};move.setPointerCapture(e.pointerId);e.preventDefault();});
   on(move,'pointermove',e=>{if(drag?.id!==e.pointerId)return;position={x:e.clientX-drag.x,y:e.clientY-drag.y};place();});
   for(const event of ['pointerup','pointercancel','lostpointercapture'])on(move,event,()=>{drag=null;});
   on(move,'keydown',e=>{const step=e.shiftKey?40:10,delta={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[e.key];if(delta){e.preventDefault();position.x+=delta[0];position.y+=delta[1];place();}});
   on(shadow,'keydown',e=>{e.stopPropagation();if(e.key==='Escape')void close();});
   for(const event of ['keyup','keypress','click','dblclick','pointerdown','pointerup','pointermove','mousedown','mouseup','touchstart','touchend','wheel'])on(shadow,event,e=>e.stopPropagation());
   if(typeof ResizeObserver==='function'){const observer=new ResizeObserver(place);observer.observe(box);cleanup.push(()=>observer.disconnect());}
   on(root,'resize',place);on(document,'fullscreenchange',()=>{if(!host?.isConnected)return;const full=document.fullscreenElement;(full&&!['VIDEO','AUDIO'].includes(full.tagName)?full:document.documentElement).append(host);place();});
   place();box.focus({preventScroll:true});return true;
  }
  return {show,change:action=>ui?.change(action),accept:snapshot=>ui?.accept(snapshot),disconnect:()=>ui?.disconnect(),close};
 };
})(globalThis);
