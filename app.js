
const $ = s => document.querySelector(s);
const esc = s => String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const DBKEY="apd_portal_v2";
const seed={
 users:[
  {id:"admin-carter",username:"sgt.carter",password:"APD-Demo-Admin",name:"Sgt Carter",serviceNo:"S-01",role:"admin",rank:"Sergeant",fto:"Sgt Carter",start:"03.10.2026",status:"FTO / Administration",completed:[]},
  {id:"recruit-test",username:"recruit.test",password:"APD-Demo-2026",name:"Recruit Test",serviceNo:"R-102",role:"recruit",rank:"Recruit",fto:"Sgt Carter",start:"03.10.2026",status:"In Ausbildung",completed:[]}
 ]};
function loadDB(){
  let data;
  try { data = JSON.parse(localStorage.getItem(DBKEY) || '{"users":[]}'); }
  catch { data = {users:[]}; }
  if (!data || !Array.isArray(data.users)) data = {users:[]};

  // Demo-/Notfallkonten immer sicherstellen, auch wenn bereits alte Browserdaten existieren.
  for (const demo of seed.users) {
    const i = data.users.findIndex(u => u.username === demo.username);
    if (i === -1) data.users.push({...demo, completed:[...(demo.completed||[])]});
    else data.users[i] = {...data.users[i], ...demo, completed:data.users[i].completed||[]};
  }
  for(const u of data.users){u.assignedTests=u.assignedTests||[];u.testResults=u.testResults||[];}
  localStorage.setItem(DBKEY, JSON.stringify(data));
  return data;
}
function saveDB(){localStorage.setItem(DBKEY,JSON.stringify(db))}
function isOwner(u=current){return !!u && u.id==="admin-carter"}
function isTrainer(u=current){return !!u && (u.role==="admin"||u.role==="trainer")}
function canCreateRecruit(u=current){return isOwner(u)||u?.role==="admin"||(u?.role==="trainer"&&u.access==="extra")}
function roleLabel(u){
 if(!u)return "";
 if(isOwner(u))return "Hauptadmin / FTO";
 if(u.role==="trainer")return u.access==="extra"?"Ausbilder · Extra-Zugriff":"Ausbilder";
 return "Recruit";
}
let db=loadDB(), current=null, selectedRecruit=null;
const titles=Object.entries(CHAPTERS).map(([n,c])=>({n:+n,title:c.title}));

