
const $ = s => document.querySelector(s);
const esc = s => String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const SUPABASE_URL="https://nbjfslwznuuwbqmvtldl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_EmJes2VlNCNztFeNiL6KLQ_U_1G_Mvy";
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
 auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
});
let db={users:[]}, current=null, selectedRecruit=null;

function authEmail(username){
 return `${String(username||"").trim().toLowerCase()}@altapd.internal`;
}
function mapProfile(p){
 return {
  id:p.id, username:p.username, name:p.name, serviceNo:p.service_no||"",
  role:p.role, access:p.access_level||"standard", rank:p.rank||"",
  fto:p.fto||"", start:p.training_start||"", status:p.status||"In Ausbildung",
  mustChangePassword:!!p.must_change_password, secondaryFto:p.secondary_fto||"", lastLogin:p.last_login||null,
  completed:[], assignedTests:[], testResults:[], notes:[], goals:[], activity:[], reports:[], favorites:[]
 };
}
async function refreshData(){
 const {data:{user}}=await sb.auth.getUser();
 if(!user){db={users:[]};current=null;return false}
 const {data:me,error:meErr}=await sb.from("profiles").select("*").eq("id",user.id).single();
 if(meErr||!me) throw meErr||new Error("Kein Portal-Profil gefunden.");
 current=mapProfile(me);

 let profiles=[me];
 if(["admin","trainer"].includes(me.role)){
  const {data,error}=await sb.from("profiles").select("*").order("name");
  if(error) throw error;
  profiles=data||[];
 }
 db.users=profiles.map(mapProfile);

 const ids=db.users.map(x=>x.id);
 if(ids.length){
  const [{data:prog,error:pe},{data:assign,error:ae},{data:results,error:re},{data:notes,error:ne},{data:goals,error:ge},{data:reports,error:rpe},{data:favs,error:fe}]=await Promise.all([
   sb.from("training_progress").select("*").in("recruit_id",ids),
   sb.from("test_assignments").select("*").eq("active",true).in("recruit_id",ids),
   sb.from("test_results").select("*").in("recruit_id",ids).order("completed_at",{ascending:true}),
   sb.from("recruit_notes").select("*").in("recruit_id",ids).order("created_at",{ascending:true}),
   sb.from("training_goals").select("*").in("recruit_id",ids).order("created_at",{ascending:true}),
   sb.from("field_reports").select("*").in("recruit_id",ids).order("created_at",{ascending:true}),
   sb.from("chapter_favorites").select("*").in("user_id",ids)
  ]);
  if(pe) throw pe;if(ae) throw ae;if(re) throw re;if(ne) console.warn("Recruit-Vermerke:",ne.message);if(ge) console.warn("Ausbildungsziele:",ge.message);if(rpe) console.warn("FTO-Berichte:",rpe.message);if(fe) console.warn("Favoriten:",fe.message);
  for(const u of db.users){
   u.completed=(prog||[]).filter(x=>x.recruit_id===u.id&&x.completed).map(x=>x.chapter).sort((a,b)=>a-b);
   u.assignedTests=(assign||[]).filter(x=>x.recruit_id===u.id&&x.active).map(x=>x.test_id);
   u.testResults=(results||[]).filter(x=>x.recruit_id===u.id).map(x=>({
    testId:x.test_id,score:x.score,total:x.total,percent:x.percent,passed:x.passed,
    date:new Date(x.completed_at).toLocaleString("de-DE")
   }));
   u.notes=(notes||[]).filter(x=>x.recruit_id===u.id).map(x=>({
    id:x.id,text:x.note_text,authorName:x.author_name,authorRank:x.author_rank,
    createdAt:x.created_at,date:new Date(x.created_at).toLocaleString("de-DE")
   }));
   u.goals=(goals||[]).filter(x=>x.recruit_id===u.id).map(x=>({id:x.id,text:x.goal_text,done:!!x.completed,createdAt:x.created_at,completedAt:x.completed_at||null,authorName:x.author_name||"Ausbilder"}));
   u.reports=(reports||[]).filter(x=>x.recruit_id===u.id).map(x=>({id:x.id,date:x.report_date,duration:x.duration_minutes||0,topics:x.topics||"",positive:x.positive_points||"",improve:x.improvement_points||"",next:x.next_steps||"",author:x.author_name||"Ausbilder",createdAt:x.created_at}));
   u.favorites=(favs||[]).filter(x=>x.user_id===u.id).map(x=>x.chapter);
   const acts=[];
   (prog||[]).filter(x=>x.recruit_id===u.id&&x.completed).forEach(x=>acts.push({when:x.completed_at||null,icon:"✓",text:`Kapitel ${x.chapter} abgeschlossen`}));
   u.testResults.forEach(x=>{const raw=(results||[]).find(r=>r.recruit_id===u.id&&r.test_id===x.testId&&new Date(r.completed_at).toLocaleString("de-DE")===x.date);acts.push({when:raw?.completed_at||null,icon:x.passed?"🏅":"📝",text:`${TESTS.find(t=>t.id===x.testId)?.title||x.testId}: ${x.percent}% ${x.passed?"· bestanden":"· nicht bestanden"}`})});
   u.notes.forEach(x=>acts.push({when:x.createdAt,icon:"📝",text:`Vermerk von ${x.authorRank||"Ausbilder"} ${x.authorName||""}`}));
   u.goals.forEach(x=>acts.push({when:x.completedAt||x.createdAt,icon:x.done?"🎯":"📌",text:`Ausbildungsziel ${x.done?"erledigt":"gesetzt"}: ${x.text}`}));
   u.reports.forEach(x=>acts.push({when:x.createdAt,icon:"🚓",text:`FTO-Bericht: ${x.topics||"Ausbildungsfahrt"}`}));
   u.activity=acts.filter(x=>x.when).sort((a,b)=>new Date(b.when)-new Date(a.when));
  }
 }
 current=db.users.find(x=>x.id===user.id)||current;
 return true;
}
function isOwner(u=current){return !!u && u.role==="admin"&&u.access==="owner"}
function isTrainer(u=current){return !!u && (u.role==="admin"||u.role==="trainer")}
function canCreateRecruit(u=current){return isOwner(u)||(u?.role==="trainer"&&u.access==="extra")}
function roleLabel(u){
 if(!u)return "";
 if(isOwner(u))return "Hauptadmin / FTO";
 if(u.role==="trainer")return u.access==="extra"?"Ausbilder · Extra-Zugriff":"Ausbilder";
 return "Recruit";
}
async function invokeAccountAction(body){
 const {data,error}=await sb.functions.invoke("manage-user",{body});
 if(error) throw error;
 if(data?.error) throw new Error(data.error);
 return data;
}
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


