/* APD Halloween season: a cinematic Los Santos night-shift hero integrated below the portal header. */
(()=>{
 const app=document.getElementById('app'),bar=app?.querySelector('.topbar');
 if(!bar||app.querySelector('.apd-nightshift-hero'))return;
 document.querySelector('.apd-halloween')?.remove();
 const hero=document.createElement('section');
 hero.className='apd-nightshift-hero';
 hero.setAttribute('aria-label','Alta PD Halloween-Nachtstreife');
 hero.innerHTML=`<div class="apd-nightshift-content"><div class="apd-nightshift-meta"><span class="apd-nightshift-emblem">APD</span><span>ALTA POLICE DEPARTMENT <i></i> SEASONAL NIGHT WATCH</span></div><h1>HALLOWEEN <span>NIGHT SHIFT</span></h1><div class="apd-nightshift-rule"></div><p>LOS SANTOS <b>·</b> Nachtdienst-Atmosphäre für die FTO Academy</p></div><div class="apd-nightshift-stamp" aria-hidden="true"><span>31</span><small>OCT</small></div><div class="apd-nightshift-grain" aria-hidden="true"></div><div class="apd-spider-event" aria-hidden="true"><span class="apd-spider-thread"></span><svg viewBox="0 0 64 64"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M32 28V8M24 29 12 18m12 19L7 37m19 5L13 54m17-9-8 12M40 29l12-11m-12 19 17 1m-17 4 13 12m-15-8 8 13"/><ellipse cx="32" cy="38" rx="8.5" ry="10" fill="#111b27"/><circle cx="32" cy="27" r="6.5" fill="#182536"/></g><circle cx="29.5" cy="27" r="1.2" fill="#e9a46d"/><circle cx="34.5" cy="27" r="1.2" fill="#e9a46d"/></svg></div>`;
 bar.insertAdjacentElement('afterend',hero);
 const spider=hero.querySelector('.apd-spider-event');
 if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
  let first=true;
  const schedule=()=>window.setTimeout(()=>{
   if(document.visibilityState!=='visible'){schedule();return}
   first=false;spider.classList.add('is-active');
   window.setTimeout(()=>{spider.classList.remove('is-active');schedule()},7600);
  },first?(12000+Math.random()*7000):(52000+Math.random()*28000));
  schedule();
 }
})();