const TESTS=[
{id:"test-a",title:"Test A · Dienst & Auftrag",desc:"Auftrag, Verhalten, Dienstantritt und Ausrüstung.",pass:80,questions:[
{q:"Was beschreibt RKE?",a:["Ruhig bleiben – klar kommunizieren – Entscheidungen erklären","Rechte kennen – Kontrolle erklären – Einsatz beenden","Rückmeldung – Kennzeichen – Einsatzort"],c:0},
{q:"Wofür steht UAFL?",a:["Uniform – Ausrüstung – Funk – Laptop","Uniform – Akte – Fahrzeug – Leitstelle","Unterweisung – Auftrag – Funk – Lage"],c:0},
{q:"Was gehört zum Auftrag des APD?",a:["Bürgern helfen, Lagen bearbeiten, Entscheidungen treffen und dokumentieren","Nur Verkehrskontrollen","Nur Funksprüche beantworten"],c:0},
{q:"Wie sollte ein Recruit auftreten?",a:["Ruhig, klar und nachvollziehbar","Ohne Erklärungen","Nur über den FTO"],c:0},
{q:"Wer begleitet bis zur Streifenfreigabe?",a:["Der zuständige FTO","Nur die Leitstelle","Das DOJ"],c:0},
{q:"Was gehört zur Dienstausrüstung?",a:["Funkgerät","Privates Tablet als Pflichtgerät","Privates Funkgerät"],c:0},
{q:"Was ist vor Dienstbeginn zu prüfen?",a:["Uniform, Ausrüstung, Funk und Laptop","Nur das Fahrzeug","Nur Waffe und Munition"],c:0},
{q:"Was ist bei Entscheidungen wichtig?",a:["Begründbarkeit und Nachvollziehbarkeit","Keine Dokumentation","Keine Erklärung"],c:0},
{q:"Was gehört zu professionellem Verhalten?",a:["Klare Kommunikation und Dienstwege","Eigenmächtiges Handeln ohne Rückmeldung","Funk ignorieren"],c:0},
{q:"Welcher Status passt zu einem neuen Recruit?",a:["In Ausbildung","Streifenfreigabe","Außer Dienst"],c:0}]},
{id:"test-b",title:"Test B · Funk & Funkcodes",desc:"Funkdisziplin, Meldeschema, Rufnamen und wichtige 10-Codes.",pass:80,questions:[
{q:"Wofür steht DDS?",a:["Denken – Drücken – Sprechen","Dienst – Durchsage – Status","Drücken – Durchgeben – Sichern"],c:0},
{q:"Wofür steht WWWB?",a:["Wer – wo – was – Bedarf","Wann – wer – warum – Beweis","Wache – Wagen – Waffe – Bürger"],c:0},
{q:"Was bedeutet 10-4?",a:["Verstanden / bestätigt","Standort","Verkehrsunfall"],c:0},
{q:"Was bedeutet 10-20?",a:["Standort","Dienstbeginn","Verstärkung"],c:0},
{q:"Was bedeutet 10-78?",a:["Verstärkung benötigt","Rückkehr zur Wache","Fahrzeugkontrolle"],c:0},
{q:"Was bedeutet 10-80?",a:["Verfolgung","Dienstende","Person festgenommen"],c:0},
{q:"Was bedeutet 10-41?",a:["Dienstbeginn","Dienstende","Nicht verfügbar"],c:0},
{q:"Was bedeutet 10-42?",a:["Dienstende","Dienstbeginn","Ankunft am Einsatzort"],c:0},
{q:"Welcher Funkrufname wird im Handbuch genannt?",a:["ADAM","OMEGA","TANGO-X"],c:0},
{q:"Welche Stationskennung hat APD?",a:["1","5","10"],c:0}]},
{id:"test-c",title:"Test C · Ortskunde & Orientierung",desc:"Postleitzahlbereiche, Standortmeldungen und Orientierung.",pass:80,questions:[
{q:"Wofür steht SPM?",a:["Straße – Postleitzahl – markanter Ort","Standort – Person – Maßnahme","Sicherung – Position – Meldung"],c:0},
{q:"Paleto / Mount Chiliad?",a:["1000er","6000er","9000er"],c:0},{q:"Grapeseed?",a:["2000er","5000er","8000er"],c:0},
{q:"Sandy?",a:["3000er","7000er","10000er"],c:0},{q:"Harmony / Route 68?",a:["4000er","1000er","9000er"],c:0},
{q:"Zancudo / LS County?",a:["5000er","3000er","8000er"],c:0},{q:"Vinewood?",a:["6000er","2000er","10000er"],c:0},
{q:"Rockford?",a:["7000er","4000er","1000er"],c:0},{q:"Los Santos Middle?",a:["8000er","5000er","2000er"],c:0},
{q:"Ports?",a:["10000er","6000er","3000er"],c:0}]},
{id:"test-d",title:"Test D · CAD, EFA & Streifendienst",desc:"Dienstsysteme, Fahrzeugabfragen und Streifenarbeit.",pass:80,questions:[
{q:"Welches System enthält Personen, Fahrzeuge und Reports?",a:["CAD","EFA","EMS"],c:0},
{q:"Wann bedient der Fahrer den Laptop?",a:["Wenn das Fahrzeug sicher steht","Während jeder Fahrt","Nur bei Code 3"],c:0},
{q:"Wofür steht KAP?",a:["Kennzeichen – Abfrage – passenden Treffer prüfen","Kontrolle – Akte – Person","Kennzeichen – Anhalten – Protokoll"],c:0},
{q:"Wozu dient EFA?",a:["Fahrzeugabfrage","Funkfrequenz","Waffenfreigabe"],c:0},
{q:"Welche Kategorie gehört zum CAD?",a:["Personen","Wetterradar","Werkstatt"],c:0},
{q:"Welche weitere Kategorie gehört zum CAD?",a:["Fahrzeuge","Kleiderkammer","Tankstellen"],c:0},
{q:"Wofür steht BBEHD?",a:["Beobachten – bewerten – entscheiden – handeln – dokumentieren","Bergen – befragen – ermitteln – handeln – durchsuchen","Beobachten – berichten – Einsatz – Hilfe – Dienstende"],c:0},
{q:"Wofür steht OFK?",a:["Orientierung – Funk – Kontrolle","Officer – Fahrzeug – Kennzeichen","Ort – Festnahme – Kontrolle"],c:0},
{q:"Was folgt auf eine relevante Maßnahme?",a:["Saubere Dokumentation","Keine weitere Bearbeitung","Nur eine mündliche Meldung"],c:0},
{q:"Ist EVA dasselbe wie EFA?",a:["Nein, es ist ein anderes System","Ja","Nur bei Fahrzeugen"],c:0}]},
{id:"test-e",title:"Test E · Maßnahmen, Gefahren & Beweismittel",desc:"Bürgerkontakt, Maßnahmen, Gefahrenlehre und Beweissicherung.",pass:80,questions:[
{q:"Wofür steht BKFA?",a:["Beobachtung – Kontakt – Feststellung – Abschluss","Bürger – Kontrolle – Funk – Akte","Beweis – Kennzeichen – Festnahme – Abschluss"],c:0},
{q:"Wofür steht GMD?",a:["Grundlage prüfen – Maßnahme begründen – dokumentieren","Gefahr melden – Dienst beenden","Gesetz merken – Durchsuchung"],c:0},
{q:"Was ist vor einer Maßnahme wichtig?",a:["Grundlage prüfen","Akte schließen","Keine Rückfragen"],c:0},
{q:"Wofür steht SÜLA?",a:["Sichern – Übergabe dokumentieren – Laborprüfung – Akte ergänzen","Suchen – überprüfen – Lage – Abschluss","Sichern – üben – Leitstelle – Anhalten"],c:0},
{q:"Wofür steht EMBH?",a:["Erkennen – Melden – Bewerten – Hilfe","Einsatz – Maßnahme – Beweis – Haft","Ermitteln – Markieren – Bergen – Handeln"],c:0},
{q:"Wie mit unbekannter Gefahr umgehen?",a:["Nicht unnötig testen; erkennen, melden und bewerten","Sofort betreten","Nur fotografieren"],c:0},
{q:"Was gehört zur Beweismittelarbeit?",a:["Übergabe dokumentieren","Ohne Eintrag weitergeben","Privat aufbewahren"],c:0},
{q:"Was unterstützt STOP?",a:["Situation neu betrachten und Tatsachen von Annahmen trennen","Funk beenden","Verfolgung automatisch abbrechen"],c:0},
{q:"Wann Partner/FTO einbeziehen?",a:["Bei unklarer Lage oder Grundlage","Nie","Erst nach Dienstende"],c:0},
{q:"Was gehört zum Abschluss?",a:["Ergebnis und Schritte dokumentieren","Notizen löschen","Keine Rückmeldung"],c:0}]}
];