const chapterIcons={1:"📋",2:"🛡️",3:"🦺",4:"📡",5:"📻",6:"🗺️",7:"💻",8:"🔎",9:"🚓",10:"🤝",11:"⚖️",12:"🗂️",13:"🛡️",14:"🎯",15:"🎓",16:"📋",17:"🎙️",18:"🔫",19:"🧪",20:"📝",21:"🗺️",22:"⚠️"};
const chapterCardImages=Object.fromEntries(Array.from({length:22},(_,i)=>[i+1,`chapter-art-${String(i+1).padStart(2,"0")}.webp`]));
function nav(){
 let html=`<button class="nav-btn active" data-view="dashboard">🏠 Dashboard</button><div class="nav-label">AUSBILDUNG</div>`;
 for(const x of titles) html+=`<button class="nav-btn" data-chapter="${x.n}"><span class="chapter-nav-icon" aria-hidden="true">${chapterIcons[x.n]||"📘"}</span>${esc(x.title)}</button>`;
 html+=`<div class="nav-label">PRÜFUNGEN</div><button class="nav-btn" data-view="tests">📝 Tests</button><div class="nav-label">PORTAL</div><button class="nav-btn" data-view="news">📢 Mitteilungen</button><button class="nav-btn" data-view="documents">📂 Dokumente</button>`;
 if(isTrainer(current)) html+=`<div class="nav-label">FTO / ADMIN</div><button class="nav-btn" data-view="admin">🛡️ Recruit-Verwaltung</button>`;
 $("#nav").innerHTML=html;
 document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>showView(b.dataset.view));
 document.querySelectorAll("[data-chapter]").forEach(b=>b.onclick=()=>showChapter(+b.dataset.chapter));
}
function setActive(sel){document.querySelectorAll(".nav-btn").forEach(x=>x.classList.remove("active"));document.querySelector(sel)?.classList.add("active")}
function progress(u){return Math.round(((u.completed||[]).length/22)*100)}
function stage(u){let p=progress(u);return p===100?"Streifenfreigabe":p>=75?"IV · Beobachtungsfahrt":p>=50?"III · Du führst":p>=25?"II · Zusammenarbeit":"I · Demonstration"}
function qualifications(u){
 const has=n=>(u.completed||[]).includes(n);
 const passed=id=>(u.testResults||[]).some(r=>r.testId===id&&r.passed);
 return [
  ["📻","Funk",has(4)&&has(5)], ["💻","CAD / EFA",has(7)&&has(8)],
  ["🚓","Streifendienst",has(9)&&has(10)], ["🎯","Schießtraining",has(13)&&has(14)],
  ["🧪","Beweismittel",has(12)&&has(19)], ["🏅","Theorieprüfung",passed("test-a")&&passed("test-b")],
  ["🛡️","Streifenfreigabe",progress(u)===100]
 ];
}
function qualificationHtml(u){return `<div class="qualification-grid">${qualifications(u).map(q=>`<div class="qualification ${q[2]?"earned":"locked"}"><span>${q[0]}</span><b>${esc(q[1])}</b><small>${q[2]?"Freigegeben":"Offen"}</small></div>`).join("")}</div>`}
function timelineHtml(u,limit=8){const a=(u.activity||[]).slice(0,limit);return a.length?a.map(x=>`<div class="timeline-row"><span class="timeline-icon">${x.icon}</span><div><b>${esc(x.text)}</b><small>${new Date(x.when).toLocaleString("de-DE")}</small></div></div>`).join(""):`<p class="muted">Noch keine Aktivitäten vorhanden.</p>`}
function showView(v){
 if(v==="dashboard") return dashboard();
 if(v==="admin") return admin();
 if(v==="tests") return testsView();
 if(v==="account") return account();
 if(v==="news") return newsView();
 if(v==="documents") return documentsView();
}
function dashboard(){
 setActive('[data-view="dashboard"]'); $("#pageTitle").textContent="Dashboard";
 let u=current, p=progress(u);
 $("#content").innerHTML=`
 <div class="hero">
  <div><div class="eyebrow">${greeting().toUpperCase()}</div><h1>${esc(u.rank?u.rank+" ":"")}${esc(u.name)}</h1>
   <span class="status">● ${esc(u.status)}</span>
   <p>Willkommen im Alta PD Ausbildungsportal. Hier findest du die Inhalte des Rekrutenhandbuchs, bebilderte Anleitungen und deinen persönlichen Ausbildungsfortschritt. Dein zuständiger FTO ist <b>${esc(u.fto)}</b>.</p>
  </div><div class="hero-logo"><img src="apd-logo.png" alt="APD"></div>
 </div>
 <div class="grid stats">
  <div class="card stat"><span>DIENSTNUMMER</span><b>${esc(u.serviceNo)}</b></div>
  <div class="card stat"><span>FTO</span><b>${esc(u.fto)}</b>${u.secondaryFto?`<small>+ ${esc(u.secondaryFto)}</small>`:""}</div>
  <div class="card stat"><span>AUSBILDUNGSSTATUS</span><b>${esc(u.status)}</b></div>
  <div class="card stat"><span>FORTSCHRITT</span><b>${p}%</b><div class="progress"><i style="width:${p}%"></i></div></div>
 </div>
 <div class="card"><div class="section-head" style="margin:0 0 12px"><div><div class="eyebrow">AKTUELLE STUFE</div><h2>${stage(u)}</h2></div><span>${u.completed.length} / 22 Kapitel</span></div><div class="progress"><i style="width:${p}%"></i></div></div>
 ${isTrainer(u)?`<div class="section-head"><div><div class="eyebrow">FTO-ÜBERSICHT</div><h2>Ausbildungsleitung</h2></div></div><div class="grid fto-stats">${(()=>{const rs=db.users.filter(x=>x.role==="recruit"),ready=rs.filter(x=>progress(x)===100).length,open=rs.reduce((a,x)=>a+(x.goals||[]).filter(g=>!g.done).length,0),tests=rs.reduce((a,x)=>a+(x.assignedTests||[]).length,0);return `<div class="card stat"><span>RECRUITS</span><b>${rs.length}</b></div><div class="card stat"><span>STREIFENFREIGABE</span><b>${ready}</b></div><div class="card stat"><span>OFFENE ZIELE</span><b>${open}</b></div><div class="card stat"><span>ZUGEWIESENE TESTS</span><b>${tests}</b></div>`})()}</div><div class="card"><div class="eyebrow">FORTSCHRITT DER RECRUITS</div><div class="fto-recruit-list">${db.users.filter(x=>x.role==="recruit").map(r=>`<div class="fto-recruit"><div><b>${esc(r.name)}</b><small>${esc(r.fto||"—")} · ${stage(r)}</small></div><div class="mini-progress"><i style="width:${progress(r)}%"></i></div><strong>${progress(r)}%</strong></div>`).join("")||"<p class='muted'>Noch keine Recruits.</p>"}</div></div>`:`<div class="dashboard-two"><div class="card"><div class="eyebrow">🎯 OFFENE AUSBILDUNGSZIELE</div><h2>Meine nächsten Ziele</h2>${(u.goals||[]).filter(g=>!g.done).length?(u.goals||[]).filter(g=>!g.done).map(g=>`<div class="goal-mini"><span>📌</span><b>${esc(g.text)}</b></div>`).join(""):"<p class='muted'>Aktuell keine offenen Ausbildungsziele.</p>"}</div><div class="card"><div class="eyebrow">🏅 QUALIFIKATIONEN</div><h2>Freigaben</h2>${qualificationHtml(u)}</div></div>`}
 <div class="card activity-card"><div class="eyebrow">AKTIVITÄTSVERLAUF</div><h2>Letzte Ausbildungsaktivitäten</h2>${timelineHtml(u,6)}</div>
 <div class="section-head"><div><div class="eyebrow">REKRUTENAUSBILDUNG</div><h2>Ausbildungskapitel</h2></div><span class="muted">Stand Handbuch 03.10.2026</span></div>
 <div class="grid chapter-grid">${titles.map(x=>`<div class="card chapter-card chapter-card-image ${u.completed.includes(x.n)?"done":""}" data-open="${x.n}" style="--chapter-bg:url('${chapterCardImages[x.n]||`image${x.n}.png`}')"><div class="chapter-card-shade"></div><div class="chapter-card-content"><div class="chapter-num"><span class="chapter-card-icon">${chapterIcons[x.n]||"📘"}</span> KAPITEL ${String(x.n).padStart(2,"0")}</div><h3>${esc(x.title)}</h3><span class="chapter-card-state">${u.completed.includes(x.n)?"✓ Abgeschlossen":"Nicht begonnen"}</span></div></div>`).join("")}</div>`;
 document.querySelectorAll("[data-open]").forEach(x=>x.onclick=()=>showChapter(+x.dataset.open));
}

async function restoreChapterNotes(n){
 let notes={};
 const {data,error}=await sb.from("chapter_notes").select("field_key,value").eq("user_id",current.id).eq("chapter",n);
 if(!error) for(const row of data||[]) notes[row.field_key]=row.value||"";
 document.querySelectorAll(".learn-line").forEach(el=>{
  const key=String(el.dataset.note);
  el.value=notes[key]||"";
  let timer;
  el.addEventListener("input",()=>{
   clearTimeout(timer);
   timer=setTimeout(async()=>{
    await sb.from("chapter_notes").upsert({
     user_id:current.id,chapter:n,field_key:key,value:el.value,updated_at:new Date().toISOString()
    },{onConflict:"user_id,chapter,field_key"});
   },350);
  });
 });
}
function editableChapterHtml(n,html){
 // Kapitelinhalt sicher aus dem Handbuch ausgeben.
 // Freie Ausbildungsnotizen werden separat über chapter_notes gespeichert.
 return html || "";
}

