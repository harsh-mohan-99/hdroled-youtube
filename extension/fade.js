(function(root){
 'use strict';
 // Pointer drags stay transparent until release; keyboard edits restore after idle.
 root.HDROLED_CREATE_FADE=function(onChange,clock=root){
  let dragging=false,active=false,timer=null,disposed=false;
  function cancel(){if(timer!==null)clock.clearTimeout(timer);timer=null;}
  function set(value){if(active!==value){active=value;onChange(value);}}
  function start(){if(disposed)return;cancel();dragging=true;set(true);}
  function input(){if(disposed)return;cancel();set(true);if(!dragging)timer=clock.setTimeout(()=>{timer=null;set(false);},650);}
  function end(){cancel();dragging=false;set(false);}
  function dispose(){end();disposed=true;}
  return {start,input,end,dispose};
 };
})(globalThis);
