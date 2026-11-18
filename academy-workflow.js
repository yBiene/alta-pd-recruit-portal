/* MRPD: Ausbildungsworkflow und durchsuchbares Postfach. */
let portalDirectory=[],portalReviews=[],portalWorkflowReady=false;
const portalRefreshBase=refreshData;
refreshData=async function(){
 const ok=await portalRefreshBase();if(!ok){portalDirectory=[];portalReviews=[];portalWorkflowReady=false;return ok}
 const ownerId=current.id;
 const results=await Promise.allSettled([sb.rpc('portal_mail_directory'),sb.from('chapter_review_requests').select('*')]);
 if(current?.id!==ownerId)return ok;
 const directory=results[0].status==='fulfilled'?results[0].value:null;
 const reviews=results[1].status==='fulfilled'?results[1].value:null;
 portalDirectory=directory&&!directory.error?(directory.data||[]).map(x=>({...x,serviceNo:x.service_no})):db.users.filter(x=>x.accountEnabled!==false&&!x.archivedAt);
 portalReviews=reviews&&!reviews.error?reviews.data||[]:[];
 portalWorkflowReady=!!reviews&&!reviews.error;
 return ok;
};
function portalPeople(){return [...new Map([...db.users.filter(x=>x.accountEnabled!==false&&!x.archivedAt),...portalDirectory].map(x=>[x.id,x])).values()].filter(x=>x.id!==current?.id).sort((a,b)=>a.name.localeCompare(b.name,'de'))}
function portalPersonLabel(u){return `${u.rank||''} ${u.name||''} · ${u.role==='recruit'?'Rekrut':u.role==='admin'?'Leitung':'Ausbilder'}${u.serviceNo?' · '+u.serviceNo:''}`.trim()}
const portalLabelBase=v62UserLabel;
v62UserLabel=function(id){const u=portalDirectory.find(x=>x.id===id);return u?`${u.rank||''} ${u.name}`.trim():portalLabelBase(id)};
function portalRecipientOptions(people){return people.map(u=>`<option value="${esc(u.id)}">${esc(portalPersonLabel(u))}</option>`).join('')}
function portalInstallRecipientSearch(){
 const select=document.querySelector('#v62MailForm select[name="recipient"]');if(!select)return;
 const people=portalPeople(),label=select.closest('label');
 label.insertAdjacentHTML('afterbegin','<span>Empfänger suchen</span><input id="portalRecipientSearch" type="search" autocomplete="off" placeholder="Name, Rang oder Dienstnummer…" aria-label="Empfänger suchen"><small id="portalRecipientCount" role="status"></small>');
 const render=q=>{const selected=select.value,needle=q.trim().toLocaleLowerCase('de'),matches=people.filter(u=>portalPersonLabel(u).toLocaleLowerCase('de').includes(needle));
 select.innerHTML='<option value="">Empfänger auswählen…</option>'+portalRecipientOptions(matches);
 if(selected&&!matches.some(x=>x.id===selected)){const u=people.find(x=>x.id===selected);if(u)select.insertAdjacentHTML('beforeend',`<optgroup label="Bereits ausgewählt">${portalRecipientOptions([u])}</optgroup>`)}
 select.value=selected;document.querySelector('#portalRecipientCount').textContent=`${matches.length} Personen gefunden${matches.length?'':' – Suchbegriff ändern'}`;
 };render('');document.querySelector('#portalRecipientSearch').oninput=e=>render(e.target.value);
 document.querySelector('#v621Compose').addEventListener('click',()=>document.querySelector('#portalRecipientSearch').focus());
}
function portalChapterStatus(u,n){
 const request=portalReviews.find(r=>r.recruit_id===u.id&&+r.chapter===+n);
 if(request&&!request.reviewed_at)return {label:'Warten auf FTO',kind:'waiting',detail:'Angefragt am '+new Date(request.requested_at).toLocaleDateString('de-DE')};
 if((u.completed||[]).includes(+n)){const p=(u.chapterProgress||[]).find(x=>+x.chapter===+n);return {label:'Abgeschlossen',kind:'done',detail:p?.completed_at?new Date(p.completed_at).toLocaleDateString('de-DE')+' · '+(p.completed_by===u.id?'Wissenscheck':v62UserLabel(p.completed_by)):''}}
 const st=u.id===current?.id?chapterStates.find(x=>+x.chapter===+n):null;
 return st?.last_opened_at||st?.read_at?{label:'In Bearbeitung',kind:'working',detail:''}:{label:'Offen',kind:'open',detail:''};
}
function portalChapterBadges(){document.querySelectorAll('.chapter-card[data-open]').forEach(card=>{const s=portalChapterStatus(current,+card.dataset.open),el=card.querySelector('.chapter-card-state');if(el){el.textContent=s.label;el.dataset.progress=s.kind;el.title=s.detail;if(s.detail)el.insertAdjacentHTML('afterend',`<small class="portal-chapter-meta">${esc(s.detail)}</small>`)}})}
function portalFtoQueue(){
 if(!isTrainer(current))return;
 const people=db.users.filter(x=>x.role==='recruit'&&x.accountEnabled!==false&&!x.archivedAt&&x.status!=='Archiviert');
 const requests=portalReviews.filter(x=>!x.reviewed_at&&people.some(r=>r.id===x.recruit_id));
 const stale=people.filter(r=>v61DaysSince(v61LastActivity(r)||r.start)>=7);
 const card=document.createElement('section');card.className='card portal-fto-queue';
 card.innerHTML=`<div class="eyebrow">FTO · RÜCKMELDUNGEN</div><h2>${requests.length} wartende Kapitel · ${stale.length} Rekruten ohne aktuelle Aktivität</h2>${!portalWorkflowReady?'<p class="notice">Die neue Datenbank-Erweiterung wurde noch nicht eingerichtet.</p>':''}<div class="portal-queue-list">${requests.map(x=>{const r=people.find(r=>r.id===x.recruit_id);return `<div><button class="secondary" data-portal-record="${esc(r.id)}"><b>${esc(r.name)}</b> · Kapitel ${chapterNumber(x.chapter)}<small>Seit ${new Date(x.requested_at).toLocaleDateString('de-DE')}</small></button><button class="primary" data-review-recruit="${esc(r.id)}" data-review-chapter="${x.chapter}">Rückmeldung bestätigen</button></div>`}).join('')||'<p class="muted">Keine Kapitel warten auf Rückmeldung.</p>'}</div>${stale.length?`<details><summary>Rekruten ohne Aktivität seit mindestens 7 Tagen</summary>${stale.map(r=>`<button class="secondary" data-portal-record="${esc(r.id)}">${esc(r.name)} · ${v61LastActivity(r)?v61DaysSince(v61LastActivity(r))+' Tage':'Noch keine Ausbildung dokumentiert'}</button>`).join('')}</details>`:''}`;
 document.querySelector('.hero')?.insertAdjacentElement('afterend',card);
 card.querySelectorAll('[data-portal-record]').forEach(b=>b.onclick=()=>v630OpenRecruit(b.dataset.portalRecord));
 card.querySelectorAll('[data-review-recruit]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const {error}=await sb.rpc('portal_review_chapter',{p_recruit_id:b.dataset.reviewRecruit,p_chapter:+b.dataset.reviewChapter});if(error)throw error;await refreshData();dashboard();toast('✓ Rückmeldung bestätigt. Den Kapitelabschluss kannst du in der Akte bearbeiten.')}catch(e){toast('⚠ '+e.message);b.disabled=false}});
}
const portalDashboardBase=dashboard;
dashboard=function(){const out=portalDashboardBase();portalChapterBadges();portalFtoQueue();if(current?.role==='recruit'){document.querySelector('.ae-today')?.remove();const n=v61NextRecruitStep();const subtitle=document.querySelector('.v61-continue p');if(n&&subtitle)subtitle.textContent=n.sub}return out};
const portalNextBase=v61NextRecruitStep;
v61NextRecruitStep=function(u=current){
 const pending=portalReviews.find(x=>x.recruit_id===u?.id&&!x.reviewed_at);
 if(pending)return {icon:'⏳',title:`FTO-Rückmeldung zu Kapitel ${chapterNumber(pending.chapter)}`,sub:'Deine Anfrage ist eingegangen. Du kannst deinen Ausbildungsstand im Konto ansehen.',go:()=>showView('account')};
 const next=portalNextBase(u);if(next?.icon==='📖'&&u?.role==='recruit')next.sub='Kapitel lesen, Wissenscheck absolvieren und offene Fragen mit dem FTO klären.';return next;
};
const portalChapterBase=showChapter;
showChapter=function(n){const out=portalChapterBase(n);const side=document.querySelector('.side-card');if(!side||!current)return out;
 const state=portalChapterStatus(current,n),request=portalReviews.find(x=>x.recruit_id===current.id&&+x.chapter===+n);
 side.insertAdjacentHTML('beforeend',`<div class="portal-chapter-state"><span class="chapter-card-state" data-progress="${state.kind}">${state.label}</span>${state.detail?`<small>${esc(state.detail)}</small>`:''}${request?.reviewed_by?`<small>Ausbilder: ${esc(v62UserLabel(request.reviewed_by))}</small>`:''}${current.role==='recruit'?`<button class="secondary" id="portalRequestReview" ${!portalWorkflowReady||state.kind==='waiting'?'disabled':''}>${state.kind==='waiting'?'⏳ Rückmeldung angefragt':'FTO-Rückmeldung anfordern'}</button><small>${portalWorkflowReady?'Für Fragen oder die praktische Abzeichnung. Wissenscheck und FTO-Rückmeldung bleiben getrennte Nachweise.':'Neue Datenbank-Erweiterung für FTO-Rückmeldungen erforderlich.'}</small>`:''}</div>`);
 document.querySelector('#portalRequestReview')?.addEventListener('click',async e=>{e.currentTarget.disabled=true;try{const {error}=await sb.rpc('portal_request_chapter_review',{p_chapter:+n});if(error)throw error;await refreshData();showChapter(n);toast('✓ FTO-Rückmeldung angefragt')}catch(err){toast('⚠ '+err.message);e.target.disabled=false}});return out;
};
const portalTimelineBase=timelineHtml;
timelineHtml=function(u,limit=8){const extra=portalReviews.filter(x=>x.recruit_id===u.id).flatMap(x=>[{when:x.requested_at,icon:'⏳',text:`Kapitel ${chapterNumber(x.chapter)}: FTO-Rückmeldung angefragt`},...(x.reviewed_at?[{when:x.reviewed_at,icon:'✓',text:`Kapitel ${chapterNumber(x.chapter)}: Rückmeldung von ${v62UserLabel(x.reviewed_by)}`}]:[])]);return portalTimelineBase({...u,activity:[...(u.activity||[]),...extra].sort((a,b)=>new Date(b.when)-new Date(a.when))},limit)};
const portalNewsBase=newsView;
newsView=async function(){await portalNewsBase();if(!isTrainer(current)||!document.querySelector('#newsList'))return;const list=document.querySelector('#newsList');const {data,error}=await sb.rpc('portal_announcement_receipts');if(!list.isConnected)return;if(error){list.insertAdjacentHTML('beforeend','<p class="notice">Lesebestätigungs-Übersicht benötigt die neue Datenbank-Erweiterung.</p>');return}
 list.querySelectorAll('.news-card').forEach(card=>{const button=card.querySelector('[data-read-news]');const id=button?.dataset.readNews||card.dataset.announcement;const rows=(data||[]).filter(x=>String(x.announcement_id)===String(id));if(!rows.length)return;card.insertAdjacentHTML('beforeend',`<details class="portal-receipts"><summary>${rows.filter(x=>x.confirmed).length}/${rows.length} Lesebestätigungen</summary>${rows.map(x=>`<div>${x.confirmed?'✓':'○'} ${esc(x.name)} · ${x.confirmed?'Bestätigt':'Noch offen'}</div>`).join('')}</details>`)});
};