function showChapter(n){
 const c=CHAPTERS[n]; if(!c)return; localStorage.setItem("alta_last_chapter",String(n));
 setActive(`[data-chapter="${n}"]`); $("#pageTitle").textContent=`Kapitel ${n}`;
 const done=current.completed.includes(n);
 const chapterImages=(n===6||n===21)?["gebietskarte.png"]:(c.images||[]); const imgs=chapterImages.map(i=>`<img src="${i}" alt="Handbuch-Abbildung ${i}" onclick="window.open(this.src,'_blank')">`).join("");
 $("#content").innerHTML=`
 <div class="chapter-header" style="background-image:linear-gradient(90deg,rgba(4,13,24,.96),rgba(4,13,24,.58)),url('${(n===6||n===21)?"gebietskarte.png":((c.images||[])[0]||"image26.png")}')">
  <div><div class="chapter-no">KAPITEL ${String(n).padStart(2,"0")}</div><h1>${esc(c.title)}</h1><span class="status">${done?"✓ Abgeschlossen":"● In Ausbildung"}</span></div>
 </div>
 <div class="chapter-body">
  <article class="card article">${editableChapterHtml(n,c.html) || "<p>Für dieses Kapitel wurden keine zusätzlichen Textblöcke erkannt.</p>"}${imgs?`<h3>Bebilderte Anleitung</h3><div class="gallery">${imgs}</div>`:""}</article>
  <aside class="card side-card">
    <div class="eyebrow">AUSBILDUNGSSTATUS</div><h2>${done?"Abgeschlossen":"In Ausbildung"}</h2>
    <p class="muted">Zuständiger FTO</p><h3>${esc(current.fto)}</h3>
    <div class="notice">${isTrainer(current)?"Als Ausbilder kannst du den Ausbildungsstand in der Recruit-Verwaltung ändern.":"Der Abschluss wird durch deinen FTO im Verwaltungsbereich bestätigt."}</div>
    ${isTrainer(current)?`<button class="primary complete-btn ${done?"done":""}" id="quickToggle">${done?"Abschluss zurücknehmen":"Kapitel abschließen"}</button>`:""}<button class="secondary" id="favoriteChapter">${(current.favorites||[]).includes(n)?"★ Favorit entfernen":"☆ Als Favorit"}</button>
  </aside>
 </div>`;
 restoreChapterNotes(n); $("#favoriteChapter").onclick=async()=>{const on=(current.favorites||[]).includes(n);if(on)await sb.from("chapter_favorites").delete().eq("user_id",current.id).eq("chapter",n);else await sb.from("chapter_favorites").insert({user_id:current.id,chapter:n});await refreshData();showChapter(n)}; if(isTrainer(current)) $("#quickToggle").onclick=async()=>{await toggleChapter(current.id,n);showChapter(n)};
}
function account(){
 setActive('[data-view="account"]');$("#pageTitle").textContent="Mein Konto";
 $("#content").innerHTML=`<div class="section-head"><div><div class="eyebrow">ACCOUNT</div><h1>Mein Konto</h1></div><span class="status">${roleLabel(current)}</span></div>
 <div class="digital-id"><img src="apd-logo.png"><div><small>ALTA POLICE DEPARTMENT</small><h2>${esc(current.name)}</h2><b>${esc(current.rank||roleLabel(current))}</b><span>Badge ${esc(current.serviceNo||"—")}</span></div></div><div class="card account-card">
  <div class="profile-line"><img src="apd-logo.png" alt="Alta PD Logo"><div><h2>${esc(current.name)}</h2><p>${esc(current.rank||"")}</p></div></div>
  <div class="form-grid">
   <label>Benutzername<input value="${esc(current.username)}" disabled></label>
   <label>Dienstnummer<input id="myServiceNo" value="${esc(current.serviceNo||"")}" placeholder="z. B. R-102"></label>
   <label>Status<input value="${esc(current.status||"")}" disabled></label>
   <label>FTO<input value="${esc(current.fto||"—")}" disabled></label>
  </div>
  <button class="primary" id="saveMyAccount">💾 Dienstnummer speichern</button>
  <p class="muted" style="margin-top:10px">Die Dienstnummer kann von jedem Account selbst geändert werden. · Letzte Anmeldung: ${current.lastLogin?new Date(current.lastLogin).toLocaleString("de-DE"):"—"}</p><button class="secondary" onclick="window.print()">🖨️ Ausbildungsakte drucken</button>
 </div>
 <div class="card password-card">
  <div class="eyebrow">🔐 SICHERHEIT</div><h2>Passwort ändern</h2>
  ${current.mustChangePassword?`<div class="notice password-warning"><b>Erstanmeldung:</b> Bitte ersetze das Standardpasswort 123456 jetzt durch dein eigenes Passwort.</div>`:""}
  <form id="changeMyPassword" class="form-grid password-form">
   <label>Neues Passwort<input id="newPassword" type="password" minlength="8" autocomplete="new-password" required placeholder="Mindestens 8 Zeichen"></label>
   <label>Passwort wiederholen<input id="repeatPassword" type="password" minlength="8" autocomplete="new-password" required placeholder="Passwort wiederholen"></label>
   <button class="primary" type="submit">🔑 Passwort speichern</button>
  </form>
  <p class="muted" style="margin-top:10px">Dein aktuelles Passwort kann von niemandem eingesehen werden. Bei Verlust kann der Hauptadmin es auf 123456 zurücksetzen.</p>
 </div>
 ${current.role==="recruit"?`<div class="card notes-card"><div class="section-head compact"><div><div class="eyebrow">📝 AUSBILDUNGSVERMERKE</div><h2>Vermerke meiner Ausbilder</h2></div><span class="note-count">${(current.notes||[]).length}</span></div>${(current.notes||[]).length?current.notes.slice().reverse().map(n=>`<article class="note-entry"><div class="note-meta"><b>${esc(n.authorRank||"Ausbilder")} ${esc(n.authorName||"")}</b><span>${esc(n.date)}</span></div><p>${esc(n.text)}</p></article>`).join(""):`<div class="empty-note">Noch keine Vermerke vorhanden.</div>`}</div>`:""}
 ${current.role==="recruit"?`<div class="dashboard-two"><div class="card"><div class="eyebrow">🎯 AUSBILDUNGSZIELE</div><h2>Meine Ziele</h2>${(current.goals||[]).length?current.goals.map(g=>`<div class="goal-account ${g.done?"done":""}"><span>${g.done?"✓":"○"}</span><div><b>${esc(g.text)}</b><small>${g.done?"Erledigt":"Offen"}</small></div></div>`).join(""):"<p class='muted'>Keine Ziele eingetragen.</p>"}</div><div class="card"><div class="eyebrow">🏅 QUALIFIKATIONEN</div><h2>Meine Freigaben</h2>${qualificationHtml(current)}</div></div><div class="card activity-card"><div class="eyebrow">AKTIVITÄTSVERLAUF</div><h2>Meine Ausbildung</h2>${timelineHtml(current,12)}</div>`:""}`;
 $("#saveMyAccount").onclick=async()=>{
    const value=$("#myServiceNo").value.trim();
    if(!value){alert("Bitte eine Dienstnummer eintragen.");return}
    const {error}=await sb.rpc("update_my_service_no",{new_service_no:value});
    if(error){alert("Speichern fehlgeschlagen: "+error.message);return}
    await refreshData();
    alert("Dienstnummer gespeichert.");
    account();
 };
 $("#changeMyPassword")?.addEventListener("submit",async e=>{
  e.preventDefault();
  const pw=$("#newPassword").value, repeat=$("#repeatPassword").value;
  if(pw.length<8){alert("Das neue Passwort muss mindestens 8 Zeichen lang sein.");return}
  if(pw!==repeat){alert("Die Passwörter stimmen nicht überein.");return}
  if(pw==="123456"){alert("Bitte wähle ein eigenes Passwort und nicht das Standardpasswort 123456.");return}
  const {error}=await sb.auth.updateUser({password:pw});
  if(error){alert("Passwort konnte nicht geändert werden: "+error.message);return}
  const {error:flagError}=await sb.rpc("mark_password_changed");
  if(flagError){alert("Passwort wurde geändert, aber der Status konnte nicht aktualisiert werden: "+flagError.message);return}
  await refreshData();
  alert("Passwort erfolgreich geändert.");
  account();
 });
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
    <label>Standardpasswort<input value="123456" disabled></label>
    <label>FTO<input name="fto" value="${esc(current.name)}" required></label>
    <label>Ausbildungsbeginn<input name="start" value="${new Date().toLocaleDateString("de-DE")}"></label>
    <button class="primary" type="submit">Recruit-Account erstellen</button>
   </form></div>`:`<div class="card"><h3>Recruit-Accounts</h3><p class="muted">Mit deinem aktuellen Zugriff kannst du Ausbildungsstände bearbeiten. Neue Accounts können nur mit Extra-Zugriff angelegt werden.</p></div>`;
 const trainerAdmin=isOwner()?`<div class="card trainer-admin"><div class="section-head compact"><div><div class="eyebrow">AUSBILDER</div><h3>Ausbilder-Accounts</h3></div><span class="access-badge owner">Nur Hauptadmin</span></div>
   <form id="createTrainer" class="form-grid">
    <label>Name<input name="name" required placeholder="Sgt Mustermann"></label>
    <label>Dienstnummer<input name="serviceNo" required placeholder="S-02"></label>
    <label>Rang<select name="rank" required><option>Officer</option><option selected>Sergeant</option><option>Lieutenant</option><option>Captain</option><option>Commander</option></select></label>
    <label>Benutzername<input name="username" required placeholder="sgt.mustermann"></label>
    <label>Standardpasswort<input value="123456" disabled></label>
    <label>Status / Zugriff<select name="access"><option value="standard">Ausbilder</option><option value="extra">Ausbilder + Extra-Zugriff</option></select></label>
    <button class="primary" type="submit">Ausbilder-Account erstellen</button>
   </form>
   <div class="trainer-list">${trainers.map(t=>`<div class="trainer-row"><div><b>🎖️ ${esc(t.name)}</b><small>${esc(t.serviceNo)} · ${esc(t.username)}</small></div><select data-rank="${t.id}" aria-label="Rang"><option ${t.rank==="Officer"?"selected":""}>Officer</option><option ${t.rank==="Sergeant"?"selected":""}>Sergeant</option><option ${t.rank==="Lieutenant"?"selected":""}>Lieutenant</option><option ${t.rank==="Captain"?"selected":""}>Captain</option><option ${t.rank==="Commander"?"selected":""}>Commander</option></select><select data-access="${t.id}" aria-label="Zugriff"><option value="standard" ${t.access!=="extra"?"selected":""}>Ausbilder</option><option value="extra" ${t.access==="extra"?"selected":""}>Ausbilder + Extra-Zugriff</option></select><button class="secondary" data-reset-password="${t.id}" data-reset-name="${esc(t.name)}">🔑 Passwort zurücksetzen</button><button class="danger-btn" data-delete-trainer="${t.id}">Löschen</button></div>`).join("")||"<p class='muted'>Noch keine zusätzlichen Ausbilder-Accounts.</p>"}</div>
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
 $("#createRecruit")?.addEventListener("submit",async e=>{
  e.preventDefault();const f=new FormData(e.target);
  try{
   await invokeAccountAction({action:"create",role:"recruit",username:f.get("username"),
    name:f.get("name"),serviceNo:f.get("serviceNo"),rank:"Recruit",fto:f.get("fto"),start:f.get("start"),access:"standard"});
   await refreshData();selectedRecruit=db.users.find(x=>x.username===String(f.get("username")).trim().toLowerCase())?.id||null;admin();
  }catch(err){alert("Account konnte nicht erstellt werden: "+err.message)}
 });
 $("#createTrainer")?.addEventListener("submit",async e=>{
  e.preventDefault();const f=new FormData(e.target);
  try{
   await invokeAccountAction({action:"create",role:"trainer",username:f.get("username"),
    name:f.get("name"),serviceNo:f.get("serviceNo"),rank:f.get("rank"),fto:"—",access:f.get("access")});
   await refreshData();admin();
  }catch(err){alert("Ausbilder konnte nicht erstellt werden: "+err.message)}
 });
 document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{selectedRecruit=b.dataset.edit;admin()});
 document.querySelectorAll("[data-check]").forEach(b=>b.onchange=async()=>{await toggleChapter(sel.id,+b.dataset.check);await refreshData();admin()});
 document.querySelectorAll("[data-test-assign]").forEach(b=>b.onchange=async()=>{
  if(b.checked){
   const {error}=await sb.from("test_assignments").upsert({recruit_id:sel.id,test_id:b.dataset.testAssign,assigned_by:current.id,active:true},{onConflict:"recruit_id,test_id"});
   if(error) alert(error.message);
  }else{
   const {error}=await sb.from("test_assignments").update({active:false}).eq("recruit_id",sel.id).eq("test_id",b.dataset.testAssign);
   if(error) alert(error.message);
  }
  await refreshData();admin();
});
 document.querySelectorAll("[data-rank]").forEach(x=>x.onchange=async()=>{
  try{await invokeAccountAction({action:"trainer_rank",userId:x.dataset.rank,rank:x.value});await refreshData();admin()}
  catch(err){alert(err.message)}
});
 document.querySelectorAll("[data-access]").forEach(x=>x.onchange=async()=>{
  try{await invokeAccountAction({action:"trainer_access",userId:x.dataset.access,access:x.value});await refreshData();admin()}
  catch(err){alert(err.message)}
});
 document.querySelectorAll("[data-reset-password]").forEach(b=>b.onclick=async()=>{
  if(!isOwner())return;
  if(!confirm(`Passwort von ${b.dataset.resetName||"diesem Account"} wirklich auf 123456 zurücksetzen?`))return;
  try{await invokeAccountAction({action:"reset_password",userId:b.dataset.resetPassword});alert("Passwort wurde auf 123456 zurückgesetzt. Beim nächsten Login muss ein eigenes Passwort vergeben werden.");await refreshData();admin()}catch(err){alert("Passwort konnte nicht zurückgesetzt werden: "+err.message)}
 });
 document.querySelectorAll("[data-delete-trainer]").forEach(b=>b.onclick=async()=>{
 if(confirm("Ausbilder-Account wirklich löschen?"))try{await invokeAccountAction({action:"delete",userId:b.dataset.deleteTrainer});await refreshData();admin()}catch(err){alert(err.message)}
});
 $("#saveRecruit")?.addEventListener("click",async()=>{
 const {error}=await sb.rpc("staff_update_recruit",{target_id:sel.id,new_fto:$("#editFto").value,new_status:$("#editStatus").value,new_rank:$("#editRank").value});
 if(error){alert(error.message);return}await sb.rpc("staff_update_secondary_fto",{target_id:sel.id,new_secondary_fto:$("#editSecondaryFto")?.value||""});await refreshData();admin();
});
 $("#copyAccess")?.addEventListener("click",async()=>{const msg=`🎉 Willkommen beim ALTA PD, ${sel.rank||"Recruit"} ${sel.name}! 🎉\n\n📋 Deine Zugangsdaten:\n🆔 Benutzername: ${sel.username}\n🔑 Passwort: 123456\n🔗 Login: https://ybiene.github.io/alta-pd-recruit-portal/\n\n🎖️ Deine Dienstdaten:\n🪪 Dienstnummer: ${sel.serviceNo||"—"}\n👮 Rang: ${sel.rank||"Recruit"}\n\n⚠️ WICHTIG: Ändere dein Passwort nach dem ersten Login und gib deine Zugangsdaten nicht weiter.\n\nViel Erfolg im Dienst! 👮🚔\nALTA Police Department`;await navigator.clipboard.writeText(msg);alert("Zugangsnachricht kopiert.")});
 $("#addFieldReport")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await sb.from("field_reports").insert({recruit_id:sel.id,author_id:current.id,author_name:current.name,report_date:f.get("date"),duration_minutes:+f.get("duration")||0,topics:f.get("topics"),positive_points:f.get("positive"),improvement_points:f.get("improve"),next_steps:f.get("next")});if(error){alert(error.message);return}await refreshData();admin()});
 $("#addTrainingGoal")?.addEventListener("submit",async e=>{e.preventDefault();const text=$("#trainingGoalText").value.trim();if(!text)return;const {error}=await sb.from("training_goals").insert({recruit_id:sel.id,goal_text:text,author_id:current.id,author_name:current.name});if(error){alert("Ziel konnte nicht gespeichert werden: "+error.message);return}await refreshData();admin()});
 document.querySelectorAll("[data-goal-toggle]").forEach(x=>x.onchange=async()=>{const {error}=await sb.from("training_goals").update({completed:x.checked,completed_at:x.checked?new Date().toISOString():null}).eq("id",x.dataset.goalToggle);if(error){alert(error.message);return}await refreshData();admin()});
 document.querySelectorAll("[data-goal-delete]").forEach(b=>b.onclick=async()=>{if(!isOwner()||!confirm("Ausbildungsziel wirklich löschen?"))return;const {error}=await sb.from("training_goals").delete().eq("id",b.dataset.goalDelete);if(error){alert(error.message);return}await refreshData();admin()});
 $("#addRecruitNote")?.addEventListener("submit",async e=>{
  e.preventDefault();
  const text=$("#recruitNoteText").value.trim();
  if(!text){alert("Bitte einen Vermerk eintragen.");return}
  const {error}=await sb.from("recruit_notes").insert({recruit_id:sel.id,author_id:current.id,author_name:current.name,author_rank:current.rank||roleLabel(current),note_text:text});
  if(error){alert("Vermerk konnte nicht gespeichert werden: "+error.message);return}
  await refreshData();admin();
 });
 document.querySelectorAll("[data-delete-note]").forEach(b=>b.onclick=async()=>{
  if(!isOwner())return;
  if(!confirm("Vermerk wirklich löschen?"))return;
  const {error}=await sb.from("recruit_notes").delete().eq("id",b.dataset.deleteNote);
  if(error){alert(error.message);return}
  await refreshData();admin();
 });
 $("#resetRecruitPassword")?.addEventListener("click",async()=>{
  if(!isOwner())return;
  if(!confirm(`Passwort von ${sel.name} wirklich auf 123456 zurücksetzen?`))return;
  try{await invokeAccountAction({action:"reset_password",userId:sel.id});alert("Passwort wurde auf 123456 zurückgesetzt. Beim nächsten Login muss ein eigenes Passwort vergeben werden.");await refreshData();admin()}catch(err){alert("Passwort konnte nicht zurückgesetzt werden: "+err.message)}
 });
 $("#deleteRecruit")?.addEventListener("click",async()=>{
 if(!canCreateRecruit()){alert("Zum Löschen von Accounts ist Extra-Zugriff erforderlich.");return}
 if(confirm("Recruit-Account wirklich löschen?"))try{await invokeAccountAction({action:"delete",userId:sel.id});selectedRecruit=null;await refreshData();admin()}catch(err){alert(err.message)}
});
}
function adminRecruit(r){
 let p=progress(r);
 return `<div class="card">
  <div class="eyebrow">AUSBILDUNGSAKTE</div><h2>${esc(r.name)}</h2>
  <p class="muted">${esc(r.serviceNo)} · ${esc(r.username)}</p>
  <div class="progress"><i style="width:${p}%"></i></div><p><b>${p}%</b> · ${r.completed.length}/22 Kapitel · ${stage(r)}</p>
  <div class="grid account-grid">
   <label>FTO<input id="editFto" value="${esc(r.fto)}"></label>
   <label>Status<select id="editStatus"><option ${r.status==="In Ausbildung"?"selected":""}>In Ausbildung</option><option ${r.status==="Pausiert"?"selected":""}>Pausiert</option><option ${r.status==="Streifenfreigabe"?"selected":""}>Streifenfreigabe</option><option ${r.status==="Ausbildung abgeschlossen"?"selected":""}>Ausbildung abgeschlossen</option><option ${r.status==="Archiviert"?"selected":""}>Archiviert</option></select></label><label>Weiterer FTO<input id="editSecondaryFto" value="${esc(r.secondaryFto||"")}" placeholder="Optional"></label>
   <label>Rang<input id="editRank" value="${esc(r.rank)}"></label>
  </div>
  <button class="primary" id="saveRecruit">Stammdaten speichern</button> <button class="secondary" id="copyAccess">📋 Zugangsdaten kopieren</button>
  <h3>Kapitel-Freigaben</h3>
  <div class="chapter-checks chapter-category-grid">${titles.map(x=>`<label class="check chapter-category-card" style="--chapter-bg:url(\'${chapterCardImages[x.n]}\')"><input type="checkbox" data-check="${x.n}" ${r.completed.includes(x.n)?"checked":""}><span><b>${x.n}.</b> ${esc(x.title)}</span></label>`).join("")}</div>
  <h3 style="margin-top:22px">Tests zuweisen</h3>
  <p class="muted">Freigegebene Tests erscheinen beim Recruit unter „Tests“.</p>
  <div class="chapter-checks">${TESTS.map(t=>`<label class="check"><input type="checkbox" data-test-assign="${t.id}" ${(r.assignedTests||[]).includes(t.id)?"checked":""}><span><b>${esc(t.title)}</b><small>${esc(t.desc)}</small></span></label>`).join("")}</div>
  <h3 style="margin-top:22px">Test-Mappe</h3>
  <div>${(r.testResults||[]).length?r.testResults.slice().reverse().map(res=>{let t=TESTS.find(x=>x.id===res.testId);return `<div class="test-result-row"><div><b>${esc(t?.title||res.testId)}</b><small>${esc(res.date||"")} · ${res.score}/${res.total} Punkte · ${res.percent}%</small></div><span class="test-state ${res.passed?"passed":"failed"}">${res.passed?"BESTANDEN":"NICHT BESTANDEN"}</span></div>`}).join(""):"<p class='muted'>Noch keine abgeschlossenen Tests.</p>"}</div>
  <div class="record-grid"><div class="card inner-card"><div class="eyebrow">🏅 QUALIFIKATIONEN</div><h3>Freigaben</h3>${qualificationHtml(r)}</div><div class="card inner-card"><div class="eyebrow">🎯 AUSBILDUNGSZIELE</div><h3>Offene Ziele</h3><form id="addTrainingGoal" class="goal-form"><input id="trainingGoalText" maxlength="300" required placeholder="z. B. Funkdisziplin im Einsatz verbessern"><button class="primary" type="submit">Ziel hinzufügen</button></form><div class="goal-list">${(r.goals||[]).length?r.goals.map(g=>`<div class="goal-admin ${g.done?"done":""}"><label><input type="checkbox" data-goal-toggle="${g.id}" ${g.done?"checked":""}><span>${esc(g.text)}</span></label>${isOwner()?`<button data-goal-delete="${g.id}" class="note-delete">Löschen</button>`:""}</div>`).join(""):"<p class='muted'>Noch keine Ziele eingetragen.</p>"}</div></div></div>
  <div class="card inner-card activity-card"><div class="eyebrow">AKTIVITÄTSVERLAUF</div><h3>Ausbildungsakte · Verlauf</h3>${timelineHtml(r,12)}</div>
  <div class="card inner-card"><div class="eyebrow">🚓 FTO-SCHICHTBERICHT</div><h3>Ausbildungsfahrten</h3><form id="addFieldReport" class="form-grid"><label>Datum<input name="date" type="date" value="${new Date().toISOString().slice(0,10)}" required></label><label>Dauer (Min.)<input name="duration" type="number" min="0" value="60"></label><label>Themen<input name="topics" required placeholder="Funk, Verkehrskontrolle …"></label><label>Positive Punkte<input name="positive" placeholder="Was lief gut?"></label><label>Verbesserungsbedarf<input name="improve" placeholder="Was wird weiter geübt?"></label><label>Nächste Schritte<input name="next" placeholder="Nächstes Ausbildungsziel"></label><button class="primary">Bericht speichern</button></form><div>${(r.reports||[]).slice().reverse().map(x=>`<article class="field-report"><b>${esc(x.date)} · ${esc(x.author)}</b><small>${x.duration} Min.</small><p><strong>Themen:</strong> ${esc(x.topics)}</p><p><strong>Positiv:</strong> ${esc(x.positive||"—")}</p><p><strong>Verbesserung:</strong> ${esc(x.improve||"—")}</p><p><strong>Nächste Schritte:</strong> ${esc(x.next||"—")}</p></article>`).join("")||"<p class='muted'>Noch keine Ausbildungsfahrten dokumentiert.</p>"}</div></div>
  <div class="notes-admin-section"><div class="section-head compact"><div><div class="eyebrow">📝 AUSBILDUNGSVERMERKE</div><h3>Vermerke für ${esc(r.name)}</h3></div><span class="note-count">${(r.notes||[]).length}</span></div><form id="addRecruitNote" class="note-form"><textarea id="recruitNoteText" maxlength="1200" required placeholder="z. B. Gute Streifenfahrt, sichere Kommunikation und saubere Maßnahmenbegründung."></textarea><button class="primary" type="submit">➕ Vermerk hinzufügen</button></form><div class="note-list">${(r.notes||[]).length?r.notes.slice().reverse().map(n=>`<article class="note-entry"><div class="note-meta"><b>${esc(n.authorRank||"Ausbilder")} ${esc(n.authorName||"")}</b><span>${esc(n.date)}</span></div><p>${esc(n.text)}</p>${isOwner()?`<button class="note-delete" data-delete-note="${n.id}">Vermerk löschen</button>`:""}</article>`).join(""):`<div class="empty-note">Noch keine Vermerke vorhanden.</div>`}</div></div>
  ${isOwner()?`<button id="resetRecruitPassword" class="secondary" style="margin-top:18px">🔑 Passwort auf 123456 zurücksetzen</button>`:""}
  <button id="deleteRecruit" style="margin-top:18px;background:transparent;color:#ff7c87;border:1px solid #66333b;border-radius:8px;padding:9px 12px;cursor:pointer">Recruit löschen</button>
 </div>`;
}

