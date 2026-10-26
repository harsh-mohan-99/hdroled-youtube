(function(root){
 'use strict';root.HDROLED_CREATE_CLIENT=function(transport,onState=()=>{},onError=()=>{}){
  const clone=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>a&&b&&a.tabId===b.tabId&&a.key===b.key&&a.epoch===b.epoch;
  let current=null,generation=0,readSeq=0,running=false,inflight=null;const queue=[];
  function snapshot(){if(!current)return null;const out=clone(current);for(const job of [inflight,...queue])if(job&&same(job.context,out.context)&&job.action.type==='patch')Object.assign(out.state.settings,job.action.patch);return out;}
  const emit=()=>onState(snapshot(),running||queue.length>0);
  function clearQueue(){while(queue.length)for(const done of queue.shift().done)done({ok:false,code:'STALE'});}
  function accept(value){
   if(!value?.ok||!value.context||!value.state)return false;
   if(current&&!same(current.context,value.context)){generation++;clearQueue();}
   else if(current&&value.state.revision<current.state.revision)return false;
   current=clone(value);emit();return true;
  }
  function disconnect(){generation++;current=null;clearQueue();emit();}
  async function refresh(){const seq=++readSeq,g= generation;try{const value=await transport.get();if(seq!==readSeq||g!==generation)return;if(value?.ok)accept(value);else{disconnect();onError('Open or refresh the YouTube tab to reconnect.');}}catch(_){if(seq===readSeq&&g===generation){disconnect();onError('Could not connect to this YouTube page.');}}}
  async function drain(){
   if(running)return;running=true;emit();
   while(queue.length){
    const job=queue.shift(),g=generation;inflight=job;let response={ok:false,code:'STALE'};
    if(current&&same(job.context,current.context)){
     for(let retry=0;retry<3;retry++){
      if(g!==generation||!current||!same(job.context,current.context))break;
      try{response=await transport.update({context:clone(job.context),revision:current.state.revision,action:clone(job.action)});}catch(_){response={ok:false,code:'ERROR'};}
      if(g!==generation||!current||!same(job.context,current.context)){response={ok:false,code:'STALE'};break;}
      if(response.code==='CONFLICT'&&response.snapshot&&same(response.snapshot.context,job.context)){accept(response.snapshot);continue;}
      if(response.ok)accept(response);break;
     }
    }
    inflight=null;
    if(!response.ok){onError(response.code==='STALE'?'Page changed; the old edit was not applied.':'Could not save this change. Please retry.');if(response.code==='STALE'&&g===generation)void refresh();}
    for(const done of job.done)done(response);emit();
   }
   running=false;emit();
  }
  function change(action){
   if(!current)return Promise.resolve({ok:false,code:'DISCONNECTED'});
   return new Promise(resolve=>{
    const last=queue.at(-1);
    if(action.type==='patch'&&last?.action.type==='patch'&&same(last.context,current.context)){Object.assign(last.action.patch,action.patch);last.done.push(resolve);}
    else queue.push({context:clone(current.context),action:clone(action),done:[resolve]});
    emit();void drain();
   });
  }
  return {refresh,accept,change,snapshot,disconnect};
 };
})(globalThis);
