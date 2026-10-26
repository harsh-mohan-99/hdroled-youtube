if(typeof importScripts==='function')importScripts('api.js','shared.js','featured.js','coordinator.js');
(function(){
 'use strict';const api=HDROLED_EXT,coordinator=HDROLED_CREATE_COORDINATOR(api);
 api.runtime.onMessage.addListener((message,sender,reply)=>{
  if(!['HDROLED_HELLO','HDROLED_GET','HDROLED_UPDATE','HDROLED_OPEN_PANEL','HDROLED_MEDIA'].includes(message?.type))return false;
  coordinator.handle(message,sender).then(reply,()=>reply({ok:false,code:'ERROR'}));return true;
 });
 api.tabs.onRemoved.addListener(id=>{void coordinator.removeTab(id);});
 api.tabs.onUpdated.addListener((id,change)=>{if(change.status==='loading')void coordinator.markLoading(id);});
 async function reconnect(){
  await api.action.enable();
  const tabs=await api.tabs.query({});
  await Promise.allSettled(tabs.map(async tab=>{await api.action.enable(tab.id);return api.tabs.sendMessage(tab.id,{type:'HDROLED_RECONNECT'},{frameId:0});}));
 }
 api.runtime.onInstalled.addListener(()=>{void reconnect().catch(()=>{});});
 api.runtime.onStartup.addListener(()=>{void reconnect().catch(()=>{});});
})();