function testsView(){
 setActive('[data-view="tests"]'); $("#pageTitle").textContent="Tests";
 if(isTrainer(current)){
  $("#content").innerHTML=`<div class="section-head"><div><div class="eyebrow">PRÜFUNGEN</div><h1>Test-Katalog</h1></div><span class="status">${TESTS.length} Tests</span></div><div class="card"><p>Tests werden unter <b>Recruit-Verwaltung → Recruit öffnen → Tests zuweisen</b> freigegeben.</p></div><div class="grid test-grid">${TESTS.map(t=>`<div class="card test-card"><div class="eyebrow">${t.questions.length} FRAGEN · BESTEHEN AB ${t.pass}%</div><h2>${esc(t.title)}</h2><p>${esc(t.desc)}</p></div>`).join("")}</div>`;return;
 }
 current.assignedTests=current.assignedTests||[];current.testResults=current.testResults||[];
 const assigned=TESTS.filter(t=>current.assignedTests.includes(t.id)); const prereq={"test-a":[1,2,3],"test-b":[4,5],"test-c":[6],"test-d":[7,8,9,10],"test-e":[11,12,13,19,22]};
 $("#content").innerHTML=`<div class="section-head"><div><div class="eyebrow">PRÜFUNGEN</div><h1>Meine Tests</h1></div><span class="status">${assigned.length} freigegeben</span></div><div class="test-tabs"><button class="primary" id="openTestsTab">Freigegebene Tests</button><button class="secondary" id="folderTab">📁 Mappe</button></div><div class="grid test-grid">${assigned.length?assigned.map(t=>`<div class="card test-card"><div class="eyebrow">${t.questions.length} FRAGEN · BESTEHEN AB ${t.pass}%</div><h2>${esc(t.title)}</h2><p>${esc(t.desc)}</p>${(prereq[t.id]||[]).every(n=>current.completed.includes(n))?`<button class="primary" data-start-test="${t.id}">${current.testResults.some(r=>r.testId===t.id)?"Erneut üben":"Test starten"}</button>`:`<button class="secondary" disabled>🔒 Kapitel zuerst abschließen</button>`}</div>`).join(""):"<div class='card'><h2>Keine Tests freigegeben</h2><p class='muted'>Dein Ausbilder hat dir aktuell noch keinen Test zugewiesen.</p></div>"}</div>`;
 document.querySelectorAll("[data-start-test]").forEach(b=>b.onclick=()=>startTest(b.dataset.startTest));$("#folderTab").onclick=showTestFolder;
}
function startTest(id){
 const t=TESTS.find(x=>x.id===id);if(!t||isTrainer(current)||!(current.assignedTests||[]).includes(id))return testsView();
 $("#pageTitle").textContent=t.title;$("#content").innerHTML=`<div class="section-head"><div><div class="eyebrow">ÜBUNGSTEST</div><h1>${esc(t.title)}</h1><p>${esc(t.desc)}</p></div><span class="status" id="testTimer">15:00</span></div><form id="testForm">${t.questions.map((q,i)=>`<div class="card question-card"><div class="question-no">FRAGE ${i+1} / ${t.questions.length}</div><h3>${esc(q.q)}</h3><div class="answers">${q.a.map((a,j)=>`<label class="answer"><input type="radio" name="q${i}" value="${j}" required><span>${esc(a)}</span></label>`).join("")}</div></div>`).join("")}<button class="primary finish-test" type="submit">Test auswerten</button></form>`;
 let left=900;const timer=setInterval(()=>{left--;const el=$("#testTimer");if(el)el.textContent=`${String(Math.floor(left/60)).padStart(2,"0")}:${String(left%60).padStart(2,"0")}`;if(left<=0){clearInterval(timer);alert("Die Testzeit ist abgelaufen.");$("#testForm")?.requestSubmit()}},1000); $("#testForm").onsubmit=async e=>{clearInterval(timer);e.preventDefault();let f=new FormData(e.target),score=0;t.questions.forEach((q,i)=>{if(+f.get("q"+i)===q.c)score++});let percent=Math.round(score/t.questions.length*100),passed=percent>=t.pass;await sb.from("test_results").insert({recruit_id:current.id,test_id:t.id,score,total:t.questions.length,percent,passed});await refreshData();showTestResult(t,score,percent,passed)};
}
function showTestResult(t,score,percent,passed){
 $("#content").innerHTML=`<div class="result-hero card ${passed?"passed":"failed"}"><div class="eyebrow">TEST ABGESCHLOSSEN</div><h1>${passed?"Bestanden":"Nicht bestanden"}</h1><div class="score-big">${score} / ${t.questions.length}</div><h2>${percent}%</h2><p>${passed?"Bestanden und in deiner Mappe gespeichert.":"Versuch gespeichert. Du kannst den Test erneut üben."}</p><button class="primary" id="toFolder">📁 Zur Mappe</button> <button class="secondary" id="backTests">Zu den Tests</button></div>`;$("#toFolder").onclick=showTestFolder;$("#backTests").onclick=testsView;
}
function showTestFolder(){
 $("#pageTitle").textContent="Tests · Mappe";const results=(current.testResults||[]).slice().reverse();$("#content").innerHTML=`<div class="section-head"><div><div class="eyebrow">TESTS</div><h1>📁 Meine Mappe</h1><p>Abgeschlossene Testversuche.</p></div></div><div class="card">${results.length?results.map(r=>{let t=TESTS.find(x=>x.id===r.testId);return `<div class="folder-row"><div><b>${esc(t?.title||r.testId)}</b><small>${esc(r.date)} · ${r.score}/${r.total} Punkte · ${r.percent}%</small></div><span class="test-state ${r.passed?"passed":"failed"}">${r.passed?"BESTANDEN":"NICHT BESTANDEN"}</span></div>`}).join(""):"<p class='muted'>Deine Mappe ist noch leer.</p>"}</div><button class="secondary" id="backTests">← Zurück zu Tests</button>`;$("#backTests").onclick=testsView;
}
async function toggleChapter(uid,n){
 const u=db.users.find(x=>x.id===uid);if(!u)return;
 const done=(u.completed||[]).includes(n);
 if(done){
  const {error}=await sb.from("training_progress").delete().eq("recruit_id",uid).eq("chapter",n);
  if(error) throw error;
 }else{
  const {error}=await sb.from("training_progress").upsert({recruit_id:uid,chapter:n,completed:true,completed_by:current.id,completed_at:new Date().toISOString()},{onConflict:"recruit_id,chapter"});
  if(error) throw error;
 }
 await refreshData();
}

