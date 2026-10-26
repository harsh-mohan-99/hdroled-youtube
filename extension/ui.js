(function(root){
 'use strict';root.HDROLED_MOUNT_UI=function(options={}){
 const api=options.api||HDROLED_EXT,H=HDROLED,scope=options.root||document,$=id=>scope.querySelector('#'+id),embedded=options.embedded===true;
 let tabId=options.tabId??null,disposed=false,lastChange=Promise.resolve(),pendingManual=null;const cleanup=[];
 function on(target,event,fn,options){target.addEventListener(event,fn,options);cleanup.push(()=>target.removeEventListener(event,fn,options));}
 function error(text){$('save-status').textContent=text;$('save-status').hidden=!text;}
 function render(snapshot,busy){
  const ready=Boolean(snapshot?.ok),state=snapshot?.state,s=H.normalizeSettings(state?.settings||{pictureEnabled:true,soundEnabled:true,strength:60,soundStrength:60}),m=snapshot?.media,confirmed=Boolean(!busy&&m?.ok&&m.revision===state?.revision);
  for(const id of ['picture','sound','strength','sound-strength'])$(id).disabled=!ready;
  $('auto-enabled').disabled=!ready||busy;
  $('brand-button').disabled=!embedded&&!Number.isInteger(tabId);$('brand-button').title=embedded?'Close this popup':'Open controls over the YouTube page';
  $('popup-hint').textContent=embedded?'Opacity slider stays visible while adjusting':'Click logo to open popup';
  for(const[id,key]of[['picture','pictureEnabled'],['sound','soundEnabled']]){$(id).setAttribute('aria-pressed',String(s[key]));$(id+'-state').textContent=s[key]?'ON':'OFF';}
  for(const[id,key]of[['strength','strength'],['sound-strength','soundStrength']]){$(id).value=String(s[key]);$(id).setAttribute('aria-valuetext',s[key].toFixed(1)+'%');$(id+'-value').textContent=s[key].toFixed(1)+'%';}
  $('strength-hint').textContent=s.bypass?'Original preview · your picture level is saved.':'0% original · 100% full HDROLED picture effect';
  $('sound-strength-hint').textContent=s.bypass?'Original preview · your sound level is saved.':'0% original sound · 100% full boost';
  $('compare').disabled=!ready||!(s.pictureEnabled||s.soundEnabled)||busy;$('compare').setAttribute('aria-pressed',String(s.bypass));$('compare-label').textContent=s.bypass?'Back to HDROLED':'Show original';
  const automatic=Boolean(ready&&state.autoEnabled&&!state.manualHold);$('auto-enabled').setAttribute('aria-pressed',String(automatic));$('auto-enabled').textContent=automatic?'Auto optimization on':'Auto optimization off';$('auto-enabled').title=state?.manualHold?'Paused after your edit. Click to resume automatic opacity adjustment.':'Automatic opacity adjustment for this page';
  const picture=confirmed&&s.pictureEnabled&&s.strength>0&&!s.bypass&&m.pageApplied;
  const sound=confirmed&&s.soundEnabled&&s.soundStrength>0&&!s.bypass&&m.audioEnhanced>0;
  $('picture-dot').classList.toggle('active',Boolean(picture));$('sound-dot').classList.toggle('active',Boolean(sound));
  $('page-label').textContent=snapshot?.context?.label||snapshot?.context?.key||'Connecting to YouTube…';$('page-label').title=$('page-label').textContent;
  $('connection-title').textContent=!ready?'YouTube disconnected':busy?'Applying settings…':s.bypass?'Original picture · compare on':!s.pictureEnabled||s.strength===0?'Original picture':picture?'Picture active · '+s.strength.toFixed(1)+'%':'Picture effect not confirmed';
  $('connection-detail').textContent=!ready?'Open the extension from a YouTube tab.':s.bypass?'Both effect choices are saved.':picture?'HDROLED color effect applied to this page.':'Picture and sound remain independent.';
  const percent=s.soundStrength/100,db=v=>Number((v*percent).toFixed(2));
  $('audio-status').textContent=!ready?'Sound unchanged · disconnected':busy?'Applying sound settings…':!s.soundEnabled||s.soundStrength===0||s.bypass?'Original sound · processing bypassed':sound?`Boost active · ${s.soundStrength.toFixed(1)}% · Bass +${db(4)} dB · Dialogue +${db(2.5)} dB · Peaks controlled`:m?.audioWaiting?'Click the playing video once to activate sound':m?.audioBlocked?'Original sound · this source cannot be processed':'Waiting for supported YouTube audio';
  $('source-size').textContent=confirmed?`${m.screenWidth} × ${m.screenHeight}`:'— × —';
  $('source-size').title='Display size reported by the browser, in CSS pixels; Windows scaling may differ from physical pixels.';
  $('graphics-row').hidden=!m?.graphicsName;$('graphics-name').textContent=m?.graphicsName||'';
  $('audio-row').hidden=!m?.audioDriverName;$('audio-device').textContent=m?.audioDriverName||'';
  if(ready&&!embedded)document.title='HDROLED · Featured · '+(snapshot.context.label||snapshot.context.key);
 }
 const client=HDROLED_CREATE_CLIENT({
  get:()=>api.runtime.sendMessage({type:'HDROLED_GET',tabId}),
  update:req=>api.runtime.sendMessage({type:'HDROLED_UPDATE',tabId,...req})
 },(s,busy)=>{if(!disposed)render(s,busy);},text=>{if(!disposed)error(text);});
 function change(action){
  error('');lastChange=client.change(action);
  if(action.type==='patch'){
   const context=client.snapshot()?.context,same=a=>a?.tabId===context?.tabId&&a?.key===context?.key&&a?.epoch===context?.epoch;
   pendingManual={context,patch:{...(same(pendingManual?.context)?pendingManual.patch:{}),...action.patch}};
   void lastChange.then(()=>{if(!pendingManual||!same(pendingManual.context))return;const patch={...pendingManual.patch};for(const key of Object.keys(action.patch))if(patch[key]===action.patch[key])delete patch[key];pendingManual=Object.keys(patch).length?{context,patch}:null;});
  }
  return lastChange;
 }
 for(const[id,key]of[['picture','pictureEnabled'],['sound','soundEnabled']])on($(id),'click',()=>{const s=client.snapshot();if(s)void change({type:'patch',patch:{[key]:!s.state.settings[key]}});});
 for(const[id,key]of[['strength','strength'],['sound-strength','soundStrength']])on($(id),'input',e=>{void change({type:'patch',patch:{[key]:Number(e.target.value)}});});
 on($('compare'),'click',()=>{void change({type:'compare'});});
 on($('auto-enabled'),'click',()=>{const s=client.snapshot();if(s)void change({type:'auto',enabled:!(s.state.autoEnabled&&!s.state.manualHold)});});
 on($('brand-button'),'click',async()=>{
  if(embedded){options.onClose?.();return;}
  try{const answer=await api.tabs.sendMessage(tabId,{type:'HDROLED_SHOW_PANEL',tabId,edit:pendingManual},{frameId:0});if(answer?.ok)options.onOpened?.();else error('Could not open the page popup. Refresh YouTube and retry.');}catch(_){error('Refresh this YouTube tab after updating HDROLED, then click the logo again.');}
 });
 const fade=HDROLED_CREATE_FADE(value=>options.onFade?.(value));
 if(embedded){
  on($('strength'),'pointerdown',fade.start);on($('strength'),'input',fade.input);
  for(const event of ['pointerup','pointercancel','lostpointercapture'])on(globalThis,event,fade.end,true);
  on($('strength'),'blur',fade.end);on(globalThis,'blur',fade.end);
 }
 const receive=m=>{
  if(m?.type==='HDROLED_CHANGED'&&m.snapshot?.context?.tabId===tabId)client.accept(m.snapshot);
  if(m?.type==='HDROLED_INVALIDATE'&&m.tabId===tabId){client.disconnect();error('The attached page is changing or disconnected.');}
  return false;
 };
 if(!embedded){api.runtime.onMessage.addListener(receive);cleanup.push(()=>api.runtime.onMessage.removeListener(receive));}
 on(globalThis,'focus',()=>{if(Number.isInteger(tabId)&&(!embedded||options.isVisible?.()!==false))void client.refresh();});
 (async()=>{
  if(tabId===null){try{const[tab]=await api.tabs.query({active:true,currentWindow:true});tabId=tab?.id;}catch(_){}}
  if(!Number.isInteger(tabId)||tabId<0){render(null,false);error('Open HDROLED from a YouTube tab.');return;}
  render(options.initialSnapshot||null,false);
  if(options.initialSnapshot?.ok)client.accept(options.initialSnapshot);else await client.refresh();
 })();
 return {accept:s=>{if(s?.ok)error('');return client.accept(s);},change,cancelFade:fade.end,disconnect:()=>{fade.end();client.disconnect();},settle:()=>lastChange,dispose:()=>{disposed=true;fade.dispose();for(const remove of cleanup)remove();client.disconnect();}};
 };
})(globalThis);
