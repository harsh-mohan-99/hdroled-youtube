(function(root){
 'use strict';let cached=null;
 function cleanGraphicsName(value){
  let name=String(value||'').trim();
  if(/^ANGLE\s*\(/i.test(name)){name=name.replace(/^ANGLE\s*\(/i,'').replace(/\)\s*$/,'');const comma=name.indexOf(',');if(comma>=0)name=name.slice(comma+1).trim();}
  name=name.replace(/\s*\(0x[\da-f]+\)/ig,'').replace(/[,\s]*(?:Direct3D|D3D\d|OpenGL|Vulkan|Metal|vs_\d|ps_\d)[\s\S]*$/i,'').replace(/\/PCIe[\s\S]*$/i,'').trim();
  if(!name||/^(?:WebKit|WebGL|ANGLE|Google SwiftShader|SwiftShader|llvmpipe|Software)/i.test(name))return null;
  return name.slice(0,120);
 }
 function get(){
  if(cached)return cached;
  cached={graphicsName:null,audioDriverName:null,audioOutput:null};
  let gl=null;try{
   const canvas=document.createElement('canvas');gl=canvas.getContext('webgl',{antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});
   const debug=gl?.getExtension('WEBGL_debug_renderer_info'),name=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl?.getParameter(gl.RENDERER);
   cached.graphicsName=cleanGraphicsName(name);
  }catch(_){}finally{try{gl?.getExtension('WEBGL_lose_context')?.loseContext();}catch(_){}}
  return cached;
 }
 root.HDROLED_HARDWARE={get,cleanGraphicsName};
})(globalThis);
