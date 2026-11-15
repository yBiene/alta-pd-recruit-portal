/* Compact dashboard: a single overview instead of stacked historical dashboard extensions. */
(()=>{'use strict';
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const active=r=>typeof apdActiveRecruit==='function'?apdActiveRecruit(r):r?.role==='recruit'&&!r.archivedAt&&!r.archived_at&&r.status!=='Archiviert';
const stamp=v=>new Date(v).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
function upcoming(staff,people){const allowed=new Set(people.map(r=>r.id)),now=Date.now();const general=typeof trainingEvents!=='undefined'?trainingEvents:[],personal=typeof academyAppointments!=='undefined'?academyAppointments:[];
 return [...general.filter(x=>!x.recruit_id||(staff?allowed.has(x.recruit_id):x.recruit_id===current.id)).map(x=>({...x,key:'event:'+x.id})),...personal.filter(x=>staff?allowed.has(x.recruit_id):x.recruit_id===current.id).map(x=>({...x,key:'appointment:'+x.id,recruitName:people.find(r=>r.id===x.recruit_id)?.name}))].filter(x=>new Date(x.starts_at).getTime()>=now).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));}
function issues(people){const allowed=new Set(people.map(r=>r.id)),result=new Map();
 const reviews=typeof portalReviews!=='undefined'?portalReviews:[];
 reviews.filter(x=>!x.reviewed_at&&allowed.has(x.recruit_id)).forEach(x=>{const r=people.find(p=>p.id===x.recruit_id);const prior=result.get(r.id);result.set(r.id,{r,sev:4,text:prior?`${prior.count+1} Kapitel warten auf Rückmeldung`:'Kapitel wartet auf Rückmeldung',count:(prior?.count||0)+1,tab:'chapters'})});
 const remaining=typeof v630IssueRows==='function'?v630IssueRows():[];
 remaining.filter(x=>allowed.has(x.r.id)).forEach(x=>{if(!result.has(x.r.id))result.set(x.r.id,{...x,tab:'overview'})});
 return [...result.values()].sort((a,b)=>b.sev-a.sev||a.r.name.localeCompare(b.r.name,'de'));}