function greeting(){const h=new Date().getHours();return h<11?"Guten Morgen":h<18?"Guten Tag":"Guten Abend"}
async function newsView(){
 setActive('[data-view="news"]');$("#pageTitle").textContent="Mitteilungen";
 const {data:news,error}=await sb.from("announcements").select("*").order("pinned",{ascending:false}).order("created_at",{ascending:false});
 const {data:reads}=await sb.from("announcement_reads").select("announcement_id").eq("user_id",current.id); const read=new Set((reads||[]).map(x=>x.announcement_id));
 $("#content").innerHTML=`<div class="section-head"><div><div class="eyebrow">DEPARTMENT NEWS</div><h1>📢 Mitteilungen</h1></div>${isOwner()?'<button class="primary" id="newAnnouncement">+ Mitteilung</button>':''}</div><div id="newsList">${(news||[]).map(n=>`<article class="card news-card ${n.pinned?'pinned':''}"><div class="eyebrow">${n.pinned?'📌 ANGEHEFTET':'MITTEILUNG'} · ${new Date(n.created_at).toLocaleDateString('de-DE')}</div><h2>${esc(n.title)}</h2><p>${esc(n.body)}</p><small>${esc(n.author_name||'ALTA PD')}</small>${!read.has(n.id)?`<button class="secondary" data-read-news="${n.id}">✓ Als gelesen bestätigen</button>`:'<span class="read-badge">✓ Gelesen</span>'}</article>`).join('')||'<div class="card"><p class="muted">Keine Mitteilungen.</p></div>'}</div>`;
 document.querySelectorAll('[data-read-news]').forEach(b=>b.onclick=async()=>{await sb.from('announcement_reads').upsert({announcement_id:+b.dataset.readNews,user_id:current.id},{onConflict:'announcement_id,user_id'});newsView()});
 $("#newAnnouncement")?.addEventListener('click',async()=>{const title=prompt('Titel der Mitteilung:');if(!title)return;const body=prompt('Text der Mitteilung:');if(!body)return;const pinned=confirm('Mitteilung oben anheften?');const {error}=await sb.from('announcements').insert({title,body,pinned,author_id:current.id,author_name:current.name});if(error)alert(error.message);else newsView()});
}
function documentsView(){setActive('[data-view="documents"]');$("#pageTitle").textContent="Dokumente";$("#content").innerHTML=`<div class="section-head"><div><div class="eyebrow">INTERNER BEREICH</div><h1>📂 Dokumente & Schnellzugriff</h1></div></div><div class="grid chapter-grid"><div class="card"><h2>⭐ Favoriten</h2>${(current.favorites||[]).length?(current.favorites||[]).map(n=>`<button class="doc-link" data-doc-chapter="${n}">Kapitel ${n} · ${esc(CHAPTERS[n]?.title||'')}</button>`).join(''):'<p class="muted">Noch keine Favoriten. In einem Kapitel kannst du ☆ Als Favorit wählen.</p>'}</div><div class="card"><h2>🕘 Zuletzt angesehen</h2>${localStorage.getItem('alta_last_chapter')?`<button class="doc-link" data-doc-chapter="${localStorage.getItem('alta_last_chapter')}">Kapitel ${localStorage.getItem('alta_last_chapter')} · ${esc(CHAPTERS[localStorage.getItem('alta_last_chapter')]?.title||'')}</button>`:'<p class="muted">Noch kein Kapitel angesehen.</p>'}</div><div class="card"><h2>📚 Rekrutenhandbuch</h2><p>Alle 22 Kapitel sind über die Navigation erreichbar. Favorisiere häufig benötigte Inhalte für den Schnellzugriff.</p></div><div class="card"><h2>🖨️ Ausbildungsakte</h2><p>Unter „Mein Account“ kannst du deine aktuelle Ausbildungsübersicht drucken oder als PDF speichern.</p></div></div>`;document.querySelectorAll('[data-doc-chapter]').forEach(b=>b.onclick=()=>showChapter(+b.dataset.docChapter))}

