(function(root){
 'use strict';
 root.HDROLED_CREATE_COORDINATOR=function(api,now=Date.now){
  const F=root.HDROLED_FEATURED,queues=new Map(),closed=new Set(),loading=new Set();
  const key=id=>'hdroledFeaturedTab:'+id;
  const ui=s=>typeof s?.url==='string'&&s.url.startsWith(api.runtime.getURL(''));
  const page=s=>s?.frameId===0&&Number.isInteger(s?.tab?.id)&&Boolean(F.pageKey(s.url));
  const same=(a,b)=>a&&b&&a.key===b.key&&a.epoch===b.epoch;
  const enqueue=(id,fn)=>{const task=(queues.get(id)||Promise.resolve()).catch(()=>{}).then(fn);queues.set(id,task);return task.finally(()=>{if(queues.get(id)===task)queues.delete(id);});};
  async function identify(id){if(closed.has(id))return null;try{const i=await api.tabs.sendMessage(id,{type:'HDROLED_IDENTIFY'},{frameId:0});return i?.ok&&F.pageKey(i.url)===i.key&&typeof i.epoch==='string'?i:null;}catch(_){return null;}}
  async function matches(id,context){return same(await identify(id),context);}
  const context=(id,r)=>({tabId:id,key:r.key,epoch:r.epoch,label:r.label});
  function result(id,r,p,media){return {ok:true,context:context(id,r),state:F.copy(r.states[r.key]),media:media?.ok?media:null};}
  function broadcast(snapshot){try{Promise.resolve(api.runtime.sendMessage({type:'HDROLED_CHANGED',snapshot})).catch(()=>{});}catch(_){}}
  async function deliver(id,r,p){
   if(!await matches(id,r))return {ok:false,code:'STALE'};
   const state=r.states[r.key],ctx=context(id,r);
   const media=await api.tabs.sendMessage(id,{type:'HDROLED_APPLY',context:ctx,state:F.copy(state)},{frameId:0}).catch(()=>null);
   if(!media?.ok||!await matches(id,r))return {ok:false,code:'STALE'};
   const answer=result(id,r,p,media);broadcast(answer);return answer;
  }
  async function save(id,r,p,before){
   if(!await matches(id,r))return {ok:false,code:'STALE'};
   await api.storage.session.set({[key(id)]:r});
   const answer=await deliver(id,r,p);
   if(!answer.ok&&before)await api.storage.session.set({[key(id)]:before});
   return answer;
  }
  async function bind(id,i,r,p){
   if(r&&same(r,i)&&r.states[r.key]?.schema===2){r.label=String(i.label||i.key).slice(0,200);return r;}
   r=r?F.copy(r):{states:{},order:[]};
   const restored=r.states[i.key]?.schema===2;
   const s=restored?F.copy(r.states[i.key]):F.createState(i.key,{initialStrength:i.initialStrength},now());if(!Number.isFinite(s.qualityTarget))s.qualityTarget=s.settings.strength;
   if(restored){s.revision++;s.notice={id:i.epoch+':restore',kind:'startup',text:'Page restored · video '+s.settings.strength.toFixed(1)+'% · sound '+s.settings.soundStrength.toFixed(1)+'%.'};}
   else s.notice.id=i.epoch+':initial';
   r.states[i.key]=s;r.order=r.order.filter(k=>k!==i.key);r.order.push(i.key);
   while(r.order.length>20)delete r.states[r.order.shift()];
   Object.assign(r,{key:i.key,epoch:i.epoch,label:String(i.label||i.key).slice(0,200)});
   await api.storage.session.set({[key(id)]:r});return r;
  }
  async function run(m,sender,id){
   const isUi=ui(sender),isPage=page(sender);
   if(!isUi&&!isPage)return {ok:false,code:'FORBIDDEN'};
   if(isPage&&(sender.tab.id!==id||m.tabId!=null&&m.tabId!==id))return {ok:false,code:'FORBIDDEN'};
   if(isPage&&!['HDROLED_HELLO','HDROLED_GET','HDROLED_UPDATE','HDROLED_MEDIA'].includes(m.type))return {ok:false,code:'FORBIDDEN'};
   const i=await identify(id);if(!i)return {ok:false,code:'DISCONNECTED'};
   if(m.type==='HDROLED_HELLO'&&(!isPage||!same(m,i)))return {ok:false,code:'STALE'};
   if(loading.has(id)&&m.type!=='HDROLED_HELLO')return {ok:false,code:'DISCONNECTED'};
   if(m.type==='HDROLED_HELLO'){loading.delete(id);await api.action?.enable(id);}
   const p={};let r=(await api.storage.session.get(key(id)))[key(id)];
   r=await bind(id,i,r,p);
   if(m.type==='HDROLED_HELLO'||m.type==='HDROLED_GET'){
    await api.action?.enable(id);return deliver(id,r,p);
   }
   if(m.type==='HDROLED_OPEN_PANEL'){
    if(!isUi)return {ok:false,code:'FORBIDDEN'};
    if(m.context?.tabId!==id||!same(m.context,r)||!await matches(id,r))return {ok:false,code:'STALE'};
    const answer=await api.tabs.sendMessage(id,{type:'HDROLED_SHOW_PANEL',context:context(id,r)},{frameId:0}).catch(()=>null);
    return answer?.ok?{ok:true}:{ok:false,code:'DISCONNECTED'};
   }
   if(!same(m.context,r)||m.context?.tabId!==id)return {ok:false,code:'STALE'};
   if(m.type==='HDROLED_MEDIA'){
    if(!isPage||m.revision!==r.states[r.key].revision)return {ok:false,code:'STALE'};
    const answer=result(id,r,p,m.media);broadcast(answer);return {ok:true};
   }
   if(m.type!=='HDROLED_UPDATE')return {ok:false,code:'BAD_REQUEST'};
   const current=r.states[r.key],action=m.action;
   if(!['slow','recover'].includes(action?.type)&&m.revision!==current.revision)return {ok:false,code:'CONFLICT',snapshot:result(id,r,p,null)};
   const commit=async nextPrefs=>{
    if(!await matches(id,r))return {ok:false,code:'STALE'};
    const next=F.transition(current,action,now());
    if(next===current)return result(id,r,nextPrefs,null);
    const before=F.copy(r);r=F.copy(r);r.states[r.key]=next;return save(id,r,nextPrefs,before);
   };
   return commit(p);
  }
  async function handle(m,sender={}){
   if(!m||typeof m.type!=='string')return {ok:false,code:'BAD_REQUEST'};
   const id=page(sender)?sender.tab.id:m.tabId;
   if(!Number.isInteger(id)||id<0)return {ok:false,code:'BAD_REQUEST'};
   try{return await enqueue(id,()=>run(m,sender,id));}catch(error){return {ok:false,code:'ERROR',message:error?.message==='quota'?'Settings could not be saved.':'Could not complete this change. Please retry.'};}
  }
  async function removeTab(id){closed.add(id);loading.delete(id);return enqueue(id,async()=>{await api.storage.session.remove(key(id));try{await api.runtime.sendMessage({type:'HDROLED_INVALIDATE',tabId:id});}catch(_){}});}
  async function markLoading(id){loading.add(id);try{await api.action?.enable(id);await api.runtime.sendMessage({type:'HDROLED_INVALIDATE',tabId:id});}catch(_){}}
  return {handle,removeTab,markLoading};
 };
})(globalThis);
