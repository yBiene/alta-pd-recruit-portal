
const $ = s => document.querySelector(s);
const esc = s => String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const DBKEY="apd_portal_v2";
const seed={
 users:[
  {id:"admin-carter",username:"sgt.carter",password:"APD-Demo-Admin",name:"Sgt Carter",serviceNo:"S-01",role:"admin",rank:"Sergeant",fto:"Sgt Carter",start:"03.10.2026",status:"FTO / Administration",completed:[]},
  {id:"recruit-test",username:"recruit.test",password:"APD-Demo-2026",name:"Recruit Test",serviceNo:"R-102",role:"recruit",rank:"Recruit",fto:"Sgt Carter",start:"03.10.2026",status:"In Ausbildung",completed:[]}
 ]};
function loadDB(){let x=localStorage.getItem(DBKEY);if(!x){localStorage.setItem(DBKEY,JSON.stringify(seed));return structuredClone(seed)}try{return JSON.parse(x)}catch{return structuredClone(seed)}}
function saveDB(){localStorage.setItem(DBKEY,JSON.stringify(db))}
let db=loadDB(), current=null, selectedRecruit=null;
const titles=Object.entries(CHAPTERS).map(([n,c])=>({n:+n,title:c.title}));

function nav(){
 let html=`<button class="nav-btn active" data-view="dashboard">⌂ Dashboard</button><div class="nav-label">AUSBILDUNG</div>`;
 for(const x of titles) html+=`<button class="nav-btn" data-chapter="${x.n}"><span class="num">${x.n}</span>${esc(x.title)}</button>`;
 if(current?.role==="admin") html+=`<div class="nav-label">FTO / ADMIN</div><button class="nav-btn" data-view="admin">⚙ Recruit-Verwaltung</button>`;
 $("#nav").innerHTML=html;
 document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>showView(b.dataset.view));
 document.querySelectorAll("[data-chapter]").forEach(b=>b.onclick=()=>showChapter(+b.dataset.chapter));
}
function setActive(sel){document.querySelectorAll(".nav-btn").forEach(x=>x.classList.remove("active"));document.querySelector(sel)?.classList.add("active")}
function progress(u){return Math.round(((u.completed||[]).length/22)*100)}
function stage(u){let p=progress(u);return p===100?"Streifenfreigabe":p>=75?"IV · Beobachtungsfahrt":p>=50?"III · Du führst":p>=25?"II · Zusammenarbeit":"I · Demonstration"}
function showView(v){
 if(v==="dashboard") return dashboard();
 if(v==="admin") return admin();
 if(v==="account") return account();
}
function dashboard(){
 setActive('[data-view="dashboard"]'); $("#pageTitle").textContent="Dashboard";
 let u=current, p=progress(u);
 $("#content").innerHTML=`
 <div class="hero">
  <div><div class="eyebrow">WILLKOMMEN ZURÜCK</div><h1>${esc(u.name)}</h1>
   <span class="status">● ${esc(u.status)}</span>
   <p>Willkommen im Alta PD Ausbildungsportal. Hier findest du die Inhalte des Rekrutenhandbuchs, bebilderte Anleitungen und deinen persönlichen Ausbildungsfortschritt. Dein zuständiger FTO ist <b>${esc(u.fto)}</b>.</p>
  </div><div class="hero-logo"><img src="assets/apd-logo.png" alt="APD"></div>
 </div>
 <div class="grid stats">
  <div class="card stat"><span>DIENSTNUMMER</span><b>${esc(u.serviceNo)}</b></div>
  <div class="card stat"><span>FTO</span><b>${esc(u.fto)}</b></div>
  <div class="card stat"><span>AUSBILDUNGSSTATUS</span><b>${esc(u.status)}</b></div>
  <div class="card stat"><span>FORTSCHRITT</span><b>${p}%</b><div class="progress"><i style="width:${p}%"></i></div></div>
 </div>
 <div class="card"><div class="section-head" style="margin:0 0 12px"><div><div class="eyebrow">AKTUELLE STUFE</div><h2>${stage(u)}</h2></div><span>${u.completed.length} / 22 Kapitel</span></div><div class="progress"><i style="width:${p}%"></i></div></div>
 <div class="section-head"><div><div class="eyebrow">REKRUTENAUSBILDUNG</div><h2>Ausbildungskapitel</h2></div><span class="muted">Stand Handbuch 03.10.2026</span></div>
 <div class="grid chapter-grid">${titles.map(x=>`<div class="card chapter-card ${u.completed.includes(x.n)?"done":""}" data-open="${x.n}"><div class="chapter-num">KAPITEL ${String(x.n).padStart(2,"0")}</div><h3>${esc(x.title)}</h3></div>`).join("")}</div>`;
 document.querySelectorAll("[data-open]").forEach(x=>x.onclick=()=>showChapter(+x.dataset.open));
}
function showChapter(n){
 const c=CHAPTERS[n]; if(!c)return;
 setActive(`[data-chapter="${n}"]`); $("#pageTitle").textContent=`Kapitel ${n}`;
 const done=current.completed.includes(n);
 const imgs=(c.images||[]).map(i=>`<img src="assets/handbook/${i}" alt="Handbuch-Abbildung ${i}" onclick="window.open(this.src,'_blank')">`).join("");
 $("#content").innerHTML=`
 <div class="chapter-header" style="background-image:linear-gradient(90deg,rgba(4,13,24,.96),rgba(4,13,24,.58)),url('assets/handbook/${(c.images||[])[0]||"image26.png"}')">
  <div><div class="chapter-no">KAPITEL ${String(n).padStart(2,"0")}</div><h1>${esc(c.title)}</h1><span class="status">${done?"✓ Abgeschlossen":"● In Ausbildung"}</span></div>
 </div>
 <div class="chapter-body">
  <article class="card article">${c.html || "<p>Für dieses Kapitel wurden keine zusätzlichen Textblöcke erkannt.</p>"}${imgs?`<h3>Bebilderte Anleitung</h3><div class="gallery">${imgs}</div>`:""}</article>
  <aside class="card side-card">
    <div class="eyebrow">AUSBILDUNGSSTATUS</div><h2>${done?"Abgeschlossen":"In Ausbildung"}</h2>
    <p class="muted">Zuständiger FTO</p><h3>${esc(current.fto)}</h3>
    <div class="notice">${current.role==="admin"?"Als Admin kannst du den Ausbildungsstand in der Recruit-Verwaltung ändern.":"Der Abschluss wird durch deinen FTO im Adminbereich bestätigt."}</div>
    ${current.role==="admin"?`<button class="primary complete-btn ${done?"done":""}" id="quickToggle">${done?"Abschluss zurücknehmen":"Kapitel abschließen"}</button>`:""}
  </aside>
 </div>`;
 if(current.role==="admin") $("#quickToggle").onclick=()=>{toggleChapter(current.id,n);showChapter(n)};
}
function account(){
 setActive('[data-view="account"]'); $("#pageTitle").textContent="Mein Account";
 $("#content").innerHTML=`<div class="section-head"><div><div class="eyebrow">ACCOUNT</div><h1>${esc(current.name)}</h1></div></div>
 <div class="grid account-grid">
 <div class="card"><span class="muted">Benutzername</span><h3>${esc(current.username)}</h3></div>
 <div class="card"><span class="muted">Dienstnummer</span><h3>${esc(current.serviceNo)}</h3></div>
 <div class="card"><span class="muted">Rang</span><h3>${esc(current.rank)}</h3></div>
 <div class="card"><span class="muted">FTO</span><h3>${esc(current.fto)}</h3></div>
 <div class="card"><span class="muted">Ausbildungsbeginn</span><h3>${esc(current.start)}</h3></div>
 <div class="card"><span class="muted">Ausbildungsstatus</span><h3>${esc(current.status)}</h3></div>
 </div>`;
}
function admin(){
 if(current.role!=="admin") return dashboard();
 setActive('[data-view="admin"]'); $("#pageTitle").textContent="Recruit-Verwaltung";
 const recruits=db.users.filter(x=>x.role==="recruit");
 if(!selectedRecruit && recruits[0]) selectedRecruit=recruits[0].id;
 let sel=db.users.find(x=>x.id===selectedRecruit);
 $("#content").innerHTML=`
 <div class="section-head"><div><div class="eyebrow">FTO / ADMINISTRATION</div><h1>Recruit-Verwaltung</h1></div><span class="status">Sgt Carter · Vollzugriff</span></div>
 <div class="admin-grid">
  <div>
   <div class="card"><h3>Neuen Recruit anlegen</h3><form id="createRecruit" class="form-grid">
    <label>Name<input name="name" required placeholder="Recruit Name"></label>
    <label>Dienstnummer<input name="serviceNo" required placeholder="R-103"></label>
    <label>Benutzername<input name="username" required placeholder="vorname.nachname"></label>
    <label>Initiales Passwort<input name="password" required minlength="6"></label>
    <label>FTO<input name="fto" value="Sgt Carter" required></label>
    <label>Ausbildungsbeginn<input name="start" value="${new Date().toLocaleDateString("de-DE")}"></label>
    <button class="primary" type="submit">Recruit-Account erstellen</button>
   </form></div>
   <div class="card" style="margin-top:14px"><h3>Recruit-Accounts</h3>
    ${recruits.map(r=>`<div class="recruit-row"><div><b>${esc(r.name)}</b><small>${esc(r.serviceNo)} · ${progress(r)}% · ${esc(r.fto)}</small></div><button class="primary" data-edit="${r.id}">Öffnen</button></div>`).join("")||"<p>Noch keine Recruit-Accounts.</p>"}
   </div>
  </div>
  <div>${sel?adminRecruit(sel):`<div class="card"><h2>Keinen Recruit ausgewählt</h2></div>`}</div>
 </div>`;
 $("#createRecruit").onsubmit=e=>{e.preventDefault();let f=new FormData(e.target);let username=f.get("username").trim().toLowerCase();if(db.users.some(x=>x.username===username)){alert("Benutzername existiert bereits.");return}let u={id:"r-"+Date.now(),username,password:f.get("password"),name:f.get("name"),serviceNo:f.get("serviceNo"),role:"recruit",rank:"Recruit",fto:f.get("fto"),start:f.get("start"),status:"In Ausbildung",completed:[]};db.users.push(u);saveDB();selectedRecruit=u.id;admin()};
 document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{selectedRecruit=b.dataset.edit;admin()});
 document.querySelectorAll("[data-check]").forEach(b=>b.onchange=()=>{toggleChapter(sel.id,+b.dataset.check);admin()});
 $("#saveRecruit")?.addEventListener("click",()=>{let u=db.users.find(x=>x.id===sel.id);u.fto=$("#editFto").value;u.status=$("#editStatus").value;u.rank=$("#editRank").value;saveDB();admin()});
 $("#deleteRecruit")?.addEventListener("click",()=>{if(confirm("Recruit-Account wirklich löschen?")){db.users=db.users.filter(x=>x.id!==sel.id);saveDB();selectedRecruit=null;admin()}});
}
function adminRecruit(r){
 let p=progress(r);
 return `<div class="card">
  <div class="eyebrow">AUSBILDUNGSAKTE</div><h2>${esc(r.name)}</h2>
  <p class="muted">${esc(r.serviceNo)} · ${esc(r.username)}</p>
  <div class="progress"><i style="width:${p}%"></i></div><p><b>${p}%</b> · ${r.completed.length}/22 Kapitel · ${stage(r)}</p>
  <div class="grid account-grid">
   <label>FTO<input id="editFto" value="${esc(r.fto)}"></label>
   <label>Status<select id="editStatus"><option ${r.status==="In Ausbildung"?"selected":""}>In Ausbildung</option><option ${r.status==="Pausiert"?"selected":""}>Pausiert</option><option ${r.status==="Streifenfreigabe"?"selected":""}>Streifenfreigabe</option></select></label>
   <label>Rang<input id="editRank" value="${esc(r.rank)}"></label>
  </div>
  <button class="primary" id="saveRecruit">Stammdaten speichern</button>
  <h3>Kapitel-Freigaben</h3>
  <div class="chapter-checks">${titles.map(x=>`<label class="check"><input type="checkbox" data-check="${x.n}" ${r.completed.includes(x.n)?"checked":""}><span><b>${x.n}.</b> ${esc(x.title)}</span></label>`).join("")}</div>
  <button id="deleteRecruit" style="margin-top:18px;background:transparent;color:#ff7c87;border:1px solid #66333b;border-radius:8px;padding:9px 12px;cursor:pointer">Recruit löschen</button>
 </div>`;
}
function toggleChapter(uid,n){let u=db.users.find(x=>x.id===uid);if(!u)return;u.completed=u.completed||[];u.completed=u.completed.includes(n)?u.completed.filter(x=>x!==n):[...u.completed,n].sort((a,b)=>a-b);if(u.role==="recruit"){u.status=u.completed.length===22?"Streifenfreigabe":"In Ausbildung"}saveDB();if(current.id===uid)current=u}
function setupSearch(){
 $("#globalSearch").addEventListener("input",e=>{
  let q=e.target.value.trim().toLowerCase(), box=$("#searchResults");
  if(!q){box.classList.add("hidden");return}
  let hits=titles.map(x=>({n:x.n,title:x.title,text:(CHAPTERS[x.n].html||"").replace(/<[^>]+>/g," ")}))
   .filter(x=>(x.title+" "+x.text).toLowerCase().includes(q)).slice(0,12);
  box.innerHTML=hits.length?hits.map(x=>`<div class="search-item" data-result="${x.n}"><b>Kapitel ${x.n}: ${esc(x.title)}</b><small>Inhalt im Handbuch gefunden</small></div>`).join(""):`<div class="search-item"><b>Keine Treffer</b><small>Versuche einen anderen Suchbegriff.</small></div>`;
  box.classList.remove("hidden");
  box.querySelectorAll("[data-result]").forEach(x=>x.onclick=()=>{showChapter(+x.dataset.result);box.classList.add("hidden");$("#globalSearch").value=""});
 });
 document.addEventListener("click",e=>{if(!e.target.closest(".searchbox"))$("#searchResults").classList.add("hidden")});
}
$("#loginForm").onsubmit=e=>{
 e.preventDefault();db=loadDB();let u=$("#loginUser").value.trim().toLowerCase(),p=$("#loginPass").value;
 let found=db.users.find(x=>x.username.toLowerCase()===u&&x.password===p);
 if(!found){$("#loginError").textContent="Benutzername oder Passwort ist nicht korrekt.";return}
 current=found;$("#loginView").classList.add("hidden");$("#app").classList.remove("hidden");
 $("#topName").textContent=current.name;$("#topRole").textContent=current.role==="admin"?"Administrator / FTO":"Recruit";
 nav();setupSearch();dashboard();
 if(!sessionStorage.getItem("apd_seen_splash")){$("#splash").classList.remove("hidden")}
};
$("#enterPortal").onclick=()=>{$("#splash").classList.add("hidden");sessionStorage.setItem("apd_seen_splash","1")};
$("#logoutBtn").onclick=()=>{current=null;location.reload()};
