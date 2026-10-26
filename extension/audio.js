(function(root){
  'use strict';let ctx,input,boostControls,lastStrength,attempted=false,resuming=false;const records=new WeakMap(),routed=new Set();
  const notify=()=>root.dispatchEvent(new Event('hdroled-audio'));
  function safe(v){if(v.mediaKeys||!(v.currentSrc||v.src))return false;try{return new URL(v.currentSrc||v.src,location.href).origin===location.origin||Boolean(v.crossOrigin);}catch(_){return false;}}
  function wake(){if(!ctx||ctx.state==='running'||resuming)return;resuming=true;attempted=true;ctx.resume().then(()=>{resuming=false;notify();},()=>{resuming=false;});}
  function init(){
    ctx=new AudioContext({latencyHint:'playback'});ctx.addEventListener('statechange',notify);
    const eq=(type,hz,gain,q)=>{const n=ctx.createBiquadFilter();n.type=type;n.frequency.value=hz;n.gain.value=gain;n.Q.value=q;return n;};
    const nodes=[eq('highpass',35,0,0.7),eq('lowshelf',105,4,0.7),eq('peaking',280,-1.8,0.8),eq('peaking',2200,2.5,0.8)];
    const dynamics=ctx.createDynamicsCompressor();Object.entries({threshold:-18,knee:12,ratio:2.2,attack:0.006,release:0.18}).forEach(([k,v])=>{dynamics[k].value=v;});
    const gain=ctx.createGain();gain.gain.value=1.6;
    const limiter=ctx.createDynamicsCompressor();Object.entries({threshold:-3,knee:0,ratio:20,attack:0.001,release:0.09}).forEach(([k,v])=>{limiter[k].value=v;});
    boostControls=[[nodes[0].frequency,5,35],[nodes[1].gain,0,4],[nodes[2].gain,0,-1.8],[nodes[3].gain,0,2.5],[dynamics.ratio,1,2.2],[gain.gain,1,1.6]];
    nodes.push(dynamics,gain,limiter,ctx.destination);for(let i=0;i<nodes.length-1;i++)nodes[i].connect(nodes[i+1]);input=nodes[0];
  }
  function tune(strength){
    if(lastStrength===strength)return;
    for(const[param,start,end]of boostControls){
      const value=start+(end-start)*strength/100;
      if(lastStrength!==undefined&&typeof param.setTargetAtTime==='function')param.setTargetAtTime(value,ctx.currentTime,0.025);
      else param.value=value;
    }
    lastStrength=strength;
  }
  function route(r,on){if(r.on===on)return;r.node.disconnect();r.node.connect(on?input:ctx.destination);r.on=on;}
  function applyAll(media,on,strength=100){
    strength=typeof strength==='number'&&Number.isFinite(strength)?Math.max(0,Math.min(100,strength)):100;
    on=Boolean(on&&strength>0);
    const present=on?new Set(media):null;let enhanced=0,blocked=0,waiting=0;
    for(const r of routed)if(!on||!present.has(r.video)){route(r,false);if(!r.video.isConnected)routed.delete(r);}
    if(!on)return {state:'original',enhanced:0,blocked:0,waiting:0};
    for(const video of media){
      if(!(video.currentSrc||video.src)){waiting++;continue;}
      if(!safe(video)){const r=records.get(video);if(r)route(r,false);blocked++;continue;}
      try{
        if(!ctx)init();if(ctx.state!=='running'){if(!attempted)wake();waiting++;continue;}tune(strength);
        let r=records.get(video);if(!r){r={video,node:ctx.createMediaElementSource(video),on:null};records.set(video,r);}
        routed.add(r);route(r,true);enhanced++;
      }catch(_){const r=records.get(video);if(r){try{route(r,false);}catch(__){}}blocked++;}
    }
    return {state:enhanced?'enhanced':waiting?'gesture':blocked?'unsupported':'waiting',enhanced,blocked,waiting};
  }
  for(const e of ['pointerdown','keydown'])document.addEventListener(e,()=>{if(ctx&&ctx.state!=='running')wake();},true);
  root.HDROLED_AUDIO=Object.freeze({applyAll,safe});
})(globalThis);