function setupMobileMenu(){
 const btn=$("#mobileMenuBtn"), sidebar=document.querySelector(".sidebar"), overlay=$("#mobileOverlay");
 if(!btn||!sidebar||!overlay)return;
 const close=()=>{sidebar.classList.remove("mobile-open");overlay.classList.add("hidden");document.body.classList.remove("menu-open")};
 btn.onclick=()=>{const open=sidebar.classList.toggle("mobile-open");overlay.classList.toggle("hidden",!open);document.body.classList.toggle("menu-open",open)};
 overlay.onclick=close;
 sidebar.addEventListener("click",e=>{if(window.innerWidth<=760&&e.target.closest(".nav-btn"))close()});
 window.addEventListener("resize",()=>{if(window.innerWidth>760)close()});
}
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
$("#loginForm").onsubmit=async e=>{
 e.preventDefault();
 $("#loginError").textContent="";
 const username=$("#loginUser").value.trim().toLowerCase(), password=$("#loginPass").value;
 const {error}=await sb.auth.signInWithPassword({email:authEmail(username),password});
 if(error){$("#loginError").textContent="Benutzername oder Passwort ist nicht korrekt.";return}
 try{await refreshData()}catch(err){await sb.auth.signOut();$("#loginError").textContent="Portal-Profil konnte nicht geladen werden.";return}
 $("#loginView").classList.add("hidden");$("#app").classList.remove("hidden");
 $("#topName").textContent=current.name;$("#topRole").textContent=roleLabel(current);
 nav();setupSearch();setupMobileMenu();current.mustChangePassword?account():dashboard();
 if(!current.mustChangePassword&&!sessionStorage.getItem("apd_seen_splash")){$("#splash").classList.remove("hidden")}
};
$("#enterPortal").onclick=()=>{$("#splash").classList.add("hidden");sessionStorage.setItem("apd_seen_splash","1")};
$("#logoutBtn").onclick=async()=>{await sb.auth.signOut();current=null;location.reload()};

