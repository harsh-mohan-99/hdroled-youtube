(function(root){
 'use strict';root.HDROLED_CREATE_NOTICES=function(){
  let host=null,timer=null,lastId=null;
  function clear(){if(timer!==null)clearTimeout(timer);timer=null;host?.remove();host=null;}
  function show(snapshot){
   const n=snapshot.state.notice;if(!n||n.id===lastId)return;lastId=n.id;clear();
   host=document.createElement('div');host.setAttribute('data-hdroled-notice','');
   host.style.cssText='position:fixed;right:18px;bottom:18px;max-width:min(360px,calc(100vw - 36px));z-index:2147483647;pointer-events:none';
   const shadow=host.attachShadow({mode:'closed'}),style=document.createElement('style'),text=document.createElement('p');
   style.textContent=':host{font:11px/1.45 Arial,sans-serif;color:#dfecff}p{margin:0;padding:9px 12px;background:#111c2bed;border:1px solid #3e556c;border-radius:8px;box-shadow:0 4px 16px #0004;font-variant-numeric:tabular-nums}';
   text.setAttribute('role','status');text.textContent=n.text;shadow.append(style,text);
   const full=document.fullscreenElement;(full&&!['VIDEO','AUDIO'].includes(full.tagName)?full:document.documentElement).append(host);
   timer=setTimeout(clear,3500);
  }
  return {show,clear};
 };
})(globalThis);
