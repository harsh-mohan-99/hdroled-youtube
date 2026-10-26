(function(root){
  'use strict';
  const clampStrength=value=>typeof value==='number'&&Number.isFinite(value)?Math.round(Math.max(0,Math.min(100,value))*10)/10:100;
  const normalizeSettings=value=>{
    const legacy=value?.enabled===true;
    const pictureEnabled=typeof value?.pictureEnabled==='boolean'?value.pictureEnabled:legacy;
    const soundEnabled=typeof value?.soundEnabled==='boolean'?value.soundEnabled:legacy;
    return {enabled:pictureEnabled||soundEnabled,pictureEnabled,soundEnabled,strength:clampStrength(value?.strength),soundStrength:clampStrength(value?.soundStrength),bypass:value?.bypass===true};
  };
  const pictureFilter=value=>{
    const amount=clampStrength(value)/100;
    const number=n=>Number(n.toFixed(5));
    return amount?`contrast(${number(1+0.08*amount)}) saturate(${number(1+0.1*amount)}) brightness(${number(1+0.025*amount)})`:'';
  };
  root.HDROLED=Object.freeze({STORAGE_KEY:'hdroledSettings',DEFAULTS:normalizeSettings(),normalizeSettings,pictureFilter,
    FILTER:'contrast(1.08) saturate(1.1) brightness(1.025)',MODES:{
      off:{label:'HDROLED is off',detail:'Enable whole-page picture enhancement and fuller sound on YouTube.'},
      active:{label:'HDROLED is active',detail:'The complete page is color-graded once; available audio is enhanced.'},
      original:{label:'Original on YouTube',detail:'Picture and sound processing are bypassed across YouTube tabs.'},
      partial:{label:'Some media cannot be enhanced',detail:'Protected players or page styles may prevent processing.'}
    }});
})(globalThis);
