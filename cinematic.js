/* Ruhige Standbild-Version: keine Videos oder Video-Downloads. */
(()=>{
 const btn=document.getElementById('cinematicToggle');
 let enabled=true;try{enabled=localStorage.getItem('alta_cinematic_enabled')!=='0'}catch(_){}
 const apply=()=>{
  document.body.classList.toggle('cinematic-off',!enabled);
  if(btn){btn.textContent=enabled?'\xe2\x9c\xa8 Effekte':'\xe2\x96\xb6 Effekte';btn.setAttribute('aria-pressed',String(enabled));}
 };
 btn?.addEventListener('click',()=>{enabled=!enabled;try{localStorage.setItem('alta_cinematic_enabled',enabled?'1':'0')}catch(_){}apply()});
 apply();
})();
