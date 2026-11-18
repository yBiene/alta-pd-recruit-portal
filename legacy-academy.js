/* ===== V4.4 COMMAND CENTER ENHANCEMENTS ===== */
let portalSettings={department_name:"Mission Row Police Department",motto:"Serve · Protect · Train",handbook_version:"2.1",portal_version:"V4.4",maintenance_mode:false,urgent_banner:""};
let chapterStates=[], ftoQuestions=[], trainingEvents=[];
const _refreshDataV43=refreshData;
refreshData=async function(){
 const ok=await _refreshDataV43(); if(!ok)return ok;
 try{
  const ids=db.users.map(u=>u.id);
  const [{data:rawProfiles},{data:settings},{data:states},{data:questions},{data:events}]=await Promise.all([
   sb.from("profiles").select("id,avatar_url,account_enabled,archived_at,password_changed_at").in("id",ids),
   sb.from("portal_settings").select("*").eq("id",1).maybeSingle(),
   sb.from("chapter_state").select("*").eq("user_id",current.id),
   sb.from("fto_questions").select("*").order("created_at",{ascending:false}),
   sb.from("training_events").select("*").gte("starts_at",new Date(Date.now()-86400000).toISOString()).order("starts_at")
  ]);
  if(settings)portalSettings=settings; chapterStates=states||[]; ftoQuestions=questions||[]; trainingEvents=events||[];
  for(const u of db.users){const p=(rawProfiles||[]).find(x=>x.id===u.id);if(p){u.avatarUrl=p.avatar_url||"";u.accountEnabled=p.account_enabled!==false;u.archivedAt=p.archived_at||null;u.passwordChangedAt=p.password_changed_at||null}}
  current=db.users.find(x=>x.id===current.id)||current;
  if(current.accountEnabled===false){await sb.auth.signOut();throw new Error("Dieser Portal-Account wurde deaktiviert.")}
 }catch(e){console.warn("V4.4 Zusatzdaten:",e.message)}
 return ok;
};
function toast(msg){let s=document.querySelector(".toast-stack");if(!s){s=document.createElement("div");s.className="toast-stack";document.body.appendChild(s)}const t=document.createElement("div");t.className="toast";t.textContent=msg;s.appendChild(t);setTimeout(()=>t.remove(),2600)}
function statusName(u){if(u.archivedAt||u.status==="Archiviert")return "Archiviert";if(u.role==="recruit"&&progress(u)===100)return "Abgeschlossen";return u.role==="recruit"?(u.status||"In Ausbildung"):"Aktiv"}
function rankBadge(u){const r=u.rank||roleLabel(u);return `<span class="rank-badge rank-${esc(r)}">🎖️ ${esc(r)}</span>`}
function serviceDuration(u){if(!u.start)return "—";const d=Math.max(0,Math.floor((Date.now()-new Date(u.start+"T00:00:00"))/86400000));return d===0?"Seit heute":`Seit ${d} Tag${d===1?"":"en"}`}
function attentionCount(u){return (u.goals||[]).filter(g=>!g.done).length+(u.testResults||[]).filter(r=>!r.passed).length}
function commandStrip(){if(!isTrainer(current))return "";const rs=db.users.filter(x=>apdActiveRecruit(x));const open=rs.reduce((a,r)=>a+(r.goals||[]).filter(g=>!g.done).length,0);const att=rs.filter(r=>attentionCount(r)>0).length;const reports=rs.reduce((a,r)=>a+(r.reports||[]).length,0);return `<div class="command-strip"><div class="command-chip"><small>AKTIVE REKRUTEN</small><b>${rs.length}</b></div><div class="command-chip"><small>AUFMERKSAMKEIT</small><b>${att}</b></div><div class="command-chip"><small>OFFENE ZIELE</small><b>${open}</b></div><div class="command-chip"><small>FTO-BERICHTE</small><b>${reports}</b></div><div class="command-chip"><small>ABSCHLUSSBEREIT</small><b>${rs.filter(r=>progress(r)===100).length}</b></div></div>`}
function updateClock(){const d=new Date(),h=d.getHours(),shift=h<6?"Nachtschicht":h<12?"Frühschicht":h<18?"Tagschicht":"Abendschicht",icon=h<6?"🌙":h<12?"🌅":h<18?"☀️":"🌆",date=d.toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit",year:"numeric"}),time=d.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});document.querySelectorAll(".live-clock").forEach(e=>e.textContent=`${date} · ${time}`);document.querySelectorAll(".shift-pill").forEach(e=>e.textContent=`${icon} ${shift} · ${date} · ${time}`)}
setInterval(updateClock,1000);window.addEventListener("online",()=>{document.body.classList.remove("offline");toast("✓ Verbindung wiederhergestellt")});window.addEventListener("offline",()=>document.body.classList.add("offline"));
function setupTopAccountLink(){const b=$("#topAccountBtn");if(!b||b.dataset.boundAccount)return;b.dataset.boundAccount="1";b.onclick=()=>showView("account")}

function ensureChrome(){setupTopAccountLink();if(!document.querySelector(".connection-banner")){document.body.insertAdjacentHTML("beforeend",`<div class="connection-banner">🛜 Verbindung zu MRPD wird wiederhergestellt…</div><nav class="bottom-nav"><button data-mobile="dashboard"><span>🏠</span>Dashboard</button><button data-mobile="chapter"><span>🎓</span>Ausbildung</button><button data-mobile="tests"><span>📝</span>Tests</button><button data-mobile="account"><span>👤</span>Konto</button></nav>`);document.querySelectorAll("[data-mobile]").forEach(b=>b.onclick=()=>b.dataset.mobile==="chapter"?showChapter(1):showView(b.dataset.mobile))}updateClock()}
const _navV43=nav;nav=function(){_navV43();ensureChrome();if(isOwner()){const host=$("#nav");host.insertAdjacentHTML("beforeend",`<div class="nav-label">COMMAND</div><button class="nav-btn" data-view="calendar">📅 Ausbildungskalender</button><button class="nav-btn" data-view="command">🧑‍✈️ Command Center</button>`);host.querySelectorAll('[data-view="calendar"],[data-view="command"]').forEach(b=>b.onclick=()=>showView(b.dataset.view))}}
const _showViewV43=showView;showView=function(v){if(v==="calendar")return calendarView();if(v==="command")return commandView();return _showViewV43(v)};
function calendarView(){setActive('[data-view="calendar"]');$("#pageTitle").textContent="Ausbildungskalender";$("#content").innerHTML=`<div class="section-head"><div><div class="eyebrow">📅 PLANUNG</div><h1>Ausbildungskalender</h1></div><span class="shift-pill"></span></div><div class="card"><h2>Kommende Termine</h2>${trainingEvents.length?trainingEvents.map(e=>`<div class="test-result-row"><div><b>${esc(e.title)}</b><small>${new Date(e.starts_at).toLocaleString("de-DE")} · ${esc(e.location||"—")}</small></div><span class="state-badge">${esc(e.event_type)}</span></div>`).join(""):`<p class="muted">Noch keine Termine eingetragen.</p>`}</div>`;updateClock()}
function commandView(){if(!isOwner())return dashboard();setActive('[data-view="command"]');$("#pageTitle").textContent="Command Center";const rs=db.users.filter(x=>apdActiveRecruit(x));const load={};rs.forEach(r=>{load[r.fto||"Nicht zugewiesen"]=(load[r.fto||"Nicht zugewiesen"]||0)+1});$("#content").innerHTML=`<div class="section-head"><div><div class="eyebrow">🧑‍✈️ FÜHRUNG</div><h1>Command Center</h1></div><span class="status">Nur Hauptadmin</span></div>${commandStrip()}<div class="grid dashboard-two"><div class="card"><h2>FTO-Auslastung</h2>${Object.entries(load).map(([n,c])=>`<div class="test-result-row"><b>${esc(n)}</b><span class="state-badge">${c} Recruit${c===1?"":"s"}</span></div>`).join("")}</div><div class="card"><h2>Berechtigungsmatrix</h2><div class="table-wrap"><table><thead><tr><th>Rolle</th><th>Ausbildung</th><th>Verwalten</th><th>Accounts</th></tr></thead><tbody><tr><td>Recruit</td><td>Eigene</td><td>—</td><td>—</td></tr><tr><td>FTO</td><td>Alle</td><td>✓</td><td>—</td></tr><tr><td>Extra-FTO</td><td>Alle</td><td>✓</td><td>Recruits</td></tr><tr><td>Hauptadmin</td><td>Alle</td><td>✓</td><td>Alle</td></tr></tbody></table></div></div></div><div class="card"><h2>Portal-Einstellungen</h2><div class="account-info-grid"><div class="info-tile"><small>Department</small><b>${esc(portalSettings.department_name)}</b></div><div class="info-tile"><small>Handbuch</small><b>${esc(portalSettings.handbook_version)}</b></div><div class="info-tile"><small>Portal-Version</small><b>${esc(portalSettings.portal_version)}</b></div><div class="info-tile"><small>Wartungsmodus</small><b>${portalSettings.maintenance_mode?"AKTIV":"Aus"}</b></div></div></div>`}
const _dashboardV43=dashboard;dashboard=function(){_dashboardV43();ensureChrome();const c=$("#content");if(!c)return;const urgent=portalSettings.urgent_banner?`<div class="urgent-banner">🚨 ${esc(portalSettings.urgent_banner)}</div>`:"";c.insertAdjacentHTML("afterbegin",urgent+commandStrip());const h=c.querySelector(".hero");if(h)h.insertAdjacentHTML("beforeend",`<div class="hero-command-meta"><span class="shift-pill"></span></div>`);updateClock();if(current.role==="recruit"){const stats=c.querySelector(".stats");if(stats)stats.insertAdjacentHTML("afterend",`<div class="grid dashboard-two"><div class="card"><div class="eyebrow">🧑‍🏫 MEIN FTO</div><h2>${esc(current.fto||"Noch nicht zugewiesen")}</h2><p>${esc(current.secondaryFto?"Weiterer FTO: "+current.secondaryFto:"Dein zuständiger Ausbilder")}</p></div><div class="card"><div class="eyebrow">📅 AUSBILDUNGSDAUER</div><h2>${serviceDuration(current)}</h2><p class="muted">Beginn: ${current.start?new Date(current.start+"T00:00:00").toLocaleDateString("de-DE"):"—"}</p></div></div>`)} }
const _accountV43=account;account=function(){setActive('[data-view="account"]');$("#pageTitle").textContent="Mein Konto";const u=current,p=progress(u),avatar=u.avatarUrl||"assets/mrpd-logo.svg";$("#content").innerHTML=`<div class="section-head"><div><div class="eyebrow">MEINE DIENSTAKTE</div><h1>Mein Konto</h1></div><div>${rankBadge(u)} <span class="state-badge ${u.accountEnabled===false?"state-off":""}"><i class="state-dot"></i>${esc(statusName(u))}</span></div></div><div class="account-command"><section class="service-card"><div class="service-head"><img class="service-avatar" src="${esc(avatar)}" onerror="this.src='assets/mrpd-logo.svg'"><div class="service-name"><small>Mission Row Police Department</small><h2>${esc(u.name)}</h2>${rankBadge(u)}</div></div><div class="service-meta"><div><small>Badge / Dienstnummer</small><b>${esc(u.serviceNo||"—")}</b></div><div><small>Funktion</small><b>${esc(roleLabel(u))}</b></div><div><small>Status</small><b>● ${esc(statusName(u))}</b></div><div><small>Eintritt / Ausbildung</small><b>${u.start?new Date(u.start+"T00:00:00").toLocaleDateString("de-DE"):"—"}</b></div></div></section><div class="account-panels"><section class="card"><div class="eyebrow">👤 ACCOUNTINFORMATIONEN</div><h2>Profil</h2><div class="account-info-grid"><div class="info-tile"><small>Benutzername</small><b>${esc(u.username)}</b></div><div class="info-tile"><small>Berechtigung</small><b>${esc(roleLabel(u))}</b></div><div class="info-tile"><small>Letzter Login</small><b>${u.lastLogin?new Date(u.lastLogin).toLocaleString("de-DE"):"—"}</b></div><div class="info-tile"><small>Ausbildungsdauer</small><b>${serviceDuration(u)}</b></div></div><label style="display:block;margin-top:12px">Dienstnummer<input id="myServiceNo" value="${esc(u.serviceNo||"")}"></label><button class="primary" id="saveMyAccount">💾 Speichern</button></section><section class="card"><div class="eyebrow">🔐 SICHERHEIT</div><h2>Passwort</h2>${u.mustChangePassword?`<div class="notice password-warning"><b>Erstanmeldung:</b> Lege jetzt dein persönliches Passwort fest.</div>`:""}<form id="changeMyPassword" class="password-form"><label>Neues Passwort<input id="newPassword" type="password" minlength="8" required></label><label>Wiederholen<input id="repeatPassword" type="password" minlength="8" required></label><button class="primary">🔑 Passwort ändern</button></form><p class="muted">Zuletzt geändert: ${u.passwordChangedAt?new Date(u.passwordChangedAt).toLocaleString("de-DE"):"—"}</p></section>${u.role==="recruit"?`<section class="card wide"><div class="eyebrow">📊 AUSBILDUNG</div><h2>${p}% · ${stage(u)}</h2><div class="progress"><i style="width:${p}%"></i></div><div class="account-info-grid" style="margin-top:12px"><div class="info-tile"><small>Leiter FTO</small><b>${esc(u.fto||"—")}</b></div><div class="info-tile"><small>Weiterer FTO</small><b>${esc(u.secondaryFto||"—")}</b></div><div class="info-tile"><small>Kapitel</small><b>${u.completed.length}/22</b></div><div class="info-tile"><small>Offene Ziele</small><b>${(u.goals||[]).filter(g=>!g.done).length}</b></div></div></section>`:""}</div></div>${u.role==="recruit"?`<div class="grid dashboard-two"><div class="card"><div class="eyebrow">🏅 DIENST & QUALIFIKATIONEN</div><h2>Freigaben</h2>${qualificationHtml(u)}</div><div class="card"><div class="eyebrow">⭐ FAVORITEN & ZULETZT</div><h2>Schnellzugriff</h2>${(u.favorites||[]).length?u.favorites.map(n=>`<button class="secondary" data-open-fav="${n}">★ Kapitel ${chapterNumber(n)}</button>`).join(" "):"<p class='muted'>Noch keine Favoriten.</p>"}</div></div><div class="card activity-card account-history-compact"><div class="eyebrow">🕒 MEINE AKTIVITÄT · DIENSTBUCH</div><h2>Ausbildungsverlauf</h2><div class="history-first">${timelineHtml(u,3)}</div>${(u.activity||[]).length>3?`<details class="history-more"><summary>Weitere ${(u.activity||[]).length-3} Einträge anzeigen</summary><div>${(u.activity||[]).slice(3,20).map(x=>`<div class="timeline-row"><span class="timeline-icon">${x.icon}</span><div><b>${esc(x.text)}</b><small>${new Date(x.when).toLocaleString("de-DE")}</small></div></div>`).join("")}</div></details>`:""}</div><div class="card"><button class="secondary" onclick="window.print()">📄 Meine Ausbildungsakte drucken / PDF</button></div>`:""}`;
 $("#saveMyAccount").onclick=async()=>{const value=$("#myServiceNo").value.trim();if(!value)return toast("⚠ Dienstnummer fehlt");const {error}=await sb.rpc("update_my_service_no",{new_service_no:value});if(error)return toast("⚠ "+error.message);await refreshData();toast("✓ Gespeichert");account()};
 $("#changeMyPassword").onsubmit=async e=>{e.preventDefault();const pw=$("#newPassword").value,rep=$("#repeatPassword").value;if(pw.length<8)return toast("⚠ Mindestens 8 Zeichen");if(pw!==rep)return toast("⚠ Passwörter stimmen nicht überein");if(pw==="123456")return toast("⚠ Bitte eigenes Passwort wählen");const {error}=await sb.auth.updateUser({password:pw});if(error)return toast("⚠ "+error.message);await sb.rpc("mark_password_changed");await refreshData();toast("✓ Passwort geändert");account()};document.querySelectorAll("[data-open-fav]").forEach(b=>b.onclick=()=>showChapter(+b.dataset.openFav));ensureChrome()}
const _showChapterV43=showChapter;showChapter=async function(n){_showChapterV43(n);try{await sb.from("chapter_state").upsert({user_id:current.id,chapter:n,last_opened_at:new Date().toISOString()},{onConflict:"user_id,chapter"})}catch{}const side=document.querySelector(".chapter-side")||document.querySelector(".chapter-layout aside");if(side){const st=chapterStates.find(x=>x.chapter===n);side.insertAdjacentHTML("beforeend",`<div class="chapter-state-box"><div><small>Gelesen</small><b>${st?.read_at?"✓ Ja":"Offen"}</b></div><div><small>Notizen</small><b>Auto-Save</b></div><div><small>Status</small><b>${current.completed.includes(n)?"Praxis ✓":"Offen"}</b></div></div><div class="chapter-actions"><button class="secondary" id="markRead">👁️ Als gelesen</button>${current.role==="recruit"?`<button class="secondary" id="askFto">❓ FTO fragen</button>`:""}</div>`);$("#markRead").onclick=async()=>{await sb.from("chapter_state").upsert({user_id:current.id,chapter:n,read_at:new Date().toISOString(),last_opened_at:new Date().toISOString()},{onConflict:"user_id,chapter"});toast("✓ Kapitel als gelesen markiert")};$("#askFto")?.addEventListener("click",async()=>{const q=prompt("Welche Frage möchtest du deinem FTO zu diesem Kapitel stellen?");if(!q?.trim())return;const {error}=await sb.from("fto_questions").insert({recruit_id:current.id,chapter:n,question:q.trim()});if(error)return toast("⚠ "+error.message);toast("✓ Frage an FTO gesendet")})}}
const _adminV43=admin;admin=function(){_adminV43();if(!isTrainer(current))return;const c=$("#content");const firstCard=c?.querySelector(".admin-grid > div > .card");if(firstCard)firstCard.insertAdjacentHTML("beforebegin",`<div class="admin-toolbar"><input id="adminSearch" placeholder="🔍 Name, Benutzername oder Dienstnummer"><select id="adminFilter"><option>Alle</option><option>In Ausbildung</option><option>Abgeschlossen</option><option>Archiviert</option></select><select id="adminSort"><option>Name</option><option>Fortschritt</option><option>Dienstnummer</option></select></div>`);document.querySelectorAll(".trainer-row").forEach(r=>r.classList.add("roomy"));document.querySelectorAll(".recruit-row").forEach(r=>{const txt=r.textContent.toLowerCase();r.dataset.search=txt});$("#adminSearch")?.addEventListener("input",e=>{const q=e.target.value.toLowerCase();document.querySelectorAll(".recruit-row").forEach(r=>r.style.display=r.dataset.search.includes(q)?"":"none")});const rs=db.users.filter(x=>apdActiveRecruit(x));if(rs.some(r=>attentionCount(r)>0)){const grid=c.querySelector(".admin-grid");grid?.insertAdjacentHTML("beforebegin",`<div class="card attention-card"><div class="eyebrow">🚦 AUFMERKSAMKEIT ERFORDERLICH</div><h2>${rs.filter(r=>attentionCount(r)>0).length} Recruit(s) mit offenen Punkten</h2><p class="muted">Offene Ausbildungsziele oder nicht bestandene Tests werden hier berücksichtigt.</p></div>`)}}
const _restoreNotesV43=restoreChapterNotes;restoreChapterNotes=async function(n){await _restoreNotesV43(n);document.querySelectorAll(".learn-line").forEach(el=>el.addEventListener("change",()=>toast("✓ Gespeichert")))};
ensureChrome();

/* ===== V4.5 Workflow & Recruit UX ===== */
function recruitSignal(r){
 const failed=(r.testResults||[]).some(t=>!t.passed), open=(r.goals||[]).filter(g=>!g.done).length;
 if(failed) return {cls:'red',label:'Handlungsbedarf'};
 if(open>=3) return {cls:'amber',label:'Offene Punkte'};
 return {cls:'green',label:'Im Plan'};
}
function derivedNotifications(){
 const out=[];
 if(current?.role==='recruit'){
  const goals=(current.goals||[]).filter(g=>!g.done); if(goals.length) out.push(`${goals.length} offene Ausbildungsziel${goals.length===1?'':'e'}`);
  if((current.assignedTests||[]).length) out.push(`${current.assignedTests.length} zugewiesene${current.assignedTests.length===1?'r Test':' Tests'}`);
  if(progress(current)===100) out.push('Ausbildung vollständig – Abschlussprüfung/Freigabe prüfen');
 } else if(isTrainer(current)) {
  const rs=db.users.filter(x=>apdActiveRecruit(x)), att=rs.filter(r=>attentionCount(r)>0).length;
  if(att) out.push(`${att} Recruit${att===1?'':'s'} benötigen Aufmerksamkeit`);
  const ready=rs.filter(r=>progress(r)===100).length; if(ready) out.push(`${ready} Recruit${ready===1?' ist':'s sind'} abschlussbereit`);
 }
 return out;
}
function installNotificationBell(){
 const host=document.querySelector('.top-actions'); if(!host)return;
 const unread=(typeof v62Unread==="function"?v62Unread():0);
 let b=host.querySelector('.notify-btn');
 if(!b){b=document.createElement('button');b.className='notify-btn';b.title='Benachrichtigungen';b.onclick=(e)=>{e.preventDefault();e.stopPropagation();openWorkflowNotifications()};host.insertBefore(b,host.querySelector('.user-pill'))}
 b.innerHTML=`🔔${unread?`<i>${unread}</i>`:''}`;
 let mail=host.querySelector('.v622-mail-top');
 if(!mail){mail=document.createElement('button');mail.className='v622-mail-top';mail.title='Postfach';mail.onclick=(e)=>{e.preventDefault();e.stopPropagation();messagesView()};host.insertBefore(mail,b)}
 mail.innerHTML=`<span>📬</span>${unread?`<i>${unread}</i>`:''}`;
}
function openRecruitQuickPanel(id){
 document.querySelector('.quick-panel')?.remove();document.querySelector('.quick-backdrop')?.remove();
 const r=db.users.find(x=>x.id===id);if(!r)return;const sig=recruitSignal(r),open=(r.goals||[]).filter(g=>!g.done),failed=(r.testResults||[]).filter(t=>!t.passed);
 const back=document.createElement('div');back.className='quick-backdrop';const p=document.createElement('aside');p.className='quick-panel';p.innerHTML=`<button class="quick-close">×</button><div class="eyebrow">RECRUIT-SCHNELLAKTE</div><div class="quick-person"><div class="quick-avatar">${esc((r.name||'MRPD').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase())}</div><div><h2>${esc(r.name)}</h2><small>${esc(r.rank||'Recruit')} · Badge ${esc(r.serviceNo||'—')}</small></div></div><div class="signal ${sig.cls}"><i></i>${sig.label}</div><div class="quick-progress"><div><b>Ausbildungsfortschritt</b><strong>${progress(r)}%</strong></div><div class="progress"><i style="width:${progress(r)}%"></i></div></div><div class="quick-grid"><div><small>Leiter FTO</small><b>${esc(r.fto||'—')}</b></div><div><small>Phase</small><b>${esc(stage(r))}</b></div><div><small>Offene Ziele</small><b>${open.length}</b></div><div><small>FTO-Berichte</small><b>${(r.reports||[]).length}</b></div></div>${open.length?`<div class="quick-section"><b>Nächste Aufgaben</b>${open.slice(0,3).map(g=>`<p>📌 ${esc(g.text)}</p>`).join('')}</div>`:''}${failed.length?`<div class="quick-section danger"><b>Prüfung beachten</b><p>⚠ ${failed.length} nicht bestandene Prüfung(en)</p></div>`:''}<div class="quick-actions"><button class="primary" data-full-record>📂 Ausbildungsakte öffnen</button><button class="secondary" data-close>Schließen</button></div>`;
 document.body.append(back,p);const close=()=>{p.remove();back.remove()};back.onclick=close;p.querySelector('.quick-close').onclick=close;p.querySelector('[data-close]').onclick=close;p.querySelector('[data-full-record]').onclick=()=>{close();recruitRecordClosed=false;selectedRecruit=r.id;admin()};
}
const _adminV45=admin;admin=function(){_adminV45();if(!isTrainer(current))return;const rows=[...document.querySelectorAll('.recruit-row')];rows.forEach(row=>{const btn=row.querySelector('[data-edit]');if(!btn)return;const id=btn.dataset.edit, r=db.users.find(x=>x.id===id);if(!r)return;const sig=recruitSignal(r);if(!row.querySelector('.recruit-signal'))row.querySelector('div')?.insertAdjacentHTML('beforeend',`<span class="recruit-signal ${sig.cls}"><i></i>${sig.label}</span>`);if(!row.querySelector('[data-quick]')){const q=document.createElement('button');q.className='secondary quick-record-btn';q.dataset.quick=id;q.textContent='👁 Schnellakte';btn.before(q);q.onclick=()=>openRecruitQuickPanel(id)}});
 const filter=$('#adminFilter'),sort=$('#adminSort');const apply=()=>{const q=($('#adminSearch')?.value||'').toLowerCase(),f=filter?.value||'Alle';rows.forEach(row=>{const id=row.querySelector('[data-edit]')?.dataset.edit,r=db.users.find(x=>x.id===id);if(!r)return;const matchQ=(row.dataset.search||row.textContent.toLowerCase()).includes(q);const s=statusName(r);const matchF=f==='Alle'||(f==='In Ausbildung'&&s==='In Ausbildung')||(f==='Abgeschlossen'&&s==='Abgeschlossen')||(f==='Archiviert'&&s==='Archiviert');row.style.display=matchQ&&matchF?'':'none'});if(sort){const parent=rows[0]?.parentElement;if(parent){[...rows].sort((a,b)=>{const ra=db.users.find(x=>x.id===a.querySelector('[data-edit]')?.dataset.edit),rb=db.users.find(x=>x.id===b.querySelector('[data-edit]')?.dataset.edit);if(sort.value==='Fortschritt')return progress(rb)-progress(ra);if(sort.value==='Dienstnummer')return String(ra?.serviceNo||'').localeCompare(String(rb?.serviceNo||''),'de',{numeric:true});return String(ra?.name||'').localeCompare(String(rb?.name||''),'de')}).forEach(x=>parent.appendChild(x))}}};$('#adminSearch')?.addEventListener('input',apply);filter?.addEventListener('change',apply);sort?.addEventListener('change',apply);apply();installNotificationBell()};
const _dashboardV45=dashboard;dashboard=function(){_dashboardV45();installNotificationBell();if(current.role==='recruit'){const c=$('#content'),open=(current.goals||[]).filter(g=>!g.done);const anchor=c.querySelector('.dashboard-two')||c.querySelector('.stats');if(anchor){const done=progress(current)===100;anchor.insertAdjacentHTML('beforebegin',`${done?`<div class="graduation-banner"><span>🏅</span><div><small>Mission Row Police Department</small><h2>AUSBILDUNG VOLLSTÄNDIG</h2><p>Alle 22 Kapitel sind abgeschlossen. Abschlussprüfung und finale Freigabe können geprüft werden.</p></div></div>`:''}<div class="card today-card"><div class="section-head compact"><div><div class="eyebrow">📋 HEUTE IM FOKUS</div><h2>Meine nächsten Aufgaben</h2></div><span class="state-badge">${Math.min(open.length,3)} Aufgaben</span></div>${open.length?open.slice(0,3).map((g,i)=>`<div class="today-task"><span>${i+1}</span><div><b>${esc(g.text)}</b><small>Vom FTO gesetztes Ausbildungsziel</small></div></div>`).join(''):`<p class="muted">Keine offenen Aufgaben – aktuell alles erledigt.</p>`}</div>`)} }};
const _showViewV45=showView;showView=function(v){const x=_showViewV45(v);setTimeout(installNotificationBell,0);return x};

/* ===== V4.6 Recruit Motivation & Learning UX ===== */
function recruitXP(u){
 const passed=(u.testResults||[]).filter(x=>x.passed).length;
 const goals=(u.goals||[]).filter(x=>x.done).length;
 const quals=qualifications(u).filter(x=>x[2]).length;
 return (u.completed||[]).length*120+passed*250+goals*60+quals*100;
}
function recruitLevel(u){return Math.max(1,Math.floor(recruitXP(u)/500)+1)}
function learningStreak(u){
 const days=[...new Set((u.activity||[]).filter(x=>x.when).map(x=>new Date(x.when).toISOString().slice(0,10)))].sort().reverse();
 if(!days.length)return 0;let streak=1;
 for(let i=1;i<days.length;i++){const a=new Date(days[i-1]+'T12:00:00'),b=new Date(days[i]+'T12:00:00');if(Math.round((a-b)/86400000)===1)streak++;else break}
 return streak;
}
function personalBadges(u){
 const q=qualifications(u).filter(x=>x[2]).map(x=>({icon:x[0],name:x[1]}));
 if((u.completed||[]).length>=1)q.unshift({icon:'🚀',name:'Erstes Kapitel'});
 if((u.completed||[]).length>=11)q.push({icon:'⚡',name:'Halbzeit'});
 if(progress(u)===100)q.push({icon:'🏆',name:'Academy Complete'});
 if((u.testResults||[]).some(x=>x.passed&&Number(x.score)>=100))q.push({icon:'💯',name:'Perfect Test'});
 return q.slice(0,10);
}
function missionData(u){
 const passed=(u.testResults||[]).filter(x=>x.passed).length;
 return [
  {icon:'📘',text:'Ein Ausbildungskapitel abschließen',done:(u.completed||[]).length>0,sub:`${(u.completed||[]).length}/22 Kapitel`},
  {icon:'🧠',text:'Einen Wissenstest bestehen',done:passed>0,sub:`${passed} bestanden`},
  {icon:'⭐',text:'Ein Kapitel als Favorit merken',done:(u.favorites||[]).length>0,sub:`${(u.favorites||[]).length} Favoriten`}
 ];
}
function allPracticeQuestions(){return TESTS.flatMap(t=>t.questions.map(q=>({...q,area:t.title})))}
function renderPracticeQuiz(host){
 const qs=allPracticeQuestions(); if(!qs.length)return;
 const q=qs[Math.floor(Math.random()*qs.length)];
 host.innerHTML=`<div class="eyebrow">🧠 SCHNELLQUIZ</div><h2>Eine Frage zwischendurch</h2><p class="quiz-area">${esc(q.area)}</p><h3>${esc(q.q)}</h3><div class="practice-options">${q.a.map((a,i)=>`<button class="practice-answer" data-a="${i}">${esc(a)}</button>`).join('')}</div><div class="practice-feedback"></div><button class="secondary practice-next" style="display:none">Nächste Frage →</button>`;
 host.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{const ok=+b.dataset.a===q.c;host.querySelectorAll('[data-a]').forEach(x=>{x.disabled=true;x.classList.toggle('correct',+x.dataset.a===q.c);if(x===b&&!ok)x.classList.add('wrong')});host.querySelector('.practice-feedback').innerHTML=ok?'✓ Richtig – stark!':'↻ Noch nicht ganz. Die richtige Antwort ist markiert.';host.querySelector('.practice-next').style.display='inline-flex'});
 host.querySelector('.practice-next').onclick=()=>renderPracticeQuiz(host);
}
function addMotivationDashboard(){
 const c=$('#content');if(!c||c.querySelector('.motivation-zone'))return;
 const target=current.role==='recruit'?current:(db.users.find(x=>x.role==='recruit')||current);
 const preview=current.role!=='recruit';
 const xp=recruitXP(target),lvl=recruitLevel(target),next=lvl*500,xpIn=xp-(lvl-1)*500,streak=learningStreak(target),badges=personalBadges(target),missions=missionData(target),p=progress(target);
 const milestone=p>=100?'100% · Ausbildung komplett':p>=75?'75% · Endspurt':p>=50?'50% · Halbzeit erreicht':p>=25?'25% · Erste Etappe geschafft':'Nächstes Ziel · 25%';
 const html=`<section class="motivation-zone">${preview?`<div class="motivation-preview"><span>🎮 RECRUIT-MOTIVATION · VORSCHAU</span><b>${esc(target.name||'Recruit')}</b><small>So sieht ein Recruit Level, XP, Lernserie, Missionen und Abzeichen.</small></div>`:''}<div class="motivation-top"><div class="card xp-card"><div class="eyebrow">⭐ AUSBILDUNGS-XP</div><div class="xp-main"><strong>LEVEL ${lvl}</strong><span>${xp} XP</span></div><div class="progress xp-progress"><i style="width:${Math.min(100,(xpIn/500)*100)}%"></i></div><small>${Math.max(0,next-xp)} XP bis Level ${lvl+1}</small></div><div class="card streak-card"><span>🔥</span><div><div class="eyebrow">LERNSERIE</div><h2>${streak} Tag${streak===1?'':'e'}</h2><small>Persönlicher Lernrhythmus</small></div></div><div class="card milestone-card"><span>🎯</span><div><div class="eyebrow">MEILENSTEIN</div><h2>${milestone}</h2><small>${(target.completed||[]).length} von 22 Kapiteln</small></div></div></div><div class="motivation-grid"><div class="card"><div class="eyebrow">🎯 TAGESMISSIONEN</div><h2>Kleine Ziele, sichtbarer Fortschritt</h2><div class="mission-list">${missions.map(m=>`<div class="mission ${m.done?'done':''}"><span>${m.done?'✓':m.icon}</span><div><b>${esc(m.text)}</b><small>${esc(m.sub)}</small></div></div>`).join('')}</div></div><div class="card badge-card"><div class="eyebrow">🏅 MEINE ABZEICHEN</div><h2>Erreichte Meilensteine</h2><div class="badge-shelf">${badges.length?badges.map(b=>`<div class="learning-badge"><span>${b.icon}</span><b>${esc(b.name)}</b></div>`).join(''):'<p class="muted">Schließe dein erstes Kapitel ab, um dein erstes Abzeichen zu erhalten.</p>'}</div></div><div class="card practice-card"></div></div></section>`;
 const chapterHead=[...c.querySelectorAll('.section-head')].find(x=>x.textContent.includes('Ausbildungskapitel'));
 if(chapterHead)chapterHead.insertAdjacentHTML('beforebegin',html);else c.insertAdjacentHTML('beforeend',html);
 renderPracticeQuiz(c.querySelector('.practice-card'));
}
const _dashboardV46=dashboard;dashboard=function(){_dashboardV46();addMotivationDashboard()};
function chapterIntro(n){
 if(current.role!=='recruit')return;const key=`alta_intro_${current.id}_${n}`;if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,'1');
 const c=CHAPTERS[n];if(!c)return;const o=document.createElement('div');o.className='chapter-intro';o.innerHTML=`<div class="chapter-intro-bg" style="background-image:url('${chapterBannerImages[n]}')"></div><div class="chapter-intro-shade"></div><div class="chapter-intro-content"><div class="eyebrow">Mission Row Police Department · AUSBILDUNG</div><div class="intro-number">KAPITEL ${String(chapterNumber(n)).padStart(2,'0')}</div><h1>${esc(c.title)}</h1><p>${current.completed.includes(n)?'✓ Bereits abgeschlossen':'Bereit für den nächsten Ausbildungsschritt?'}</p><button class="primary">Kapitel starten →</button></div>`;document.body.appendChild(o);const close=()=>{o.classList.add('leaving');setTimeout(()=>o.remove(),220)};o.querySelector('button').onclick=close;o.onclick=e=>{if(e.target===o)close()};
}
const _showChapterV46=showChapter;showChapter=async function(n){const r=await _showChapterV46(n);setTimeout(()=>chapterIntro(n),80);return r};