function appointmentsHTML(events){return events.length?events.slice(0,3).map(x=>`<article class="cd-appointment"><time datetime="${E(x.starts_at)}">${E(stamp(x.starts_at))}</time><div><b>${E(x.title)}</b><small>${E([x.location,x.recruitName].filter(Boolean).join(' · ')||'Ort noch offen')}</small></div></article>`).join(''):'<p class="cd-empty">Keine kommenden Termine eingetragen.</p>'}
function openRecord(id,tab='overview'){const r=db.users.find(x=>x.id===id);if(!active(r))return;if(typeof v630OpenRecruit==='function')return v630OpenRecruit(id,tab);selectedRecruit=id;recruitRecordClosed=false;admin()}
dashboard=function(){
 if(!current)return;
 if(typeof aeStopChapterSession==='function')aeStopChapterSession();
 setActive('[data-view="dashboard"]');document.querySelector('#pageTitle').textContent='Dashboard';
 const root=document.querySelector('#content');if(!root)return;root.classList.remove('dashboard-v541');
 const staff=typeof isTrainer==='function'&&isTrainer(current),people=db.users.filter(active),tasks=staff?issues(people):[],events=upcoming(staff,people);
 const pending=typeof portalReviews!=='undefined'?portalReviews.filter(x=>!x.reviewed_at&&people.some(r=>r.id===x.recruit_id)).length:0;
 const next=!staff&&typeof v61NextRecruitStep==='function'?v61NextRecruitStep(current):null,goals=(current.goals||[]).filter(g=>!g.done);
 const urgent=typeof portalSettings!=='undefined'&&portalSettings.urgent_banner?`<div class="urgent-banner" role="status">${E(portalSettings.urgent_banner)}</div>`:'';
 root.innerHTML=`<div class="hero" aria-hidden="true"></div>${urgent}<section class="cd-overview" data-compact-dashboard aria-label="Kompakte Dienstübersicht">
 ${staff?`<div class="cd-metrics"><div><span>Aktive Rekruten</span><b>${people.length}</b></div><div><span>Rekruten mit Handlungsbedarf</span><b>${tasks.length}</b></div><div><span>Wartende Kapitel</span><b>${pending}</b></div></div>`:''}
 <div class="cd-main"><section class="card cd-tasks"><header class="cd-section-head"><div><span class="eyebrow">${staff?'FTO / HEUTE':'MEINE AUSBILDUNG'}</span><h2>${staff?'Handlungsbedarf':'Mein nächster Schritt'}</h2></div>${staff&&tasks.length?`<span class="cd-count">${tasks.length}</span>`:''}</header>
 ${staff?(tasks.length?tasks.slice(0,4).map(x=>`<button type="button" class="cd-task" data-cd-record="${E(x.r.id)}" data-cd-tab="${E(x.tab)}"><span class="cd-task-dot" aria-hidden="true"></span><span><b>${E(x.r.name)}</b><small>${E(x.text)}</small></span><span aria-hidden="true">→</span></button>`).join(''):'<p class="cd-empty">Aktuell kein besonderer Handlungsbedarf.</p>'):`<h3 class="cd-next-title">${E(next?.title||'Ausbildungsstand mit dem FTO abstimmen')}</h3><p class="muted">${E(next?.sub||'Dein FTO unterstützt dich beim nächsten Schritt.')}</p>${next?'<button type="button" class="primary" data-cd-continue>Ausbildung fortsetzen</button>':''}${goals.length?`<div class="cd-goals"><span>Offene Ziele · ${goals.length}</span>${goals.slice(0,3).map(g=>`<p>${E(g.text)}</p>`).join('')}</div>`:''}`}
 ${staff?`<button type="button" class="cd-text-link" data-cd-view="admin">${tasks.length>4?`${tasks.length-4} weitere · `:''}Ausbildungsakten öffnen →</button>`:''}</section>
 <section class="card cd-appointments"><header class="cd-section-head"><div><span class="eyebrow">PLANUNG</span><h2>Nächste Termine</h2></div></header>${appointmentsHTML(events)}<button type="button" class="cd-text-link" data-cd-view="calendar">${events.length>3?'Alle Termine':'Kalender öffnen'} →</button></section></div>
 <details class="cd-more"><summary>Weitere Übersichten <span>${staff?'Ausbildungsstände & letzte Aktivitäten':'Kapitel & Ausbildungsdetails'}</span></summary><div class="cd-more-body">
 ${staff?`<section class="card"><h2>Aktive Ausbildungsakten</h2>${people.length?people.map(r=>`<button type="button" class="cd-person" data-cd-record="${E(r.id)}"><span><b>${E(r.name)}</b><small>FTO: ${E(r.fto||'Nicht zugewiesen')}</small></span><span>${progress(r)} %</span></button>`).join(''):'<p class="cd-empty">Keine aktiven Rekruten.</p>'}</section><section class="card"><h2>Letzte Aktivitäten</h2>${(typeof v630AcademyFeed==='function'?v630AcademyFeed(20):[]).filter(x=>active(x.r)).slice(0,5).map(x=>`<button class="cd-person" type="button" data-cd-record="${E(x.r.id)}"><span><b>${E(x.r.name)}</b><small>${E(x.text)}</small></span><time>${E(stamp(x.when))}</time></button>`).join('')||'<p class="cd-empty">Keine Aktivitäten dokumentiert.</p>'}</section>`:`<section class="card"><h2>Ausbildungskapitel</h2><div class="cd-chapters">${(typeof titles!=='undefined'?titles:[]).map(x=>`<button type="button" class="secondary" data-cd-chapter="${x.n}"><span>${String(typeof chapterNumber==='function'?chapterNumber(x.n):x.n).padStart(2,'0')}</span>${E(x.title)}</button>`).join('')}</div></section><section class="card"><h2>Mein Ausbildungsstand</h2><p>${progress(current)} % · ${E(typeof stage==='function'?stage(current):current.status)}</p><p class="muted">Freigaben, Verlauf und persönliche Angaben findest du in deinem Dienstprofil.</p><button type="button" class="secondary" data-cd-view="account">Mein Dienstprofil öffnen</button></section>`}
 </div></details></section>`;
 root.querySelectorAll('[data-cd-record]').forEach(b=>b.onclick=()=>openRecord(b.dataset.cdRecord,b.dataset.cdTab));
 root.querySelectorAll('[data-cd-view]').forEach(b=>b.onclick=()=>showView(b.dataset.cdView));
 root.querySelectorAll('[data-cd-chapter]').forEach(b=>b.onclick=()=>showChapter(+b.dataset.cdChapter));
 root.querySelector('[data-cd-continue]')?.addEventListener('click',()=>next.go());
 if(typeof ensureChrome==='function')ensureChrome();
};
})();
