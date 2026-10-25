(function(root){
  'use strict';
  const normalizeSettings=value=>({enabled:value?.enabled===true,bypass:value?.bypass===true});
  root.HDROLED=Object.freeze({STORAGE_KEY:'hdroledSettings',DEFAULTS:{enabled:false,bypass:false},normalizeSettings,
    FILTER:'contrast(1.08) saturate(1.1) brightness(1.025)',MODES:{
      off:{label:'HDROLED is off',detail:'Enable whole-page picture enhancement and fuller sound on YouTube.'},
      active:{label:'HDROLED is active',detail:'The complete page is color-graded once; available audio is enhanced.'},
      original:{label:'Original on YouTube',detail:'Picture and sound processing are bypassed across YouTube tabs.'},
      partial:{label:'Some media cannot be enhanced',detail:'Protected players or page styles may prevent processing.'}
    }});
})(globalThis);
