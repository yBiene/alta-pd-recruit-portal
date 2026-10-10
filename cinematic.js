/* Nur Darstellung. Keine Änderungen an Auth, Supabase, Akten oder Export. */
(()=>{
 const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
 const key='alta_cinematic_enabled';
 const btn=document.getElementById('cinematicToggle');
 let enabled=true;
 try{enabled=localStorage.getItem(key)!=='0'}catch(_){}
 function apply(){
  const on=enabled&&!reduce.matches;
  document.body.classList.toggle('cinematic-off',!on);
  document.querySelectorAll('.cinematic-video').forEach(v=>{v.muted=true;if(on){const play=v.play();if(play&&play.catch)play.catch(()=>{});}else v.pause();});
  if(btn){btn.textContent=on?'⏸ Effekte':'▶ Effekte';btn.setAttribute('aria-pressed',String(on));btn.title=on?'Animationen und Videos pausieren':'Animationen und Videos aktivieren';}
 }
 btn?.addEventListener('click',()=>{enabled=!enabled;try{localStorage.setItem(key,enabled?'1':'0')}catch(_){}apply()});
 reduce.addEventListener?.('change',apply);
 // Das Dashboard wird von app.js dynamisch neu gerendert.
 const root=document.getElementById('content');
 if(root){const observer=new MutationObserver(()=>{
  const chapter=root.querySelector('.chapter-header');
  if(chapter&&!chapter.querySelector('.cinematic-academy')){
   const vid=document.createElement('video');vid.className='cinematic-video cinematic-academy';vid.muted=true;vid.autoplay=true;vid.loop=true;vid.playsInline=true;vid.preload='metadata';vid.setAttribute('aria-hidden','true');vid.src='academy.mp4';
   chapter.prepend(vid);
  }
  const v=root.querySelector('.cinematic-dashboard, .cinematic-academy');
  if(v){v.muted=true;if(enabled&&!reduce.matches&&v.paused){const play=v.play();if(play&&play.catch)play.catch(()=>{});}else if(!enabled||reduce.matches)v.pause();}
 });observer.observe(root,{childList:true});}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){document.querySelectorAll('.cinematic-video').forEach(v=>v.pause())}else apply()});
 apply();
})();
