(function(root){
 'use strict';
 // Native smallestScreenWidthDp stays stable when rotating or opening the keyboard.
 // Tablets keep every original style, even when their window becomes narrow.
 function update(){
  let phone;
  try{if(typeof root.SRGApp?.isPhone==='function')phone=root.SRGApp.isPhone()===true;}catch(e){}
  if(phone===undefined)phone=Math.min(root.innerWidth,root.innerHeight)<600;
  document.documentElement.dataset.device=phone?'phone':'tablet';
 }
 update();root.addEventListener('resize',update);
})(window);
