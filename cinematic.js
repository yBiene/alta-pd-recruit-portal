/* Static backgrounds only. Login, records, Supabase and exports unchanged. */
(()=>{
 const key='alta_cinematic_enabled',btn=document.getElementById('cinematicToggle');
 let enabled=true;try{enabled=localStorage.getItem(key)!=='0'}catch(_){}
 function apply(){document.body.classList.toggle('cinematic-off',!enabled);if(btn){btn.textContent=enabled?'⏸ Effekte':'▶ Effekte';btn.setAttribute('aria-pressed',String(enabled));btn.title=enabled?'Animationen pausieren':'Animationen aktivieren';}}
 btn?.addEventListener('click',()=>{enabled=!enabled;try{localStorage.setItem(key,enabled?'1':'0')}catch(_){}apply()});
 apply();
})();
