/* ALTA PD / POLARIS 2026 – visual shell, winter dashboard and recruit archive. */
(()=>{'use strict';
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let archiveTab=false,search='';
const archived=r=>!!r.archivedAt||r.status==='Archiviert';
const archiveAction=invokeAccountAction;
invokeAccountAction=async function(body){
 const person=db.users.find(u=>u.id===body.userId);
 if(body.action==='delete'&&person?.role==='recruit'){const {error}=await sb.rpc('apd_archive_recruit',{p_id:person.id,p_archive:true});if(error)throw error;return {archived:true}}
 return archiveAction(body);
};
const originalAdmin=admin;
admin=function(){
 if(!recruitRecordsOnly||!hasExtraTrainerAccess(current))return originalAdmin();
 const r=db.users.find(u=>u.id===selectedRecruit&&u.role==='recruit');
 if(!r||recruitRecordClosed){selectedRecruit=null;recordList();return}
 originalAdmin();recordLayout(r);
};
function recordList(){
 setActive('[data-view="admin"]');document.querySelector('#pageTitle').textContent='Ausbildungsakten';
 const root=document.querySelector('#content'),all=db.users.filter(u=>u.role==='recruit');
 root.innerHTML=`<section class="pr-record-header"><div><span class="eyebrow">ACADEMY / PERSONNEL DEVELOPMENT</span><h1>Ausbildungsakten</h1><p>Ein klarer Überblick. Jeder Fortschritt an einem Ort.</p></div><div class="pr-record-counter"><b>${all.filter(u=>!archived(u)).length}</b><span>aktive Rekruten</span></div></section><div class="pr-record-toolbar"><div role="tablist" aria-label="Aktenbereich"><button type="button" role="tab" aria-selected="${!archiveTab}" data-pr-tab="active" class="${archiveTab?'':'active'}">Aktive Rekruten <small>${all.filter(u=>!archived(u)).length}</small></button><button type="button" role="tab" aria-selected="${archiveTab}" data-pr-tab="archive" class="${archiveTab?'active':''}">Alte Rekruten <small>${all.filter(archived).length}</small></button></div><input type="search" data-pr-search maxlength="200" placeholder="Name, Dienstnummer oder FTO suchen …" aria-label="Rekrutenakten durchsuchen" value="${E(search)}"></div><p class="muted pr-archive-info">${archiveTab?'Archivierte Akten bleiben vollständig erhalten. Du kannst sie öffnen und bei Bedarf wiederherstellen.':'Wähle eine Akte aus, um Ausbildung, Praxis und nächste Schritte zu bearbeiten.'}</p><div class="pr-record-list"></div>`;
 function rows(){const list=all.filter(u=>archived(u)===archiveTab&&[u.name,u.serviceNo,u.fto,u.username].join(' ').toLowerCase().includes(search.toLowerCase()));root.querySelector('.pr-record-list').innerHTML=list.map(r=>`<article class="pr-recruit-row"><div class="pr-initials">${E(r.name.split(' ').map(x=>x[0]).slice(0,2).join(''))}</div><div class="pr-recruit-name"><h2>${E(r.name)}</h2><small>#${E(r.serviceNo||'—')} · ${E(r.fto||'FTO nicht zugewiesen')}</small></div><div class="pr-recruit-progress"><span>${progress(r)} % abgeschlossen</span><div class="progress"><i style="width:${progress(r)}%"></i></div></div><span class="pr-record-status">${archiveTab?'Archiviert':E(r.status||'In Ausbildung')}</span><button class="primary" data-pr-open="${E(r.id)}">Akte öffnen ↗</button></article>`).join('')||'<div class="card pr-empty">Keine passenden Ausbildungsakten vorhanden.</div>';root.querySelectorAll('[data-pr-open]').forEach(b=>b.onclick=()=>{selectedRecruit=b.dataset.prOpen;recruitRecordClosed=false;recordActiveTab='overview';try{sessionStorage.setItem('alta_record_active_tab','overview')}catch{}admin()})}
 root.querySelectorAll('[data-pr-tab]').forEach(b=>b.onclick=()=>{archiveTab=b.dataset.prTab==='archive';recordList()});root.querySelector('[data-pr-search]').oninput=e=>{search=e.target.value;rows()};rows();
}
function recordLayout(r){
 const content=document.querySelector('#content'),grid=content.querySelector('.admin-grid'),workspace=content.querySelector('.record-workspace');if(!workspace)return;
 grid?.classList.add('pr-record-workspace');if(grid?.firstElementChild!==workspace)grid?.firstElementChild?.remove();
 const back=document.createElement('button');back.className='secondary pr-record-back';back.textContent='← '+(archived(r)?'Alte Rekruten':'Alle Ausbildungsakten');back.onclick=()=>{archiveTab=archived(r);selectedRecruit=null;recruitRecordClosed=true;recordList()};workspace.prepend(back);
 const overview=workspace.querySelector('[data-record-panel="overview"]');if(overview&&!overview.querySelector('.pr-summary')){
 const old=document.createElement('details');old.className='pr-additional';const summary=document.createElement('summary');summary.textContent='Weitere Ausbildungsdetails & Freigaben';old.append(summary);while(overview.firstChild)old.append(overview.firstChild);
 const front=document.createElement('div');front.className='pr-summary';front.innerHTML=`<div class="pr-summary-grid"><article><span>Ausbildungsfortschritt</span><b>${progress(r)}<small>%</small></b><p>${r.completed.length} von 22 Kapiteln</p></article><article><span>Theorieprüfungen</span><b>${(r.testResults||[]).filter(x=>x.passed).length}</b><p>bestandene Prüfungsversuche</p></article><article><span>Ausbildungsfahrten</span><b>${(r.reports||[]).length}</b><p>Praxisberichte dokumentiert</p></article><article><span>Offene Ziele</span><b>${(r.goals||[]).filter(x=>!x.done).length}</b><p>nächste Entwicklungsschritte</p></article></div><div class="pr-next"><div><span class="eyebrow">NÄCHSTER SCHRITT</span><h3>${E(stage(r))}</h3><p>${E((r.goals||[]).find(x=>!x.done)?.text||'Ausbildungsstand prüfen und nächste Einheit mit dem zuständigen FTO planen.')}</p></div><button class="secondary" data-pr-practice>Praxis & Berichte öffnen →</button></div>`;overview.append(front,old);front.querySelector('[data-pr-practice]').onclick=()=>activateRecordTab('practice');
 }
 const reset=workspace.querySelector('#resetRecruitPassword'),archive=workspace.querySelector('#deleteRecruit');
 if(archive){archive.classList.add('pr-archive-button');archive.textContent=archived(r)?'↶ Akte wiederherstellen':'In Alte Rekruten archivieren';}
 const manage=workspace.querySelector('.v640-masterdata');if(manage)manage.classList.add('pr-manage');
 const title=workspace.querySelector('.record-head .eyebrow');if(title)title.textContent=archived(r)?'ARCHIV / AUSBILDUNGSAKTE':'AKTIVE AUSBILDUNGSAKTE';
 if(archived(r)){
 const banner=document.createElement('div');banner.className='pr-archived-banner';banner.textContent='Archivierte Ausbildungsakte · Alle bisherigen Einträge bleiben erhalten.';workspace.querySelector('.record-head')?.before(banner);
 workspace.querySelectorAll('input,select,textarea').forEach(x=>x.disabled=true);
 workspace.querySelectorAll('form button').forEach(x=>x.disabled=true);if(reset)reset.disabled=true;
 }
}
// Personalakten löschen in der Account-Verwaltung bedeutet für Rekruten ebenfalls archivieren.
const originalAccounts=accountManagement;accountManagement=function(){originalAccounts();document.querySelectorAll('[data-account-delete]').forEach(b=>{if(db.users.find(u=>u.id===b.dataset.accountDelete)?.role==='recruit'){b.textContent='Archivieren';b.onclick=async()=>{if(!confirm('Rekrut unter Alte Rekruten archivieren? Alle Ausbildungsdaten bleiben erhalten.'))return;try{await invokeAccountAction({action:'delete',userId:b.dataset.accountDelete});await refreshData();accountManagement()}catch(e){alert(e.message)}}}})};

function navigation(){
 const host=document.querySelector('#nav');if(!host)return;
 const buttons=[...host.querySelectorAll('button.nav-btn')].filter(b=>b.dataset.view||b.dataset.chapter);
 if(!buttons.length)return;
 const signature=buttons.map(b=>b.dataset.view||'chapter:'+b.dataset.chapter).sort().join('|');
 if(host.dataset.prSignature===signature&&host.querySelector('.pr-menu-group')&&!host.querySelector(':scope > button.nav-btn:not([data-pr-essential])'))return;
 const openState=new Map([...host.querySelectorAll('details[data-menu-group]')].map(g=>[g.dataset.menuGroup,g.open]));
 const unique=[...new Map(buttons.map(b=>[(b.dataset.view||'chapter:'+b.dataset.chapter),b])).values()];
 const essentials=['dashboard','evidence','admin'];
 const primary=essentials.map(key=>unique.find(b=>b.dataset.view===key)).filter(Boolean);
 primary.forEach(b=>b.dataset.prEssential='true');
 const groups=[{key:'academy',title:'Ausbildung & Prüfungen',icon:'◈',views:['tests'],chapters:true},{key:'practice',title:'Training & Simulatoren',icon:'◇',views:['cad','scenario','radio','mapquiz','rides','dienstbuch','achievements','leaderboard']},{key:'planning',title:'Planung & Termine',icon:'▦',views:['calendar','plan']},{key:'department',title:'Department & Dokumente',icon:'▤',views:['news','documents','messages']},{key:'management',title:'FTO & Verwaltung',icon:'⚙',views:['command','command-live','accounts']}];
 const used=new Set(primary),elements=[...primary];
 for(const group of groups){const members=unique.filter(b=>!used.has(b)&&(group.views.includes(b.dataset.view)||(group.chapters&&b.dataset.chapter)));if(!members.length)continue;
  const details=document.createElement('details');details.className='pr-menu-group';details.dataset.menuGroup=group.key;
  let remembered=false;try{remembered=sessionStorage.getItem('apd_menu_'+group.key)==='1'}catch{}
  details.open=openState.has(group.key)?openState.get(group.key):remembered;
  const summary=document.createElement('summary');summary.innerHTML='<span class="pr-menu-icon">'+group.icon+'</span><span>'+group.title+'</span><small>'+members.length+'</small>';
  details.append(summary);members.forEach(b=>{delete b.dataset.prEssential;used.add(b);details.append(b)});
  details.addEventListener('toggle',()=>{try{sessionStorage.setItem('apd_menu_'+group.key,details.open?'1':'0')}catch{}});elements.push(details);
 }
 const rest=unique.filter(b=>!used.has(b));if(rest.length){const d=document.createElement('details');d.className='pr-menu-group';d.dataset.menuGroup='other';const summary=document.createElement('summary');summary.textContent='Weitere Funktionen';d.append(summary,...rest);elements.push(d)}
 host.dataset.prSignature=signature;host.replaceChildren(...elements);
 const brand=document.querySelector('.brand small');if(brand)brand.textContent='PERSONNEL & OPERATIONS';
}
const oldNav=nav;nav=function(){oldNav();navigation()};navigation();
const navHost=document.querySelector('#nav');if(navHost)new MutationObserver(navigation).observe(navHost,{childList:true});

document.addEventListener('click',e=>{if(!e.target.closest('#nav [data-view],#nav [data-chapter],[data-mobile]'))return;requestAnimationFrame(()=>{window.scrollTo({top:0,left:0,behavior:'instant'});const content=document.querySelector('#content');if(content)content.scrollTop=0})});
const dashboardBase=dashboard;dashboard=function(){dashboardBase();winterHero()};
let frame=0,snowCanvas=null,snowContext=null,last=0,flakes=[],heroObserver=null;
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
function winterHero(){
 const root=document.querySelector('#content');if(!root||root.querySelector('.pr-winter'))return;
 root.querySelector('.hero')?.classList.add('pr-old-dashboard-hero');
 const hero=document.createElement('section');hero.className='pr-winter';hero.setAttribute('aria-label','Winterstreife in Los Santos mit Weihnachtscountdown');
 hero.innerHTML=`<video class="pr-winter-video" autoplay muted loop playsinline preload="metadata" poster="assets/winter-patrol.webp" aria-hidden="true"><source src="assets/winter-patrol-60fps.mp4" type="video/mp4"></video><div class="pr-winter-shade"></div><canvas aria-hidden="true"></canvas><div class="pr-winter-copy"><span class="pr-season">● WINTER WATCH / LOS SANTOS</span><h1>Die Stadt schläft.<br><em>Wir bleiben wach.</em></h1><p>Willkommen zurück, ${E(current?.name||'Officer')}.<br>Dein Department. Deine Verantwortung.</p><div class="pr-winter-bottom"><div class="pr-countdown" aria-label="Countdown bis 24. Dezember 2026"><span><b data-days>—</b><small>TAGE</small></span><span><b data-hours>—</b><small>STUNDEN</small></span><span><b data-minutes>—</b><small>MINUTEN</small></span><span><b data-seconds>—</b><small>SEKUNDEN</small></span></div><div class="pr-until">BIS HEILIGABEND<small>24. DEZEMBER 2026</small></div></div></div><button class="pr-motion-toggle" type="button" aria-label="Winteranimation pausieren">Ⅱ Animation pausieren</button><div class="pr-winter-index" aria-hidden="true">01 / WINTER EDITION</div>`;
 root.prepend(hero);const video=hero.querySelector('video');video.muted=true;let paused=reduced.matches;
 const button=hero.querySelector('button');function apply(){if(paused){video.pause();cancelAnimationFrame(frame);frame=0}else{video.play().catch(()=>{});startSnow(hero)}button.textContent=paused?'▶ Animation starten':'Ⅱ Animation pausieren';button.setAttribute('aria-pressed',String(paused))}button.onclick=()=>{paused=!paused;apply()};apply();
 heroObserver?.disconnect();heroObserver=new MutationObserver(()=>{if(!hero.isConnected){video.pause();cancelAnimationFrame(frame);frame=0;heroObserver.disconnect()}});heroObserver.observe(root,{childList:true});
}
function startSnow(hero){cancelAnimationFrame(frame);snowCanvas=hero.querySelector('canvas');snowContext=snowCanvas.getContext('2d');const width=hero.clientWidth,height=hero.clientHeight,ratio=Math.min(devicePixelRatio||1,2);snowCanvas.width=width*ratio;snowCanvas.height=height*ratio;snowContext.setTransform(ratio,0,0,ratio,0,0);flakes=Array.from({length:65},()=>({x:Math.random()*width,y:Math.random()*height,r:Math.random()*1.8+.4,v:Math.random()*25+12}));last=0;
 function tick(t){if(!hero.isConnected)return;const dt=last?Math.min((t-last)/1000,.05):0;last=t;snowContext.clearRect(0,0,width,height);snowContext.fillStyle='rgba(230,248,255,.6)';for(const f of flakes){f.y=(f.y+f.v*dt)%height;f.x=(f.x+7*dt)%width;snowContext.beginPath();snowContext.arc(f.x,f.y,f.r,0,Math.PI*2);snowContext.fill()}frame=requestAnimationFrame(tick)}frame=requestAnimationFrame(tick);
}
function countdown(){const hero=document.querySelector('.pr-winter');if(!hero)return;const distance=Math.max(0,new Date('2026-12-24T00:00:00+01:00').getTime()-Date.now()),seconds=Math.floor(distance/1000);for(const [key,value] of Object.entries({days:Math.floor(seconds/86400),hours:Math.floor(seconds/3600)%24,minutes:Math.floor(seconds/60)%60,seconds:seconds%60})){const el=hero.querySelector('[data-'+key+']');if(el)el.textContent=String(value).padStart(2,'0')}if(!distance)hero.querySelector('.pr-until').innerHTML='FROHE WEIHNACHTEN<small>ALTA POLICE DEPARTMENT</small>'}
setInterval(countdown,1000);
const heroContent=document.querySelector('#content');if(heroContent)new MutationObserver(countdown).observe(heroContent,{childList:true});
document.addEventListener('visibilitychange',()=>{const hero=document.querySelector('.pr-winter'),video=hero?.querySelector('video');if(!hero)return;if(document.hidden){video.pause();cancelAnimationFrame(frame)}else if(hero.querySelector('button').getAttribute('aria-pressed')!=='true'){video.play().catch(()=>{});startSnow(hero)}});
})();