function nav(){
 let html=`<button class="nav-btn active" data-view="dashboard">⌂ Dashboard</button><div class="nav-label">AUSBILDUNG</div>`;
 for(const x of titles) html+=`<button class="nav-btn" data-chapter="${x.n}"><span class="num">${x.n}</span>${esc(x.title)}</button>`;
 html+=`<div class="nav-label">PRÜFUNGEN</div><button class="nav-btn" data-view="tests">✎ Tests</button>`;
 if(isTrainer(current)) html+=`<div class="nav-label">FTO / ADMIN</div><button class="nav-btn" data-view="admin">⚙ Recruit-Verwaltung</button>`;
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
 if(v==="tests") return testsView();
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
  </div><div class="hero-logo"><img src="apd-logo.png" alt="APD"></div>
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
 const chapterImages=n===21?["gebietskarte.png"]:(c.images||[]); const imgs=chapterImages.map(i=>`<img src="${i}" alt="Handbuch-Abbildung ${i}" onclick="window.open(this.src,'_blank')">`).join("");
 $("#content").innerHTML=`
 <div class="chapter-header" style="background-image:linear-gradient(90deg,rgba(4,13,24,.96),rgba(4,13,24,.58)),url('${n===21?"gebietskarte.png":((c.images||[])[0]||"image26.png")}')">
  <div><div class="chapter-no">KAPITEL ${String(n).padStart(2,"0")}</div><h1>${esc(c.title)}</h1><span class="status">${done?"✓ Abgeschlossen":"● In Ausbildung"}</span></div>
 </div>
 <div class="chapter-body">
  <article class="card article">${c.html || "<p>Für dieses Kapitel wurden keine zusätzlichen Textblöcke erkannt.</p>"}${imgs?`<h3>Bebilderte Anleitung</h3><div class="gallery">${imgs}</div>`:""}</article>
  <aside class="card side-card">
    <div class="eyebrow">AUSBILDUNGSSTATUS</div><h2>${done?"Abgeschlossen":"In Ausbildung"}</h2>
    <p class="muted">Zuständiger FTO</p><h3>${esc(current.fto)}</h3>
    <div class="notice">${isTrainer(current)?"Als Ausbilder kannst du den Ausbildungsstand in der Recruit-Verwaltung ändern.":"Der Abschluss wird durch deinen FTO im Verwaltungsbereich bestätigt."}</div>
    ${isTrainer(current)?`<button class="primary complete-btn ${done?"done":""}" id="quickToggle">${done?"Abschluss zurücknehmen":"Kapitel abschließen"}</button>`:""}
  </aside>
 </div>`;
 if(isTrainer(current)) $("#quickToggle").onclick=()=>{toggleChapter(current.id,n);showChapter(n)};
}
function account(){
 setActive('[data-view="account"]');$("#pageTitle").textContent="Mein Konto";
 $("#content").innerHTML=`<div class="section-head"><div><div class="eyebrow">ACCOUNT</div><h1>Mein Konto</h1></div><span class="status">${roleLabel(current)}</span></div>
 <div class="card account-card">
  <div class="profile-line"><img src="apd-logo.png" alt="Alta PD Logo"><div><h2>${esc(current.name)}</h2><p>${esc(current.rank||"")}</p></div></div>
  <div class="form-grid">
   <label>Benutzername<input value="${esc(current.username)}" disabled></label>
   <label>Dienstnummer<input id="myServiceNo" value="${esc(current.serviceNo||"")}" placeholder="z. B. R-102"></label>
   <label>Status<input value="${esc(current.status||"")}" disabled></label>
   <label>FTO<input value="${esc(current.fto||"—")}" disabled></label>
  </div>
  <button class="primary" id="saveMyAccount">Dienstnummer speichern</button>
  <p class="muted" style="margin-top:10px">Die Dienstnummer kann von jedem Account selbst geändert werden.</p>
 </div>`;
 $("#saveMyAccount").onclick=()=>{
   const value=$("#myServiceNo").value.trim();
   if(!value){alert("Bitte eine Dienstnummer eintragen.");return}
   const u=db.users.find(x=>x.id===current.id);
   if(!u)return;
   u.serviceNo=value;saveDB();current=u;
   alert("Dienstnummer gespeichert.");
   account();
 };
}
function admin(){
 if(!isTrainer(current)) return dashboard();
 setActive('[data-view="admin"]'); $("#pageTitle").textContent="Recruit-Verwaltung";
 const recruits=db.users.filter(x=>x.role==="recruit");
 const trainers=db.users.filter(x=>x.role==="trainer");
 if(!selectedRecruit && recruits[0]) selectedRecruit=recruits[0].id;
 let sel=db.users.find(x=>x.id===selectedRecruit && x.role==="recruit");
 const createRecruitCard=canCreateRecruit()?`<div class="card"><h3>Neuen Recruit anlegen</h3><form id="createRecruit" class="form-grid">
    <label>Name<input name="name" required placeholder="Recruit Name"></label>
    <label>Dienstnummer<input name="serviceNo" required placeholder="R-103"></label>
    <label>Benutzername<input name="username" required placeholder="vorname.nachname"></label>
    <label>Initiales Passwort<input name="password" required minlength="6"></label>
    <label>FTO<input name="fto" value="${esc(current.name)}" required></label>
    <label>Ausbildungsbeginn<input name="start" value="${new Date().toLocaleDateString("de-DE")}"></label>
    <button class="primary" type="submit">Recruit-Account erstellen</button>
   </form></div>`:`<div class="card"><h3>Recruit-Accounts</h3><p class="muted">Mit deinem aktuellen Zugriff kannst du Ausbildungsstände bearbeiten. Neue Accounts können nur mit Extra-Zugriff angelegt werden.</p></div>`;
 const trainerAdmin=isOwner()?`<div class="card trainer-admin"><div class="section-head compact"><div><div class="eyebrow">AUSBILDER</div><h3>Ausbilder-Accounts</h3></div><span class="access-badge owner">Nur Hauptadmin</span></div>
   <form id="createTrainer" class="form-grid">
    <label>Name<input name="name" required placeholder="Sgt Mustermann"></label>
    <label>Dienstnummer<input name="serviceNo" required placeholder="S-02"></label>
    <label>Rang<input name="rank" value="Sergeant" required></label>
    <label>Benutzername<input name="username" required placeholder="sgt.mustermann"></label>
    <label>Initiales Passwort<input name="password" required minlength="6"></label>
    <label>Status / Zugriff<select name="access"><option value="standard">Ausbilder</option><option value="extra">Ausbilder + Extra-Zugriff</option></select></label>
    <button class="primary" type="submit">Ausbilder-Account erstellen</button>
   </form>
   <div class="trainer-list">${trainers.map(t=>`<div class="trainer-row"><div><b>${esc(t.name)}</b><small>${esc(t.serviceNo)} · ${esc(t.rank)} · ${esc(t.username)}</small></div><select data-access="${t.id}"><option value="standard" ${t.access!=="extra"?"selected":""}>Ausbilder</option><option value="extra" ${t.access==="extra"?"selected":""}>Ausbilder + Extra-Zugriff</option></select><button class="danger-btn" data-delete-trainer="${t.id}">Löschen</button></div>`).join("")||"<p class='muted'>Noch keine zusätzlichen Ausbilder-Accounts.</p>"}</div>
  </div>`:"";
 $("#content").innerHTML=`
 <div class="section-head"><div><div class="eyebrow">FTO / ADMINISTRATION</div><h1>Recruit-Verwaltung</h1></div><span class="status">${esc(current.name)} · ${roleLabel(current)}</span></div>
 <div class="admin-grid">
  <div>
   ${createRecruitCard}
   <div class="card" style="margin-top:14px"><h3>Recruit-Accounts</h3>
    ${recruits.map(r=>`<div class="recruit-row"><div><b>${esc(r.name)}</b><small>${esc(r.serviceNo)} · ${progress(r)}% · ${esc(r.fto)}</small></div><button class="primary" data-edit="${r.id}">Öffnen</button></div>`).join("")||"<p>Noch keine Recruit-Accounts.</p>"}
   </div>
   ${trainerAdmin}
  </div>
  <div>${sel?adminRecruit(sel):`<div class="card"><h2>Keinen Recruit ausgewählt</h2></div>`}</div>
 </div>`;
 $("#createRecruit")?.addEventListener("submit",e=>{e.preventDefault();let f=new FormData(e.target);let username=f.get("username").trim().toLowerCase();if(db.users.some(x=>x.username===username)){alert("Benutzername existiert bereits.");return}let u={id:"r-"+Date.now(),username,password:f.get("password"),name:f.get("name"),serviceNo:f.get("serviceNo"),role:"recruit",rank:"Recruit",fto:f.get("fto"),start:f.get("start"),status:"In Ausbildung",completed:[],assignedTests:[],testResults:[]};db.users.push(u);saveDB();selectedRecruit=u.id;admin()});
 $("#createTrainer")?.addEventListener("submit",e=>{e.preventDefault();let f=new FormData(e.target);let username=f.get("username").trim().toLowerCase();if(db.users.some(x=>x.username===username)){alert("Benutzername existiert bereits.");return}db.users.push({id:"t-"+Date.now(),username,password:f.get("password"),name:f.get("name"),serviceNo:f.get("serviceNo"),role:"trainer",access:f.get("access"),rank:f.get("rank"),fto:"—",start:new Date().toLocaleDateString("de-DE"),status:f.get("access")==="extra"?"Ausbilder · Extra-Zugriff":"Ausbilder",completed:[],assignedTests:[],testResults:[]});saveDB();admin()});
 document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{selectedRecruit=b.dataset.edit;admin()});
 document.querySelectorAll("[data-check]").forEach(b=>b.onchange=()=>{toggleChapter(sel.id,+b.dataset.check);admin()});
 document.querySelectorAll("[data-test-assign]").forEach(b=>b.onchange=()=>{let u=db.users.find(x=>x.id===sel.id);u.assignedTests=u.assignedTests||[];if(b.checked&&!u.assignedTests.includes(b.dataset.testAssign))u.assignedTests.push(b.dataset.testAssign);if(!b.checked)u.assignedTests=u.assignedTests.filter(x=>x!==b.dataset.testAssign);saveDB();admin()});
 document.querySelectorAll("[data-access]").forEach(x=>x.onchange=()=>{let u=db.users.find(v=>v.id===x.dataset.access);if(!u)return;u.access=x.value;u.status=x.value==="extra"?"Ausbilder · Extra-Zugriff":"Ausbilder";saveDB();admin()});
 document.querySelectorAll("[data-delete-trainer]").forEach(b=>b.onclick=()=>{if(confirm("Ausbilder-Account wirklich löschen?")){db.users=db.users.filter(x=>x.id!==b.dataset.deleteTrainer);saveDB();admin()}});
 $("#saveRecruit")?.addEventListener("click",()=>{let u=db.users.find(x=>x.id===sel.id);u.fto=$("#editFto").value;u.status=$("#editStatus").value;u.rank=$("#editRank").value;saveDB();admin()});
 $("#deleteRecruit")?.addEventListener("click",()=>{if(!canCreateRecruit()){alert("Zum Löschen von Accounts ist Extra-Zugriff erforderlich.");return}if(confirm("Recruit-Account wirklich löschen?")){db.users=db.users.filter(x=>x.id!==sel.id);saveDB();selectedRecruit=null;admin()}});
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
  <h3 style="margin-top:22px">Tests zuweisen</h3>
  <p class="muted">Freigegebene Tests erscheinen beim Recruit unter „Tests“.</p>
  <div class="chapter-checks">${TESTS.map(t=>`<label class="check"><input type="checkbox" data-test-assign="${t.id}" ${(r.assignedTests||[]).includes(t.id)?"checked":""}><span><b>${esc(t.title)}</b><small>${esc(t.desc)}</small></span></label>`).join("")}</div>
  <h3 style="margin-top:22px">Test-Mappe</h3>
  <div>${(r.testResults||[]).length?r.testResults.slice().reverse().map(res=>{let t=TESTS.find(x=>x.id===res.testId);return `<div class="test-result-row"><div><b>${esc(t?.title||res.testId)}</b><small>${esc(res.date||"")} · ${res.score}/${res.total} Punkte · ${res.percent}%</small></div><span class="test-state ${res.passed?"passed":"failed"}">${res.passed?"BESTANDEN":"NICHT BESTANDEN"}</span></div>`}).join(""):"<p class='muted'>Noch keine abgeschlossenen Tests.</p>"}</div>
  <button id="deleteRecruit" style="margin-top:18px;background:transparent;color:#ff7c87;border:1px solid #66333b;border-radius:8px;padding:9px 12px;cursor:pointer">Recruit löschen</button>
 </div>`;
}

function testsView(){
 setActive('[data-view="tests"]'); $("#pageTitle").textContent="Tests";
 if(isTrainer(current)){
  $("#content").innerHTML=`<div class="section-head"><div><div class="eyebrow">PRÜFUNGEN</div><h1>Test-Katalog</h1></div><span class="status">${TESTS.length} Tests</span></div><div class="card"><p>Tests werden unter <b>Recruit-Verwaltung → Recruit öffnen → Tests zuweisen</b> freigegeben.</p></div><div class="grid test-grid">${TESTS.map(t=>`<div class="card test-card"><div class="eyebrow">${t.questions.length} FRAGEN · BESTEHEN AB ${t.pass}%</div><h2>${esc(t.title)}</h2><p>${esc(t.desc)}</p></div>`).join("")}</div>`;return;
 }
 current.assignedTests=current.assignedTests||[];current.testResults=current.testResults||[];
 const assigned=TESTS.filter(t=>current.assignedTests.includes(t.id));
 $("#content").innerHTML=`<div class="section-head"><div><div class="eyebrow">PRÜFUNGEN</div><h1>Meine Tests</h1></div><span class="status">${assigned.length} freigegeben</span></div><div class="test-tabs"><button class="primary" id="openTestsTab">Freigegebene Tests</button><button class="secondary" id="folderTab">📁 Mappe</button></div><div class="grid test-grid">${assigned.length?assigned.map(t=>`<div class="card test-card"><div class="eyebrow">${t.questions.length} FRAGEN · BESTEHEN AB ${t.pass}%</div><h2>${esc(t.title)}</h2><p>${esc(t.desc)}</p><button class="primary" data-start-test="${t.id}">${current.testResults.some(r=>r.testId===t.id)?"Erneut üben":"Test starten"}</button></div>`).join(""):"<div class='card'><h2>Keine Tests freigegeben</h2><p class='muted'>Dein Ausbilder hat dir aktuell noch keinen Test zugewiesen.</p></div>"}</div>`;
 document.querySelectorAll("[data-start-test]").forEach(b=>b.onclick=()=>startTest(b.dataset.startTest));$("#folderTab").onclick=showTestFolder;
}
function startTest(id){
 const t=TESTS.find(x=>x.id===id);if(!t||isTrainer(current)||!(current.assignedTests||[]).includes(id))return testsView();
 $("#pageTitle").textContent=t.title;$("#content").innerHTML=`<div class="section-head"><div><div class="eyebrow">ÜBUNGSTEST</div><h1>${esc(t.title)}</h1><p>${esc(t.desc)}</p></div><span class="status">${t.questions.length} Fragen</span></div><form id="testForm">${t.questions.map((q,i)=>`<div class="card question-card"><div class="question-no">FRAGE ${i+1} / ${t.questions.length}</div><h3>${esc(q.q)}</h3><div class="answers">${q.a.map((a,j)=>`<label class="answer"><input type="radio" name="q${i}" value="${j}" required><span>${esc(a)}</span></label>`).join("")}</div></div>`).join("")}<button class="primary finish-test" type="submit">Test auswerten</button></form>`;
 $("#testForm").onsubmit=e=>{e.preventDefault();let f=new FormData(e.target),score=0;t.questions.forEach((q,i)=>{if(+f.get("q"+i)===q.c)score++});let percent=Math.round(score/t.questions.length*100),passed=percent>=t.pass;let u=db.users.find(x=>x.id===current.id);u.testResults=u.testResults||[];u.testResults.push({testId:t.id,score,total:t.questions.length,percent,passed,date:new Date().toLocaleString("de-DE")});saveDB();current=u;showTestResult(t,score,percent,passed)};
}
function showTestResult(t,score,percent,passed){
 $("#content").innerHTML=`<div class="result-hero card ${passed?"passed":"failed"}"><div class="eyebrow">TEST ABGESCHLOSSEN</div><h1>${passed?"Bestanden":"Nicht bestanden"}</h1><div class="score-big">${score} / ${t.questions.length}</div><h2>${percent}%</h2><p>${passed?"Bestanden und in deiner Mappe gespeichert.":"Versuch gespeichert. Du kannst den Test erneut üben."}</p><button class="primary" id="toFolder">📁 Zur Mappe</button> <button class="secondary" id="backTests">Zu den Tests</button></div>`;$("#toFolder").onclick=showTestFolder;$("#backTests").onclick=testsView;
}
function showTestFolder(){
 $("#pageTitle").textContent="Tests · Mappe";const results=(current.testResults||[]).slice().reverse();$("#content").innerHTML=`<div class="section-head"><div><div class="eyebrow">TESTS</div><h1>📁 Meine Mappe</h1><p>Abgeschlossene Testversuche.</p></div></div><div class="card">${results.length?results.map(r=>{let t=TESTS.find(x=>x.id===r.testId);return `<div class="folder-row"><div><b>${esc(t?.title||r.testId)}</b><small>${esc(r.date)} · ${r.score}/${r.total} Punkte · ${r.percent}%</small></div><span class="test-state ${r.passed?"passed":"failed"}">${r.passed?"BESTANDEN":"NICHT BESTANDEN"}</span></div>`}).join(""):"<p class='muted'>Deine Mappe ist noch leer.</p>"}</div><button class="secondary" id="backTests">← Zurück zu Tests</button>`;$("#backTests").onclick=testsView;
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
 current=found;
 localStorage.setItem("apd_logged_in_user", current.username); db.activeUser=current.username; saveDB();
 $("#loginView").classList.add("hidden");$("#app").classList.remove("hidden");
 $("#topName").textContent=current.name;$("#topRole").textContent=roleLabel(current);
 nav();setupSearch();dashboard();
 if(!sessionStorage.getItem("apd_seen_splash")){$("#splash").classList.remove("hidden")}
};
$("#enterPortal").onclick=()=>{$("#splash").classList.add("hidden");sessionStorage.setItem("apd_seen_splash","1")};
$("#logoutBtn").onclick=()=>{localStorage.removeItem("apd_logged_in_user");db.activeUser=null;saveDB();current=null;location.reload()};

(function restoreLogin(){
  db=loadDB(); const username=localStorage.getItem("apd_logged_in_user") || db.activeUser;
  if(!username) return;
  const found=db.users.find(x=>x.username===username);
  if(!found){localStorage.removeItem("apd_logged_in_user");return;}
  current=found;
  $("#loginView").classList.add("hidden");
  $("#app").classList.remove("hidden");
  $("#topName").textContent=current.name;
  $("#topRole").textContent=roleLabel(current);
  nav();setupSearch();dashboard();
})();