(async function restoreLogin(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session)return;
 try{
  await refreshData();
  $("#loginView").classList.add("hidden");$("#app").classList.remove("hidden");
  $("#topName").textContent=current.name;$("#topRole").textContent=roleLabel(current);
  nav();setupSearch();setupMobileMenu();current.mustChangePassword?account():dashboard();
 }catch(err){console.error(err);await sb.auth.signOut()}
})();

/* ===== V4.4 COMMAND CENTER ENHANCEMENTS ===== */
let portalSettings={department_name:"ALTA POLICE DEPARTMENT",motto:"Serve · Protect · Train",handbook_version:"2.1",portal_version:"V4.4",maintenance_mode:false,urgent_banner:""};
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
function commandStrip(){if(!isTrainer(current))return "";const rs=db.users.filter(x=>x.role==="recruit"&&!x.archivedAt);const open=rs.reduce((a,r)=>a+(r.goals||[]).filter(g=>!g.done).length,0);const att=rs.filter(r=>attentionCount(r)>0).length;const reports=rs.reduce((a,r)=>a+(r.reports||[]).length,0);return `<div class="command-strip"><div class="command-chip"><small>AKTIVE REKRUTEN</small><b>${rs.length}</b></div><div class="command-chip"><small>AUFMERKSAMKEIT</small><b>${att}</b></div><div class="command-chip"><small>OFFENE ZIELE</small><b>${open}</b></div><div class="command-chip"><small>FTO-BERICHTE</small><b>${reports}</b></div><div class="command-chip"><small>ABSCHLUSSBEREIT</small><b>${rs.filter(r=>progress(r)===100).length}</b></div></div>`}
function updateClock(){const d=new Date(),h=d.getHours(),shift=h<6?"Nachtschicht":h<12?"Frühschicht":h<18?"Tagschicht":"Abendschicht",icon=h<6?"🌙":h<12?"🌅":h<18?"☀️":"🌆",date=d.toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit",year:"numeric"}),time=d.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});document.querySelectorAll(".live-clock").forEach(e=>e.textContent=`${date} · ${time}`);document.querySelectorAll(".shift-pill").forEach(e=>e.textContent=`${icon} ${shift} · ${date} · ${time}`)}
setInterval(updateClock,1000);window.addEventListener("online",()=>{document.body.classList.remove("offline");toast("✓ Verbindung wiederhergestellt")});window.addEventListener("offline",()=>document.body.classList.add("offline"));
function ensureChrome(){if(!document.querySelector(".connection-banner")){document.body.insertAdjacentHTML("beforeend",`<div class="connection-banner">🛜 Verbindung zu ALTA PD wird wiederhergestellt…</div><nav class="bottom-nav"><button data-mobile="dashboard"><span>🏠</span>Dashboard</button><button data-mobile="chapter"><span>🎓</span>Ausbildung</button><button data-mobile="tests"><span>📝</span>Tests</button><button data-mobile="account"><span>👤</span>Konto</button></nav>`);document.querySelectorAll("[data-mobile]").forEach(b=>b.onclick=()=>b.dataset.mobile==="chapter"?showChapter(1):showView(b.dataset.mobile))}updateClock()}
const _navV43=nav;nav=function(){_navV43();ensureChrome();if(isOwner()){const host=$("#nav");host.insertAdjacentHTML("beforeend",`<div class="nav-label">COMMAND</div><button class="nav-btn" data-view="calendar">📅 Ausbildungskalender</button><button class="nav-btn" data-view="command">🧑‍✈️ Command Center</button>`);host.querySelectorAll('[data-view="calendar"],[data-view="command"]').forEach(b=>b.onclick=()=>showView(b.dataset.view))}}
const _showViewV43=showView;showView=function(v){if(v==="calendar")return calendarView();if(v==="command")return commandView();return _showViewV43(v)};
function calendarView(){setActive('[data-view="calendar"]');$("#pageTitle").textContent="Ausbildungskalender";$("#content").innerHTML=`<div class="section-head"><div><div class="eyebrow">📅 PLANUNG</div><h1>Ausbildungskalender</h1></div><span class="shift-pill"></span></div><div class="card"><h2>Kommende Termine</h2>${trainingEvents.length?trainingEvents.map(e=>`<div class="test-result-row"><div><b>${esc(e.title)}</b><small>${new Date(e.starts_at).toLocaleString("de-DE")} · ${esc(e.location||"—")}</small></div><span class="state-badge">${esc(e.event_type)}</span></div>`).join(""):`<p class="muted">Noch keine Termine eingetragen.</p>`}</div>`;updateClock()}
function commandView(){if(!isOwner())return dashboard();setActive('[data-view="command"]');$("#pageTitle").textContent="Command Center";const rs=db.users.filter(x=>x.role==="recruit");const load={};rs.forEach(r=>{load[r.fto||"Nicht zugewiesen"]=(load[r.fto||"Nicht zugewiesen"]||0)+1});$("#content").innerHTML=`<div class="section-head"><div><div class="eyebrow">🧑‍✈️ FÜHRUNG</div><h1>Command Center</h1></div><span class="status">Nur Hauptadmin</span></div>${commandStrip()}<div class="grid dashboard-two"><div class="card"><h2>FTO-Auslastung</h2>${Object.entries(load).map(([n,c])=>`<div class="test-result-row"><b>${esc(n)}</b><span class="state-badge">${c} Recruit${c===1?"":"s"}</span></div>`).join("")}</div><div class="card"><h2>Berechtigungsmatrix</h2><div class="table-wrap"><table><thead><tr><th>Rolle</th><th>Ausbildung</th><th>Verwalten</th><th>Accounts</th></tr></thead><tbody><tr><td>Recruit</td><td>Eigene</td><td>—</td><td>—</td></tr><tr><td>FTO</td><td>Alle</td><td>✓</td><td>—</td></tr><tr><td>Extra-FTO</td><td>Alle</td><td>✓</td><td>Recruits</td></tr><tr><td>Hauptadmin</td><td>Alle</td><td>✓</td><td>Alle</td></tr></tbody></table></div></div></div><div class="card"><h2>Portal-Einstellungen</h2><div class="account-info-grid"><div class="info-tile"><small>Department</small><b>${esc(portalSettings.department_name)}</b></div><div class="info-tile"><small>Handbuch</small><b>${esc(portalSettings.handbook_version)}</b></div><div class="info-tile"><small>Portal-Version</small><b>${esc(portalSettings.portal_version)}</b></div><div class="info-tile"><small>Wartungsmodus</small><b>${portalSettings.maintenance_mode?"AKTIV":"Aus"}</b></div></div></div>`}
const _dashboardV43=dashboard;dashboard=function(){_dashboardV43();ensureChrome();const c=$("#content");if(!c)return;const urgent=portalSettings.urgent_banner?`<div class="urgent-banner">🚨 ${esc(portalSettings.urgent_banner)}</div>`:"";c.insertAdjacentHTML("afterbegin",urgent+commandStrip());const h=c.querySelector(".hero");if(h)h.insertAdjacentHTML("beforeend",`<div class="hero-command-meta"><span class="shift-pill"></span></div>`);updateClock();if(current.role==="recruit"){const stats=c.querySelector(".stats");if(stats)stats.insertAdjacentHTML("afterend",`<div class="grid dashboard-two"><div class="card"><div class="eyebrow">🧑‍🏫 MEIN FTO</div><h2>${esc(current.fto||"Noch nicht zugewiesen")}</h2><p>${esc(current.secondaryFto?"Weiterer FTO: "+current.secondaryFto:"Dein zuständiger Ausbilder")}</p></div><div class="card"><div class="eyebrow">📅 AUSBILDUNGSDAUER</div><h2>${serviceDuration(current)}</h2><p class="muted">Beginn: ${current.start?new Date(current.start+"T00:00:00").toLocaleDateString("de-DE"):"—"}</p></div></div>`)} }
const _accountV43=account;account=function(){setActive('[data-view="account"]');$("#pageTitle").textContent="Mein Konto";const u=current,p=progress(u),avatar=u.avatarUrl||"apd-logo.png";$("#content").innerHTML=`<div class="section-head"><div><div class="eyebrow">MEINE DIENSTAKTE</div><h1>Mein Konto</h1></div><div>${rankBadge(u)} <span class="state-badge ${u.accountEnabled===false?"state-off":""}"><i class="state-dot"></i>${esc(statusName(u))}</span></div></div><div class="account-command"><section class="service-card"><div class="service-head"><img class="service-avatar" src="${esc(avatar)}" onerror="this.src='apd-logo.png'"><div class="service-name"><small>ALTA POLICE DEPARTMENT</small><h2>${esc(u.name)}</h2>${rankBadge(u)}</div></div><div class="service-meta"><div><small>Badge / Dienstnummer</small><b>${esc(u.serviceNo||"—")}</b></div><div><small>Funktion</small><b>${esc(roleLabel(u))}</b></div><div><small>Status</small><b>● ${esc(statusName(u))}</b></div><div><small>Eintritt / Ausbildung</small><b>${u.start?new Date(u.start+"T00:00:00").toLocaleDateString("de-DE"):"—"}</b></div></div></section><div class="account-panels"><section class="card"><div class="eyebrow">👤 ACCOUNTINFORMATIONEN</div><h2>Profil</h2><div class="account-info-grid"><div class="info-tile"><small>Benutzername</small><b>${esc(u.username)}</b></div><div class="info-tile"><small>Berechtigung</small><b>${esc(roleLabel(u))}</b></div><div class="info-tile"><small>Letzter Login</small><b>${u.lastLogin?new Date(u.lastLogin).toLocaleString("de-DE"):"—"}</b></div><div class="info-tile"><small>Ausbildungsdauer</small><b>${serviceDuration(u)}</b></div></div><label style="display:block;margin-top:12px">Dienstnummer<input id="myServiceNo" value="${esc(u.serviceNo||"")}"></label><button class="primary" id="saveMyAccount">💾 Speichern</button></section><section class="card"><div class="eyebrow">🔐 SICHERHEIT</div><h2>Passwort</h2>${u.mustChangePassword?`<div class="notice password-warning"><b>Erstanmeldung:</b> Lege jetzt dein persönliches Passwort fest.</div>`:""}<form id="changeMyPassword" class="password-form"><label>Neues Passwort<input id="newPassword" type="password" minlength="8" required></label><label>Wiederholen<input id="repeatPassword" type="password" minlength="8" required></label><button class="primary">🔑 Passwort ändern</button></form><p class="muted">Zuletzt geändert: ${u.passwordChangedAt?new Date(u.passwordChangedAt).toLocaleString("de-DE"):"—"}</p></section>${u.role==="recruit"?`<section class="card wide"><div class="eyebrow">📊 AUSBILDUNG</div><h2>${p}% · ${stage(u)}</h2><div class="progress"><i style="width:${p}%"></i></div><div class="account-info-grid" style="margin-top:12px"><div class="info-tile"><small>Haupt-FTO</small><b>${esc(u.fto||"—")}</b></div><div class="info-tile"><small>Weiterer FTO</small><b>${esc(u.secondaryFto||"—")}</b></div><div class="info-tile"><small>Kapitel</small><b>${u.completed.length}/22</b></div><div class="info-tile"><small>Offene Ziele</small><b>${(u.goals||[]).filter(g=>!g.done).length}</b></div></div></section>`:""}</div></div>${u.role==="recruit"?`<div class="grid dashboard-two"><div class="card"><div class="eyebrow">🏅 DIENST & QUALIFIKATIONEN</div><h2>Freigaben</h2>${qualificationHtml(u)}</div><div class="card"><div class="eyebrow">⭐ FAVORITEN & ZULETZT</div><h2>Schnellzugriff</h2>${(u.favorites||[]).length?u.favorites.map(n=>`<button class="secondary" data-open-fav="${n}">★ Kapitel ${n}</button>`).join(" "):"<p class='muted'>Noch keine Favoriten.</p>"}</div></div><div class="card activity-card"><div class="eyebrow">🕒 MEINE AKTIVITÄT · DIENSTBUCH</div><h2>Ausbildungsverlauf</h2>${timelineHtml(u,20)}</div><div class="card"><button class="secondary" onclick="window.print()">📄 Meine Ausbildungsakte drucken / PDF</button></div>`:""}`;
 $("#saveMyAccount").onclick=async()=>{const value=$("#myServiceNo").value.trim();if(!value)return toast("⚠ Dienstnummer fehlt");const {error}=await sb.rpc("update_my_service_no",{new_service_no:value});if(error)return toast("⚠ "+error.message);await refreshData();toast("✓ Gespeichert");account()};
 $("#changeMyPassword").onsubmit=async e=>{e.preventDefault();const pw=$("#newPassword").value,rep=$("#repeatPassword").value;if(pw.length<8)return toast("⚠ Mindestens 8 Zeichen");if(pw!==rep)return toast("⚠ Passwörter stimmen nicht überein");if(pw==="123456")return toast("⚠ Bitte eigenes Passwort wählen");const {error}=await sb.auth.updateUser({password:pw});if(error)return toast("⚠ "+error.message);await sb.rpc("mark_password_changed");await refreshData();toast("✓ Passwort geändert");account()};document.querySelectorAll("[data-open-fav]").forEach(b=>b.onclick=()=>showChapter(+b.dataset.openFav));ensureChrome()}
const _showChapterV43=showChapter;showChapter=async function(n){_showChapterV43(n);try{await sb.from("chapter_state").upsert({user_id:current.id,chapter:n,last_opened_at:new Date().toISOString()},{onConflict:"user_id,chapter"})}catch{}const side=document.querySelector(".chapter-side")||document.querySelector(".chapter-layout aside");if(side){const st=chapterStates.find(x=>x.chapter===n);side.insertAdjacentHTML("beforeend",`<div class="chapter-state-box"><div><small>Gelesen</small><b>${st?.read_at?"✓ Ja":"Offen"}</b></div><div><small>Notizen</small><b>Auto-Save</b></div><div><small>Status</small><b>${current.completed.includes(n)?"Praxis ✓":"Offen"}</b></div></div><div class="chapter-actions"><button class="secondary" id="markRead">👁️ Als gelesen</button>${current.role==="recruit"?`<button class="secondary" id="askFto">❓ FTO fragen</button>`:""}</div>`);$("#markRead").onclick=async()=>{await sb.from("chapter_state").upsert({user_id:current.id,chapter:n,read_at:new Date().toISOString(),last_opened_at:new Date().toISOString()},{onConflict:"user_id,chapter"});toast("✓ Kapitel als gelesen markiert")};$("#askFto")?.addEventListener("click",async()=>{const q=prompt("Welche Frage möchtest du deinem FTO zu diesem Kapitel stellen?");if(!q?.trim())return;const {error}=await sb.from("fto_questions").insert({recruit_id:current.id,chapter:n,question:q.trim()});if(error)return toast("⚠ "+error.message);toast("✓ Frage an FTO gesendet")})}}
const _adminV43=admin;admin=function(){_adminV43();if(!isTrainer(current))return;const c=$("#content");const firstCard=c?.querySelector(".admin-grid > div > .card");if(firstCard)firstCard.insertAdjacentHTML("beforebegin",`<div class="admin-toolbar"><input id="adminSearch" placeholder="🔍 Name, Benutzername oder Dienstnummer"><select id="adminFilter"><option>Alle</option><option>In Ausbildung</option><option>Abgeschlossen</option><option>Archiviert</option></select><select id="adminSort"><option>Name</option><option>Fortschritt</option><option>Dienstnummer</option></select></div>`);document.querySelectorAll(".trainer-row").forEach(r=>r.classList.add("roomy"));document.querySelectorAll(".recruit-row").forEach(r=>{const txt=r.textContent.toLowerCase();r.dataset.search=txt});$("#adminSearch")?.addEventListener("input",e=>{const q=e.target.value.toLowerCase();document.querySelectorAll(".recruit-row").forEach(r=>r.style.display=r.dataset.search.includes(q)?"":"none")});const rs=db.users.filter(x=>x.role==="recruit");if(rs.some(r=>attentionCount(r)>0)){const grid=c.querySelector(".admin-grid");grid?.insertAdjacentHTML("beforebegin",`<div class="card attention-card"><div class="eyebrow">🚦 AUFMERKSAMKEIT ERFORDERLICH</div><h2>${rs.filter(r=>attentionCount(r)>0).length} Recruit(s) mit offenen Punkten</h2><p class="muted">Offene Ausbildungsziele oder nicht bestandene Tests werden hier berücksichtigt.</p></div>`)}}
const _restoreNotesV43=restoreChapterNotes;restoreChapterNotes=async function(n){await _restoreNotesV43(n);document.querySelectorAll(".learn-line").forEach(el=>el.addEventListener("change",()=>toast("✓ Gespeichert")))};
ensureChrome();