// ===== V4.7 Daily workflow helpers =====
function workflowNotifications(){
 if(!current)return [];
 if(current.role==="recruit"){
  const n=[]; const open=(current.goals||[]).filter(x=>!x.done);
  if(open.length)n.push(`🎯 ${open.length} offene${open.length===1?"s":""} Ausbildungsziel${open.length===1?"":"e"}`);
  if((current.assignedTests||[]).length)n.push(`📝 ${(current.assignedTests||[]).length} freigegebene Tests`);
  if(progress(current)<100)n.push(`📚 Noch ${22-(current.completed||[]).length} Kapitel bis 100 %`);
  return n;
 }
 const rs=db.users.filter(x=>apdActiveRecruit(x)), n=[];
 const att=rs.filter(x=>readiness(x)[0]==="Handlungsbedarf").length;if(att)n.push(`⚠️ ${att} Recruit${att===1?"":"s"} mit Handlungsbedarf`);
 const ready=rs.filter(x=>readiness(x)[0]==="Abschlussbereit").length;if(ready)n.push(`🎓 ${ready} Recruit${ready===1?"":"s"} abschlussbereit`);
 const open=rs.reduce((a,x)=>a+(x.goals||[]).filter(g=>!g.done).length,0);if(open)n.push(`🎯 ${open} offene Ausbildungsziele`);
 return n;
}
function openWorkflowNotifications(){
 document.querySelector(".workflow-pop")?.remove();
 const n=[], unread=(typeof v62Unread==="function"?v62Unread():0);
 const recent=((db.messages||[]).filter(x=>x.recipient_id===current?.id&&!x.read_at)).slice(0,4);
 const d=document.createElement("div");d.className="workflow-pop";
 d.innerHTML=`<div class="workflow-pop-head"><b>🔔 Benachrichtigungen</b><button type="button">×</button></div>
 ${recent.length?`<div class="notify-mail-head"><span>✉️ Postfach</span><b>${unread} ungelesen</b></div>${recent.map(x=>`<button class="notify-mail-row" data-notify-mail="${x.id}"><span>✉️</span><div><b>${esc(x.subject||"Neue Nachricht")}</b><small>${esc(typeof v62UserLabel==="function"?v62UserLabel(x.sender_id):"MRPD")}</small></div><strong>›</strong></button>`).join("")}`:""}
 ${n.length?n.map(x=>`<div class="workflow-note">${esc(x)}</div>`).join(""):(!recent.length?`<div class="workflow-note">✓ Aktuell nichts offen.</div>`:"")}
 <button class="notify-open-mail" type="button">Postfach öffnen →</button>`;
 document.body.appendChild(d);d.querySelector(".workflow-pop-head button").onclick=()=>d.remove();
 d.querySelector(".notify-open-mail").onclick=()=>{d.remove();messagesView()};
 d.querySelectorAll("[data-notify-mail]").forEach(b=>b.onclick=()=>{d.remove();messagesView();setTimeout(()=>document.querySelector(`[data-mail="${b.dataset.notifyMail}"]`)?.scrollIntoView({behavior:"smooth",block:"center"}),60)});
}
async function printRecruitRecord(r){
 const w=window.open("","_blank","width=1120,height=900");
 if(!w){alert("Pop-up wurde blockiert. Bitte Pop-ups für diese Seite erlauben.");return}

 const documentBrand=window.APD_SHEETS?.brandAssets?.()||{};
 let savedDocumentSheets='',savedRecord=null;
 if(!window.APD_RECORD_EDITOR){w.close();alert('Die Datei record-documents.js fehlt. Bitte das aktuelle Update vollständig hochladen.');return}
 try{savedRecord=await window.APD_RECORD_EDITOR.load(r)}catch(error){w.close();alert(error.message);return}
 const recordFields=savedRecord?.fields||{};
 const completedCount=Number.isInteger(recordFields.chapters)?Math.max(0,Math.min(22,recordFields.chapters)):r.completed.length;
 try{if(window.APD_SHEETS)savedDocumentSheets=await window.APD_SHEETS.printAttachments(r)}
 catch(error){w.close();alert(error.message);return}
 const ev=recordFields.evaluation??(typeof v53Eval==="function"?v53Eval(r.id):null);
 const appointments=typeof v53Upcoming==="function"?v53Upcoming(r.id):[];
 const audit=typeof v53Audit==="function"?v53Audit(r.id):[];
 const quals=typeof qualifications==="function"?qualifications(r):[];
 const tests=Array.isArray(recordFields.tests)?recordFields.tests:(r.testResults||[]).slice().reverse().map(t=>({...t,title:TESTS.find(x=>x.id===t.testId)?.title||t.testId}));
 const reports=Array.isArray(recordFields.reports)?recordFields.reports:(r.reports||[]).slice().reverse();
 const goals=Array.isArray(recordFields.goals)?recordFields.goals:r.goals||[];
 const notes=Array.isArray(recordFields.notes)?recordFields.notes:(r.notes||[]).slice().reverse();
 const doneChapters=new Set(r.completed||[]);
 const pct=Math.round(completedCount/22*100);
 const passedTests=tests.filter(x=>x.passed).length;
 const totalMinutes=reports.reduce((sum,x)=>sum+(+x.duration||0),0);
 const printDate=new Date().toLocaleString("de-DE");
 const safe=v=>esc(v||"—");
 const fmt=v=>{try{return v?new Date(v).toLocaleString("de-DE"):"—"}catch{return v||"—"}};

 const testRows=window.APD_RECORD_EDITOR.entriesHtml('tests',tests);
 const reportRows=window.APD_RECORD_EDITOR.reportHtml(reports);
 const goalRows=window.APD_RECORD_EDITOR.entriesHtml('goals',goals);
 const qualRows=window.APD_RECORD_EDITOR.qualificationHtml(quals,recordFields);
 const noteRows=window.APD_RECORD_EDITOR.entriesHtml('notes',notes);
 const appointmentRows=appointments.length?appointments.map(a=>`<div class="line-item"><span class="calendar">▣</span><div><b>${safe(a.title)}</b><small>${fmt(a.starts_at)} · ${safe(a.location||"Ort offen")}${a.notes?" · "+safe(a.notes):""}</small></div></div>`).join(""):`<p class="empty">Keine kommenden Ausbildungstermine.</p>`;
 const auditRows=audit.length?audit.slice(0,30).map(a=>`<div class="audit"><span>${fmt(a.created_at)}</span><b>${safe(a.action)}</b><small>${safe(a.actor_name||"System")}${a.details?" · "+safe(a.details):""}</small></div>`).join(""):`<p class="empty">Kein Änderungsverlauf vorhanden.</p>`;

 w.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Ausbildungsakte - ${safe(r.name)}</title>
 <style>
 @page{size:A4;margin:12mm}
 *{box-sizing:border-box}
 body{margin:0;background:#eef3f8;color:#172536;font:13px/1.45 Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
 .sheet{max-width:1000px;margin:24px auto;background:white;box-shadow:0 12px 40px #1a2d401f}
 .hero{background:linear-gradient(135deg,#06192b,#0a3152 62%,#075d91);color:white;padding:30px 34px;display:flex;justify-content:space-between;gap:24px;align-items:center;border-bottom:5px solid #28a9ff}
 .brand{display:flex;align-items:center;gap:18px}.brand img{width:72px;height:72px;object-fit:contain;background:#fff;border-radius:50%;padding:7px}
 .brand small{letter-spacing:2.2px;color:#71c8ff;font-weight:700}.brand h1{font-size:27px;margin:4px 0 0}.docno{text-align:right}.docno b{display:block;font-size:14px}.docno span{font-size:11px;color:#c4dded}
 .content{padding:28px 34px 34px}.identity{display:grid;grid-template-columns:1.4fr .6fr;gap:18px;margin-bottom:20px}
 .identity-card,.progress-card,.section{border:1px solid #dbe5ed;border-radius:12px;background:#fff}
 .identity-card{padding:20px}.identity-card .kicker,.section-title small{color:#1687ca;font-size:10px;letter-spacing:1.7px;font-weight:800}
 .identity-card h2{font-size:25px;margin:3px 0 14px}.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
 .meta div{background:#f5f8fb;border-radius:8px;padding:9px 11px}.meta small,.kpi small,.entry-grid small{display:block;color:#718090;font-size:10px;text-transform:uppercase;letter-spacing:.7px}.meta b{font-size:13px}
 .progress-card{padding:18px;text-align:center;background:#f7fbfe}.circle{width:105px;height:105px;border-radius:50%;margin:0 auto 10px;display:grid;place-items:center;background:conic-gradient(#169fe8 ${pct}%,#dce7ef 0);position:relative}.circle:after{content:"";position:absolute;width:78px;height:78px;border-radius:50%;background:#f7fbfe}.circle strong{position:relative;z-index:1;font-size:25px;color:#083c60}.progress-card b{font-size:14px}.progress-card p{margin:4px 0;color:#667788}
 .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:20px}.kpi{padding:13px;border-radius:9px;background:#071d31;color:#fff}.kpi small{color:#74bce7}.kpi b{display:block;font-size:17px;margin-top:3px}
 .section{padding:18px 20px;margin:0 0 18px;break-inside:avoid}.section-title{display:flex;justify-content:space-between;align-items:end;border-bottom:2px solid #e7eef4;padding-bottom:9px;margin-bottom:13px}.section-title h3{font-size:17px;margin:2px 0}.section-title span{font-size:11px;color:#718090}
 table{width:100%;border-collapse:collapse}th{background:#edf5fa;color:#31546c;text-transform:uppercase;font-size:9px;letter-spacing:.6px}th,td{padding:8px 9px;border-bottom:1px solid #e6edf2;text-align:left;vertical-align:top}.num{width:38px;font-weight:bold;color:#1687ca}
 .badge{display:inline-block;padding:3px 7px;border-radius:99px;font-size:9px;font-weight:800}.green{background:#e0f5e9;color:#167444}.red{background:#ffe7e7;color:#a92f2f}.gray{background:#edf1f4;color:#687785}
 .two{display:grid;grid-template-columns:1fr 1fr;gap:18px}.line-item,.qual{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid #edf1f4}.line-item:last-child,.qual:last-child{border-bottom:0}.line-item small,.qual small{display:block;color:#758492;margin-top:2px}.check,.calendar,.qual>span{width:24px;height:24px;border-radius:50%;background:#edf2f5;display:grid;place-items:center;font-weight:bold;flex:none}.check.done,.qual>span:first-child{color:#1687ca}
 .entry{border:1px solid #e0e8ee;border-radius:9px;padding:13px;margin:10px 0;break-inside:avoid}.entry-head{display:flex;justify-content:space-between}.entry-head span,.entry-meta{color:#718090;font-size:11px}.entry-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:9px}.entry-grid div{background:#f6f9fb;border-radius:7px;padding:9px}.entry-grid p{margin:3px 0 0;white-space:pre-wrap}
 .evaluation{background:linear-gradient(135deg,#f5fbff,#edf7fc);border-left:5px solid #168fd2}.eval-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.eval-box{background:white;border:1px solid #dce8ef;border-radius:8px;padding:12px}.eval-box.wide{grid-column:1/-1}.eval-box p{white-space:pre-wrap;margin:5px 0}.result{display:inline-block;margin-top:10px;padding:6px 10px;background:#09253b;color:white;border-radius:6px;font-weight:bold}
 .note{border-left:3px solid #80b9da;padding:7px 11px;margin:9px 0;background:#f8fafc}.note>div{display:flex;justify-content:space-between;font-size:11px}.note p{margin:5px 0;white-space:pre-wrap}
 .audit{display:grid;grid-template-columns:130px 1fr;gap:2px 12px;padding:7px 0;border-bottom:1px solid #edf1f4}.audit span{color:#718090;font-size:10px}.audit small{grid-column:2;color:#718090}
 .signatures{display:grid;grid-template-columns:1fr 1fr;gap:45px;margin-top:38px}.signature{padding-top:28px;border-top:1px solid #536778;text-align:center;color:#5d6b77;font-size:11px}
 .footer{padding:12px 34px 22px;color:#7b8995;font-size:9px;display:flex;justify-content:space-between}.empty{color:#788894;font-style:italic}
 .export-toolbar{position:fixed;z-index:1000;right:18px;bottom:18px;display:flex;gap:9px;align-items:center;background:#09253b;padding:11px;border-radius:12px;box-shadow:0 8px 28px #0004}
 .export-toolbar button{background:#0b8ed8;color:#fff;border:0;border-radius:8px;padding:11px 15px;font-weight:bold;cursor:pointer}
 .export-toolbar button:disabled{opacity:.55;cursor:wait}
 .export-toolbar #exportStatus{color:#fff;font-size:12px;max-width:230px}
 .sheet{overflow:visible}
 @media screen{.section{break-inside:auto}}

 @media print{body{background:#fff}.sheet{margin:0;box-shadow:none;max-width:none}.export-toolbar{display:none}.section{break-inside:auto}.entry,.evaluation,.identity,.kpis{break-inside:avoid}.hero{border-radius:0}}

 .hero{position:relative;isolation:isolate;overflow:hidden;padding:34px;min-height:210px;background:#071d31;border-bottom:4px solid #28b9ef}
 .hero:before{content:"";position:absolute;z-index:-2;inset:0;background:url('${documentBrand.scene||'image26.png'}') center 39%/cover no-repeat;opacity:.75}
 .hero:after{content:"";position:absolute;z-index:-1;inset:0;background:linear-gradient(90deg,#04182af5 8%,#061e32d9 48%,#061e3255)}
 .hero .brand{display:flex;gap:20px;align-items:center}.hero .brand img{width:112px;height:108px;object-fit:contain;filter:drop-shadow(0 5px 16px #0009);background:transparent;border-radius:0;padding:0}
 .hero .brand small{letter-spacing:2.3px;color:#84d9ff;font-size:10px}.hero h1{font-size:36px;letter-spacing:-1px;margin:8px 0}.hero-motto{font-size:8px;letter-spacing:1.3px;color:#aecddd;margin:0}
 .hero .docno{border-left:2px solid #d4a354;padding-left:15px;font-size:9px;color:#d5e4ed;background:#061d3166;padding:13px 15px;border-radius:0 8px 8px 0;flex-shrink:0}
 .identity-card{border-top:3px solid #159ac8;border-radius:12px;background:linear-gradient(120deg,#f1f8fd,#fff)}.identity-card h2{color:#102f48;font-size:29px;letter-spacing:-.6px}
 .kpi{border:1px solid #d6e4ee;border-top:3px solid #209cc6;border-radius:10px;background:linear-gradient(145deg,#f4faff,#fff);box-shadow:0 5px 14px #0f385409}.kpi:nth-child(2),.kpi:nth-child(5){border-top-color:#d0a052}.kpi b{color:#102f48}.kpi small{color:#526f82}
 .section{border-radius:12px;border:1px solid #dae6ee;box-shadow:0 4px 15px #0e2f4c06}.section-title{border-bottom:1px solid #e0eaf2;padding-bottom:11px}.section-title h3{color:#102f48}.section-title small{color:#187da7;letter-spacing:1.6px}
 .section-title h3:before{content:'◆';font-size:10px;color:#d4a354;margin-right:9px}.badge{border-radius:20px}.note{border-radius:0 9px 9px 0}
 .apd-saved-sheet{padding:14px!important;background:#f4f8fc}.apd-saved-sheet img{border-radius:8px;border:1px solid #dce7ef}
 .footer{border-top:1px solid #d9e7f0;background:#f5f9fc;padding-top:15px}.signature{border-top-color:#2087b2}
 @media print{.hero{min-height:155px;padding:22px}.hero .brand img{width:90px;height:85px}.hero h1{font-size:30px}.section{box-shadow:none}.hero .docno{font-size:8px}}

 .doc-help{display:flex;flex-direction:column;gap:4px;padding:13px 16px;border:1px solid #a4d4eb;border-radius:10px;background:#edf8ff;margin-bottom:18px;color:#23485f;font-size:11px}.doc-help b{font-size:14px}
 .doc-count-label{display:grid;gap:6px;margin-top:15px;color:#527086;font-size:11px}.doc-count-label input{width:85px;margin:auto;font:bold 20px Arial;text-align:center;padding:7px;border:1px solid #87b9d4;border-radius:8px;color:#123b55;background:#fff}
 .doc-modules{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.doc-module{display:flex;gap:10px;align-items:center;background:#f1f8fc;border:1px solid #c5dce9;border-radius:10px;padding:14px}.doc-module small{display:block;font-size:10px;color:#668295}.doc-module input,.doc-qualification input{width:19px;height:19px;accent-color:#148eae;flex:none}.doc-qualification{cursor:pointer;align-items:center}.doc-qualification>span{width:auto;height:auto;display:block;background:none;border-radius:0}.doc-checked b{color:#087563}
 .doc-report-meta{display:grid;grid-template-columns:1fr .7fr 1.4fr;gap:10px;margin-top:10px}.doc-report-meta label{display:grid;font-size:10px;color:#527087;gap:4px}.doc-report-meta input{width:100%;font:12px Arial;border:1px solid #bfd4e2;border-radius:6px;padding:7px;background:#fff;color:#183b52;min-width:0}
 .doc-editable{min-height:45px;outline:none;border:1px dashed #b6d1e2;border-radius:6px;padding:7px!important;overflow-wrap:anywhere;white-space:pre-wrap!important}.doc-editable:focus{border-color:#168fc1;background:#fff}.doc-editable:empty:before{content:'Hier eintragen …';color:#92a8b7;font-style:italic}
 button.doc-control,.doc-savebar button{border:1px solid #257b9d;background:#126a8d;color:#fff;font:700 11px Arial;border-radius:7px;padding:8px 12px;cursor:pointer}.entry-head button.doc-control{color:#a34040;background:#fff7f5;border-color:#e6bab4}
 .doc-savebar{position:sticky;top:0;z-index:1001;padding:11px 18px;background:#0c2d43;display:flex;align-items:center;gap:14px;color:#d6ecf8;font:11px Arial;box-shadow:0 4px 14px #0002}.doc-savebar button{background:#087f87}.doc-savebar button:disabled{opacity:.5}.doc-savebar span{max-width:75%}.sheet{margin-bottom:100px}
 @media(max-width:700px){.doc-modules,.doc-report-meta{grid-template-columns:1fr}.doc-savebar{flex-wrap:wrap}.doc-savebar span{max-width:100%}}
 @media print{.doc-control,.doc-savebar{display:none!important}.doc-editable{border:0;padding:0!important;min-height:0}.doc-editable:empty:before{content:''}.doc-report-meta input,.doc-count-label input{border:0;background:transparent;padding:0}.sheet{margin-bottom:0}.doc-report{break-inside:avoid}}

 .doc-result-label{display:grid;gap:6px;margin-top:14px;color:#44647a;font-size:11px}.doc-result-label select{padding:9px;border:1px solid #b6d1e2;border-radius:7px;background:#fff;color:#173e58;font:12px Arial;max-width:320px}
 .doc-item{background:#fbfdff}.doc-goal-check{display:flex;align-items:center;gap:8px;font-size:12px;color:#315b70;margin:9px 0}.doc-goal-check input{width:18px;height:18px;accent-color:#148eae}
 .doc-item small{font-size:10px;display:block;color:#567387}.doc-item [data-entry-percent]{display:block;margin-top:8px;color:#123b55;font-size:16px}
 @media print{.doc-result-label select{appearance:none;border:0;background:none;padding:0}.doc-editable:empty{min-height:12px}}

 .hero>.hero-scene{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 39%;z-index:0;opacity:.75}.hero:before{display:none}.hero:after{z-index:1}.hero>.brand,.hero>.docno{position:relative;z-index:2}
 </style></head><body><div class="sheet">
 <header class="hero">${documentBrand.scene?`<img class="hero-scene" src="${documentBrand.scene}" alt="MRPD Officers vor der Skyline">`:""}<div class="brand"><img src="${documentBrand.logo||'assets/mrpd-logo.svg'}"><div><small>Mission Row Police Department</small><h1>Gesamtakte</h1><p class="hero-motto">DIENST VERSTEHEN. VERANTWORTUNG ÜBERNEHMEN.</p></div></div><div class="docno"><b>RECRUIT TRAINING DIVISION</b><span data-record-saved-at>Stand: ${savedRecord?fmt(savedRecord.updated_at):printDate}</span></div></header>
 <main class="content">
 <div class="doc-control doc-help"><b>✎ Bearbeitbare Gesamtakte</b><span>Alle Felder mit Rahmen direkt bearbeiten. Ziele, Prüfungen, Notizen und Praxisberichte lassen sich hinzufügen und entfernen. Beim PNG-/JPEG-Export wird der aktuelle Stand zuerst gespeichert. Änderungen gelten für dieses Dokument; die Ausbildungsdaten und Freigaben im Portal bleiben unverändert.</span></div>
  <section class="identity"><div class="identity-card"><div class="kicker">AKTENINHABER / RECRUIT</div><h2>${safe(r.name)}</h2><div class="meta"><div><small>Dienstnummer</small><b>${safe(r.serviceNo)}</b></div><div><small>Benutzername</small><b>${safe(r.username)}</b></div><div><small>Rang</small><b>${safe(r.rank||"Recruit")}</b></div><div><small>Status</small><b>${safe(r.status)}</b></div><div><small>Leiter FTO</small><b>${safe(r.fto)}</b></div><div><small>Weiterer FTO</small><b>${safe(r.secondaryFto)}</b></div><div><small>Ausbildungsbeginn</small><b>${r.start?new Date(r.start+"T00:00:00").toLocaleDateString("de-DE"):"—"}</b></div><div><small>Ausbildungsphase</small><b>${safe(stage(r))}</b></div></div></div>
  <div class="progress-card"><div class="circle"><strong data-document-percent>${pct}%</strong></div><b>Gesamtfortschritt</b><p><span data-document-chapters>${completedCount}</span> von 22 Kapiteln</p><label class="doc-count-label">Abgeschlossene Kapitel<input id="recordChapterCount" type="number" min="0" max="22" step="1" value="${completedCount}"></label></div></section>
  <div class="kpis"><div class="kpi"><small>Kapitel</small><b><span data-document-chapters>${completedCount}</span>/22</b></div><div class="kpi"><small>Tests bestanden</small><b><span data-document-passed-tests>${passedTests}</span> bestanden</b></div><div class="kpi"><small>Praxisberichte</small><b data-document-report-count>${reports.length}</b></div><div class="kpi"><small>Ausbildungszeit</small><b data-document-minutes>${fmtDuration(totalMinutes)}</b></div><div class="kpi"><small>Offene Ziele</small><b data-document-goal-count>${goals.filter(g=>!g.done).length}</b></div></div>

  <section class="section evaluation"><div class="section-title"><div><small>FTO-ABSCHLUSSBEWERTUNG</small><h3>Bewertung & Empfehlung</h3></div><span data-record-evaluation-meta>${savedRecord?`${fmt(savedRecord.updated_at)} · ${safe(savedRecord.author_name||"FTO")}`:ev?`${fmt(ev.updated_at||ev.created_at)} · ${safe(ev.author_name||"FTO")}`:"Noch keine Abschlussbewertung"}</span></div>
   ${window.APD_RECORD_EDITOR.evaluationHtml(ev||{})}
  </section>

  ${window.APD_RECORD_EDITOR.moduleHtml(recordFields)}
  <div class="two"><section class="section"><div class="section-title"><div><small>AUSBILDUNGSZIELE</small><h3>Ziele & Status</h3></div></div><div data-document-list="goals">${goalRows}</div>${window.APD_RECORD_EDITOR.emptyAndAdd('goals','Ziel hinzufügen')}</section><section class="section"><div class="section-title"><div><small>FREIGABEN</small><h3>Qualifikationen</h3></div></div>${qualRows}</section></div>



  <section class="section"><div class="section-title"><div><small>PRÜFUNGEN</small><h3>Test- und Prüfungsergebnisse</h3></div><span><span data-document-passed-tests>${passedTests}</span> bestanden</span></div><div data-document-list="tests">${testRows}</div>${window.APD_RECORD_EDITOR.emptyAndAdd('tests','Prüfung hinzufügen')}</section>

  <section class="section"><div class="section-title"><div><small>PRAXISAUSBILDUNG</small><h3>FTO-Berichte & Ausbildungsfahrten</h3></div><span><span data-document-minutes>${fmtDuration(totalMinutes)}</span> dokumentiert</span></div><div id="documentReports">${reportRows}</div><p id="docNoReports" class="empty" ${reports.length?'hidden':''}>Noch keine Praxisberichte.</p><button class="doc-control" id="addDocumentReport" type="button">＋ Bericht hinzufügen</button></section>


  <section class="section"><div class="section-title"><div><small>FTO-VERMERKE</small><h3>Ausbildungsnotizen</h3></div><span><span data-document-note-count>${notes.length}</span> Einträge</span></div><div data-document-list="notes">${noteRows}</div>${window.APD_RECORD_EDITOR.emptyAndAdd('notes','Notiz hinzufügen')}</section>


  ${savedDocumentSheets}
  <div class="signatures"><div class="signature">Recruit · Datum / Unterschrift</div><div class="signature">FTO / Ausbildungsleitung · Datum / Unterschrift</div></div>
 </main>
 <footer class="footer"><span>Mission Row Police Department · Recruit Training Division</span><span>Ausbildungsakte ${safe(r.serviceNo)} · ${safe(r.name)}</span></footer>
 </div>
 <div class="doc-savebar"><button id="saveDocumentRecord" type="button">✓ Gesamtakte speichern</button><span id="recordSaveStatus" role="status" aria-live="polite"></span></div><div class="export-toolbar"><button data-export-image="png" type="button">⬇ PNG speichern</button><button data-export-image="jpeg" type="button">⬇ JPEG speichern</button><button type="button" id="recordPrint">🖨 PDF / Drucken</button><span id="exportStatus" role="status"></span></div>
 <script>
 (function(){
  const buttons=Array.from(document.querySelectorAll('[data-export-image]'));
  const status=document.getElementById('exportStatus');
  async function saveImage(format){
   buttons.forEach(button=>button.disabled=true);
   status.textContent='Gesamte Akte wird erstellt …';
   const editingSheet=document.querySelector('.sheet');editingSheet.inert=true;
   try{
    if(typeof window.apdSaveRecord==='function')await window.apdSaveRecord();
    if(typeof html2canvas!=='function')throw new Error('Bildbibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen.');
    await document.fonts.ready;
    await Promise.all(Array.from(document.querySelectorAll('.sheet img')).map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});setTimeout(resolve,3000)})));
    const sheet=document.querySelector('.sheet');
    const width=Math.ceil(sheet.scrollWidth),height=Math.ceil(sheet.scrollHeight);
    // Eine einzige lange Datei; Canvas-Grenzen des Browsers beachten.
    const scale=Math.min(2,30000/height,Math.sqrt(16000000/(width*height)));
    if(scale<0.35)throw new Error('Die Akte ist fuer ein einzelnes Browser-Bild zu lang. Bitte PDF / Drucken verwenden.');
    const canvas=await html2canvas(sheet,{backgroundColor:'#ffffff',scale:scale,useCORS:true,allowTaint:false,logging:false,onclone:function(copy){copy.querySelectorAll('.doc-control,.doc-savebar').forEach(function(node){node.remove()});copy.querySelectorAll('[contenteditable]').forEach(function(node){node.removeAttribute('contenteditable')});copy.querySelectorAll('.hero-scene').forEach(function(img){const host=img.parentElement;const width=host.clientWidth,height=host.clientHeight,iw=img.naturalWidth||1672,ih=img.naturalHeight||941;const scale=Math.max(width/iw,height/ih);img.style.inset='auto';img.style.width=iw*scale+'px';img.style.height=ih*scale+'px';img.style.left=(width-iw*scale)*.5+'px';img.style.top=(height-ih*scale)*.39+'px'});copy.querySelectorAll('.circle').forEach(function(node){const percent=parseFloat(node.querySelector('strong').textContent)||0;const ring=copy.createElement('canvas');ring.width=210;ring.height=210;const ctx=ring.getContext('2d');ctx.lineWidth=24;ctx.strokeStyle='#dce7ef';ctx.beginPath();ctx.arc(105,105,93,0,2*Math.PI);ctx.stroke();ctx.strokeStyle='#169fe8';ctx.beginPath();ctx.arc(105,105,93,-Math.PI/2,-Math.PI/2+2*Math.PI*percent/100);ctx.stroke();node.style.background='url('+ring.toDataURL()+') center/cover'});const clean=copy.createElement('style');clean.textContent='.doc-editable{border:0!important;min-height:0!important;padding:0!important}.doc-editable:empty:before{content:none!important}';copy.head.append(clean)},scrollX:0,scrollY:0,windowWidth:Math.max(document.documentElement.clientWidth,width),windowHeight:Math.max(document.documentElement.clientHeight,height)});
    const mime=format==='jpeg'?'image/jpeg':'image/png';
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,mime,format==='jpeg'?0.94:undefined));
    if(!blob)throw new Error('Bild konnte nicht erzeugt werden.');
    const link=document.createElement('a'),url=URL.createObjectURL(blob);
    link.href=url;link.download='Ausbildungsakte-'+document.title.replace(/^Ausbildungsakte - /,'').replace(/[^a-z0-9_-]+/gi,'-')+'-Gesamt.'+(format==='jpeg'?'jpg':'png');
    document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
    status.textContent=(format==='jpeg'?'JPEG':'PNG')+' gespeichert – komplette Akte von oben bis unten.';
   }catch(error){status.textContent=error.message||'Export fehlgeschlagen';console.error('Akte als Bild:',error)}
   finally{editingSheet.inert=false;buttons.forEach(button=>button.disabled=false)}
  }
  buttons.forEach(button=>button.addEventListener('click',()=>saveImage(button.dataset.exportImage)));
 })();
 <\/script></body></html>`);
 w.document.close();
 window.APD_RECORD_EDITOR.bind(w,r,savedRecord);
 // Druckdialog nicht automatisch oeffnen; der Nutzer waehlt PNG oder PDF.
 setTimeout(()=>{try{w.focus()}catch{}},150);
}

document.addEventListener("click",e=>{if(e.target.closest("#notifyBtn,.notify-btn,[data-notifications]")){e.preventDefault();openWorkflowNotifications()}});

// ===== V4.9 Academy Suite =====
const academyKey=(name,u=current)=>`alta_v49_${name}_${u?.id||'guest'}`;
const academyGet=(name,fallback,u=current)=>{try{return JSON.parse(localStorage.getItem(academyKey(name,u)))??fallback}catch{return fallback}};
const academySet=(name,val,u=current)=>localStorage.setItem(academyKey(name,u),JSON.stringify(val));
const scenarioBank=[
 {q:'Du stoppst ein Fahrzeug. Der Fahrer wirkt nervös und greift mehrfach Richtung Mittelkonsole. Was ist dein erster Schwerpunkt?',a:['Eigensicherung, klare Anweisungen und Lage bewerten','Sofort Fahrzeug durchsuchen','Kontrolle ohne Rückmeldung beenden'],c:0,chapter:10},
 {q:'Bei einer Fahrzeugabfrage passt das Kennzeichen nicht eindeutig zum Treffer. Was tust du?',a:['Treffer prüfen und Daten abgleichen','Ersten Treffer übernehmen','Abfrage ignorieren'],c:0,chapter:8},
 {q:'Eine Einsatzlage ist unklar und entwickelt sich dynamisch. Was hilft zuerst?',a:['Lage melden, Partner/FTO einbeziehen und strukturiert bewerten','Allein sofort handeln','Funk ausschalten'],c:0,chapter:22},
 {q:'Nach einer Festnahme wurden Gegenstände sichergestellt. Was ist entscheidend?',a:['Beweismittel nachvollziehbar dokumentieren und übergeben','Nur fotografieren','Bis Dienstende privat aufbewahren'],c:0,chapter:12}
];
const radioBank=[
 ['10-4','Verstanden / bestätigt'],['10-20','Standort'],['10-78','Verstärkung benötigt'],['10-80','Verfolgung'],['10-41','Dienstbeginn'],['10-42','Dienstende']
];
function academyNavPatch(){
 const navEl=$('#nav');if(!navEl||navEl.querySelector('[data-view="scenario"]'))return;
 const portal=[...navEl.querySelectorAll('.nav-label')].find(x=>x.textContent.includes('PORTAL'));
 const html=`<div class="nav-label">ACADEMY TOOLS</div><button class="nav-btn" data-view="cad">🗂️ CAD- & Akten-Simulator</button><button class="nav-btn" data-view="scenario">🎬 Einsatz-Simulator</button><button class="nav-btn" data-view="radio">📻 Funk-Trainer</button><button class="nav-btn" data-view="mapquiz">🗺️ Kartenprüfung</button><button class="nav-btn" data-view="plan">📅 Mein Plan</button><button class="nav-btn" data-view="rides">🚓 Ausbildungsfahrten</button><button class="nav-btn" data-view="dienstbuch">📔 Dienstbuch</button><button class="nav-btn" data-view="achievements">🏆 Abzeichen</button><button class="nav-btn" data-view="leaderboard">🥇 Leaderboard</button>`;
 if(portal)portal.insertAdjacentHTML('beforebegin',html);else navEl.insertAdjacentHTML('beforeend',html);
 navEl.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));
}
const _navV49=nav;nav=function(){_navV49();academyNavPatch()};
const _showViewV49=showView;showView=function(v){
 if(v==='scenario')return scenarioView();if(v==='radio')return radioView();if(v==='mapquiz')return mapQuizView();if(v==='plan')return planView();if(v==='rides')return ridesView();if(v==='dienstbuch')return dienstbuchView();if(v==='messages')return messagesView();if(v==='achievements')return achievementsView();if(v==='leaderboard')return leaderboardViewV565();return _showViewV49(v)
};
function moduleHead(kicker,title,desc){return `<div class="section-head"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p class="muted">${desc}</p></div><span class="status">● Academy online</span></div>`}
function scenarioView(){setActive('[data-view="scenario"]');$('#pageTitle').textContent='Einsatz-Simulator';let i=academyGet('scenarioIndex',0)%scenarioBank.length,s=scenarioBank[i];$('#content').innerHTML=moduleHead('🎬 PRAXISTRAINING','Einsatz-Simulator','Trainiere Entscheidungen anhand kurzer Einsatzlagen.')+`<div class="card simulator-card"><div class="scenario-tag">SZENARIO ${i+1} / ${scenarioBank.length}</div><h2>${esc(s.q)}</h2><div class="sim-options">${s.a.map((a,j)=>`<button data-sim="${j}">${esc(a)}</button>`).join('')}</div><div id="simFeedback" class="sim-feedback"></div></div>`;document.querySelectorAll('[data-sim]').forEach(b=>b.onclick=()=>{let ok=+b.dataset.sim===s.c;document.querySelectorAll('[data-sim]').forEach(x=>x.disabled=true);b.classList.add(ok?'correct':'wrong');$('#simFeedback').innerHTML=`<b>${ok?'✓ Richtig':'✕ Noch einmal ansehen'}</b><span>Passender Lernstoff: Kapitel ${chapterNumber(s.chapter)} · ${esc(CHAPTERS[s.chapter].title)}</span><button class="primary" id="nextScenario">Nächstes Szenario →</button>`;$('#nextScenario').onclick=()=>{academySet('scenarioIndex',i+1);scenarioView()}})}
function radioView(){setActive('[data-view="radio"]');$('#pageTitle').textContent='Funk-Trainer';let score=academyGet('radioScore',{right:0,total:0}),pair=radioBank[Math.floor(Math.random()*radioBank.length)],opts=[pair[1],...radioBank.filter(x=>x[1]!==pair[1]).sort(()=>.5-Math.random()).slice(0,2).map(x=>x[1])].sort(()=>.5-Math.random());$('#content').innerHTML=moduleHead('📻 FUNKTRAINING','Funk-Trainer','Kurze Wiederholungen für Funkcodes und Einsatzmeldungen.')+`<div class="grid dashboard-two"><div class="card simulator-card"><div class="scenario-tag">FUNKCODE</div><h1 class="radio-code">${pair[0]}</h1><p>Was bedeutet dieser Code?</p><div class="sim-options">${opts.map(o=>`<button data-radio="${esc(o)}">${esc(o)}</button>`).join('')}</div><div id="radioFeedback" class="sim-feedback"></div></div><div class="card"><div class="eyebrow">MEINE STATISTIK</div><h2>${score.right} / ${score.total} richtig</h2><div class="progress"><i style="width:${score.total?Math.round(score.right/score.total*100):0}%"></i></div><p class="muted">Falsche Antworten werden beim weiteren Training erneut abgefragt.</p></div></div>`;document.querySelectorAll('[data-radio]').forEach(b=>b.onclick=()=>{let ok=b.dataset.radio===pair[1];score.total++;if(ok)score.right++;academySet('radioScore',score);document.querySelectorAll('[data-radio]').forEach(x=>x.disabled=true);b.classList.add(ok?'correct':'wrong');$('#radioFeedback').innerHTML=`<b>${ok?'✓ Korrekt':'✕ Richtig wäre: '+esc(pair[1])}</b><button class="primary" id="radioNext">Nächste Frage →</button>`;$('#radioNext').onclick=radioView})}
function mapQuizView(){setActive('[data-view="mapquiz"]');$('#pageTitle').textContent='Kartenprüfung';const zones=[['Paleto / Mount Chiliad','1000er'],['Grapeseed','2000er'],['Sandy','3000er'],['Harmony / Route 68','4000er'],['Vinewood','6000er'],['Rockford','7000er'],['Los Santos Middle','8000er'],['Ports','10000er']],z=zones[Math.floor(Math.random()*zones.length)];$('#content').innerHTML=moduleHead('🗺️ ORTSKUNDE','Kartenprüfung','Trainiere Postleitzahlbereiche und Orientierung.')+`<div class="map-trainer card"><div class="map-test-image-wrap"><img class="map-test-image" src="gebietskarte.png" onerror="this.src='chapter-art-21.webp?v=4.8.1'"></div><div class="map-question"><div class="eyebrow">WO LIEGT DER BEREICH?</div><h2>${z[0]}</h2><div class="zone-buttons">${['1000er','2000er','3000er','4000er','5000er','6000er','7000er','8000er','9000er','10000er'].map(x=>`<button data-zone="${x}">${x}</button>`).join('')}</div><div id="mapFeedback"></div></div></div>`;document.querySelectorAll('[data-zone]').forEach(b=>b.onclick=()=>{$('#mapFeedback').innerHTML=b.dataset.zone===z[1]?'<b class="ok-text">✓ Richtig</b>':'<b class="bad-text">✕ Richtig: '+z[1]+'</b>';setTimeout(mapQuizView,900)})}
function planView(){setActive('[data-view="plan"]');$('#pageTitle').textContent='Mein Plan';let tasks=academyGet('weekTasks',[{t:'1 Kapitel bearbeiten',done:false},{t:'5 Funkfragen beantworten',done:false},{t:'Ausbildungsziel prüfen',done:false}]);$('#content').innerHTML=moduleHead('📅 AUSBILDUNGSPLAN','Mein Plan','Tages- und Wochenziele auf einen Blick.')+`<div class="grid dashboard-two"><div class="card"><h2>Diese Woche</h2>${tasks.map((x,i)=>`<label class="plan-task"><input type="checkbox" data-plan="${i}" ${x.done?'checked':''}><span><b>${esc(x.t)}</b><small>${x.done?'Erledigt':'Offen'}</small></span></label>`).join('')}<div class="inline-add"><input id="newPlanTask" placeholder="Eigenes Wochenziel"><button class="primary" id="addPlanTask">＋</button></div></div><div class="card"><h2>Nächste Schritte</h2>${(current.goals||[]).filter(x=>!x.done).slice(0,5).map(x=>`<div class="today-task"><span>🎯</span><div><b>${esc(x.text)}</b><small>FTO-Ausbildungsziel</small></div></div>`).join('')||'<p class="muted">Keine offenen FTO-Ziele.</p>'}</div></div>`;document.querySelectorAll('[data-plan]').forEach(x=>x.onchange=()=>{tasks[+x.dataset.plan].done=x.checked;academySet('weekTasks',tasks);planView()});$('#addPlanTask').onclick=()=>{let t=$('#newPlanTask').value.trim();if(t){tasks.push({t,done:false});academySet('weekTasks',tasks);planView()}}}
function ridesView(){setActive('[data-view="rides"]');$('#pageTitle').textContent='Ausbildungsfahrten';let rides=academyGet('rides',[]),start=academyGet('rideStart',null);$('#content').innerHTML=moduleHead('🚓 PRAXIS','Ausbildungsfahrten','Zeit erfassen und Ausbildungsfahrten dokumentieren.')+`<div class="grid dashboard-two"><div class="card ride-live"><div class="eyebrow">AKTUELLE FAHRT</div><h2>${start?'Ausbildungsfahrt läuft':'Keine Fahrt aktiv'}</h2><div class="ride-clock" id="rideClock">${start?'00:00:00':'—'}</div>${start?'<button class="danger" id="stopRide">■ Fahrt beenden</button>':'<button class="primary" id="startRide">▶ Fahrt starten</button>'}</div><div class="card"><h2>Meine Praxiszeit</h2><div class="big-number">${fmtDuration(rides.reduce((a,x)=>a+x.minutes,0))}</div><p class="muted">Persönlich erfasste Ausbildungsfahrten auf diesem Gerät.</p></div></div><div class="card"><h2>Fahrtenverlauf</h2>${rides.slice().reverse().map(x=>`<div class="timeline-row"><span class="timeline-icon">🚓</span><div><b>${esc(x.title||'Ausbildungsfahrt')}</b><small>${esc(x.date)} · ${fmtDuration(x.minutes)}</small></div></div>`).join('')||'<p class="muted">Noch keine Fahrt erfasst.</p>'}</div>`;if(start){const tick=()=>{let d=Math.floor((Date.now()-start)/1000),h=String(Math.floor(d/3600)).padStart(2,'0'),m=String(Math.floor(d%3600/60)).padStart(2,'0'),s=String(d%60).padStart(2,'0');if($('#rideClock'))$('#rideClock').textContent=`${h}:${m}:${s}`};tick();window._rideTimer&&clearInterval(window._rideTimer);window._rideTimer=setInterval(tick,1000);$('#stopRide').onclick=()=>{window._rideTimer&&clearInterval(window._rideTimer);window._rideTimer=null;let mins=Math.max(1,Math.round((Date.now()-start)/60000)),title=prompt('Kurzer Schwerpunkt der Fahrt:','Streifendienst')||'Ausbildungsfahrt';academySet('rideStart',null);rides.push({date:new Date().toLocaleString('de-DE'),minutes:mins,title});academySet('rides',rides);keepScrollV52(ridesView)}}else{window._rideTimer&&clearInterval(window._rideTimer);window._rideTimer=null;$('#startRide').onclick=()=>{academySet('rideStart',Date.now());keepScrollV52(ridesView)}}}
function dienstbuchView(){setActive('[data-view="dienstbuch"]');$('#pageTitle').textContent='Dienstbuch';let rides=academyGet('rides',[]),extra=rides.map(x=>({when:new Date().toISOString(),icon:'🚓',text:`${x.title} · ${fmtDuration(x.minutes)}`}));let acts=[...(current.activity||[]),...extra];$('#content').innerHTML=moduleHead('📔 CHRONIK','Mein Dienstbuch','Automatische Übersicht über Ausbildung, Tests, Ziele und Praxis.')+`<div class="card"><div class="timeline-v49">${acts.length?acts.slice(0,30).map(x=>`<div class="timeline-row"><span class="timeline-icon">${x.icon}</span><div><b>${esc(x.text)}</b><small>${x.when?new Date(x.when).toLocaleString('de-DE'):'Persönlicher Eintrag'}</small></div></div>`).join(''):'<p class="muted">Noch keine Einträge.</p>'}</div></div>`}

const V62_RANKS=["Recruit","Police Officer","Detective","Sergeant","Captain","Commander","Deputy Chief","Assistant Chief","Chief of Police"];
function v62RankLevel(u=current){let i=V62_RANKS.indexOf(u?.rank||"");return i<0?(u?.role==="admin"?8:u?.role==="trainer"?3:0):i}
function v62IsSergeantPlus(u=current){return v62RankLevel(u)>=3}
function v62UserLabel(id){let u=db.users.find(x=>x.id===id);return u?`${u.rank||""} ${u.name}`.trim():"Unbekannt"}
function v62AssignedFtos(r){
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const byId=id=>id&&uuid.test(String(id))?db.users.find(u=>u.id===id&&["trainer","admin"].includes(u.role))||null:null;
 let leader=byId(r?.leaderFtoId),secondary=byId(r?.secondaryFtoId);
 const norm=v=>String(v||"").trim().toLowerCase(),match=(u,v)=>!!norm(v)&&[u.name,u.username,`${u.rank||""} ${u.name}`].filter(Boolean).some(x=>norm(x)===norm(v));
 if(!leader)leader=db.users.find(u=>uuid.test(String(u.id||""))&&["trainer","admin"].includes(u.role)&&match(u,r?.fto))||null;
 if(!secondary)secondary=db.users.find(u=>uuid.test(String(u.id||""))&&["trainer","admin"].includes(u.role)&&match(u,r?.secondaryFto))||null;
 return [leader,secondary].filter((u,i,a)=>u&&a.findIndex(x=>x.id===u.id)===i);
}
function v623RecordRecipients(r){
 const a=v62AssignedFtos(r),leader=(r?.leaderFtoId?a.find(u=>u.id===r.leaderFtoId):null)||a[0]||null,secondary=(r?.secondaryFtoId?a.find(u=>u.id===r.secondaryFtoId):null)||a.find(u=>u.id!==leader?.id)||null;
 if(current?.id===leader?.id)return secondary?[secondary]:[];
 if(current?.id===secondary?.id)return leader?[leader]:[];
 return [leader,secondary].filter((u,i,x)=>u&&u.id!==current?.id&&x.findIndex(y=>y.id===u.id)===i);
}

async function v62SendMessage({recipientId,subject,body,recruitId=null,kind="mail",threadId=null,parentId=null,sourceType=null,sourceId=null,messageId=null,attachments=[]}){
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const {data:{user}}=await sb.auth.getUser();
 const senderId=user?.id||current?.id;
 if(!uuid.test(String(senderId||"")))throw new Error("Absender-Account hat keine gültige Benutzer-ID.");
 if(!uuid.test(String(recipientId||"")))throw new Error("Der Empfänger hat keine gültige Benutzer-ID. Bitte eine Person aus der Empfängerliste auswählen.");
 const row={sender_id:senderId,recipient_id:recipientId,subject:subject||"(ohne Betreff)",body,kind,recruit_id:uuid.test(String(recruitId||""))?recruitId:null,thread_id:threadId&&uuid.test(String(threadId))?threadId:crypto.randomUUID(),parent_id:parentId&&uuid.test(String(parentId))?parentId:null,source_type:sourceType||null,source_id:sourceId&&uuid.test(String(sourceId))?sourceId:null};
 if(messageId)row.id=messageId;
 if(attachments.length)row.attachments=attachments;
 const {error}=await sb.from("academy_messages").insert(row);if(error)throw error;
}
async function v62NotifyFtos(r,subject,body,sourceType,sourceId=null){
 const recipients=v623RecordRecipients(r);
 for(const u of recipients){
   await v62SendMessage({recipientId:u.id,subject,body,recruitId:r.id,kind:"record_alert",sourceType,sourceId});
 }
}
async function v62MarkRead(id){
 const {error}=await sb.from("academy_messages").update({read_at:new Date().toISOString()}).eq("id",id).eq("recipient_id",current.id);
 if(error)throw error;await refreshData();messagesView();
}
async function v62Reply(id){
 const parent=db.messages.find(x=>x.id===id);if(!parent)return;
 const text=prompt("Antwort:");if(!text?.trim())return;
 const recipient=parent.sender_id===current.id?parent.recipient_id:parent.sender_id;
 await v62SendMessage({recipientId:recipient,subject:parent.subject?.startsWith("RE:")?parent.subject:`RE: ${parent.subject}`,body:text.trim(),recruitId:parent.recruit_id,kind:"reply",threadId:parent.thread_id||parent.id,parentId:parent.id});
 await refreshData();messagesView();
}
function v62Unread(){return (db.messages||[]).filter(x=>x.recipient_id===current?.id&&!x.read_at).length}
function messagesView(){
 setActive('[data-view="messages"]');$('#pageTitle').textContent='Postfach';
 const mine=(db.messages||[]), incoming=mine.filter(x=>x.recipient_id===current.id), sent=mine.filter(x=>x.sender_id===current.id);
 const people=portalPeople();
 let activeFolder="in", activeId=(incoming[0]||sent[0]||{}).id||null;
 $('#content').innerHTML=`<div class="mail-desktop">
   <aside class="mail-sidebar">
    <div class="mail-brand"><span>MRPD</span><div><b>MRPD MAIL</b><small>Academy Communications</small></div></div>
    <button class="mail-compose-btn" id="v621Compose">＋ Neue Nachricht</button>
    <nav>
      <button class="active" data-folder="in"><span>📥 Posteingang</span><b>${v62Unread()||""}</b></button>
      <button data-folder="out"><span>📤 Gesendet</span><b></b></button>
    </nav>
    <div class="mail-side-info"><i></i><span>Interne Verbindung<br><small>MRPD · Sicher</small></span></div>
   </aside>
   <section class="mail-window">
    <header class="mail-window-bar"><div><span class="window-dot"></span><span class="window-dot"></span><span class="window-dot"></span></div><b>Postfach</b><button id="v621Refresh" title="Aktualisieren">↻</button></header>
    <div class="mail-toolbar"><div><h2 id="v621FolderTitle">Posteingang</h2><small id="v621FolderCount">${incoming.length} Nachrichten</small></div><div class="mail-search-wrap">⌕ <input id="v621MailSearch" placeholder="Nachrichten durchsuchen…"></div></div>
    <div class="mail-three">
      <div class="mail-list-pane" id="v621MailList"></div>
      <div class="mail-reading-pane" id="v621MailReader"></div>
    </div>
   </section>
  </div>
  <div class="mail-compose-modal hidden" id="v621ComposeModal"><div class="mail-compose-window"><header><b>Neue Nachricht</b><button type="button" id="v621ComposeClose">×</button></header><form id="v62MailForm"><label>An<select name="recipient" required><option value="">Empfänger auswählen…</option>${people.map(u=>`<option value="${u.id}">${esc(portalPersonLabel(u))}</option>`).join("")}</select></label><label>Betreff<input name="subject" maxlength="140" required placeholder="Betreff"></label><textarea name="body" rows="10" maxlength="4000" required placeholder="Nachricht schreiben…"></textarea><footer><small>Interne MRPD Nachricht</small><button class="primary">Senden ➤</button></footer></form></div></div>`;
 const folder=()=>activeFolder==="in"?incoming:sent;
 const renderList=(query="")=>{
   let arr=folder().filter(x=>!query||`${x.subject||""} ${x.body||""} ${v62UserLabel(activeFolder==="in"?x.sender_id:x.recipient_id)}`.toLowerCase().includes(query.toLowerCase()));
   if(!arr.some(x=>x.id===activeId))activeId=arr[0]?.id||null;
   $('#v621FolderTitle').textContent=activeFolder==="in"?"Posteingang":"Gesendet";
   $('#v621FolderCount').textContent=`${arr.length} Nachricht${arr.length===1?"":"en"}`;
   $('#v621MailList').innerHTML=arr.length?arr.map(x=>`<button class="mail-list-item ${x.id===activeId?"selected":""} ${activeFolder==="in"&&!x.read_at?"unread":""}" data-select-mail="${x.id}"><div class="mail-list-avatar">${esc((v62UserLabel(activeFolder==="in"?x.sender_id:x.recipient_id)||"AP").split(/\s+/).slice(-2).map(a=>a[0]).join("").toUpperCase())}</div><div><div class="mail-list-top"><b>${esc(v62UserLabel(activeFolder==="in"?x.sender_id:x.recipient_id))}</b><time>${new Date(x.created_at).toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit"})}</time></div><strong>${esc(x.subject)}</strong><p>${esc((x.body||"").slice(0,95))}</p></div></button>`).join(""):`<div class="mail-empty">📭<b>Keine Nachrichten</b><span>Hier ist aktuell alles erledigt.</span></div>`;
   document.querySelectorAll("[data-select-mail]").forEach(b=>b.onclick=()=>{activeId=b.dataset.selectMail;renderList($('#v621MailSearch').value);renderReader()});
   renderReader();
 };
 const renderReader=()=>{
   const x=folder().find(m=>m.id===activeId), r=$('#v621MailReader');
   if(!x){r.innerHTML=`<div class="mail-reader-empty"><span>✉️</span><h3>Nachricht auswählen</h3><p>Wähle links eine Nachricht aus.</p></div>`;return}
   const other=v62UserLabel(activeFolder==="in"?x.sender_id:x.recipient_id);
   r.innerHTML=`<div class="mail-reader-head"><div><div class="mail-reader-avatar">${esc(other.split(/\s+/).slice(-2).map(a=>a[0]).join("").toUpperCase())}</div><div><small>${activeFolder==="in"?"VON":"AN"}</small><b>${esc(other)}</b><span>${new Date(x.created_at).toLocaleString("de-DE")}</span></div></div><div class="mail-reader-actions">${activeFolder==="in"&&!x.read_at?`<button data-read="${x.id}">✓ Gelesen</button>`:""}<button data-reply="${x.id}">↩ Antworten</button></div></div><div class="mail-reader-subject"><small>${x.kind==="record_alert"?"📋 AKTENBENACHRICHTIGUNG":"INTERNE NACHRICHT"}</small><h1>${esc(x.subject)}</h1></div><div class="mail-reader-body">${esc(x.body).replace(/\n/g,"<br>")}</div>${mailAttachmentsHtml(x)}${x.recruit_id?`<div class="mail-reader-record v633-record-attachment"><div><small>📎 AKTENANHANG</small><b>${esc(db.users.find(u=>u.id===x.recruit_id)?.name||"Recruit-Akte")}</b><span>${esc(({practice:"Praxis / Ausbildungsfahrt",field_report:"Praxis / Ausbildungsfahrt",goal:"Offene Ziele",note:"Notizen / Vermerke",handover:"Übersicht / FTO-Übergabe",test:"Tests",chapter:"Ausbildung / Kapitel"}[x.source_type]||"Ausbildungsakte"))}</span></div><button data-open-mail-recruit="${x.recruit_id}">Genau diesen Bereich öffnen →</button></div>`:""}`;
   r.querySelector("[data-read]")?.addEventListener("click",async e=>{await sb.from("academy_messages").update({read_at:new Date().toISOString()}).eq("id",e.currentTarget.dataset.read).eq("recipient_id",current.id);await refreshData();messagesView()});
   r.querySelector("[data-reply]")?.addEventListener("click",e=>v62Reply(e.currentTarget.dataset.reply));
   r.querySelector("[data-open-mail-recruit]")?.addEventListener("click",e=>{
    const tab=({practice:"practice",field_report:"practice",goal:"goals",note:"notes",handover:"overview",test:"tests",chapter:"chapters"}[x.source_type]||"overview");
    v630OpenRecruit(e.currentTarget.dataset.openMailRecruit,tab);
   });
 };
 document.querySelectorAll("[data-folder]").forEach(b=>b.onclick=()=>{activeFolder=b.dataset.folder;activeId=folder()[0]?.id||null;document.querySelectorAll("[data-folder]").forEach(x=>x.classList.toggle("active",x===b));renderList()});
 $('#v621MailSearch').oninput=e=>renderList(e.target.value);
 $('#v621Refresh').onclick=async()=>{await refreshData();messagesView()};
 $('#v621Compose').onclick=()=>$('#v621ComposeModal').classList.remove("hidden");
 $('#v621ComposeClose').onclick=()=>$('#v621ComposeModal').classList.add("hidden");
 $('#v621ComposeModal').onclick=e=>{if(e.target.id==="v621ComposeModal")e.currentTarget.classList.add("hidden")};
 $('#v62MailForm').onsubmit=async e=>{e.preventDefault();let f=new FormData(e.target);try{await v62SendMessage({recipientId:f.get("recipient"),subject:f.get("subject").trim(),body:f.get("body").trim()});await refreshData();toast("✓ Nachricht gesendet");messagesView()}catch(err){alert("Nachricht konnte nicht gesendet werden: "+err.message)}};
 renderList();
 portalInstallRecipientSearch();
}
function achievementsView(){setActive('[data-view="achievements"]');$('#pageTitle').textContent='Abzeichen';let badges=personalBadges(current),all=[['📘','Erstes Kapitel',(current.completed||[]).length>=1],['🔥','Lernserie',learningStreak(current)>=3],['📻','Funk Ready',qualifications(current)[0][2]],['💻','EFA Ready',qualifications(current)[1][2]],['🚓','Streife',qualifications(current)[2][2]],['🎯','Schießtraining',qualifications(current)[3][2]],['🧪','Beweismittel',qualifications(current)[4][2]],['🏅','Theorie',qualifications(current)[5][2]],['⭐','Halbzeit',progress(current)>=50],['👑','100 Prozent',progress(current)===100]];$('#content').innerHTML=moduleHead('🏆 SAMMLUNG','Meine Abzeichen','Deine persönlichen Ausbildungs-Meilensteine.')+`<div class="achievement-grid">${all.map(x=>`<div class="card achievement ${x[2]?'earned':'locked'}"><span>${x[0]}</span><h3>${x[1]}</h3><small>${x[2]?'Freigeschaltet':'Noch gesperrt'}</small></div>`).join('')}</div>`}
function addPersonalLearningTools(){if(current?.role!=='recruit')return;const c=$('#content');if(!c||c.querySelector('.v49-tools'))return;const head=[...c.querySelectorAll('.section-head')].find(x=>x.textContent.includes('Ausbildungskapitel'));if(!head)return;let notes=academyGet('learningNotes','');head.insertAdjacentHTML('beforebegin',`<div class="v49-tools grid dashboard-two"><div class="card"><div class="eyebrow">📝 MEIN LERNZETTEL</div><h2>Persönliche Notizen</h2><textarea id="learningNotes" rows="4" placeholder="Merksätze, Funkcodes, Fragen an den FTO...">${esc(notes)}</textarea><small id="noteSaved" class="muted">Automatisch lokal gespeichert</small></div><div class="card"><div class="eyebrow">⚡ SCHNELLSTART</div><h2>Training starten</h2><div class="quick-tool-buttons"><button class="secondary" data-quick-view="scenario">🎬 Szenario</button><button class="secondary" data-quick-view="radio">📻 Funk</button><button class="secondary" data-quick-view="mapquiz">🗺️ Ortskunde</button><button class="secondary" data-quick-view="rides">🚓 Fahrt</button></div></div></div>`);$('#learningNotes').oninput=e=>{academySet('learningNotes',e.target.value);$('#noteSaved').textContent='✓ Gespeichert'};document.querySelectorAll('[data-quick-view]').forEach(b=>b.onclick=()=>showView(b.dataset.quickView))}
const _dashboardV49=dashboard;dashboard=function(){_dashboardV49();addPersonalLearningTools()};
function installCommandPalette(){if(document.querySelector('#commandPalette'))return;document.body.insertAdjacentHTML('beforeend',`<div id="commandPalette" class="command-palette" hidden><div class="command-box"><input id="commandSearch" placeholder="Kapitel, Recruit oder Funktion suchen…"><div id="commandResults"></div></div></div>`);const p=$('#commandPalette'),inp=$('#commandSearch');const close=()=>{p.hidden=true;inp.value=''};document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();p.hidden=false;inp.focus();renderCmd('')}if(e.key==='Escape')close()});p.onclick=e=>{if(e.target===p)close()};inp.oninput=()=>renderCmd(inp.value);function renderCmd(q){q=q.toLowerCase();let items=[...titles.map(x=>({label:`Kapitel ${chapterNumber(x.n)} · ${x.title}`,go:()=>showChapter(x.n)})),{label:'Einsatz-Simulator',go:scenarioView},{label:'Funk-Trainer',go:radioView},{label:'Kartenprüfung',go:mapQuizView},{label:'Ausbildungsfahrten',go:ridesView},{label:'Dienstbuch',go:dienstbuchView},...db.users.filter(x=>x.role==='recruit'&&isTrainer(current)).map(r=>({label:`Recruit · ${r.name}`,go:()=>{selectedRecruit=r.id;admin()}}))].filter(x=>x.label.toLowerCase().includes(q)).slice(0,10);$('#commandResults').innerHTML=items.map((x,i)=>`<button data-cmd="${i}">${esc(x.label)}</button>`).join('');document.querySelectorAll('[data-cmd]').forEach(b=>b.onclick=()=>{items[+b.dataset.cmd].go();close()})}}
setTimeout(installCommandPalette,500);


/* ===== V5.0 Role Cockpits + echte Ausbildungsakte-Tabs ===== */
let recordActiveTab=sessionStorage.getItem("alta_record_active_tab")||"overview";
function activateRecordTab(name,scroll=true){
 recordActiveTab=name||"overview";
 try{sessionStorage.setItem("alta_record_active_tab",recordActiveTab)}catch(_){}
 document.querySelectorAll('[data-record-panel]').forEach(p=>p.classList.toggle('active',p.dataset.recordPanel===recordActiveTab));
 document.querySelectorAll('[data-record-jump]').forEach(b=>b.classList.toggle('active',b.dataset.recordJump===recordActiveTab));
 const box=document.querySelector('.record-workspace'); if(scroll&&box) box.scrollIntoView({behavior:'smooth',block:'start'});
}
function rerenderRecordKeepPosition(){
 const y=window.scrollY,tab=recordActiveTab;
 admin();
 requestAnimationFrame(()=>{activateRecordTab(tab,false);window.scrollTo({top:y,left:0,behavior:"instant"})});
}
function recruitSignalV5(r){
 const open=(r.goals||[]).filter(g=>!g.done).length, pct=progress(r), failed=(r.testResults||[]).filter(x=>!x.passed).length;
 if(pct===100 && open===0) return ['🔵','Abschlussbereit','blue'];
 if(failed>0 || open>=4) return ['🔴','Handlungsbedarf','red'];
 if(open>0 || pct<35) return ['🟡','Beobachten','yellow'];
 return ['🟢','Im Plan','green'];
}
function roleCockpitV5(){
 const c=$('#content'); if(!c)return;
 if(isTrainer(current) && !c.querySelector('.fto-cockpit-v5')){
  const rs=db.users.filter(x=>apdActiveRecruit(x));
  const mine=rs.filter(r=>!r.fto || r.fto===current.name || isOwner());
  const rows=mine.map(r=>{const sig=recruitSignalV5(r),open=(r.goals||[]).filter(g=>!g.done).length;return `<button class="fto-person-v5" data-v5-open="${r.id}"><span class="v5-signal ${sig[2]}">${sig[0]}</span><div><b>${esc(r.name)}</b><small>${esc(r.fto||'Kein FTO')} · ${stage(r)} · ${fmtDuration(totalTrainingMinutes(r))}</small></div><div class="v5-mini"><i style="width:${progress(r)}%"></i></div><strong>${progress(r)}%</strong><em>${open} Ziele</em></button>`}).join('');
  const html=`<section class="card fto-cockpit-v5"><div class="section-head compact"><div><div class="eyebrow">🎓 FTO-COCKPIT</div><h2>${isOwner()?'Academy-Übersicht':'Meine Recruits'}</h2></div><span class="state-badge">${mine.length} aktiv</span></div><div class="fto-kpis-v5"><div><small>Recruits</small><b>${mine.length}</b></div><div><small>Offene Ziele</small><b>${mine.reduce((a,r)=>a+(r.goals||[]).filter(g=>!g.done).length,0)}</b></div><div><small>Abschlussbereit</small><b>${mine.filter(r=>progress(r)===100).length}</b></div><div><small>Ausbildungszeit</small><b>${fmtDuration(mine.reduce((a,r)=>a+totalTrainingMinutes(r),0))}</b></div></div><div class="fto-list-v5">${rows||'<p class="muted">Keine Recruits zugewiesen.</p>'}</div></section>`;
  const target=c.querySelector('.fto-stats')||c.querySelector('.stats'); if(target)target.insertAdjacentHTML('beforebegin',html); else c.insertAdjacentHTML('afterbegin',html);
  c.querySelectorAll('[data-v5-open]').forEach(b=>b.onclick=()=>{selectedRecruit=b.dataset.v5Open;recruitRecordClosed=false;admin()});
 }
 if(current.role==='recruit' && !c.querySelector('.recruit-next-v5')){
  const open=(current.goals||[]).filter(g=>!g.done); const next=open[0]?.text || (progress(current)<100?'Nächstes noch offenes Ausbildungskapitel bearbeiten':'Ausbildung vollständig – Abschlussfreigabe prüfen');
  const last=localStorage.getItem('alta_last_chapter');
  const html=`<section class="card recruit-next-v5"><div><div class="eyebrow">➡️ MEIN NÄCHSTER SCHRITT</div><h2>${esc(next)}</h2><p class="muted">${stage(current)} · ${progress(current)}% Gesamtfortschritt</p></div><button class="primary" id="continueLearningV5">${last?'Weiterlernen · Kapitel '+last:'Ausbildung öffnen'}</button></section>`;
  const target=c.querySelector('.stats'); if(target)target.insertAdjacentHTML('beforebegin',html);
  $('#continueLearningV5')?.addEventListener('click',()=>showChapter(+(last||1)));
 }
}
const _dashboardV50=dashboard; dashboard=function(){_dashboardV50();roleCockpitV5()};

/* ===== V5.1 Academy Workflow: Board, Session, Pass, Übergabe, Abschluss ===== */
function academyPassV51(u){
 const qs=qualifications(u);
 return `<div class="academy-pass-v51">${qs.map(q=>`<div class="pass-item ${q[2]?'ok':'open'}"><span>${q[0]}</span><div><b>${esc(q[1])}</b><small>${q[2]?'✓ Freigegeben':'○ Offen'}</small></div></div>`).join('')}</div>`;
}
function phaseIndexV51(u){const p=progress(u);return p>=100?4:p>=75?3:p>=50?2:p>=25?1:0}
function academyBoardV51(){
 const rs=db.users.filter(x=>apdActiveRecruit(x));
 const cols=[['PHASE I','Grundlagen'],['PHASE II','Theorie'],['PHASE III','Praxis'],['PHASE IV','Beobachtung'],['ABSCHLUSS','Bereit / Freigabe']];
 return `<section class="card academy-board-v51"><div class="section-head compact"><div><div class="eyebrow">🗂️ ACADEMY BOARD</div><h2>Ausbildungsphasen</h2></div><span class="state-badge">${rs.length} Recruits</span></div><div class="board-grid-v51">${cols.map((c,i)=>`<div class="board-col-v51"><header><b>${c[0]}</b><small>${c[1]}</small></header>${rs.filter(r=>phaseIndexV51(r)===i).map(r=>`<button data-v51-open="${r.id}" class="board-recruit-v51"><span>${progress(r)}%</span><b>${esc(r.name)}</b><small>${esc(r.fto||'Kein FTO')} · ${(r.goals||[]).filter(g=>!g.done).length} Ziele</small></button>`).join('')||'<p class="board-empty-v51">Keine Recruits</p>'}</div>`).join('')}</div></section>`;
}
function activeSessionV51(id){try{return JSON.parse(localStorage.getItem('alta_v51_session_'+id)||'null')}catch{return null}}
function saveSessionV51(id,v){if(v)localStorage.setItem('alta_v51_session_'+id,JSON.stringify(v));else localStorage.removeItem('alta_v51_session_'+id)}
function sessionCardV51(r){const s=activeSessionV51(r.id);return `<div class="card inner-card session-v51"><div class="section-head compact"><div><div class="eyebrow">🚓 AKTIVE AUSBILDUNG</div><h3>${s?esc(s.topic):'Ausbildungssession starten'}</h3></div>${s?'<span class="live-pill-v51">● LIVE</span>':''}</div>${s?`<div class="session-clock-v51" id="sessionClockV51">00:00:00</div><p class="muted">Gestartet von ${esc(s.author)} · ${new Date(s.started).toLocaleString('de-DE')}</p><textarea id="sessionNoteV51" rows="3" placeholder="Notiz während der Ausbildung…">${esc(s.note||'')}</textarea><div class="session-actions-v51"><button class="secondary" id="saveSessionNoteV51">Notiz speichern</button><button class="primary" id="stopSessionV51">Ausbildung beenden & Bericht speichern</button></div>`:`<div class="session-start-v51"><select id="sessionTopicV51"><option>Streifenfahrt</option><option>Funktraining</option><option>Verkehrskontrolle</option><option>Recht & Maßnahmen</option><option>Ortskunde</option><option>Schießtraining</option><option>EFA / CAD</option></select><button class="primary" id="startSessionV51">▶ Ausbildung starten</button></div>`}</div>`}
function handoffV51(r){const last=(r.notes||[]).filter(n=>String(n.text||'').startsWith('FTO-Übergabe:')).slice(-1)[0];return `<div class="card inner-card"><div class="eyebrow">🤝 FTO-ÜBERGABE</div><h3>Übergabe an den nächsten Ausbilder</h3>${last?`<div class="handoff-last-v51"><small>Letzte Übergabe · ${esc(last.date)}</small><p>${esc(last.text.replace(/^FTO-Übergabe:\s*/,''))}</p></div>`:''}<textarea id="handoffTextV51" rows="4" placeholder="Zuletzt gemacht · lief gut · weiter üben · nächster Schritt"></textarea><button class="primary" id="saveHandoffV51">Übergabe speichern</button></div>`}
function graduationWorkflowV51(r){const ready=progress(r)===100 && !(r.goals||[]).some(g=>!g.done);return `<div class="card inner-card graduation-flow-v51"><div class="eyebrow">🎓 ABSCHLUSSWORKFLOW</div><h3>Von der Academy zur Streifenfreigabe</h3><div class="flow-v51"><span class="done">Ausbildung</span><i>→</i><span class="${ready?'done':''}">Voraussetzungen</span><i>→</i><span class="${r.status==='Ausbildung abgeschlossen'||r.status==='Streifenfreigabe'?'done':''}">FTO-Empfehlung</span><i>→</i><span class="${r.status==='Streifenfreigabe'?'done':''}">Command-Freigabe</span></div><div class="session-actions-v51"><button class="secondary" id="recommendGradV51" ${ready?'':'disabled'}>FTO: Abschluss empfehlen</button>${isOwner()?`<button class="primary" id="releaseGradV51" ${r.status==='Ausbildung abgeschlossen'?'':'disabled'}>Command: Streifenfreigabe</button>`:''}</div>${!ready?'<p class="muted">Freigabe wird aktiv, sobald 22/22 Kapitel abgeschlossen und alle Ausbildungsziele erledigt sind.</p>':''}</div>`}
const _adminRecruitV51=adminRecruit;
adminRecruit=function(r){
 let html=_adminRecruitV51(r);
 html=html.replace('${V51_NEVER}','');
 html=html.replace('<section class="record-tab-panel" data-record-panel="overview">',`<section class="record-tab-panel" data-record-panel="overview"><div class="card inner-card"><div class="eyebrow">🎫 ACADEMY-PASS</div><h3>Freigaben auf einen Blick</h3>${academyPassV51(r)}</div>${graduationWorkflowV51(r)}`);
 html=html.replace('<section class="record-tab-panel" data-record-panel="practice"><div id="record-practice"></div>',`<section class="record-tab-panel" data-record-panel="practice"><div id="record-practice"></div>${sessionCardV51(r)}${handoffV51(r)}`);
 return html;
}
async function bindWorkflowV51(){
 const r=db.users.find(x=>x.id===selectedRecruit); if(!r)return;
 const start=$('#startSessionV51'); if(start)start.onclick=()=>{saveSessionV51(r.id,{started:Date.now(),topic:$('#sessionTopicV51').value,author:current.name,note:''});admin()};
 const s=activeSessionV51(r.id); if(s&&$('#sessionClockV51')){clearInterval(window._v51timer);const tick=()=>{const d=Math.floor((Date.now()-s.started)/1000),h=String(Math.floor(d/3600)).padStart(2,'0'),m=String(Math.floor(d%3600/60)).padStart(2,'0'),ss=String(d%60).padStart(2,'0');if($('#sessionClockV51'))$('#sessionClockV51').textContent=`${h}:${m}:${ss}`};tick();window._v51timer=setInterval(tick,1000)}
 $('#saveSessionNoteV51')?.addEventListener('click',()=>{s.note=$('#sessionNoteV51').value;saveSessionV51(r.id,s);$('#saveSessionNoteV51').textContent='✓ Gespeichert'});
 $('#stopSessionV51')?.addEventListener('click',async()=>{const mins=Math.max(1,Math.round((Date.now()-s.started)/60000));const note=$('#sessionNoteV51').value.trim();const {error}=await sb.from('field_reports').insert({recruit_id:r.id,author_id:current.id,author_name:current.name,report_date:new Date().toISOString().slice(0,10),duration_minutes:mins,topics:s.topic,positive_points:'',improvement_points:note,next_steps:''});if(error){alert(error.message);return}saveSessionV51(r.id,null);await refreshData();admin()});
 $('#saveHandoffV51')?.addEventListener('click',async()=>{const t=$('#handoffTextV51').value.trim();if(!t)return;const {error}=await sb.from('recruit_notes').insert({recruit_id:r.id,author_id:current.id,author_name:current.name,author_rank:current.rank||roleLabel(current),note_text:'FTO-Übergabe: '+t});if(error){alert(error.message);return}await refreshData();admin()});
 $('#recommendGradV51')?.addEventListener('click',async()=>{const {error}=await sb.rpc('staff_update_recruit',{target_id:r.id,new_fto:r.fto,new_status:'Ausbildung abgeschlossen',new_rank:r.rank});if(error){alert(error.message);return}await refreshData();admin()});
 $('#releaseGradV51')?.addEventListener('click',async()=>{const {error}=await sb.rpc('staff_update_recruit',{target_id:r.id,new_fto:r.fto,new_status:'Streifenfreigabe',new_rank:r.rank});if(error){alert(error.message);return}await refreshData();admin()});
}
const _adminV51=admin;admin=function(){_adminV51();bindWorkflowV51()};
const _commandV51=commandCenter;commandCenter=function(){_commandV51();const c=$('#content');if(c&&!c.querySelector('.academy-board-v51')){c.insertAdjacentHTML('beforeend',academyBoardV51());c.querySelectorAll('[data-v51-open]').forEach(b=>b.onclick=()=>{selectedRecruit=b.dataset.v51Open;recruitRecordClosed=false;admin()})}};
const _dashboardV51=dashboard;dashboard=function(){_dashboardV51();if(current?.role==='recruit'){const c=$('#content'),target=c.querySelector('.activity-card');if(target&&!c.querySelector('.academy-pass-home-v51'))target.insertAdjacentHTML('beforebegin',`<section class="card academy-pass-home-v51"><div class="section-head compact"><div><div class="eyebrow">🎫 MEIN ACADEMY-PASS</div><h2>${stage(current)}</h2></div><strong>${progress(current)}%</strong></div>${academyPassV51(current)}</section>`)}};

/* ===== V5.2 Navigation & Position beibehalten ===== */
const APD_ROUTE_KEY='alta_v52_route';
function savePortalRoute(route,extra={}){
  try{sessionStorage.setItem(APD_ROUTE_KEY,JSON.stringify({route,...extra,scrollY:window.scrollY||0}))}catch{}
}
function readPortalRoute(){try{return JSON.parse(sessionStorage.getItem(APD_ROUTE_KEY)||'null')}catch{return null}}
function restorePortalRoute(){
  if(current?.mustChangePassword){account();return}
  const s=readPortalRoute();
  if(!s?.route){dashboard();return}
  if(s.route==='chapter' && s.chapter){showChapter(+s.chapter)}
  else showView(s.route);
  requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:+s.scrollY||0,left:0,behavior:'auto'})));
}
window.addEventListener('beforeunload',()=>{
  const s=readPortalRoute(); if(s) savePortalRoute(s.route,{chapter:s.chapter,scrollY:window.scrollY||0});
});
const _showViewV52=showView;
showView=function(v){savePortalRoute(v,{scrollY:0});return _showViewV52(v)};
const _showChapterV52=showChapter;
showChapter=function(n){savePortalRoute('chapter',{chapter:n,scrollY:0});return _showChapterV52(n)};

/* Academy-Tools: bei Aktionen nicht mehr an den Seitenanfang springen */
function keepScrollV52(fn){const y=window.scrollY||0;fn();requestAnimationFrame(()=>window.scrollTo({top:y,left:0,behavior:'auto'}))}
const _ridesViewV52=ridesView;
ridesView=function(){savePortalRoute('rides',{scrollY:window.scrollY||0});return _ridesViewV52()};


/* ===== V5.3 Academy Organisation & Abschluss ===== */
let academyAppointments=[], academyEvaluations=[], academyAudit=[];
function v53TrainerAccess(){return isTrainer(current)}
function v53FmtDate(v){if(!v)return '—';try{return new Date(v).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch{return v}}
function v53Upcoming(rid){return academyAppointments.filter(x=>x.recruit_id===rid && new Date(x.starts_at)>=new Date()).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at))}
function v53Eval(rid){return academyEvaluations.filter(x=>x.recruit_id===rid).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0]||null}
function v53Audit(rid){return academyAudit.filter(x=>x.recruit_id===rid).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))}
function v53Missing(r){const out=[];const q=qualifications(r);q.filter(x=>!x[2]).slice(0,5).forEach(x=>out.push(x[1]));const open=(r.goals||[]).filter(g=>!g.done);open.slice(0,3).forEach(g=>out.push(g.text));return [...new Set(out)].slice(0,6)}
async function v53Log(recruitId,action,details=''){try{await sb.from('academy_audit_log').insert({recruit_id:recruitId,actor_id:current.id,actor_name:current.name,action,details})}catch(e){console.warn('Audit:',e.message)}}
const _refreshV53=refreshData;
refreshData=async function(){const ok=await _refreshV53();if(!ok)return ok;try{const ids=db.users.filter(x=>x.role==='recruit').map(x=>x.id);if(ids.length){const [a,e,l]=await Promise.all([sb.from('academy_appointments').select('*').in('recruit_id',ids).order('starts_at',{ascending:true}),sb.from('academy_final_evaluations').select('*').in('recruit_id',ids).order('created_at',{ascending:false}),sb.from('academy_audit_log').select('*').in('recruit_id',ids).order('created_at',{ascending:false}).limit(300)]);academyAppointments=a.data||[];academyEvaluations=e.data||[];academyAudit=l.data||[]}}catch(err){console.warn('V5.3 Academy-Daten:',err.message)}return ok}
const _adminRecruitV53=adminRecruit;
adminRecruit=function(r){let html=_adminRecruitV53(r);const ap=v53Upcoming(r.id),ev=v53Eval(r.id),missing=v53Missing(r),aud=v53Audit(r.id).slice(0,20);const block=`<div class="v53-spacious-block"><div class="v53-grid-two"><section class="card inner-card v53-panel"><div class="eyebrow">📅 AUSBILDUNGSTERMINE</div><h3>Geplante Termine</h3><form id="v53Appointment" class="v53-form"><label>Titel<input name="title" required placeholder="z. B. Fahrtraining"></label><label>Datum & Uhrzeit<input name="starts" type="datetime-local" required></label><label>Ort<input name="location" placeholder="z. B. Mission Row"></label><label class="v53-wide">Hinweis<input name="notes" placeholder="Thema oder Vorbereitung"></label><button class="primary v53-wide">Termin eintragen</button></form><div class="v53-list">${ap.length?ap.map(x=>`<div class="v53-row"><div><b>${esc(x.title)}</b><small>${v53FmtDate(x.starts_at)} · ${esc(x.location||'Ort offen')}</small>${x.notes?`<p>${esc(x.notes)}</p>`:''}</div><button class="note-delete" data-v53-del-appt="${x.id}">Löschen</button></div>`).join(''):'<p class="muted">Keine kommenden Termine.</p>'}</div></section><section class="card inner-card v53-panel"><div class="eyebrow">⚠️ OFFENE PUNKTE</div><h3>Was noch fehlt</h3>${missing.length?missing.map(x=>`<div class="v53-missing">○ ${esc(x)}</div>`).join(''):'<div class="v53-ready">✓ Aktuell keine offenen Kernpunkte</div>'}<div class="v53-stats"><span><small>Kapitel</small><b>${r.completed.length}/22</b></span><span><small>Tests</small><b>${(r.testResults||[]).filter(x=>x.passed).length}/5</b></span><span><small>Praxis</small><b>${(r.reports||[]).length}</b></span><span><small>Zeit</small><b>${fmtDuration(totalTrainingMinutes(r))}</b></span></div></section></div><section class="card inner-card v53-panel"><div class="eyebrow">🧾 FTO-ABSCHLUSSBEWERTUNG</div><h3>Bewertung & Empfehlung</h3><form id="v53Evaluation" class="v53-form v53-eval"><label>Stärken<textarea name="strengths" rows="3" placeholder="Was beherrscht der Recruit sicher?">${esc(ev?.strengths||'')}</textarea></label><label>Verbesserungen<textarea name="improvements" rows="3" placeholder="Was sollte weiter trainiert werden?">${esc(ev?.improvements||'')}</textarea></label><label class="v53-wide">Empfehlung<textarea name="recommendation" rows="3" placeholder="Empfehlung für nächste Phase / Abschluss">${esc(ev?.recommendation||'')}</textarea></label><label>Status<select name="result"><option ${ev?.result==='In Ausbildung'?'selected':''}>In Ausbildung</option><option ${ev?.result==='Nächste Phase empfohlen'?'selected':''}>Nächste Phase empfohlen</option><option ${ev?.result==='Abschluss empfohlen'?'selected':''}>Abschluss empfohlen</option><option ${ev?.result==='Nachschulung empfohlen'?'selected':''}>Nachschulung empfohlen</option></select></label><button class="primary">Bewertung speichern</button></form>${ev?`<p class="muted v53-saved">Letzte Bewertung: ${v53FmtDate(ev.updated_at||ev.created_at)} · ${esc(ev.author_name||'FTO')}</p>`:''}</section><section class="card inner-card v53-panel"><div class="eyebrow">🕒 ÄNDERUNGSVERLAUF</div><h3>Academy-Protokoll</h3><div class="v53-timeline">${aud.length?aud.map(x=>`<div><span>${v53FmtDate(x.created_at)}</span><b>${esc(x.action)}</b><small>${esc(x.actor_name||'System')}${x.details?' · '+esc(x.details):''}</small></div>`).join(''):'<p class="muted">Ab V5.3 werden wichtige Änderungen hier protokolliert.</p>'}</div></section></div>`;
 html=html.replace('<section class="record-tab-panel" data-record-panel="overview">',`<section class="record-tab-panel" data-record-panel="overview">${block}`);return html}
const _adminV53=admin;
admin=function(){_adminV53();if(!isTrainer(current))return;const r=db.users.find(x=>x.id===selectedRecruit);if(!r)return;const key='alta_record_tab_'+r.id;const saved=sessionStorage.getItem(key)||'overview';activateRecordTab(saved,false);document.querySelectorAll('[data-record-jump]').forEach(b=>b.addEventListener('click',()=>sessionStorage.setItem(key,b.dataset.recordJump)));$('#v53Appointment')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await sb.from('academy_appointments').insert({recruit_id:r.id,title:f.get('title'),starts_at:new Date(f.get('starts')).toISOString(),location:f.get('location'),notes:f.get('notes'),created_by:current.id,created_by_name:current.name});if(error)return alert(error.message);await v53Log(r.id,'Ausbildungstermin erstellt',String(f.get('title')));await refreshData();sessionStorage.setItem(key,'overview');admin()});document.querySelectorAll('[data-v53-del-appt]').forEach(b=>b.onclick=async()=>{if(!confirm('Termin wirklich löschen?'))return;const item=academyAppointments.find(x=>String(x.id)===String(b.dataset.v53DelAppt));const {error}=await sb.from('academy_appointments').delete().eq('id',b.dataset.v53DelAppt);if(error)return alert(error.message);await v53Log(r.id,'Ausbildungstermin gelöscht',item?.title||'');await refreshData();admin()});$('#v53Evaluation')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await sb.from('academy_final_evaluations').upsert({recruit_id:r.id,strengths:f.get('strengths'),improvements:f.get('improvements'),recommendation:f.get('recommendation'),result:f.get('result'),author_id:current.id,author_name:current.name,updated_at:new Date().toISOString()},{onConflict:'recruit_id'});if(error)return alert(error.message);await v53Log(r.id,'FTO-Bewertung gespeichert',String(f.get('result')));await refreshData();admin()})}
const _activateRecordTabV53=activateRecordTab;
activateRecordTab=function(name,scroll=true){document.querySelectorAll('[data-record-panel]').forEach(p=>p.classList.toggle('active',p.dataset.recordPanel===name));document.querySelectorAll('[data-record-jump]').forEach(b=>b.classList.toggle('active',b.dataset.recordJump===name));if(scroll){const box=document.querySelector('.record-workspace');if(box)box.scrollIntoView({behavior:'smooth',block:'start'})}}
const _dashboardV53=dashboard;
dashboard=function(){_dashboardV53();if(current?.role!=='recruit')return;const c=$('#content');if(!c)return;const ap=v53Upcoming(current.id).slice(0,3),missing=v53Missing(current);const anchor=c.querySelector('.recruit-next-v5')||c.querySelector('.stats');const html=`<section class="v53-dashboard-space"><div class="v53-grid-two"><div class="card v53-panel"><div class="eyebrow">📅 MEINE TERMINE</div><h2>Nächste Ausbildung</h2>${ap.length?ap.map(x=>`<div class="v53-row"><div><b>${esc(x.title)}</b><small>${v53FmtDate(x.starts_at)} · ${esc(x.location||'Ort offen')}</small></div></div>`).join(''):'<p class="muted">Aktuell keine Ausbildungstermine geplant.</p>'}</div><div class="card v53-panel"><div class="eyebrow">⚠️ NOCH OFFEN</div><h2>Das fehlt dir noch</h2>${missing.length?missing.slice(0,5).map(x=>`<div class="v53-missing">○ ${esc(x)}</div>`).join(''):'<div class="v53-ready">✓ Alle Kernpunkte erfüllt</div>'}</div></div></section>`;if(anchor)anchor.insertAdjacentHTML('afterend',html);else c.insertAdjacentHTML('afterbegin',html)}


/* ===== V5.4 Praxisbewertung · Entwicklung · Beobachtung · Übergabe · Abschluss ===== */
let v54Practice=[],v54Observations=[],v54Handovers=[],v54Graduations=[];
const V54_SKILLS=[
 ['radio','Funk'],['safety','Eigensicherung'],['driving','Fahrverhalten'],
 ['contact','Bürgerkontakt'],['law','Rechtskenntnisse'],['conduct','Auftreten'],['independent','Selbstständigkeit']
];
function v54Rows(rid,arr){return arr.filter(x=>x.recruit_id===rid).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))}
function v54Grad(rid){return v54Graduations.find(x=>x.recruit_id===rid)||null}
function v54Avg(x){const vals=V54_SKILLS.map(k=>+x[k[0]]||0).filter(Boolean);return vals.length?(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1):'—'}
function v54Next(r){
 const openObs=v54Rows(r.id,v54Observations).filter(x=>!x.resolved);
 if(openObs.length)return `Beobachtungspunkt bearbeiten: ${openObs[0].title}`;
 const missing=v53Missing(r);if(missing.length)return missing[0];
 if((r.completed||[]).length<22)return `Nächstes offenes Kapitel bearbeiten`;
 if((r.testResults||[]).filter(x=>x.passed).length<5)return `Nächsten freigegebenen Test abschließen`;
 return 'Abschlussprüfung / FTO-Empfehlung';
}
function v54Requirements(r){
 const passed=new Set((r.testResults||[]).filter(x=>x.passed).map(x=>x.testId));
 return [
  ['Alle 22 Kapitel',(r.completed||[]).length===22,`${(r.completed||[]).length}/22`],
  ['Alle 5 Tests',['test-a','test-b','test-c','test-d','test-e'].every(x=>passed.has(x)),`${passed.size}/5`],
  ['Mindestens 1 Praxisbericht',(r.reports||[]).length>0,`${(r.reports||[]).length} vorhanden`],
  ['Keine offenen Ausbildungsziele',!(r.goals||[]).some(x=>!x.done),`${(r.goals||[]).filter(x=>!x.done).length} offen`],
  ['Keine offenen Beobachtungspunkte',!v54Rows(r.id,v54Observations).some(x=>!x.resolved),`${v54Rows(r.id,v54Observations).filter(x=>!x.resolved).length} offen`],
  ['Pflichtfreigaben erfüllt',qualifications(r).slice(0,3).every(x=>x[2]),'Funk · EFA · Streife']
 ];
}
function v54Ready(r){return v54Requirements(r).every(x=>x[1])}
function v54Stars(n){return '★'.repeat(+n||0)+'☆'.repeat(Math.max(0,5-(+n||0)))}
function v54Development(rid){
 const rows=v54Rows(rid,v54Practice).slice().reverse();
 return V54_SKILLS.map(([key,label])=>{
  const vals=rows.map(x=>+x[key]||0).filter(Boolean),last=vals.at(-1)||0,first=vals[0]||0;
  return `<div class="v54-dev-row"><b>${label}</b><div class="v54-dev-track"><i style="width:${last*20}%"></i></div><span>${vals.length?`${first}${vals.length>1?' → '+last:''} / 5`:'—'}</span></div>`;
 }).join('');
}
const _refreshV54=refreshData;
refreshData=async function(){
 const ok=await _refreshV54();if(!ok)return ok;
 try{
  const ids=db.users.filter(x=>x.role==='recruit').map(x=>x.id);
  if(ids.length){
   const [p,o,h,g]=await Promise.all([
    sb.from('academy_practice_evaluations').select('*').in('recruit_id',ids).order('created_at',{ascending:false}),
    sb.from('academy_observation_points').select('*').in('recruit_id',ids).order('created_at',{ascending:false}),
    sb.from('academy_fto_handovers').select('*').in('recruit_id',ids).order('created_at',{ascending:false}),
    sb.from('academy_graduations').select('*').in('recruit_id',ids)
   ]);
   if(p.error)console.warn(p.error.message);if(o.error)console.warn(o.error.message);if(h.error)console.warn(h.error.message);if(g.error)console.warn(g.error.message);
   v54Practice=p.data||[];v54Observations=o.data||[];v54Handovers=h.data||[];v54Graduations=g.data||[];
  }
 }catch(e){console.warn('V5.4:',e.message)}
 return ok;
}
const _adminRecruitV54=adminRecruit;
adminRecruit=function(r){
 let html=_adminRecruitV54(r);
 const pe=v54Rows(r.id,v54Practice),obs=v54Rows(r.id,v54Observations),hands=v54Rows(r.id,v54Handovers),grad=v54Grad(r.id),req=v54Requirements(r);
 const skillFields=V54_SKILLS.map(([k,l])=>`<label>${l}<select name="${k}" required><option value="">–</option>${[1,2,3,4,5].map(n=>`<option value="${n}">${n} / 5</option>`).join('')}</select></label>`).join('');
 const practice=`<div class="v54-space">
 <section class="card inner-card v54-panel"><div class="eyebrow">⭐ PRAXIS-BEWERTUNGSBOGEN</div><h3>Leistung nach Ausbildungsfahrt bewerten</h3>
 <form id="v54PracticeForm" class="v54-form"><label>Datum<input name="date" type="date" value="${new Date().toISOString().slice(0,10)}" required></label>${skillFields}<label class="v54-wide">Kommentar<textarea name="comment" rows="3" placeholder="Gesamteindruck, besondere Situationen, Empfehlung"></textarea></label><button class="primary v54-wide">Praxisbewertung speichern</button></form>
 <div class="v54-eval-list">${pe.length?pe.slice(0,8).map(x=>`<article class="v54-eval"><div><b>${esc(x.evaluation_date)} · ${esc(x.author_name||'FTO')}</b><strong>${v54Avg(x)} / 5</strong></div><small>${V54_SKILLS.map(([k,l])=>`${l}: ${x[k]}/5`).join(' · ')}</small>${x.comment?`<p>${esc(x.comment)}</p>`:''}</article>`).join(''):'<p class="muted">Noch keine Praxisbewertungen.</p>'}</div></section>
 <section class="card inner-card v54-panel"><div class="eyebrow">📈 ENTWICKLUNG</div><h3>Entwicklungsverlauf</h3>${v54Development(r.id)}</section>
 <section class="card inner-card v54-panel"><div class="eyebrow">🚩 BEOBACHTUNGSPUNKTE</div><h3>Offene Trainingspunkte</h3><form id="v54ObservationForm" class="v54-inline"><input name="title" required maxlength="160" placeholder="z. B. Funkdisziplin im Einsatz"><button class="primary">Punkt hinzufügen</button></form>
 <div>${obs.length?obs.map(x=>`<div class="v54-observation ${x.resolved?'resolved':''}"><div><b>${x.resolved?'✓':'⚑'} ${esc(x.title)}</b><small>${v53FmtDate(x.created_at)} · ${esc(x.created_by_name||'FTO')}${x.resolved?` · erledigt ${v53FmtDate(x.resolved_at)}`:''}</small></div>${!x.resolved?`<button class="secondary" data-v54-resolve="${x.id}">Erledigt</button>`:''}</div>`).join(''):'<p class="muted">Keine Beobachtungspunkte.</p>'}</div></section></div>`;
 html=html.replace('<div id="record-practice"></div>',`<div id="record-practice"></div>${practice}`);

 const overview=`<div class="v54-space">
 <section class="card inner-card v54-next"><div><div class="eyebrow">🎯 NÄCHSTER AUSBILDUNGSSCHRITT</div><h3>${esc(v54Next(r))}</h3><p class="muted">Automatisch aus Ausbildungsstand, offenen Punkten und Freigaben ermittelt.</p></div></section>
 <section class="card inner-card v54-panel"><div class="eyebrow">🤝 FTO-ÜBERGABE</div><h3>Übergabe an nächsten Ausbilder</h3><form id="v54HandoverForm" class="v54-form"><label>Letzter Stand<textarea name="status" rows="2" required placeholder="Was wurde zuletzt gemacht?"></textarea></label><label>Stärken<textarea name="strengths" rows="2" placeholder="Was läuft sicher?"></textarea></label><label>Offene Punkte<textarea name="open" rows="2" placeholder="Was muss weiter trainiert werden?"></textarea></label><label>Nächster Schritt<textarea name="next" rows="2" placeholder="Empfehlung für den nächsten FTO">${esc(v54Next(r))}</textarea></label><button class="primary v54-wide">Übergabe speichern</button></form>
 <div>${hands.length?hands.slice(0,4).map(x=>`<article class="v54-handover"><b>${v53FmtDate(x.created_at)} · ${esc(x.author_name||'FTO')}</b><p><strong>Stand:</strong> ${esc(x.current_status)}</p><p><strong>Stärken:</strong> ${esc(x.strengths||'—')}</p><p><strong>Offen:</strong> ${esc(x.open_points||'—')}</p><p><strong>Weiter:</strong> ${esc(x.next_step||'—')}</p></article>`).join(''):'<p class="muted">Noch keine FTO-Übergabe gespeichert.</p>'}</div></section>
 <section class="card inner-card v54-panel"><div class="eyebrow">🏁 ACADEMY-ABSCHLUSS</div><h3>Freigabekette</h3><div class="v54-req">${req.map(x=>`<div class="${x[1]?'ok':'open'}"><span>${x[1]?'✓':'○'}</span><b>${x[0]}</b><small>${x[2]}</small></div>`).join('')}</div>
 <div class="v54-grad-status"><b>Status:</b> ${esc(grad?.status||'Nicht beantragt')}</div>
 <div class="v54-grad-actions">${!grad||grad.status==='Nicht beantragt'?`<button class="primary" id="v54Recommend" ${v54Ready(r)?'':'disabled'}>🎓 Abschluss empfehlen</button>`:''}${isOwner()&&grad?.status==='FTO empfohlen'?`<button class="primary" id="v54Approve">✓ Abschluss freigeben</button>`:''}${grad?.status==='Abgeschlossen'?`<button class="secondary" id="v54Certificate">📜 Abschlussurkunde drucken</button>`:''}</div>
 ${!v54Ready(r)?`<p class="muted">Freigabe noch gesperrt. Die oben mit ○ markierten Voraussetzungen fehlen.</p>`:''}</section></div>`;
 html=html.replace('<section class="record-tab-panel" data-record-panel="overview">',`<section class="record-tab-panel" data-record-panel="overview">${overview}`);
 return html;
}
function v54Certificate(r){
 const g=v54Grad(r.id),w=window.open('','_blank','width=1000,height=760');if(!w)return alert('Pop-up wurde blockiert.');
 w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Academy Urkunde - ${esc(r.name)}</title><style>@page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{margin:0;background:#071827;font-family:Arial;color:#102437;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{width:297mm;height:210mm;background:#fff;margin:auto;padding:14mm;position:relative}.frame{height:100%;border:3px solid #0c5682;outline:1px solid #8fc9ea;outline-offset:-9px;padding:20mm;text-align:center}.seal{width:90px}.k{letter-spacing:4px;color:#147db8;font-weight:700}.frame h1{font-size:38px;margin:10px}.name{font-size:31px;font-weight:800;border-bottom:1px solid #8ca0ad;display:inline-block;padding:6px 40px}.text{font-size:16px;max-width:720px;margin:18px auto;line-height:1.7}.meta{display:flex;justify-content:center;gap:40px;margin:22px}.sig{display:grid;grid-template-columns:1fr 1fr;gap:80px;margin-top:34px}.sig div{border-top:1px solid #60717d;padding-top:8px}.no{position:fixed;right:20px;bottom:20px;padding:12px 18px}@media print{.no{display:none}}</style></head><body><div class="page"><div class="frame"><img class="seal" src="assets/mrpd-logo.svg"><div class="k">Mission Row Police Department</div><h1>ACADEMY ABSCHLUSSURKUNDE</h1><p>Hiermit wird bestätigt, dass</p><div class="name">${esc(r.name)}</div><p class="text">die vorgesehene Recruit-Ausbildung des Mission Row Police Department erfolgreich abgeschlossen und die dokumentierten Ausbildungsanforderungen erfüllt hat.</p><div class="meta"><b>Dienstnummer: ${esc(r.serviceNo||'—')}</b><b>Leiter FTO: ${esc(r.fto||'—')}</b><b>Abschluss: ${g?.approved_at?new Date(g.approved_at).toLocaleDateString('de-DE'):'—'}</b></div><div class="sig"><div>Recruit</div><div>Ausbildungsleitung / Command</div></div></div></div><button class="no" onclick="print()">PDF / Drucken</button></body></html>`);w.document.close();setTimeout(()=>w.print(),500)
}
const _adminV54=admin;
admin=function(){
 _adminV54();if(!isTrainer(current))return;
 const r=db.users.find(x=>x.id===selectedRecruit);if(!r)return;
 const keep=async(tab,fn)=>{await fn();await refreshData();sessionStorage.setItem('alta_record_tab_'+r.id,tab);admin()};
 $('#v54PracticeForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);await keep('practice',async()=>{const row={recruit_id:r.id,evaluation_date:f.get('date'),author_id:current.id,author_name:current.name,comment:f.get('comment')};V54_SKILLS.forEach(([k])=>row[k]=+f.get(k));const {error}=await sb.from('academy_practice_evaluations').insert(row);if(error)throw new Error(error.message);await v53Log(r.id,'Praxisbewertung gespeichert',`Ø ${v54Avg(row)}/5`)})});
 $('#v54ObservationForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);await keep('practice',async()=>{const {error}=await sb.from('academy_observation_points').insert({recruit_id:r.id,title:f.get('title'),created_by:current.id,created_by_name:current.name});if(error)throw new Error(error.message);await v53Log(r.id,'Beobachtungspunkt erstellt',String(f.get('title')))})});
 document.querySelectorAll('[data-v54-resolve]').forEach(b=>b.onclick=()=>keep('practice',async()=>{const {error}=await sb.from('academy_observation_points').update({resolved:true,resolved_at:new Date().toISOString(),resolved_by:current.id}).eq('id',b.dataset.v54Resolve);if(error)throw new Error(error.message);await v53Log(r.id,'Beobachtungspunkt erledigt','')}));
 $('#v54HandoverForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);await keep('overview',async()=>{const {error}=await sb.from('academy_fto_handovers').insert({recruit_id:r.id,author_id:current.id,author_name:current.name,current_status:f.get('status'),strengths:f.get('strengths'),open_points:f.get('open'),next_step:f.get('next')});if(error)throw new Error(error.message);await v53Log(r.id,'FTO-Übergabe gespeichert',String(f.get('next')))})});
 $('#v54Recommend')?.addEventListener('click',()=>keep('overview',async()=>{if(!v54Ready(r))return;const {error}=await sb.from('academy_graduations').upsert({recruit_id:r.id,status:'FTO empfohlen',recommended_by:current.id,recommended_by_name:current.name,recommended_at:new Date().toISOString()},{onConflict:'recruit_id'});if(error)throw new Error(error.message);await v53Log(r.id,'Academy-Abschluss empfohlen','FTO-Empfehlung')}));
 $('#v54Approve')?.addEventListener('click',()=>keep('overview',async()=>{if(!isOwner())return;const {error}=await sb.from('academy_graduations').update({status:'Abgeschlossen',approved_by:current.id,approved_by_name:current.name,approved_at:new Date().toISOString()}).eq('recruit_id',r.id);if(error)throw new Error(error.message);await sb.rpc('staff_update_recruit',{target_id:r.id,new_fto:r.fto,new_status:'Ausbildung abgeschlossen',new_rank:r.rank});await v53Log(r.id,'Academy erfolgreich abgeschlossen','Freigabe durch Ausbildungsleitung')}));
 $('#v54Certificate')?.addEventListener('click',()=>v54Certificate(r));
}
const _dashboardV54=dashboard;
dashboard=function(){
 _dashboardV54();if(current?.role!=='recruit')return;const c=$('#content');if(!c)return;
 const obs=v54Rows(current.id,v54Observations).filter(x=>!x.resolved),pe=v54Rows(current.id,v54Practice),g=v54Grad(current.id);
 const html=`<section class="card v54-recruit-home"><div class="eyebrow">🎯 DEIN NÄCHSTER SCHRITT</div><h2>${esc(v54Next(current))}</h2><div class="v54-home-grid"><span><small>Praxisbewertungen</small><b>${pe.length}</b></span><span><small>Offene Beobachtungen</small><b>${obs.length}</b></span><span><small>Academy-Status</small><b>${esc(g?.status||'In Ausbildung')}</b></span></div></section>`;
 const a=c.querySelector('.v53-dashboard-space');if(a)a.insertAdjacentHTML('afterend',html);else c.insertAdjacentHTML('afterbegin',html)
}


/* ===== V5.4.1 Dashboard Layout & Übersicht ===== */
const _dashboardV541=dashboard;
dashboard=function(){
  _dashboardV541();
  const c=document.querySelector('#content');
  if(!c)return;
  c.classList.add('dashboard-v541');
  const hero=c.querySelector('.hero');
  const stats=c.querySelector('.stats');
  if(hero) hero.classList.add('dash-zone','dash-zone-hero');
  if(stats) stats.classList.add('dash-zone','dash-zone-status');
  c.querySelectorAll('.today-card,.v53-dashboard-space,.v54-recruit-home,.recruit-next-v5,.academy-pass-home-v51,.dashboard-two,.activity-card,.fto-cockpit-v5,.fto-stats').forEach(el=>el.classList.add('dash-zone'));
  const chapterGrid=c.querySelector('.chapter-grid');
  if(chapterGrid){
    chapterGrid.classList.add('dash-zone','dash-zone-chapters');
    const head=chapterGrid.previousElementSibling;
    if(head?.classList.contains('section-head')) head.classList.add('dash-chapter-head');
  }
  // Die Dashboard-Inhalte bleiben vollständig erhalten; nur die visuelle Hierarchie wird verbessert.
};

/* ===== V5.4.3 – Komfort & Übersicht ===== */
function setupSidebarCollapseV543(){
 const b=document.querySelector('#sidebarCollapseBtn'); if(!b||b.dataset.bound543)return;
 b.dataset.bound543='1';
 const apply=()=>{const collapsed=localStorage.getItem('apd_sidebar_collapsed')==='1';document.body.classList.toggle('sidebar-collapsed',collapsed);b.textContent=collapsed?'⇥':'⇤';b.title=collapsed?'Seitenleiste ausklappen':'Seitenleiste einklappen'};
 b.onclick=()=>{localStorage.setItem('apd_sidebar_collapsed',document.body.classList.contains('sidebar-collapsed')?'0':'1');apply()};apply();
}
function portalSearchItemsV543(){
 const views=[['cad','🗂️','CAD- & Akten-Simulator','Übungsakten, Personen, Fahrzeuge und Prüfungsaufträge'],['dashboard','🏠','Dashboard','Übersicht und Ausbildungsstatus'],['tests','📝','Tests','Prüfungen und Testergebnisse'],['news','📢','Mitteilungen','Department News und Hinweise'],['documents','📂','Dokumente','Favoriten, zuletzt angesehen und Druckzugriff'],['account','👤','Mein Account','Profil, Dienstnummer und Sicherheit']];
 if(isTrainer(current))views.push(['accounts','👤','Account-Verwaltung','Recruit- und Ausbilder-Accounts'],['admin','📂','Rekruten Ausbildungsakten','Ausbildungsakten und FTO-Dokumentation']);
 if(isOwner())views.push(['calendar','📅','Ausbildungskalender','Termine und Planung'],['command','⚡','Command Center','Führung und Academy-Übersicht']);
 return views.map(x=>({type:'view',id:x[0],icon:x[1],title:x[2],sub:x[3]}));
}
function setupSearchV543(){
 const input=$('#globalSearch'),box=$('#searchResults');if(!input||!box||input.dataset.v543)return;input.dataset.v543='1';
 input.oninput=e=>{const q=e.target.value.trim().toLowerCase();if(!q){box.classList.add('hidden');return}
  const chapters=titles.map(x=>({type:'chapter',id:x.n,icon:chapterIcons[x.n]||'📘',title:`Kapitel ${chapterNumber(x.n)}: ${x.title}`,sub:'Rekrutenhandbuch',hay:(x.title+' '+(CHAPTERS[x.n].html||'').replace(/<[^>]+>/g,' ')).toLowerCase()})).filter(x=>x.hay.includes(q));
  const views=portalSearchItemsV543().filter(x=>(x.title+' '+x.sub).toLowerCase().includes(q));
  const recruits=isTrainer(current)?db.users.filter(x=>x.role==='recruit'&&(x.name+' '+(x.serviceNo||'')+' '+(x.username||'')).toLowerCase().includes(q)).map(x=>({type:'recruit',id:x.id,icon:'👮',title:x.name,sub:`Recruit · #${x.serviceNo||'—'} · Ausbildungsakte`})):[];
  const hits=[...views,...recruits,...chapters].slice(0,14);
  box.innerHTML=hits.length?`<div class="search-group-title">SUCHERGEBNISSE</div>`+hits.map((x,i)=>`<button class="search-item search-item-v543" data-search-i="${i}"><span>${x.icon}</span><span><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></span><i>→</i></button>`).join(''):`<div class="search-empty"><b>Keine Treffer</b><small>Suche z. B. nach „Funk“, „Tests“, „Account“ oder einem Recruit.</small></div>`;
  box.classList.remove('hidden');box.querySelectorAll('[data-search-i]').forEach(b=>b.onclick=()=>{const x=hits[+b.dataset.searchI];box.classList.add('hidden');input.value='';if(x.type==='chapter')showChapter(+x.id);else if(x.type==='recruit'){selectedRecruit=x.id;recruitRecordClosed=false;showView('admin')}else showView(x.id)});
 };
}
function workflowItemsV543(){
 if(!current)return[];const out=[];
 if(current.role==='recruit'){
  const open=(current.goals||[]).filter(x=>!x.done);if(open.length)out.push({icon:'🎯',title:`${open.length} offene Ausbildungsziele`,sub:'Deine nächsten Aufgaben ansehen',view:'dashboard'});
  const assigned=(current.assignedTests||[]).length;if(assigned)out.push({icon:'📝',title:`${assigned} freigegebene Tests`,sub:'Zu den Prüfungen',view:'tests'});
  if(progress(current)<100)out.push({icon:'📚',title:`Noch ${22-(current.completed||[]).length} Kapitel offen`,sub:'Ausbildung fortsetzen',chapter:Math.min(22,Math.max(1,...(current.completed||[]),0)+1)});
 }else{
  const rs=db.users.filter(x=>x.role==='recruit');const att=rs.filter(x=>readiness(x)[0]==='Handlungsbedarf').length;if(att)out.push({icon:'⚠️',title:`${att} Recruit${att===1?'':'s'} mit Handlungsbedarf`,sub:'Ausbildungsakten prüfen',view:'admin'});
  const ready=rs.filter(x=>readiness(x)[0]==='Abschlussbereit').length;if(ready)out.push({icon:'🎓',title:`${ready} Recruit${ready===1?'':'s'} abschlussbereit`,sub:'Abschlussfreigabe prüfen',view:'admin'});
  const open=rs.reduce((a,x)=>a+(x.goals||[]).filter(g=>!g.done).length,0);if(open)out.push({icon:'🎯',title:`${open} offene Ausbildungsziele`,sub:'Rekrutenakten öffnen',view:'admin'});
 }
 return out;
}
openWorkflowNotifications=function(){
 document.querySelector('.workflow-pop')?.remove();const items=workflowItemsV543(),d=document.createElement('div');d.className='workflow-pop workflow-pop-v543';
 d.innerHTML=`<div class="workflow-pop-head"><div><b>🔔 Benachrichtigungen</b><small>${items.length?items.length+' offene Hinweise':'Alles erledigt'}</small></div><button type="button">×</button></div><div class="workflow-list-v543">${items.length?items.map((x,i)=>`<button class="workflow-note workflow-note-v543" data-notify-i="${i}"><span>${x.icon}</span><span><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></span><i>→</i></button>`).join(''):'<div class="workflow-empty">✓ Aktuell nichts offen.</div>'}</div>`;
 document.body.appendChild(d);d.querySelector('.workflow-pop-head button').onclick=()=>d.remove();d.querySelectorAll('[data-notify-i]').forEach(b=>b.onclick=()=>{const x=items[+b.dataset.notifyI];d.remove();x.chapter?showChapter(x.chapter):showView(x.view||'dashboard')});
}
function relativeDateV543(value){const d=new Date(value),diff=d-Date.now(),mins=Math.round(diff/60000);if(!Number.isFinite(mins))return'';if(mins<0)return'läuft/war bereits';if(mins<60)return`in ${mins} Min.`;const h=Math.round(mins/60);if(h<24)return`in ${h} Std.`;const days=Math.round(h/24);return days===1?'morgen':`in ${days} Tagen`}
const _calendarV543=calendarView;calendarView=function(){_calendarV543();document.querySelectorAll('#content .test-result-row').forEach((row,i)=>{const e=trainingEvents[i];if(e?.starts_at&&!row.querySelector('.countdown-v543'))row.querySelector('small')?.insertAdjacentHTML('beforeend',` <span class="countdown-v543">· ${relativeDateV543(e.starts_at)}</span>`)})};
const _ensureChromeV543=ensureChrome;ensureChrome=function(){_ensureChromeV543();setupSidebarCollapseV543();setupSearchV543()};
const _navV543=nav;nav=function(){_navV543();setupSidebarCollapseV543();setupSearchV543()};

/* ===== V5.4.4 – Sidebar Collapse FIX ===== */
function sidebarTooltipsV544(){
 document.querySelectorAll('.sidebar .nav-btn').forEach(b=>{
  if(!b.title){const clone=b.cloneNode(true);clone.querySelectorAll('.chapter-nav-icon').forEach(x=>x.remove());const label=(clone.textContent||'').trim().replace(/^\p{Extended_Pictographic}+\s*/u,'');if(label)b.title=label;}
 });
}
const _navV544=nav;nav=function(){_navV544();sidebarTooltipsV544();};
setTimeout(sidebarTooltipsV544,0);

/* ===== V5.5.1 – Final Polish & QA ===== */
(function(){
 function labelFor(btn){
  const raw=(btn.textContent||'').replace(/\s+/g,' ').trim();
  return raw || btn.getAttribute('aria-label') || 'Menü';
 }
 function enhanceChromeV551(){
  document.querySelectorAll('.sidebar .nav-btn').forEach(btn=>{
   if(!btn.dataset.tip) btn.dataset.tip=labelFor(btn);
   if(!btn.title) btn.title=btn.dataset.tip;
  });
  const pill=document.querySelector('.user-pill');
  if(pill){pill.tabIndex=0;pill.setAttribute('role','button');pill.setAttribute('aria-label','Mein Account öffnen');}
 }
 const obs=new MutationObserver(()=>enhanceChromeV551());
 document.addEventListener('DOMContentLoaded',()=>{enhanceChromeV551();const nav=document.querySelector('.sidebar');if(nav)obs.observe(nav,{childList:true,subtree:true});});
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
   document.querySelectorAll('.workflow-pop-v543,.search-results').forEach(x=>x.classList.add('hidden'));
   const gs=document.querySelector('#globalSearch');if(gs)gs.blur();
  }
  if(e.key==='Enter' && document.activeElement?.classList?.contains('user-pill')) document.activeElement.click();
 });
 window.addEventListener('error',e=>{
  if(!e.message || /ResizeObserver loop/i.test(e.message))return;
  try{toast('⚠ Etwas konnte nicht geladen werden. Bitte erneut versuchen.')}catch{}
 });
 window.addEventListener('unhandledrejection',()=>{try{toast('⚠ Aktion fehlgeschlagen. Verbindung prüfen und erneut versuchen.')}catch{}});
})();

/* Alte Router V5.5.2 und V5.6 deaktiviert; nur V6.4.1 bleibt aktiv. */

/* ===== V5.6.1 – Ausbilder-Ränge ===== */
(function(){
 const officialTrainerRanksV561=["Chief of Police","Assistant Chief","Deputy Chief","Commander","Captain","Sergeant","Detective","Police Officer","Recruit"];
 const oldAdminV561=admin;
 admin=function(){
  oldAdminV561();
  document.querySelectorAll('select[data-rank]').forEach(sel=>{
   const trainer=db.users.find(u=>u.id===sel.dataset.rank);
   if(trainer?.rank && !officialTrainerRanksV561.includes(trainer.rank) && ![...sel.options].some(o=>o.value===trainer.rank)){
    const o=document.createElement('option');o.value=trainer.rank;o.textContent=trainer.rank+' (Altbestand)';o.selected=true;sel.prepend(o);
   }
  });
 };
})();



/* ===== V5.6.5 – Academy Leaderboard ===== */
function v565WeekBounds(){
 const now=new Date(), d=new Date(now); d.setHours(0,0,0,0);
 const day=(d.getDay()+6)%7; const start=new Date(d); start.setDate(d.getDate()-day);
 const end=new Date(start); end.setDate(start.getDate()+7);
 return {start,end,now};
}
function v565Date(x){const d=x?new Date(x):null;return d&&!isNaN(d)?d:null}
function v565InWeek(x,b){const d=v565Date(x);return !!d&&d>=b.start&&d<b.end}
function v565PassedTests(r){return (r.testResults||[]).filter(x=>x.passed).length}
function v565WeekScore(r,b){
 let pts=0,activity=0;
 const audits=(typeof academyAudit!=='undefined'?academyAudit:[]).filter(x=>x.recruit_id===r.id&&v565InWeek(x.created_at,b));
 audits.forEach(x=>{
  const a=String(x.action||'').toLowerCase(); let p=4;
  if(a.includes('abschluss'))p=18;
  else if(a.includes('praxis')||a.includes('bewertung'))p=12;
  else if(a.includes('ziel')||a.includes('termin'))p=7;
  else if(a.includes('freigabe')||a.includes('qualifikation'))p=10;
  pts+=p; activity++;
 });
 (r.testResults||[]).forEach(x=>{const when=x.created_at||x.completed_at||x.date;if(v565InWeek(when,b)){pts+=x.passed?18:5;activity++}});
 (r.reports||[]).forEach(x=>{const when=x.created_at||x.date||x.timestamp;if(v565InWeek(when,b)){pts+=12;activity++}});
 (r.goals||[]).forEach(x=>{const when=x.completed_at||x.updated_at;if(x.done&&v565InWeek(when,b)){pts+=8;activity++}});
 return {pts,activity};
}
function v565Trend(r,b){
 const pct=progress(r), open=(r.goals||[]).filter(g=>!g.done).length;
 if(pct>=90&&open<=1)return ['▲','Stark','up'];
 if(pct>=60)return ['●','Stabil','flat'];
 if(pct>=30)return ['↗','Aufbau','up'];
 return ['○','Startphase','flat'];
}
function v565LeaderboardData(){
 const b=v565WeekBounds();
 return db.users.filter(x=>apdActiveRecruit(x)).map(r=>{
  const w=v565WeekScore(r,b), tr=v565Trend(r,b);
  const practice=(typeof academyPracticeEvaluations!=='undefined'?academyPracticeEvaluations:[]).filter(x=>x.recruit_id===r.id);
  let avg=0;if(practice.length){const vals=[];practice.forEach(x=>['radio','safety','driving','citizen','law','appearance','independence'].forEach(k=>{const v=+x[k];if(v)vals.push(v)}));if(vals.length)avg=vals.reduce((a,v)=>a+v,0)/vals.length}
  return {r,points:w.pts,activity:w.activity,pct:progress(r),tests:v565PassedTests(r),practice:practice.length,avg,trend:tr};
 }).sort((a,b)=>b.points-a.points||b.pct-a.pct||b.tests-a.tests||a.r.name.localeCompare(b.r.name,'de'));
}
function leaderboardViewV565(){
 setActive('[data-view="leaderboard"]');$('#pageTitle').textContent='Academy Leaderboard';
 const b=v565WeekBounds(), all=v565LeaderboardData(), top=all.slice(0,10);
 const end=new Date(b.end);end.setDate(end.getDate()-1);
 const weekLabel=`${b.start.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})} – ${end.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})}`;
 const podium=[top[1],top[0],top[2]], places=[2,1,3], medals=['🥈','🥇','🥉'];
 const bestProgress=[...all].sort((a,b)=>b.pct-a.pct)[0], bestTests=[...all].sort((a,b)=>b.tests-a.tests)[0], bestPractice=[...all].sort((a,b)=>b.avg-a.avg)[0], mostActive=[...all].sort((a,b)=>b.activity-a.activity)[0];
 const pod=podium.map((x,i)=>x?`<div class="lb-podium lb-place-${places[i]}"><div class="lb-medal">${medals[i]}</div><img src="${esc(x.r.avatarUrl||'assets/mrpd-logo.svg')}" onerror="this.src='assets/mrpd-logo.svg'"><small>PLATZ ${places[i]}</small><h3>${esc(x.r.name)}</h3><span>${esc(x.r.serviceNo||'—')} · ${esc(x.r.rank||'Recruit')}</span><strong>${x.points} P</strong><div class="lb-mini-progress"><i style="width:${x.pct}%"></i></div><em>${x.pct}% Ausbildung</em></div>`:'<div class="lb-podium lb-empty">—</div>').join('');
 const rows=top.map((x,i)=>`<div class="lb-row ${i<3?'top':''}"><div class="lb-rank">${i+1}</div><div class="lb-person"><img src="${esc(x.r.avatarUrl||'assets/mrpd-logo.svg')}" onerror="this.src='assets/mrpd-logo.svg'"><div><b>${esc(x.r.name)}</b><small>${esc(x.r.serviceNo||'—')} · ${esc(x.r.rank||'Recruit')} · FTO: ${esc(x.r.fto||'—')}</small></div></div><div><small>Phase</small><b>${esc(stage(x.r))}</b></div><div><small>Fortschritt</small><b>${x.pct}%</b></div><div><small>Tests</small><b>${x.tests}/5</b></div><div><small>Praxis</small><b>${x.practice}</b></div><div class="lb-points"><small>Woche</small><b>${x.points} P</b></div><div class="lb-trend ${x.trend[2]}">${x.trend[0]} ${x.trend[1]}</div></div>`).join('');
 $('#content').innerHTML=moduleHead('🥇 ACADEMY TOOLS','Academy Leaderboard','Top 10 der aktiven Rekruten – Wochenleistung und aktueller Ausbildungsstand.')+
 `<section class="card lb-hero"><div><div class="eyebrow">AKTUELLE WOCHE</div><h2>${weekLabel}</h2><p class="muted">Wochenpunkte entstehen aus dokumentierten Academy-Aktivitäten, Tests, Praxis und abgeschlossenen Ausbildungszielen. Der Gesamtfortschritt dient bei Gleichstand als nächstes Kriterium.</p></div><div class="lb-week-badge"><span>🏆</span><b>${all.length}</b><small>aktive Recruits</small></div></section>
 ${top.length?`<section class="lb-podium-wrap">${pod}</section>`:`<div class="card empty-state-v551"><b>Noch keine Recruits</b>Das Leaderboard füllt sich automatisch, sobald Recruit-Accounts vorhanden sind.</div>`}
 <section class="card lb-highlights"><div><small>🚀 Höchster Fortschritt</small><b>${bestProgress?esc(bestProgress.r.name)+' · '+bestProgress.pct+'%':'—'}</b></div><div><small>📝 Beste Testbilanz</small><b>${bestTests?esc(bestTests.r.name)+' · '+bestTests.tests+'/5':'—'}</b></div><div><small>🎯 Praxis</small><b>${bestPractice&&bestPractice.practice?esc(bestPractice.r.name)+' · '+bestPractice.practice+' Bewertungen':'—'}</b></div><div><small>⚡ Aktivität der Woche</small><b>${mostActive&&mostActive.activity?esc(mostActive.r.name)+' · '+mostActive.activity+' Aktionen':'—'}</b></div></section>
 ${top.length?`<section class="card lb-table-card"><div class="section-head compact"><div><div class="eyebrow">TOP 10</div><h2>Wochenrangliste</h2></div><span class="status">Montag – Sonntag</span></div><div class="lb-list">${rows}</div><p class="muted lb-note">Das Leaderboard ist eine Motivationsübersicht. Ausbildungsfreigaben und FTO-Bewertungen werden dadurch nicht verändert.</p></section>`:''}`;
}


/* ===== V5.7 FINAL POLISH / QA ===== */
(function(){
  const VERSION='5.7';

  function v57EnsureFooter(){
    if(document.getElementById('v57SystemFooter')) return;
    const el=document.createElement('div');
    el.id='v57SystemFooter';
    el.className='v57-system-footer';
    el.innerHTML='<span>MRPD Academy Portal · v'+VERSION+'</span><span class="v57-system-ok"><i></i> System bereit</span>';
    document.body.appendChild(el);
  }

  function v57EmptyStates(){
    document.querySelectorAll('.card,.panel,.admin-card,.record-card').forEach(card=>{
      if(card.dataset.v57Checked) return;
      card.dataset.v57Checked='1';
      const text=(card.textContent||'').trim();
      if(!text && card.children.length===0){
        card.innerHTML='<div class="v57-empty"><span>◫</span><b>Keine Einträge vorhanden</b><small>Hier erscheinen Daten, sobald sie verfügbar sind.</small></div>';
      }
    });
  }

  function v57ProtectActions(){
    document.addEventListener('click',e=>{
      const b=e.target.closest('button');
      if(!b || b.disabled || b.dataset.v57Busy==='1') return;
      const txt=(b.textContent||'').toLowerCase();
      const actionWords=['speichern','erstellen','zurücksetzen','löschen','freigeben','abschließen'];
      if(!actionWords.some(x=>txt.includes(x))) return;
      b.dataset.v57Busy='1';
      b.classList.add('v57-action-pending');
      setTimeout(()=>{b.dataset.v57Busy='0';b.classList.remove('v57-action-pending')},900);
    },true);
  }

  function v57NormalizeErrors(){
    window.addEventListener('unhandledrejection',e=>{
      const raw=String(e.reason?.message||e.reason||'');
      if(!raw) return;
      let msg='Aktion konnte nicht abgeschlossen werden.';
      if(/duplicate|unique/i.test(raw)) msg='Dieser Eintrag existiert bereits. Bitte Eingaben prüfen.';
      else if(/permission|policy|rls|403/i.test(raw)) msg='Dafür fehlt die erforderliche Berechtigung.';
      else if(/network|fetch|offline/i.test(raw)) msg='Keine Verbindung zum Server. Bitte Verbindung prüfen und erneut versuchen.';
      if(typeof toast==='function') toast(msg,'error');
    });
  }

  function v57FitLongText(){
    document.querySelectorAll('h1,h2,h3,.hero h1,.hero h2,.profile-name,.recruit-name').forEach(el=>{
      if((el.textContent||'').trim().length>28) el.classList.add('v57-long-title');
    });
  }

  const obs=new MutationObserver(()=>{v57EnsureFooter();v57EmptyStates();v57FitLongText()});
  if(document.body) obs.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',()=>{v57EnsureFooter();v57EmptyStates();v57FitLongText();v57ProtectActions();v57NormalizeErrors()});
  if(document.readyState!=='loading'){v57EnsureFooter();v57EmptyStates();v57FitLongText();v57ProtectActions();v57NormalizeErrors()}
})();



/* ===== V5.8.2 – LIVE ROUTE FINAL ROUTER FIX ===== */
const _showViewV582=showView;
showView=function(v){
  if(v==='command-live') return v58RenderLiveUsers();
  return _showViewV582(v);
};

/* ===== V5.8 – COMMAND CENTER / LIVE-BENUTZER ===== */
let v58PresenceChannel=null;
let v58PresenceStartedAt=new Date().toISOString();
let v58PresenceCurrentView='dashboard';

function v58IsCommandUser(){ return isOwner(current); }
function v58PresenceMe(){
  if(typeof current!=='undefined' && current) return current;
  if(typeof currentUser!=='undefined' && currentUser) return currentUser;
  return null;
}
function v58PresenceName(){
  const me=v58PresenceMe()||{};
  return me.name||me.username||'Unbekannt';
}
function v58PresenceViewLabel(v){
  if(!v)return 'Dashboard';
  if(String(v).startsWith('chapter-'))return 'Kapitel '+String(v).split('-')[1];
  const map={'dashboard':'Dashboard','command':'Command Center','command-live':'Live-Benutzer','accounts':'Account-Verwaltung','admin':'Ausbildungsakten','tests':'Tests','account':'Mein Account','leaderboard':'Academy Leaderboard','scenario':'Einsatz-Simulator','radio':'Funk-Trainer','mapquiz':'Kartenprüfung','plan':'Ausbildungsplan','rides':'Ausbildungsfahrt','dienstbuch':'Dienstbuch','messages':'Nachrichten'};
  return map[v]||String(v).replaceAll('-',' ');
}
async function v58TrackPresence(view){
  v58PresenceCurrentView=view||v58PresenceCurrentView;
  const me=v58PresenceMe();
  if(!v58PresenceChannel || !me)return;
  try{
    await v58PresenceChannel.track({
      user_id:me.id,
      name:v58PresenceName(),
      username:me.username||'',
      role:me.role||'',
      rank:me.rank||'',
      service_no:me.serviceNo||me.service_no||'',
      view:v58PresenceViewLabel(v58PresenceCurrentView),
      online_since:v58PresenceStartedAt,
      last_active:new Date().toISOString()
    });
  }catch(e){console.warn('Presence track failed',e)}
}
function v58StartPresence(){
  if(v58PresenceChannel || typeof sb==='undefined' || !sb || ((typeof current==='undefined'||!current)&&(typeof currentUser==='undefined'||!currentUser)))return;
  try{
    v58PresenceChannel=sb.channel('MRPD-portal-presence',{
      config:{presence:{key:String((v58PresenceMe()||{}).id||(v58PresenceMe()||{}).username||Math.random())}}
    });
    v58PresenceChannel
      .on('presence',{event:'sync'},()=>{if(v58PresenceCurrentView==='command-live')v58RenderLiveUsers()})
      .on('presence',{event:'join'},()=>{if(v58PresenceCurrentView==='command-live')v58RenderLiveUsers()})
      .on('presence',{event:'leave'},()=>{if(v58PresenceCurrentView==='command-live')v58RenderLiveUsers()})
      .subscribe(async status=>{if(status==='SUBSCRIBED')await v58TrackPresence(v58PresenceCurrentView)});
  }catch(e){console.warn('Presence unavailable',e)}
}
function v58PresenceUsers(){
  if(!v58PresenceChannel)return[];
  const state=v58PresenceChannel.presenceState()||{};
  const byId=new Map();
  Object.values(state).flat().forEach(p=>{
    const id=p.user_id||p.username||p.presence_ref;
    if(!id)return;
    const old=byId.get(id);
    if(!old || new Date(p.last_active||0)>new Date(old.last_active||0))byId.set(id,p);
  });
  return [...byId.values()].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'de'));
}
function v58Ago(iso){
  const s=Math.max(0,Math.floor((Date.now()-new Date(iso||Date.now()).getTime())/1000));
  if(s<15)return 'gerade eben'; if(s<60)return `vor ${s} Sek.`; const m=Math.floor(s/60); if(m<60)return `vor ${m} Min.`; return `vor ${Math.floor(m/60)} Std.`;
}
function v58RenderLiveUsers(){
  if(!v58IsCommandUser()){if(typeof showView==='function')showView('dashboard');return}
  v58PresenceCurrentView='command-live';v58TrackPresence('command-live');
  if(typeof setActive==='function')setActive('[data-view="command-live"]');
  const pt=document.getElementById('pageTitle');if(pt)pt.textContent='Live-Benutzer';
  const users=v58PresenceUsers(), recruits=users.filter(x=>x.role==='recruit').length, staff=users.length-recruits;
  const rows=users.map(u=>`<div class="v58-live-row">
    <div class="v58-live-avatar"><span></span><img src="assets/mrpd-logo.svg" alt=""></div>
    <div class="v58-live-person"><b>${typeof esc==='function'?esc(u.name||u.username||'Unbekannt'):u.name}</b><small>${typeof esc==='function'?esc((u.rank||u.role||'—')+(u.service_no?' · #'+u.service_no:'')):''}</small></div>
    <div><small>Aktueller Bereich</small><b>${typeof esc==='function'?esc(u.view||'Portal'):u.view}</b></div>
    <div><small>Online seit</small><b>${new Date(u.online_since||Date.now()).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})} Uhr</b></div>
    <div><small>Letzte Aktivität</small><b>${v58Ago(u.last_active)}</b></div>
  </div>`).join('');
  const content=document.getElementById('content');if(!content)return;
  content.innerHTML=`<div class="v58-live-head"><div><div class="eyebrow">COMMAND CENTER</div><h1>🟢 Live-Benutzer</h1><p>Aktuell mit dem MRPD Portal verbundene Benutzer.</p></div><div class="v58-live-count">${users.length}<small>ONLINE</small></div></div>
  <div class="v58-live-stats"><div><span class="green"></span><b>${users.length}</b><small>Gesamt online</small></div><div><b>${recruits}</b><small>Rekruten</small></div><div><b>${staff}</b><small>Ausbilder / Command</small></div></div>
  <section class="card v58-live-card"><div class="section-head compact"><div><div class="eyebrow">LIVE STATUS</div><h2>Angemeldete Benutzer</h2></div><span class="status">Realtime</span></div>
  <div class="v58-live-list">${rows||'<div class="v58-live-empty">Aktuell ist kein weiterer Benutzer online.</div>'}</div>
  <p class="muted v58-live-note">Ein Benutzer gilt als online, solange eine aktive Verbindung zum Portal besteht. Geschlossene Tabs und Abmeldungen verschwinden automatisch aus der Liste.</p></section>`;
}
(function(){
  const oldShow=window.showView;
  if(typeof oldShow==='function'){
    window.showView=function(v,...args){
      if(v==='command-live'){v58RenderLiveUsers();return}
      v58PresenceCurrentView=v||'dashboard';v58TrackPresence(v58PresenceCurrentView);
      return oldShow.call(this,v,...args);
    };
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-view]');
    if(b)v58TrackPresence(b.dataset.view);
  },true);
  ['click','keydown','pointerdown'].forEach(ev=>document.addEventListener(ev,()=>v58TrackPresence(v58PresenceCurrentView),{passive:true}));
  document.addEventListener('DOMContentLoaded',()=>{setTimeout(v58StartPresence,700);setTimeout(v58StartPresence,2200)});
  if(document.readyState!=='loading'){setTimeout(v58StartPresence,700);setTimeout(v58StartPresence,2200)}
  const v58PresenceRetry=setInterval(()=>{if(v58PresenceMe()){v58StartPresence();if(v58PresenceChannel)clearInterval(v58PresenceRetry)}},1500);
  setTimeout(()=>clearInterval(v58PresenceRetry),30000);
})();

/* ===== V5.9 – DAILY HUB / FINAL COMPLETION ===== */
function v590SafeDate(v){try{const d=new Date(v);return isNaN(d)?null:d}catch(_){return null}}
function v590Notifications(u=current){
 const out=[];
 const goals=(u.goals||[]).filter(x=>!x.done);
 if(goals.length)out.push({i:'🎯',t:`${goals.length} offene${goals.length===1?'s':''} Ausbildungsziel${goals.length===1?'':'e'}`,v:'plan'});
 const assigned=(u.assignedTests||[]);if(assigned.length)out.push({i:'📝',t:`${assigned.length} zugewiesene Prüfung${assigned.length===1?'':'en'}`,v:'tests'});
 const fav=(u.favorites||u.favouriteChapters||[]);if(fav.length)out.push({i:'⭐',t:`${fav.length} Kapitel als Favorit gespeichert`,v:'documents'});
 const p=typeof progress==='function'?progress(u):0;
 if(u.role==='recruit'&&p<100)out.push({i:'📘',t:`Ausbildungsfortschritt ${p}% · ${22-(u.completed||[]).length} Kapitel offen`,v:'dashboard'});
 if(typeof trainingEvents!=='undefined'&&trainingEvents.length)out.push({i:'📅',t:`${trainingEvents.length} Termin${trainingEvents.length===1?'':'e'} im Ausbildungskalender`,v:'calendar'});
 return out.slice(0,6);
}
function v590Hub(){
 const host=document.getElementById('v590DailyHub');if(!host||!current)return;
 const u=current, notes=v590Notifications(u), rides=academyGet('rides',[]), mins=rides.reduce((a,x)=>a+(+x.minutes||0),0);
 const passed=(u.testResults||[]).filter(x=>x.passed).length, fav=(u.favorites||u.favouriteChapters||[]);
 host.innerHTML=`<div class="v590-hub-head"><div><div class="eyebrow">MEIN PORTAL HEUTE</div><h2>Auf einen Blick</h2></div><button class="secondary v590-search-open">⌘ Suche</button></div>
 <div class="v590-kpis"><button data-v590-view="tests"><small>BESTANDENE TESTS</small><b>${passed}</b></button><button data-v590-view="rides"><small>PRAXISZEIT</small><b>${fmtDuration(mins)}</b></button><button data-v590-view="documents"><small>FAVORITEN</small><b>${fav.length}</b></button><button data-v590-view="account"><small>PORTALSTATUS</small><b class="ok-text">Bereit</b></button></div>
 <div class="v590-hub-grid v601-hub-single"><div class="v590-notify"><h3>🔔 Hinweise</h3>${notes.length?notes.map(n=>`<button data-v590-view="${n.v}"><span>${n.i}</span><b>${esc(n.t)}</b><small>Öffnen →</small></button>`).join(''):'<div class="v590-empty">✓ Keine offenen Hinweise.</div>'}</div></div>`;
 host.querySelectorAll('[data-v590-view]').forEach(b=>b.onclick=()=>showView(b.dataset.v590View));
 host.querySelector('.v590-search-open')?.addEventListener('click',v590OpenSearch);
}
function v590OpenSearch(){
 let old=document.getElementById('v590Search');if(old)old.remove();
 const box=document.createElement('div');box.id='v590Search';box.className='v590-search';
 box.innerHTML=`<div class="v590-search-box"><div class="v590-search-top"><b>🔎 Portal durchsuchen</b><button id="v590SearchClose">✕</button></div><input id="v590SearchInput" autocomplete="off" placeholder="Kapitel, Kartenprüfung, Funk, Dokumente …"><div id="v590SearchResults"></div><small>ESC zum Schließen · Enter zum Öffnen</small></div>`;
 document.body.appendChild(box);const inp=box.querySelector('#v590SearchInput'),res=box.querySelector('#v590SearchResults');
 const items=[...titles.map(x=>({label:`Kapitel ${chapterNumber(x.n)} · ${x.title}`,chapter:x.n})),{label:'Kartenprüfung',view:'mapquiz'},{label:'Funk-Trainer',view:'radio'},{label:'Ausbildungsfahrten',view:'rides'},{label:'Dienstbuch',view:'dienstbuch'},{label:'Tests',view:'tests'},{label:'Dokumente',view:'documents'},{label:'Mitteilungen',view:'news'},{label:'Mein Konto',view:'account'}];
 let shown=[];
 function draw(){const q=inp.value.trim().toLowerCase();shown=items.filter(x=>!q||x.label.toLowerCase().includes(q)).slice(0,10);res.innerHTML=shown.map((x,i)=>`<button data-i="${i}">${esc(x.label)}<span>→</span></button>`).join('')||'<div class="v590-empty">Keine Treffer.</div>';res.querySelectorAll('button').forEach(b=>b.onclick=()=>open(shown[+b.dataset.i]))}
 function open(x){if(!x)return;box.remove();x.chapter?showChapter(x.chapter):showView(x.view)}
 box.querySelector('#v590SearchClose').onclick=()=>box.remove();box.onclick=e=>{if(e.target===box)box.remove()};
 inp.oninput=draw;inp.onkeydown=e=>{if(e.key==='Enter')open(shown[0]);if(e.key==='Escape')box.remove()};draw();setTimeout(()=>inp.focus(),20);
}
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();v590OpenSearch()}});
const _dashboardV590=dashboard;
dashboard=function(){
 _dashboardV590();
 const content=document.getElementById('content'),hero=content?.querySelector('.hero');
 if(content&&hero&&!document.getElementById('v590DailyHub')){const h=document.createElement('section');h.id='v590DailyHub';h.className='card v590-hub';hero.insertAdjacentElement('afterend',h);v590Hub()}
};

/* ===== V6.0 – ACADEMY ENGINE ===== */
const ACADEMY_PHASES=[
 {n:1,name:'Grundlagen',range:[1,5],test:'test-a'},
 {n:2,name:'Funk, Orientierung & Streife',range:[6,10],test:'test-b'},
 {n:3,name:'Recht & Einsatz',range:[11,15],test:'test-c'},
 {n:4,name:'Vertiefung & Abschluss',range:[16,22],test:'test-d'}
];
function aeKey(k){return `alta_ae_${current?.id||'guest'}_${k}`}
function aeGet(k,d){try{let v=localStorage.getItem(aeKey(k));return v==null?d:JSON.parse(v)}catch(_){return d}}
function aeSet(k,v){localStorage.setItem(aeKey(k),JSON.stringify(v))}
function aePhaseForChapter(n){return ACADEMY_PHASES.find(p=>n>=p.range[0]&&n<=p.range[1])||ACADEMY_PHASES[0]}
function aePassed(id,u=current){return (u?.testResults||[]).some(r=>r.testId===id&&r.passed)}
function aeChapterUnlocked(n,u=current){
 if(!u||u.role!=='recruit')return true;
 n=+n||1;
 if(n<=1)return true;
 // Kapitel werden strikt nacheinander freigeschaltet:
 // Wissenscheck des vorherigen Kapitels bestanden = nächstes Kapitel offen.
 // Für Kapitel n müssen damit alle vorherigen Wissenschecks bestanden sein.
 for(let i=1;i<n;i++)if(!aeKnowledgeOk(i))return false;
 return true;
}
function aePhaseUnlocked(p,u=current){
 if(!u||u.role!=='recruit')return true;
 return aeChapterUnlocked(p.range[0],u);
}
function aeReadData(){return aeGet('read',{})}
function aeReadSeconds(n){return +(aeReadData()[n]||0)}
function aeMarkReadSeconds(n,sec){let d=aeReadData();d[n]=Math.max(0,(+d[n]||0)+sec);aeSet('read',d)}
function aeKnowledge(){return aeGet('knowledge',{})}
function aeKnowledgeOk(n,u=current){
 if(u?.role==="recruit") return !!(u?.completed||[]).includes(+n) || !!aeKnowledge()[n];
 return !!(u?.completed||[]).includes(+n);
}
async function aeSetKnowledge(n,v){
 const chapter=Number(n);
 let d=aeKnowledge();
 d[chapter]=!!v;
 aeSet('knowledge',d);
 if(v===true && current?.role==="recruit"){
  const {error}=await sb.rpc("complete_own_training_chapter",{chapter_no:chapter});
  if(error) throw error;
 }
}
function aeReady(n){return aeReadSeconds(n)>=45 && aeKnowledgeOk(n)}
function aeReadiness(u=current){
 if(!u)return 0;
 const chapters=(u.completed||[]).length/22*45;
 const tests=TESTS.filter(t=>aePassed(t.id,u)).length/TESTS.length*30;
 const rides=academyGet('rides',[]).reduce((a,x)=>a+(+x.minutes||0),0);
 const practice=Math.min(1,rides/120)*15;
 const checks=Object.values(aeKnowledge()).filter(Boolean).length/22*10;
 return Math.round(chapters+tests+practice+checks);
}
function aeRoadmapHtml(u=current){
 return `<div class="ae-roadmap">${CHAPTER_CATEGORIES.map(p=>{const nums=CHAPTER_ORDER.slice(p.from-1,p.to),open=nums.some(n=>aeChapterUnlocked(n,u)),done=nums.filter(n=>(u.completed||[]).includes(n)).length;return `<div class="ae-phase ${open?'open':'locked'}"><div class="ae-phase-num">${open?(done===nums.length?'✓':p.n):'🔒'}</div><div><small>PHASE ${p.n}</small><b>${p.name}</b><span>Kapitel ${p.from}–${p.to} · ${done}/${nums.length}</span></div></div>`}).join('<i>›</i>')}</div>`;
}
function aeTodayHtml(u=current){
 const openCh=titles.find(x=>aeChapterUnlocked(x.n,u)&&!(u.completed||[]).includes(x.n));
 const assigned=TESTS.find(t=>(u.assignedTests||[]).includes(t.id)&&!aePassed(t.id,u));
 let tasks=[];
 if(openCh)tasks.push({i:'📖',t:`Kapitel ${chapterNumber(openCh.n)}: ${openCh.title}`,a:`showChapter(${openCh.n})`});
 if(openCh&&!aeKnowledgeOk(openCh.n))tasks.push({i:'🧠',t:`Wissenscheck Kapitel ${chapterNumber(openCh.n)}`,a:`showChapter(${openCh.n})`});
 if(assigned)tasks.push({i:'📝',t:`${assigned.title} vorbereiten`,a:`showView('tests')`});
 tasks.push({i:'📻',t:'5 Minuten Funk-Trainer',a:`showView('radio')`});
 return `<div class="card ae-today"><div class="eyebrow">HEUTIGER AUSBILDUNGSAUFTRAG</div><h2>Dein nächster Schritt</h2>${tasks.slice(0,4).map((x,i)=>`<button onclick="${x.a}"><span>${x.i}</span><b>${esc(x.t)}</b><small>${i===0?'Empfohlen':'Optional'}</small></button>`).join('')}</div>`;
}
function aeQuestionForChapter(n){
 const banks={
  1:['Was ist bei Entscheidungen besonders wichtig?',['Begründbarkeit und Nachvollziehbarkeit','Geschwindigkeit ohne Erklärung','Keine Dokumentation'],0],
  2:['Was sollte vor Dienstbeginn geprüft werden?',['Uniform, Ausrüstung, Funk und Laptop','Nur das Fahrzeug','Nur private Ausrüstung'],0],
  3:['Was gehört zur Dienstausrüstung?',['Funkgerät','Privates Funkgerät als Pflicht','Privates Tablet als Pflicht'],0],
  4:['Wofür steht DDS?',['Denken – Drücken – Sprechen','Dienst – Durchsage – Status','Drücken – Dienst – Sichern'],0],
  5:['Was bedeutet 10-20?',['Standort','Dienstbeginn','Verstärkung'],0],
  6:['Wofür steht SPM?',['Straße – Postleitzahl – markanter Ort','Status – Person – Maßnahme','Sicherung – Position – Meldung'],0],
  7:['Welches System enthält Personen, Fahrzeuge und Reports?',['CAD','EFA','EMS'],0],
  8:['Wofür steht KAP?',['Kennzeichen – Abfrage – passenden Treffer prüfen','Kontrolle – Akte – Person','Kennzeichen – Anhalten – Protokoll'],0],
  9:['Wann bedient der Fahrer den Laptop?',['Wenn das Fahrzeug sicher steht','Während jeder Fahrt','Nur bei Code 3'],0],
  10:['Was gehört zu professionellem Bürgerkontakt?',['Ruhige, klare Kommunikation','Keine Erklärung','Funk ignorieren'],0],
  11:['Was ist vor einer Maßnahme wichtig?',['Grundlage prüfen','Akte schließen','Keine Rückfragen'],0],
  12:['Was gehört zur Beweismittelarbeit?',['Übergabe dokumentieren','Ohne Eintrag weitergeben','Privat aufbewahren'],0],
  13:['Was hat bei Einsatzmitteln Vorrang?',['Sichere und begründbare Anwendung','Schnelligkeit','Keine Kommunikation'],0],
  14:['Wozu dient Training?',['Sicheres, nachvollziehbares Handeln','Nur Punkte sammeln','Dokumentation vermeiden'],0],
  15:['Wer begleitet die Ausbildung?',['Der zuständige FTO','Nur die Leitstelle','Das DOJ'],0],
  16:['Wozu dienen Checklisten?',['Vollständige persönliche Einweisung','Nur Archivierung','Nur Fahrzeugwahl'],0],
  17:['Wozu dient die Leitstelle?',['Koordination und Einsatzplanung','Nur Fahrzeugpflege','Nur Aktenablage'],0],
  18:['Was ist bei Waffeninformationen wichtig?',['Freigaben und sichere Handhabung','Private Nutzung','Keine Dokumentation'],0],
  19:['Wofür steht SÜLA?',['Sichern – Übergabe dokumentieren – Laborprüfung – Akte ergänzen','Suchen – Üben – Lage – Abschluss','Sichern – Leitstelle – Anhalten – Akte'],0],
  20:['Wozu dienen Merkwörter?',['Abläufe sicher erinnern','Tests umgehen','Dokumentation ersetzen'],0],
  21:['Was hilft bei einer Standortmeldung?',['Straße, PLZ und markanter Ort','Nur Fahrzeugfarbe','Nur Uhrzeit'],0],
  22:['Wie mit unbekannter Gefahr umgehen?',['Erkennen, melden und bewerten','Sofort betreten','Unnötig testen'],0]
 }; return banks[n]||banks[1];
}
function aeKnowledgeQuestions(n){
 const base=aeQuestionForChapter(n), here=titles.find(x=>x.n===n)?.title||`Kapitel ${chapterNumber(n)}`;
 const others=titles.filter(x=>x.n!==n).slice(Math.max(0,(n-2)%19),Math.max(0,(n-2)%19)+3).map(x=>x.title);
 return [
  base,
  [`Welcher Themenbereich gehört zu Kapitel ${chapterNumber(n)}?`,aeShuffle([here,...others]).slice(0,4),0],
  [`Was solltest du nach Kapitel ${chapterNumber(n)} tun, wenn ein Ablauf noch unklar ist?`,['Den Abschnitt erneut prüfen und bei Bedarf den FTO fragen','Den Punkt überspringen und als erledigt markieren','Im Test raten'],0],
  [`Was ist das Ziel des Wissenschecks zu Kapitel ${chapterNumber(n)}?`,['Den Inhalt sicher verstehen und anwenden können','Nur die Seite einmal geöffnet haben','Die Reihenfolge der Antworten auswendig lernen'],0]
 ].map((q,i)=>{if(i!==1)return q;let correct=here,opts=q[1],ci=opts.indexOf(correct);return [q[0],opts,ci]});
}
function aeKnowledgeCheck(n){
 const qs=aeKnowledgeQuestions(n),modal=document.createElement('div');let step=0,score=0;
 modal.className='ae-modal';document.body.appendChild(modal);
 const render=()=>{const q=qs[step];modal.innerHTML=`<div class="ae-modal-box"><div class="eyebrow">WISSENSCHECK · KAPITEL ${chapterNumber(n)} · FRAGE ${step+1}/${qs.length}</div><div class="knowledge-progress"><i style="width:${((step)/qs.length)*100}%"></i></div><h2>${esc(q[0])}</h2><div class="ae-answers">${q[1].map((a,i)=>`<button data-a="${i}">${esc(a)}</button>`).join('')}</div><p class="muted">Mindestens 3 von 4 Fragen müssen richtig sein.</p><button class="secondary" data-close>Abbrechen</button></div>`;
  modal.querySelector('[data-close]').onclick=()=>modal.remove();
  modal.querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{if(+b.dataset.a===q[2])score++;step++;if(step<qs.length)return render();const ok=score>=3;
 if(ok){
  try{
   await aeSetKnowledge(n,true);
   await refreshData();
  }catch(e){
   console.error("Fortschritt speichern:",e);
   toast?.("❌ Fortschritt konnte nicht zentral gespeichert werden: "+(e?.message||e));
   return;
  }
 }
 modal.innerHTML=`<div class="ae-modal-box knowledge-result"><div class="eyebrow">WISSENSCHECK · ERGEBNIS</div><h2>${ok?'✓ Bestanden':'✕ Noch nicht bestanden'}</h2><p><b>${score}/${qs.length}</b> Fragen richtig.</p><p class="muted">${ok?'Der Wissenscheck wurde gespeichert.':'Lies das Kapitel noch einmal aufmerksam und versuche es danach erneut.'}</p><button class="primary" data-done>${ok?(nextChapterId(n)?`Kapitel ${chapterNumber(nextChapterId(n))} öffnen`:'Ausbildung ansehen'):'Zurück zum Kapitel'}</button></div>`;modal.querySelector('[data-done]').onclick=()=>{modal.remove();if(ok&&nextChapterId(n)){nav();showChapter(nextChapterId(n))}else if(ok&&!nextChapterId(n)){nav();dashboard()}else showChapter(n)}})
 };
 render();
}
let aeChapterSession=null;
function aeStartChapterSession(n){if(aeChapterSession?.timer)clearInterval(aeChapterSession.timer);aeChapterSession={n,start:Date.now(),timer:setInterval(()=>{},1000)}}
function aeStopChapterSession(){if(!aeChapterSession)return;clearInterval(aeChapterSession.timer);aeMarkReadSeconds(aeChapterSession.n,Math.min(600,Math.floor((Date.now()-aeChapterSession.start)/1000)));aeChapterSession=null}
function aeShuffle(arr){let a=arr.slice();for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function aeExamQuestions(t){return aeShuffle(t.questions).map(q=>{let opts=q.a.map((a,i)=>({a,i}));opts=aeShuffle(opts);return {q:q.q,a:opts.map(x=>x.a),c:opts.findIndex(x=>x.i===q.c)}})}
function aeExamLock(on){document.body.classList.toggle('ae-exam-mode',!!on);sessionStorage.setItem('alta_exam_mode',on?'1':'0')}

const _navAE=nav;
nav=function(){_navAE();if(current?.role==='recruit')document.querySelectorAll('[data-chapter]').forEach(b=>{let n=+b.dataset.chapter;if(!aeChapterUnlocked(n)){b.classList.add('ae-nav-locked');b.title='Noch nicht freigeschaltet';b.onclick=()=>{toast?.('🔒 Dieses Kapitel ist noch gesperrt. Bestehe zuerst den Wissenscheck des vorherigen Kapitels.')}}})};
const _showChapterAE=showChapter;
showChapter=function(n){
 aeStopChapterSession();
 if(current?.role==='recruit'&&!aeChapterUnlocked(n)){toast?.('🔒 Bestehe zuerst den Wissenscheck des vorherigen Kapitels.');return dashboard()}
 _showChapterAE(n);aeStartChapterSession(n);
 if(current?.role==='recruit'){
  const side=document.querySelector('.side-card');if(side){const sec=aeReadSeconds(n),ok=aeKnowledgeOk(n);side.insertAdjacentHTML('beforeend',`<div class="ae-learning"><div class="eyebrow">LERNSTATUS</div><div class="ae-learn-row"><span>Lernzeit</span><b>${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}</b></div><div class="ae-learn-row"><span>Wissenscheck</span><b>${ok?'✓ Bestanden':'Offen'}</b></div><button class="${ok?'secondary':'primary'}" id="aeKnowledgeBtn">${ok?'✓ Wissenscheck wiederholen':'🧠 Wissenscheck starten'}</button><small>Empfehlung: Kapitel aufmerksam durcharbeiten, danach den Wissenscheck absolvieren.</small></div>`);document.getElementById('aeKnowledgeBtn').onclick=()=>{aeStopChapterSession();aeKnowledgeCheck(n)}}}
};
const _dashboardAE=dashboard;
dashboard=function(){aeStopChapterSession();_dashboardAE();if(current?.role==='recruit'){const hero=document.querySelector('.hero');if(hero){hero.insertAdjacentHTML('afterend',`<div class="card ae-academy-head"><div><div class="eyebrow">ACADEMY ROADMAP</div><h2>Dein Ausbildungsweg</h2></div><div class="ae-ready"><small>READINESS</small><b>${aeReadiness()}%</b></div></div>${aeRoadmapHtml()}${aeTodayHtml()}`)}}};

function startTest(id){
 aeStopChapterSession();
 const t=TESTS.find(x=>x.id===id);if(!t||isTrainer(current)||!(current.assignedTests||[]).includes(id))return testsView();
 const prereq={"test-a":[1,2,3],"test-b":[4,5],"test-c":[6],"test-d":[7,8,9,10],"test-e":[11,12,13,19,22]};
 if(!(prereq[id]||[]).every(n=>(current.completed||[]).includes(n))){toast?.('🔒 Voraussetzungen noch nicht erfüllt.');return testsView()}
 const qs=aeExamQuestions(t);aeExamLock(true);$("#pageTitle").textContent=t.title;
 $("#content").innerHTML=`<div class="ae-exam-head"><div><div class="eyebrow">🔒 PRÜFUNGSMODUS AKTIV</div><h1>${esc(t.title)}</h1><p>Kapitel, Lernhilfen und Navigation sind bis zur Abgabe gesperrt.</p></div><span class="status" id="testTimer">15:00</span></div><form id="testForm">${qs.map((q,i)=>`<div class="card question-card"><div class="question-no">FRAGE ${i+1} / ${qs.length}</div><h3>${esc(q.q)}</h3><div class="answers">${q.a.map((a,j)=>`<label class="answer"><input type="radio" name="q${i}" value="${j}" required><span>${esc(a)}</span></label>`).join('')}</div></div>`).join('')}<button class="primary finish-test" type="submit">Prüfung verbindlich abgeben</button></form>`;
 let left=900,timer=setInterval(()=>{left--;let el=$("#testTimer");if(el)el.textContent=`${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`;if(left<=0){clearInterval(timer);$("#testForm")?.requestSubmit()}},1000);
 $("#testForm").onsubmit=async e=>{e.preventDefault();clearInterval(timer);let f=new FormData(e.target),score=0;qs.forEach((q,i)=>{if(+f.get("q"+i)===q.c)score++});let percent=Math.round(score/qs.length*100),passed=percent>=t.pass;const {error}=await sb.from("test_results").insert({recruit_id:current.id,test_id:t.id,score,total:qs.length,percent,passed});aeExamLock(false);if(error){alert('Speichern fehlgeschlagen: '+error.message);return}await refreshData();showTestResult(t,score,percent,passed)};
}
const _showTestResultAE=showTestResult;
showTestResult=function(t,score,percent,passed){aeExamLock(false);_showTestResultAE(t,score,percent,passed);const h=document.querySelector('.result-hero');if(h&&!passed)h.insertAdjacentHTML('beforeend',`<div class="ae-recommend">🧠 <b>Lernempfehlung:</b> Wiederhole die zugehörigen Kapitel und starte danach einen neuen Versuch. Die Fragen und Antwortreihenfolge werden neu gemischt.</div>`)};

/* V6.0.1 Dashboard: Schnellzugriff entfernt */

/* ===== V6.1 – WORKFLOW & FTO ASSIST ===== */
function v61DaysSince(v){if(!v)return 999;let d=new Date(v);return isNaN(d)?999:Math.floor((Date.now()-d.getTime())/86400000)}
function v61LastActivity(r){let a=(r.activity||[]).map(x=>new Date(x.when)).filter(d=>!isNaN(d));return a.length?new Date(Math.max(...a.map(d=>d.getTime()))):null}
function v61Issues(r){
 const out=[], failed=(r.testResults||[]).filter(x=>!x.passed), goals=(r.goals||[]).filter(x=>!x.done);
 const counts={};failed.forEach(x=>counts[x.testId]=(counts[x.testId]||0)+1);
 Object.entries(counts).forEach(([id,n])=>{if(n>=2)out.push({sev:'red',icon:'🔴',text:`${TESTS.find(t=>t.id===id)?.title||id} ${n}× nicht bestanden`,view:'tests'})});
 if(goals.length>=3)out.push({sev:'orange',icon:'🟠',text:`${goals.length} offene Ausbildungsziele`,view:'goals'});
 const last=v61LastActivity(r);if(last&&v61DaysSince(last)>=7)out.push({sev:'orange',icon:'🟠',text:`Seit ${v61DaysSince(last)} Tagen kein Ausbildungsfortschritt`,view:'overview'});
 if(progress(r)===100)out.push({sev:'green',icon:'🟢',text:'Voraussetzungen für Abschluss prüfen',view:'overview'});
 if((r.assignedTests||[]).some(id=>!(r.testResults||[]).some(x=>x.testId===id&&x.passed)))out.push({sev:'blue',icon:'🔵',text:'Zugewiesene Prüfung noch offen',view:'tests'});
 return out;
}
function v61NextRecruitStep(u=current){
 if(!u||u.role!=='recruit')return null;
 const ch=titles.find(x=>(typeof aeChapterUnlocked==='function'?aeChapterUnlocked(x.n,u):true)&&!(u.completed||[]).includes(x.n));
 if(ch)return {icon:'📖',title:`Kapitel ${chapterNumber(ch.n)} · ${ch.title}`,sub:'Nächster Ausbildungsinhalt',go:()=>showChapter(ch.n)};
 const t=TESTS.find(x=>(u.assignedTests||[]).includes(x.id)&&!(u.testResults||[]).some(r=>r.testId===x.id&&r.passed));
 if(t)return {icon:'📝',title:t.title,sub:'Freigegebene Prüfung wartet',go:()=>showView('tests')};
 if(progress(u)===100)return {icon:'🏅',title:'Abschlussfreigabe',sub:'Deine Theorieausbildung ist vollständig.',go:()=>showView('account')};
 return {icon:'🎯',title:'Ausbildungsziele prüfen',sub:'Dein FTO legt den nächsten Schritt fest.',go:()=>showView('account')};
}
function v61RecruitContinueCard(){
 if(current?.role!=='recruit')return;let n=v61NextRecruitStep();if(!n)return;
 let hero=document.querySelector('.hero');if(!hero||document.querySelector('.v61-continue'))return;
 hero.insertAdjacentHTML('afterend',`<div class="card v61-continue"><div class="v61-continue-icon">${n.icon}</div><div><div class="eyebrow">AUSBILDUNG FORTSETZEN</div><h2>${esc(n.title)}</h2><p>${esc(n.sub)}</p></div><button class="primary" id="v61Continue">▶ Weiterlernen</button></div>`);
 document.getElementById('v61Continue').onclick=n.go;
}
function v61TrainerToday(){
 if(!isTrainer(current))return;let host=document.querySelector('.hero');if(!host||document.querySelector('.v61-fto-today'))return;
 const rs=db.users.filter(x=>apdActiveRecruit(x)), rows=rs.map(r=>({r,issues:v61Issues(r)})).filter(x=>x.issues.length).sort((a,b)=>{let s={red:4,orange:3,blue:2,green:1};return Math.max(...b.issues.map(i=>s[i.sev]))-Math.max(...a.issues.map(i=>s[i.sev]))}).slice(0,8);
 host.insertAdjacentHTML('afterend',`<div class="card v61-fto-today"><div class="section-head compact"><div><div class="eyebrow">FTO · HEUTE ZU ERLEDIGEN</div><h2>Handlungsbedarf</h2></div><span class="status">${rows.length} offen</span></div>${rows.length?rows.map(({r,issues})=>`<button data-v61-recruit="${r.id}"><div><b>${esc(r.name)}</b><small>${esc(r.serviceNo||'—')} · ${progress(r)}%</small></div><span class="v61-issue ${issues[0].sev}">${issues[0].icon} ${esc(issues[0].text)}</span><strong>Akte →</strong></button>`).join(''):`<div class="v61-empty">✓ Aktuell kein besonderer Handlungsbedarf.</div>`}</div>`);
 document.querySelectorAll('[data-v61-recruit]').forEach(b=>b.onclick=()=>{selectedRecruit=b.dataset.v61Recruit;recruitRecordClosed=false;admin()});
}
function v61Inbox(){
 let notes=[];
 if(current?.role==='recruit'){
  (current.goals||[]).filter(g=>!g.done).forEach(g=>notes.push({i:'🎯',t:g.text,sub:'Offenes Ausbildungsziel'}));
  TESTS.filter(t=>(current.assignedTests||[]).includes(t.id)&&!(current.testResults||[]).some(r=>r.testId===t.id&&r.passed)).forEach(t=>notes.push({i:'📝',t:t.title,sub:'Prüfung freigegeben'}));
 }else if(isTrainer(current)){
  db.users.filter(x=>x.role==='recruit').forEach(r=>v61Issues(r).forEach(i=>notes.push({i:i.icon,t:r.name,sub:i.text,id:r.id})));
 }
 return notes.slice(0,12);
}
function v61OpenInbox(){
 document.querySelector('.v61-inbox-modal')?.remove();let notes=v61Inbox(),m=document.createElement('div');m.className='v61-inbox-modal';m.innerHTML=`<div class="v61-inbox-box"><div class="section-head"><div><div class="eyebrow">AUFGABEN-INBOX</div><h2>${isTrainer(current)?'Academy-Handlungsbedarf':'Meine Aufgaben'}</h2></div><button class="secondary" data-close>✕</button></div>${notes.length?notes.map(x=>`<button class="v61-inbox-row" ${x.id?`data-id="${x.id}"`:''}><span>${x.i}</span><div><b>${esc(x.t)}</b><small>${esc(x.sub)}</small></div><strong>→</strong></button>`).join(''):'<div class="v61-empty">✓ Keine offenen Aufgaben.</div>'}</div>`;document.body.appendChild(m);m.onclick=e=>{if(e.target===m)m.remove()};m.querySelector('[data-close]').onclick=()=>m.remove();m.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{m.remove();selectedRecruit=b.dataset.id;recruitRecordClosed=false;admin()});
}
function v61InstallInboxButton(){ return; }
function v61RecordToolbar(){
 // V6.4.3: Die alte Schnellaktionsleiste wurde entfernt.
 // Ziel, Notiz, Praxis, Tests, Freigaben und Dienstbuch sind bereits direkt in der Ausbildungsakte vorhanden.
 return;
}
const _dashboardV61=dashboard;
dashboard=function(){_dashboardV61();v61InstallInboxButton();v61RecruitContinueCard();v61TrainerToday()};
const _adminV61=admin;
admin=function(){_adminV61();v61InstallInboxButton();v61RecordToolbar()};
const _accountV61=account;
account=function(){_accountV61();v61InstallInboxButton()};

/* ===== V6.1.3 – RELOAD STAYS ON CURRENT PAGE ===== */
(function(){
 const KEY='alta_pd_last_page_v613';
 function capture(){
   if(!current)return;
   let h=location.hash||'';
   if(!h || h==='#dashboard'){
     try{
       const s=history.state;
       if(s?.apdPortal){
         if(s.route==='chapter'&&s.chapter)h='#chapter-'+s.chapter;
         else if(s.route==='admin'&&s.recruitId&&!s.recordClosed)h='#admin-recruit-'+encodeURIComponent(s.recruitId);
         else h='#'+(s.route||'dashboard');
       }
     }catch(_){}
   }
   try{sessionStorage.setItem(KEY,h||'#dashboard')}catch(_){}
 }
 window.addEventListener('beforeunload',capture);
 document.addEventListener('click',()=>setTimeout(capture,0),true);
 window.addEventListener('hashchange',capture);

 // If a refresh/browser restart in the same tab occurs without a usable hash,
 // restore the exact last portal route before the existing V5.6 router boots.
 try{
   const saved=sessionStorage.getItem(KEY);
   if((!location.hash || location.hash==='#dashboard') && saved && saved!=='#dashboard'){
     history.replaceState(history.state,'',location.pathname+location.search+saved);
   }
 }catch(_){}
})();


/* V6.4.1: previous router disabled. */;


/* ===== V6.4.1 – BROWSER HISTORY ROUTER ===== */
(function(){
 const ROUTES=new Set(["dashboard","command","command-live","accounts","admin","tests","account","news","documents","calendar","cad","scenario","radio","mapquiz","plan","rides","dienstbuch","messages","achievements","leaderboard"]);
 let replay=false;
 const mk=(route,extra={})=>({apdHistory641:true,route,chapter:extra.chapter||null,recruitId:extra.recruitId||null,recordTab:extra.recordTab||null});
 const hash=s=>s.route==="chapter"?`#chapter-${s.chapter}`:s.route==="admin"&&s.recruitId?`#admin-recruit-${s.recruitId}${s.recordTab?`~${s.recordTab}`:""}`:`#${s.route||"dashboard"}`;
 function parse(){
  const h=(location.hash||"").slice(1);let m=h.match(/^chapter-(\d+)$/);if(m)return mk("chapter",{chapter:+m[1]});
  m=h.match(/^admin-recruit-([0-9a-f-]{36})(?:~([a-z]+))?$/i);if(m)return mk("admin",{recruitId:m[1],recordTab:m[2]||"overview"});
  return ROUTES.has(h)?mk(h):null;
 }
 function render(s){
  if(!current||!s)return;
  replay=true;
  try{
   if(current.mustChangePassword){baseShowView641("account");return}
   if(s.route==="chapter")baseShowChapter641(+s.chapter);
   else if(s.route==="admin"&&s.recruitId){
    selectedRecruit=s.recruitId;recruitRecordClosed=false;recruitRecordsOnly=true;recordActiveTab=s.recordTab||"overview";
    try{sessionStorage.setItem("alta_record_active_tab",recordActiveTab)}catch(_){}
    baseShowView641("admin");
    requestAnimationFrame(()=>requestAnimationFrame(()=>activateRecordTab(recordActiveTab,false)));
   }else baseShowView641(s.route);
  }finally{replay=false}
 }
 function push(s){
  if(replay||!current)return;
  if(history.state?.apdHistory641&&hash(history.state)===hash(s))return;
  history.pushState(s,"",hash(s));
 }
 const baseShowView641=showView,baseShowChapter641=showChapter;
 showView=function(v){
  const out=baseShowView641(v);
  if(!replay)push(mk(v,{recruitId:v==="admin"&&!recruitRecordClosed?selectedRecruit:null,recordTab:recordActiveTab||null}));
  return out;
 };
 showChapter=function(n){const out=baseShowChapter641(n);if(!replay)push(mk("chapter",{chapter:+n}));return out};

 // This is the ONLY active browser Back/Forward handler.
 window.addEventListener("popstate",e=>{const s=e.state?.apdHistory641?e.state:parse();if(s)render(s)});

 // Recruit tab changes also become navigable history steps.
 document.addEventListener("click",e=>{
  const t=e.target.closest("[data-record-jump]");
  if(t&&selectedRecruit&&!recruitRecordClosed&&!replay)setTimeout(()=>push(mk("admin",{recruitId:selectedRecruit,recordTab:t.dataset.recordJump||"overview"})),0);
 },true);

 // Initialize current entry after login/session restore without adding a duplicate history entry.
 const timer=setInterval(()=>{
  if(!current)return;clearInterval(timer);
  setTimeout(()=>{
   if(current.mustChangePassword){const s=mk("account");history.replaceState(s,"",hash(s));render(s);return}
   const s=parse();
   if(s&&location.hash&&location.hash!=="#account"){history.replaceState(s,"",hash(s));render(s)}
   else{const d=mk("dashboard");history.replaceState(d,"",hash(d));render(d)}
  },150);
 },50);
})();

/* FTO-Freigaben erfolgen ausschließlich durch berechtigte Ausbilder. */

// FTO-Module: Ereignisdelegation funktioniert auch nach dem Neuzeichnen der Rekrutenakte.
document.addEventListener("click",async e=>{
 const b=e.target.closest("[data-unlock]");if(!b||!isTrainer(current))return;
 const chapter=Number(b.dataset.unlock),recruitId=selectedRecruit;
 const recruit=db.users.find(u=>u.id===recruitId);if(!recruit||recruit.role!=="recruit")return;
 const unlocked=(recruit.unlockedChapters||[]).includes(chapter);
 if(!confirm(`Kapitel ${chapterNumber(chapter)} für ${recruit.name} ${unlocked?"sperren":"freigeben"}?`))return;
 b.disabled=true;
 try{
  const {error}=await sb.rpc("fto_set_chapter_unlock",{p_recruit_id:recruitId,p_chapter:chapter,p_unlock:!unlocked});
  if(error)throw error;
  await refreshData();selectedRecruit=recruitId;admin();
 }catch(err){alert("Freigabe fehlgeschlagen: "+err.message);b.disabled=false;}
});
document.addEventListener("submit",async e=>{
 if(e.target.id!=="apdRatingForm")return;
 e.preventDefault();if(!isTrainer(current))return;
 const form=e.target,values=new FormData(form),recruitId=selectedRecruit;
 const payload={recruit_id:recruitId,funk:+values.get("funk"),streife:+values.get("streife"),buerger:+values.get("buerger"),verhalten:+values.get("verhalten"),note:String(values.get("note")||"").trim(),trainer_id:current.id};
 const btn=form.querySelector('button[type="submit"],button:not([type])');if(btn)btn.disabled=true;
 try{const {error}=await sb.from("fto_ratings").insert(payload);if(error)throw error;await refreshData();selectedRecruit=recruitId;admin();}
 catch(err){alert("Bewertung konnte nicht gespeichert werden: "+err.message);if(btn)btn.disabled=false;}
});

