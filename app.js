function apdActiveRecruit(r){return r?.role==="recruit"&&(!r.rank||["Rekrut","Recruit"].includes(r.rank))&&!r.archivedAt&&!r.archived_at&&r.status!=="Archiviert"}

const $ = s => document.querySelector(s);
const esc = s => String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const SUPABASE_URL="https://nbjfslwznuuwbqmvtldl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_EmJes2VlNCNztFeNiL6KLQ_U_1G_Mvy";
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
 auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
});
let db={users:[],messages:[]}, current=null, selectedRecruit=null, recruitRecordClosed=false;

function authEmail(username){
 return `${String(username||"").trim().toLowerCase()}@altapd.internal`;
}
function mapProfile(p){
 return {
  id:p.id, initialPasswordIsDefault:!!p.initial_password_is_default, username:p.username, name:p.name, serviceNo:p.service_no||"", archivedAt:p.archived_at||null, accountEnabled:p.account_enabled!==false,
  role:p.role, access:p.access_level||"standard", rank:p.rank||"",
  fto:p.fto||"", start:p.training_start||"", status:p.status==="Ausbilder · Extra-Zugriff"?"Ausbilder +":p.status||"In Ausbildung",
  mustChangePassword:!!p.must_change_password, secondaryFto:p.secondary_fto||"", leaderFtoId:p.leader_fto_id||null, secondaryFtoId:p.secondary_fto_id||null, lastLogin:p.last_login||null, unlockedPhase:+p.unlocked_phase||1,
  completed:[], unlockedChapters:[], ratings:[], assignedTests:[], testResults:[], notes:[], goals:[], activity:[], reports:[], favorites:[]
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

 // Freigaben und Bewertungen werden aus Supabase geladen; bei Fehler bleiben Kapitel für Rekruten gesperrt.
 try {
  const {data:unlocks,error:unlockError}=await sb.from("chapter_unlocks").select("recruit_id,chapter,unlocked_at,unlocked_by");
  if(unlockError) throw unlockError;
  for(const u of db.users)u.unlockedChapters=(unlocks||[]).filter(x=>x.recruit_id===u.id).map(x=>x.chapter);
 } catch(e){console.warn("Kapitel-Freigaben nicht verfügbar:",e.message);for(const u of db.users)u.unlockedChapters=[];}
 try {
  const {data:ratings,error:ratingError}=await sb.from("fto_ratings").select("*").order("created_at",{ascending:false});
  if(ratingError)throw ratingError;
  for(const u of db.users)u.ratings=(ratings||[]).filter(x=>x.recruit_id===u.id);
 }catch(e){console.warn("FTO-Bewertungen:",e.message);}
 const ids=db.users.map(x=>x.id);
 if(ids.length){
  const [{data:prog,error:pe},{data:assign,error:ae},{data:results,error:re},{data:notes,error:ne},{data:goals,error:ge},{data:reports,error:rpe},{data:favs,error:fe}]=await Promise.all([
   ((current.role==="admin" || current.role==="trainer")
    ? sb.rpc("portal_visible_training_progress")
    : sb.from("training_progress").select("*").eq("recruit_id",current.id)),
   sb.from("test_assignments").select("*").eq("active",true).in("recruit_id",ids),
   sb.from("test_results").select("*").in("recruit_id",ids).order("completed_at",{ascending:true}),
   sb.from("recruit_notes").select("*").in("recruit_id",ids).order("created_at",{ascending:true}),
   sb.from("training_goals").select("*").in("recruit_id",ids).order("created_at",{ascending:true}),
   sb.from("field_reports").select("*").in("recruit_id",ids).order("created_at",{ascending:true}),
   sb.from("chapter_favorites").select("*").in("user_id",ids)
  ]);
  if(pe) throw pe;if(ae) throw ae;if(re) throw re;if(ne) console.warn("Recruit-Vermerke:",ne.message);if(ge) console.warn("Ausbildungsziele:",ge.message);if(rpe) console.warn("FTO-Berichte:",rpe.message);if(fe) console.warn("Favoriten:",fe.message);
  for(const u of db.users){
   u.chapterProgress=(prog||[]).filter(x=>x.recruit_id===u.id);
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
   u.goals=(goals||[]).filter(x=>x.recruit_id===u.id).map(x=>({id:x.id,text:x.goal_text,done:!!x.completed,createdAt:x.created_at,completedAt:x.completed_at||null,authorName:x.author_name||"Ausbilder",authorRank:x.author_rank||""}));
   u.reports=(reports||[]).filter(x=>x.recruit_id===u.id).map(x=>({id:x.id,date:x.report_date,duration:x.duration_minutes||0,topics:x.topics||"",positive:x.positive_points||"",improve:x.improvement_points||"",next:x.next_steps||"",author:x.author_name||"Ausbilder",authorRank:x.author_rank||"",createdAt:x.created_at}));
   u.favorites=(favs||[]).filter(x=>x.user_id===u.id).map(x=>x.chapter);
   const acts=[];
   (prog||[]).filter(x=>x.recruit_id===u.id&&x.completed).forEach(x=>acts.push({when:x.completed_at||null,icon:"✓",text:`Kapitel ${chapterNumber(x.chapter)} abgeschlossen`}));
   u.testResults.forEach(x=>{const raw=(results||[]).find(r=>r.recruit_id===u.id&&r.test_id===x.testId&&new Date(r.completed_at).toLocaleString("de-DE")===x.date);acts.push({when:raw?.completed_at||null,icon:x.passed?"🏅":"📝",text:`${TESTS.find(t=>t.id===x.testId)?.title||x.testId}: ${x.percent}% ${x.passed?"· bestanden":"· nicht bestanden"}`})});
   u.notes.forEach(x=>acts.push({when:x.createdAt,icon:"📝",text:`Vermerk von ${x.authorRank||"Ausbilder"} ${x.authorName||""}`}));
   u.goals.forEach(x=>acts.push({when:x.completedAt||x.createdAt,icon:x.done?"🎯":"📌",text:`Ausbildungsziel ${x.done?"erledigt":"gesetzt"}: ${x.text}`}));
   u.reports.forEach(x=>acts.push({when:x.createdAt,icon:"🚓",text:`FTO-Bericht: ${x.topics||"Ausbildungsfahrt"}`}));
   u.activity=acts.filter(x=>x.when).sort((a,b)=>new Date(b.when)-new Date(a.when));
  }
 }
 current=db.users.find(x=>x.id===user.id)||current;
 try{
  const {data:mail,error:mailErr}=await sb.from("academy_messages").select("*").or(`sender_id.eq.${current.id},recipient_id.eq.${current.id}`).order("created_at",{ascending:false}).limit(250);
  if(!mailErr) db.messages=mail||[]; else {db.messages=[];console.warn("Postfach:",mailErr.message)}
 }catch(_){db.messages=[]}
 return true;
}
function isOwner(u=current){return !!u && u.role==="admin"&&u.access==="owner"}
function isTrainer(u=current){return !!u && (u.role==="admin"||u.role==="trainer")}
function canCreateRecruit(u=current){return isTrainer(u)}
function hasExtraTrainerAccess(u=current){return isOwner(u)||(u?.role==="trainer"&&u.access==="extra")}
function isFtoLead(u=current){return !!u && isOwner(u) && (u.username==="sgt.carter" || u.name==="Sgt Carter")}
function ftoLeadershipLabel(u=current){return isFtoLead(u)?"Leitung der FTO":""}
function roleLabel(u){
 if(!u)return "";
 if(isOwner(u))return isFtoLead(u)?"Hauptadmin / Leitung der FTO":"Hauptadmin / FTO";
 if(u.role==="trainer")return u.access==="extra"?"Ausbilder · Extra-Zugriff":"Ausbilder";
 return "Recruit";
}
async function invokeAccountAction(body){
 const {data,error}=await sb.functions.invoke("manage-user",{body});
 if(error) throw error;
 if(data?.error) throw new Error(data.error);
 return data;
}
// Content IDs remain stable so saved progress and FTO permissions keep their meaning.
const CHAPTER_ORDER = [1, 2, 3, 16, 20, 11, 22, 18, 13, 14, 4, 5, 17, 10, 6, 21, 7, 8, 12, 19, 9, 15];
function chapterNumber(id){return CHAPTER_ORDER.indexOf(+id)+1}
function nextChapterId(id){return CHAPTER_ORDER[chapterNumber(id)]}
const CHAPTER_CATEGORIES = [
 {n:1,name:'Dienstgrundlagen und Rechte',from:1,to:6},
 {n:2,name:'Sicherheit, Waffen und Training',from:7,to:10},
 {n:3,name:'Funk, Leitstelle und Bürgerkontakt',from:11,to:14},
 {n:4,name:'Orientierung und Dienstsysteme',from:15,to:18},
 {n:5,name:'Dokumentation, Streifendienst und Abschluss',from:19,to:22}
];
function chapterCategory(id){return CHAPTER_CATEGORIES.find(p=>chapterNumber(id)>=p.from&&chapterNumber(id)<=p.to)}
const titles=CHAPTER_ORDER.map(n=>({n,title:CHAPTERS[n].title}));

const TESTS=[
{id:"test-a",title:"Test A · Dienst & Auftrag",desc:"Auftrag, Verhalten, Dienstantritt und Ausrüstung.",pass:80,questions:[
{q:"Was beschreibt RKE?",a:["Ruhig bleiben – klar kommunizieren – Entscheidungen erklären","Rechte kennen – Kontrolle erklären – Einsatz beenden","Rückmeldung – Kennzeichen – Einsatzort"],c:0},
{q:"Wofür steht UAFL?",a:["Uniform – Ausrüstung – Funk – Laptop","Uniform – Akte – Fahrzeug – Leitstelle","Unterweisung – Auftrag – Funk – Lage"],c:0},
{q:"Was gehört zum Auftrag des MRPD?",a:["Bürgern helfen, Lagen bearbeiten, Entscheidungen treffen und dokumentieren","Nur Verkehrskontrollen","Nur Funksprüche beantworten"],c:0},
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
{q:"Welche Stationskennung hat MRPD?",a:["1","5","10"],c:0}]},
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


const chapterIcons={1:"📋",2:"🏛️",3:"👔",4:"📱",5:"📢",6:"🗺️",7:"💻",8:"🚙",9:"🚓",10:"🤝",11:"⚖️",12:"📁",13:"🔫",14:"🎯",15:"🎓",16:"📑",17:"🎧",18:"🔋",19:"🧪",20:"📖",21:"📍",22:"⚠️"};
const chapterCardImages=Object.fromEntries(Array.from({length:22},(_,i)=>[i+1,`chapter-art-${String(i+1).padStart(2,"0")}.webp?v=hd60`]));
const chapterBannerImages=Object.fromEntries(Array.from({length:22},(_,i)=>[i+1,"kapitel-banner-original.png?v=20261010fix2"]));
function nav(){
 const canCollapseTraining=hasExtraTrainerAccess(current);
 let collapsed=false;
 try{collapsed=canCollapseTraining&&localStorage.getItem("alta_training_nav_collapsed")==="1"}catch(_){}
 let html=`<button class="nav-btn active" data-view="dashboard">🏠 Dashboard</button>`;
 if(canCollapseTraining){
  html+=`<button class="nav-label v642-training-toggle" id="trainingNavToggle" type="button" aria-expanded="${collapsed?"false":"true"}"><span>AUSBILDUNG</span><span class="v642-toggle-icon">${collapsed?"▸":"▾"}</span></button><div id="trainingNavItems" class="v642-training-items ${collapsed?"collapsed":""}">`;
 }else{
  html+=`<div class="nav-label">AUSBILDUNG</div>`;
 }
 for(const x of titles) html+=`<button class="nav-btn" data-chapter="${x.n}"><span class="chapter-nav-icon chapter-nav-emoji" aria-hidden="true">${!isTrainer(current)&&!(current.unlockedChapters||[]).includes(x.n)?"🔒":chapterIcons[x.n]||"📘"}</span>${String(chapterNumber(x.n)).padStart(2,"0")} · ${esc(x.title)}</button>`;
 if(canCollapseTraining)html+=`</div>`;
 html+=`<div class="nav-label">PRÜFUNGEN</div><button class="nav-btn" data-view="tests">📝 Tests</button><div class="nav-label">PORTAL</div><button class="nav-btn" data-view="news">📢 Mitteilungen</button><button class="nav-btn" data-view="documents">📂 Dokumente</button>`;
 if(hasExtraTrainerAccess(current)) html+=`<div class="nav-label">FTO / ADMIN</div>${isOwner(current)?`<button class="nav-btn" data-view="command">⚡ Command Center</button><button class="nav-btn v58-command-live-nav" data-view="command-live">🟢 Live-Benutzer</button>`:""}<button class="nav-btn" data-view="accounts">👤 Account-Verwaltung</button><button class="nav-btn" data-view="admin">📂 Rekruten Ausbildungsakten</button>`;
 $("#nav").innerHTML=html;
 document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>showView(b.dataset.view));
 document.querySelectorAll("[data-chapter]").forEach(b=>b.onclick=()=>showChapter(+b.dataset.chapter));
 $("#trainingNavToggle")?.addEventListener("click",e=>{
  const items=$("#trainingNavItems"),nowCollapsed=!items.classList.contains("collapsed");
  items.classList.toggle("collapsed",nowCollapsed);
  e.currentTarget.setAttribute("aria-expanded",String(!nowCollapsed));
  const icon=e.currentTarget.querySelector(".v642-toggle-icon");if(icon)icon.textContent=nowCollapsed?"▸":"▾";
  try{localStorage.setItem("alta_training_nav_collapsed",nowCollapsed?"1":"0")}catch(_){}
 });
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
 if(v==="cad")return window.APD_CAD_SIM.render();
 if(v==="dashboard") return dashboard();
 if(v==="command-live") return v58RenderLiveUsers();
 if(v==="command") return commandCenter();
 if(v==="accounts") return accountManagement();
 if(v==="admin") return recruitRecordsView();
 if(v==="tests") return testsView();
 if(v==="account") return account();
 if(v==="news") return newsView();
 if(v==="documents") return documentsView();
}

function totalTrainingMinutes(u){return (u.reports||[]).reduce((a,x)=>a+(+x.duration||0),0)}
function fmtDuration(m){m=+m||0;return `${Math.floor(m/60)} Std. ${String(m%60).padStart(2,"0")} Min.`}
function readiness(u){
 const tests=(u.testResults||[]).filter(x=>x.passed).length;
 const open=(u.goals||[]).filter(x=>!x.done).length;
 if(progress(u)===100 && tests>=5 && open===0) return ["Abschlussbereit","good"];
 if((u.testResults||[]).some(x=>!x.passed)||open>=3) return ["Handlungsbedarf","bad"];
 if(open>0) return ["Offene Punkte","warn"];
 return ["Im Plan","good"];
}
function graduationChecklist(u){
 const passed=new Set((u.testResults||[]).filter(x=>x.passed).map(x=>x.testId));
 const rows=[
  ["22 Ausbildungskapitel",(u.completed||[]).length===22,`${(u.completed||[]).length}/22`],
  ["Alle fünf Tests",["test-a","test-b","test-c","test-d","test-e"].every(x=>passed.has(x)),`${passed.size}/5 bestanden`],
  ["Praxis dokumentiert",(u.reports||[]).length>0,`${(u.reports||[]).length} Berichte`],
  ["Keine offenen Ausbildungsziele",!(u.goals||[]).some(x=>!x.done),`${(u.goals||[]).filter(x=>!x.done).length} offen`],
  ["Funk / EFA / Streife",qualifications(u).slice(0,3).every(x=>x[2]),"Pflichtfreigaben"]
 ];
 return `<div class="graduation-check">${rows.map(x=>`<div class="grad-row ${x[1]?"ok":"open"}"><span>${x[1]?"✓":"○"}</span><b>${x[0]}</b><small>${x[2]}</small></div>`).join("")}</div>`;
}
function commandCenter(){
 if(!isTrainer(current)) return dashboard();
 setActive('[data-view="command"]');$("#pageTitle").textContent="Command Center";
 const rs=db.users.filter(x=>apdActiveRecruit(x)), ts=db.users.filter(x=>x.role==="trainer");
 const ready=rs.filter(x=>readiness(x)[0]==="Abschlussbereit").length;
 const attention=rs.filter(x=>readiness(x)[0]==="Handlungsbedarf").length;
 const open=rs.reduce((a,x)=>a+(x.goals||[]).filter(g=>!g.done).length,0);
 const reports=rs.reduce((a,x)=>a+(x.reports||[]).length,0);
 const workload={}; rs.forEach(r=>{const k=r.fto||"Nicht zugewiesen";workload[k]=(workload[k]||0)+1});
 $("#content").innerHTML=`<div class="section-head"><div><div class="eyebrow">AUSBILDUNGSLEITUNG</div><h1>Command Center</h1><p class="muted">Zentrale Übersicht über Ausbildung, FTO-Auslastung und offene Punkte.</p>${isFtoLead(current)?`<div class="fto-lead-badge command">🎖️ Leitung der FTO · Sgt Carter</div>`:""}</div><span class="status">● System online</span></div>
 <div class="command-metrics"><div class="card stat"><span>AKTIVE RECRUITS</span><b>${rs.filter(x=>x.status!=="Archiviert").length}</b></div><div class="card stat"><span>FTOs</span><b>${ts.length+1}</b></div><div class="card stat"><span>OFFENE ZIELE</span><b>${open}</b></div><div class="card stat"><span>HANDLUNGSBEDARF</span><b>${attention}</b></div><div class="card stat"><span>ABSCHLUSSBEREIT</span><b>${ready}</b></div><div class="card stat"><span>FTO-BERICHTE</span><b>${reports}</b></div></div>
 <div class="command-grid"><div class="card"><div class="eyebrow">HEUTE ERFORDERLICH</div><h2>Recruit-Status</h2>${rs.length?rs.map(r=>{let a=readiness(r);return `<button class="command-recruit" data-command-open="${r.id}"><span class="signal ${a[1]}"></span><div><b>${esc(r.name)}</b><small>${esc(r.fto||"—")} · ${stage(r)} · ${fmtDuration(totalTrainingMinutes(r))}</small></div><strong>${a[0]}</strong></button>`}).join(""):"<p class='muted'>Keine Recruits vorhanden.</p>"}</div>
 <div class="card"><div class="eyebrow">FTO-AUSLASTUNG</div><h2>Zuweisungen</h2>${Object.entries(workload).map(([k,v])=>`<div class="workload-row"><div><b>${esc(k)}</b><small>${v} aktive Recruit${v===1?"":"s"}</small></div><div class="workload-bar"><i style="width:${Math.min(100,v*25)}%"></i></div><strong>${v}</strong></div>`).join("")||"<p class='muted'>Noch keine Zuweisungen.</p>"}</div></div>
 <div class="card"><div class="eyebrow">LETZTE AKTIVITÄTEN</div><h2>Dienstbuch</h2>${rs.flatMap(r=>(r.activity||[]).slice(0,3).map(a=>({...a,name:r.name}))).filter(x=>x.when).sort((a,b)=>new Date(b.when)-new Date(a.when)).slice(0,12).map(x=>`<div class="timeline-row"><span class="timeline-icon">${x.icon}</span><div><b>${esc(x.name)} · ${esc(x.text)}</b><small>${new Date(x.when).toLocaleString("de-DE")}</small></div></div>`).join("")||"<p class='muted'>Noch keine Aktivitäten.</p>"}</div>`;
 document.querySelectorAll("[data-command-open]").forEach(b=>b.onclick=()=>{selectedRecruit=b.dataset.commandOpen;recruitRecordClosed=false;admin()});
}


function v630IssueRows(){
 const now=Date.now(),day=86400000,rows=[];
 db.users.filter(r=>apdActiveRecruit(r)).forEach(r=>{
  const open=(r.goals||[]).filter(g=>!g.done);
  const fails=(r.testResults||[]).filter(t=>!t.passed);
  const last=(r.activity||[])[0]?.when;
  if(open.length>=3)rows.push({sev:3,icon:"🎯",r,text:`${open.length} offene Ausbildungsziele`});
  if(fails.length>=2)rows.push({sev:3,icon:"🧪",r,text:`${fails.length} nicht bestandene Tests`});
  if(last&&now-new Date(last).getTime()>=7*day)rows.push({sev:2,icon:"⏱️",r,text:"Seit mindestens 7 Tagen keine Ausbildungsaktivität"});
  if(progress(r)===100)rows.push({sev:1,icon:"✅",r,text:"Ausbildungsfortschritt 100 % – Abschluss prüfen"});
 });
 return rows.sort((a,b)=>b.sev-a.sev||a.r.name.localeCompare(b.r.name,"de"));
}
function v630AcademyFeed(limit=10){
 const a=[];
 db.users.filter(r=>apdActiveRecruit(r)).forEach(r=>{
  (r.notes||[]).forEach(x=>a.push({when:x.createdAt,icon:"📝",r,text:`${x.authorRank||""} ${x.authorName||"Ausbilder"}: Vermerk hinzugefügt`}));
  (r.goals||[]).forEach(x=>a.push({when:x.createdAt,icon:"🎯",r,text:`${x.authorRank||""} ${x.authorName||"Ausbilder"}: Ausbildungsziel erstellt`}));
  (r.reports||[]).forEach(x=>a.push({when:x.createdAt,icon:"🚓",r,text:`${x.authorRank||""} ${x.author||"Ausbilder"}: Ausbildungsfahrt bewertet`}));
  (r.testResults||[]).forEach(x=>a.push({when:x.date,icon:x.passed?"✅":"🧪",r,text:`Test ${x.passed?"bestanden":"nicht bestanden"} · ${x.percent}%`}));
 });
 return a.filter(x=>x.when).sort((a,b)=>new Date(b.when)-new Date(a.when)).slice(0,limit);
}
function v630OpenRecruit(id,tab="overview"){
 selectedRecruit=id;recruitRecordClosed=false;recruitRecordsOnly=true;recordActiveTab=tab;
 try{sessionStorage.setItem("alta_record_active_tab",tab);sessionStorage.setItem("alta_record_tab_"+id,tab)}catch{}
 admin();
 requestAnimationFrame(()=>requestAnimationFrame(()=>activateRecordTab(tab,true)));
}
function v630HandoverSummary(r){
 const open=(r.goals||[]).filter(g=>!g.done),lastReport=(r.reports||[]).slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))[0];
 return `FTO-Übergabe · ${r.name}\nFortschritt: ${progress(r)}% (${(r.completed||[]).length}/22 Kapitel)\nStatus: ${r.status||"—"}\nOffene Ziele: ${open.length}${open.length?`\n• ${open.slice(0,4).map(x=>x.text).join("\n• ")}`:""}\nLetzte Ausbildungsfahrt: ${lastReport?`${lastReport.date||"—"} · ${lastReport.topics||"ohne Themenangabe"}`:"noch keine dokumentiert"}\nTests bestanden: ${(r.testResults||[]).filter(x=>x.passed).length}/5`;
}
function dashboard(){
 setActive('[data-view="dashboard"]'); $("#pageTitle").textContent="Dashboard";
 let u=current, p=progress(u);
 $("#content").innerHTML=`
 <div class="hero cinematic-hero">
  <div class="cinematic-image cinematic-dashboard" aria-hidden="true"></div>
  <div class="cinematic-hero-shade" aria-hidden="true"></div>
  <div class="cinematic-hero-copy"><div class="eyebrow">${greeting().toUpperCase()}</div><h1>${esc(u.rank?u.rank+" ":"")}${esc(u.name)}</h1>
   <span class="status">● ${esc(u.status)}</span>
   <p>Willkommen im MRPD Ausbildungsportal. Hier findest du die Inhalte des Rekrutenhandbuchs, bebilderte Anleitungen und deinen persönlichen Ausbildungsfortschritt. Dein zuständiger FTO ist <b>${esc(u.fto)}</b>.</p>
  </div>
 </div>
 <div class="grid stats">
  <div class="card stat"><span>DIENSTNUMMER</span><b>${esc(u.serviceNo)}</b></div>
  <div class="card stat"><span>FTO</span><b>${esc(u.fto)}</b>${u.secondaryFto?`<small>+ ${esc(u.secondaryFto)}</small>`:""}</div>
  <div class="card stat"><span>AUSBILDUNGSSTATUS</span><b>${esc(u.status)}</b></div>
  <div class="card stat"><span>FORTSCHRITT</span><b>${p}%</b><div class="progress"><i style="width:${p}%"></i></div></div>
 </div>
 <div class="card"><div class="section-head" style="margin:0 0 12px"><div><div class="eyebrow">AKTUELLE STUFE</div><h2>${stage(u)}</h2></div><span>${u.completed.length} / 22 Kapitel</span></div><div class="progress"><i style="width:${p}%"></i></div></div>
 ${isTrainer(u)?`<div class="section-head"><div><div class="eyebrow">FTO-ÜBERSICHT</div><h2>${isFtoLead(u)?"Leitung der FTO":"Ausbildungsleitung"}</h2>${isFtoLead(u)?`<span class="fto-lead-badge">🎖️ Sgt Carter · Leitung der FTO</span>`:""}</div></div><div class="grid fto-stats">${(()=>{const rs=db.users.filter(x=>apdActiveRecruit(x)),ready=rs.filter(x=>progress(x)===100).length,open=rs.reduce((a,x)=>a+(x.goals||[]).filter(g=>!g.done).length,0),tests=rs.reduce((a,x)=>a+(x.assignedTests||[]).length,0);return `<div class="card stat"><span>RECRUITS</span><b>${rs.length}</b></div><div class="card stat"><span>STREIFENFREIGABE</span><b>${ready}</b></div><div class="card stat"><span>OFFENE ZIELE</span><b>${open}</b></div><div class="card stat"><span>ZUGEWIESENE TESTS</span><b>${tests}</b></div>`})()}</div><div class="card"><div class="eyebrow">FORTSCHRITT DER RECRUITS</div><div class="fto-recruit-list">${db.users.filter(x=>apdActiveRecruit(x)).map(r=>`<div class="fto-recruit"><div><b>${esc(r.name)}</b><small>${esc(r.fto||"—")} · ${stage(r)}</small></div><div class="mini-progress"><i style="width:${progress(r)}%"></i></div><strong>${progress(r)}%</strong></div>`).join("")||"<p class='muted'>Noch keine Recruits.</p>"}</div></div>`:`<div class="dashboard-two"><div class="card"><div class="eyebrow">🎯 OFFENE AUSBILDUNGSZIELE</div><h2>Meine nächsten Ziele</h2>${(u.goals||[]).filter(g=>!g.done).length?(u.goals||[]).filter(g=>!g.done).map(g=>`<div class="goal-mini"><span>📌</span><b>${esc(g.text)}</b></div>`).join(""):"<p class='muted'>Aktuell keine offenen Ausbildungsziele.</p>"}</div><div class="card"><div class="eyebrow">🏅 QUALIFIKATIONEN</div><h2>Freigaben</h2>${qualificationHtml(u)}</div></div>`}
 ${isTrainer(u)?`<div class="v630-command-grid">
  <div class="card v630-action-card"><div class="section-head compact"><div><div class="eyebrow">⚠️ HANDLUNGSBEDARF</div><h2>Heute im Blick</h2></div><span class="v630-count">${v630IssueRows().length}</span></div>
   <div class="v630-action-list">${v630IssueRows().slice(0,8).map(x=>`<button class="v630-action-row sev-${x.sev}" data-v630-recruit="${x.r.id}"><span>${x.icon}</span><div><b>${esc(x.r.name)}</b><small>${esc(x.text)}</small></div><strong>Öffnen →</strong></button>`).join("")||`<div class="v630-empty">✓ Aktuell kein dringender Handlungsbedarf.</div>`}</div>
  </div>
  <div class="card v630-feed-card"><div class="eyebrow">📡 ACADEMY LIVE</div><h2>Letzte Aktivitäten</h2>
   <div class="v630-feed">${v630AcademyFeed(8).map(x=>`<button class="v630-feed-row" data-v630-recruit="${x.r.id}"><span>${x.icon}</span><div><b>${esc(x.r.name)}</b><small>${esc(x.text)}</small><em>${new Date(x.when).toLocaleString("de-DE")}</em></div></button>`).join("")||`<p class="muted">Noch keine Academy-Aktivitäten.</p>`}</div>
  </div>
 </div>`:""}
 <div class="card activity-card"><div class="eyebrow">AKTIVITÄTSVERLAUF</div><h2>Letzte Ausbildungsaktivitäten</h2>${timelineHtml(u,6)}</div>
 <div class="section-head"><div><div class="eyebrow">REKRUTENAUSBILDUNG</div><h2>Ausbildungskapitel</h2></div><span class="muted">Stand Handbuch 03.10.2026</span></div>
 <div class="grid chapter-grid">${titles.map(x=>`${chapterNumber(x.n)===chapterCategory(x.n).from?`<div class="chapter-category-heading"><small>BEREICH ${chapterCategory(x.n).n}</small><h2>${esc(chapterCategory(x.n).name)}</h2><p>Kapitel ${chapterCategory(x.n).from}–${chapterCategory(x.n).to}</p></div>`:""}<div class="card chapter-card chapter-card-image phase-${chapterCategory(x.n).n} ${u.completed.includes(x.n)?"done":""}" data-open="${x.n}" style="--chapter-bg:url('${chapterCardImages[x.n]||`image${x.n}.png`}')"><div class="chapter-card-shade"></div><div class="chapter-card-content"><div class="chapter-num"><span class="chapter-card-icon">${chapterIcons[x.n]||"📘"}</span> KAPITEL ${String(chapterNumber(x.n)).padStart(2,"0")}</div><h3>${esc(x.title)}</h3><span class="chapter-card-state">${u.completed.includes(x.n)?"✓ Abgeschlossen":"Nicht begonnen"}</span></div></div>`).join("")}</div>`;
 document.querySelectorAll("[data-open]").forEach(x=>x.onclick=()=>showChapter(+x.dataset.open));
 document.querySelectorAll("[data-v630-recruit]").forEach(x=>x.onclick=()=>v630OpenRecruit(x.dataset.v630Recruit,"overview"));
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
 const c=CHAPTERS[n]; if(!c)return;
 if(!isTrainer(current)&&!(current.unlockedChapters||[]).includes(n)){
  setActive(`[data-chapter="${n}"]`);$("#pageTitle").textContent=`Kapitel ${chapterNumber(n)} · Gesperrt`;
  $("#content").innerHTML=`<div class="card apd-locked"><h1>🔒 Kapitel ${chapterNumber(n)} ist gesperrt</h1><p>${esc(c.title)}</p><p>Dieses Kapitel muss von einem Ausbilder oder einer höheren Dienststellung für dich freigegeben werden.</p><button class="secondary" id="lockedBack">Zum Dashboard</button></div>`;
  $("#lockedBack").onclick=()=>showView("dashboard");return;
 }
 localStorage.setItem("alta_last_chapter",String(n));
 setActive(`[data-chapter="${n}"]`); $("#pageTitle").textContent=`Kapitel ${chapterNumber(n)}`;
 const done=current.completed.includes(n);
 const chapterImages=(n===6||n===21)?["gebietskarte.png"]:(c.images||[]); const imgs=chapterImages.map(i=>`<img src="${i}" alt="Handbuch-Abbildung ${i}" onclick="window.open(this.src,'_blank')">`).join("");
 $("#content").innerHTML=`
 <div class="chapter-header apd-photo-banner">
  <img class="apd-banner-photo" src="kapitel-banner-original.png?v=academy-final-1" alt="Polizeibeamte am Streifenwagen in Los Santos" loading="eager" decoding="async" onerror="this.onerror=null;this.src='kapitel-banner-polizei.webp?v=academy-final-1'">
  <div class="apd-banner-shade" aria-hidden="true"></div>
  <div class="apd-banner-caption"><div class="chapter-no">KAPITEL ${String(chapterNumber(n)).padStart(2,"0")}</div><h1>${esc(c.title)}</h1><span class="status">${done?"✓ Abgeschlossen":"● In Ausbildung"}</span></div>
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
 <div class="digital-id"><img src="assets/mrpd-logo.svg"><div><small>Mission Row Police Department</small><h2>${esc(current.name)}</h2><b>${esc(current.rank||roleLabel(current))}</b><span>Badge ${esc(current.serviceNo||"—")}</span></div></div><div class="card account-card">
  <div class="profile-line"><img src="assets/mrpd-logo.svg" alt="MRPD Logo"><div><h2>${esc(current.name)}</h2><p>${esc(current.rank||"")}</p></div></div>
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
function accountManagement(){
 recruitRecordsOnly=false;
 if(!hasExtraTrainerAccess(current)) return dashboard();
 setActive('[data-view="accounts"]'); $("#pageTitle").textContent="Account-Verwaltung";
 const trainers=db.users.filter(x=>x.role==="trainer");
 const recruitCreate=canCreateRecruit()?`<section class="card account-create-panel"><div class="eyebrow">REKRUTEN</div><h2>Recruit-Account erstellen</h2><p class="muted">Hier werden ausschließlich neue Zugangsdaten für Rekruten angelegt. Die Ausbildungsakte befindet sich im separaten Menüpunkt.</p><form id="createRecruitAccounts" class="form-grid account-form-spacious">
  <label>Name<input name="name" required placeholder="Recruit Name"></label>
  <label>Dienstnummer<input name="serviceNo" required placeholder="R-103"></label>
  <label>Benutzername<input name="username" required placeholder="vorname.nachname"></label>
  <label>Standardpasswort<input value="123456" disabled></label>
  <label>Leiter FTO<input name="fto" value="${esc(current.name)}" required></label>
  <label>Ausbildungsbeginn<input name="start" value="${new Date().toLocaleDateString("de-DE")}"></label>
  <button class="primary" type="submit">Recruit-Account erstellen</button>
 </form></section>`:`<section class="card account-create-panel"><div class="eyebrow">REKRUTEN</div><h2>Recruit-Accounts</h2><p class="muted">Neue Recruit-Accounts können nur mit Extra-Zugriff angelegt werden.</p></section>`;
 const trainerCreate=isOwner()?`<section class="card account-create-panel"><div class="eyebrow">AUSBILDER</div><h2>Ausbilder-Account erstellen</h2><p class="muted">Account und Berechtigungsstufe für einen neuen Ausbilder anlegen.</p><form id="createTrainerAccounts" class="form-grid account-form-spacious">
  <label>Name<input name="name" required placeholder="Sgt Mustermann"></label>
  <label>Dienstnummer<input name="serviceNo" required placeholder="S-02"></label>
  <label>Rang<select name="rank" required><option>Chief of Police</option><option>Assistant Chief</option><option>Deputy Chief</option><option>Commander</option><option>Captain</option><option selected>Sergeant</option><option>Detective</option><option>Police Officer</option><option>Recruit</option></select></label>
  <label>Benutzername<input name="username" required placeholder="sgt.mustermann"></label>
  <label>Standardpasswort<input value="123456" disabled></label>
  <label>Status / Zugriff<select name="access"><option value="standard">Ausbilder</option><option value="extra">Ausbilder + Extra-Zugriff</option></select></label>
  <button class="primary" type="submit">Ausbilder-Account erstellen</button>
 </form></section>`:"";
 const recruits=db.users.filter(x=>apdActiveRecruit(x));
 const rankOptions=["Chief of Police","Assistant Chief","Deputy Chief","Commander","Captain","Sergeant","Detective","Police Officer","Recruit"];
 const accountEditor=isOwner()?`<section class="card account-editor-v562">
  <div class="section-head"><div><div class="eyebrow">HAUPTADMIN</div><h2>Andere Accounts bearbeiten</h2><p class="muted">Ausbilder- und Recruit-Accounts verwalten, Passwörter zurücksetzen oder Accounts entfernen.</p></div><span class="access-badge owner">Nur Hauptadmin</span></div>
  <div class="account-editor-tabs-v562"><button class="primary active" type="button" data-account-tab="trainers">Ausbilder (${trainers.length})</button><button class="secondary" type="button" data-account-tab="recruits">Rekruten (${recruits.length})</button></div>
  <div data-account-panel="trainers" class="account-panel-v562">
   ${trainers.map(t=>`<div class="account-edit-row-v562"><div class="account-edit-person-v562"><b>🎖️ ${esc(t.name)}</b><small>${esc(t.serviceNo||"—")} · ${esc(t.username)}</small></div><label>Rang<select data-account-rank="${t.id}">${rankOptions.map(r=>`<option ${t.rank===r?"selected":""}>${r}</option>`).join("")}${!rankOptions.includes(t.rank)?`<option selected>${esc(t.rank||"Altbestand")}</option>`:""}</select></label><label>Zugriff<select data-account-access="${t.id}"><option value="standard" ${t.access!=="extra"?"selected":""}>Ausbilder</option><option value="extra" ${t.access==="extra"?"selected":""}>Ausbilder + Extra-Zugriff</option></select></label><div class="account-edit-actions-v562"><button class="secondary" type="button" data-account-copy="${t.id}">📋 Zugangsdaten kopieren</button><button class="secondary" type="button" data-account-reset="${t.id}" data-account-name="${esc(t.name)}">🔑 Passwort</button>${t.id!==current.id?`<button class="danger-btn" type="button" data-account-delete="${t.id}" data-account-name="${esc(t.name)}">Löschen</button>`:""}</div></div>`).join("")||`<div class="empty-state">Keine Ausbilder-Accounts vorhanden.</div>`}
  </div>
  <div data-account-panel="recruits" class="account-panel-v562" hidden>
   ${recruits.map(r=>`<div class="account-edit-row-v562"><div class="account-edit-person-v562"><b>👮 ${esc(r.name)}</b><small>${esc(r.serviceNo||"—")} · ${esc(r.username)} · ${esc(r.rank||"Recruit")}</small></div><div class="account-edit-meta-v562"><span class="status">${esc(r.status||"In Ausbildung")}</span><span class="muted">FTO: ${esc(r.fto||"—")}</span></div><div class="account-edit-actions-v562"><button class="secondary" type="button" data-account-copy="${r.id}">📋 Zugangsdaten kopieren</button><button class="secondary" type="button" data-account-reset="${r.id}" data-account-name="${esc(r.name)}">🔑 Passwort</button><button class="primary" type="button" data-open-recruit-account="${r.id}">📂 Ausbildungsakte</button><button class="danger-btn" type="button" data-account-delete="${r.id}" data-account-name="${esc(r.name)}">Löschen</button></div></div>`).join("")||`<div class="empty-state">Keine Recruit-Accounts vorhanden.</div>`}
  </div>
 </section>`:"";
 $("#content").innerHTML=`<div class="section-head"><div><div class="eyebrow">FTO / ADMINISTRATION</div><h1>Account-Verwaltung</h1><p class="muted page-intro">Accounts erstellen und – als Hauptadmin – bestehende Zugänge verwalten.</p></div><span class="status">${esc(current.name)} · ${roleLabel(current)}</span></div><div class="account-management-grid">${recruitCreate}${trainerCreate}</div>${accountEditor}`;
 $("#createRecruitAccounts")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target);try{await invokeAccountAction({action:"create",role:"recruit",username:f.get("username"),name:f.get("name"),serviceNo:f.get("serviceNo"),rank:"Recruit",fto:f.get("fto"),start:f.get("start"),access:"standard"});await refreshData();alert("Recruit-Account wurde erstellt.");accountManagement()}catch(err){alert("Account konnte nicht erstellt werden: "+err.message)}});
 $("#createTrainerAccounts")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target);try{await invokeAccountAction({action:"create",role:"trainer",username:f.get("username"),name:f.get("name"),serviceNo:f.get("serviceNo"),rank:f.get("rank"),fto:"—",access:f.get("access")});await refreshData();alert("Ausbilder-Account wurde erstellt.");accountManagement()}catch(err){alert("Ausbilder konnte nicht erstellt werden: "+err.message)}});
 document.querySelectorAll("[data-account-tab]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-account-tab]").forEach(x=>{x.classList.toggle("primary",x===b);x.classList.toggle("secondary",x!==b)});document.querySelectorAll("[data-account-panel]").forEach(p=>p.hidden=p.dataset.accountPanel!==b.dataset.accountTab)});
 document.querySelectorAll("[data-account-rank]").forEach(x=>x.onchange=async()=>{try{await invokeAccountAction({action:"trainer_rank",userId:x.dataset.accountRank,rank:x.value});await refreshData();accountManagement()}catch(err){alert("Rang konnte nicht geändert werden: "+err.message)}});
 document.querySelectorAll("[data-account-access]").forEach(x=>x.onchange=async()=>{try{await invokeAccountAction({action:"trainer_access",userId:x.dataset.accountAccess,access:x.value});await refreshData();accountManagement()}catch(err){alert("Zugriff konnte nicht geändert werden: "+err.message)}});
 document.querySelectorAll("[data-account-copy]").forEach(b=>b.onclick=async()=>{const u=db.users.find(x=>x.id===b.dataset.accountCopy);if(!u)return;const role=u.role==="recruit"?"RECRUIT":"FTO / AUSBILDER";const msg=`🎉 Willkommen beim MRPD, ${u.rank||role} ${u.name}! 🎉\n\nDu wurdest erfolgreich in das MRPD Recruit & Training Portal eingetragen.\n\n📋 Zugangsdaten:\n🆔 Benutzername: ${u.username}\n🔑 Passwort: 123456\n🔗 Login: https://ybiene.github.io/MRPD-recruit-portal/\n\n🎖️ Dienstdaten:\n👮 Rang: ${u.rank||"—"}\n🪪 Dienstnummer: ${u.serviceNo||"—"}\n🎓 Funktion: ${role}\n\n⚠️ WICHTIG: Bitte das Passwort nach dem ersten Login ändern, Zugangsdaten nicht weitergeben und sicher speichern.\n\nViel Erfolg im Dienst! 👮🚔\nMission Row Police Department\nRecruitment & Training Division`;try{await navigator.clipboard.writeText(msg);toast("Zugangsdaten kopiert.")}catch{alert("Zugangsdaten konnten nicht kopiert werden.")}});
 document.querySelectorAll("[data-account-reset]").forEach(b=>b.onclick=async()=>{if(!confirm(`Passwort von ${b.dataset.accountName||"diesem Account"} auf 123456 zurücksetzen?`))return;try{await invokeAccountAction({action:"reset_password",userId:b.dataset.accountReset});alert("Passwort wurde auf 123456 zurückgesetzt.");await refreshData();accountManagement()}catch(err){alert("Passwort konnte nicht zurückgesetzt werden: "+err.message)}});
 document.querySelectorAll("[data-account-delete]").forEach(b=>b.onclick=async()=>{if(!confirm(`Account von ${b.dataset.accountName||"dieser Person"} wirklich löschen?`))return;try{await invokeAccountAction({action:"delete",userId:b.dataset.accountDelete});await refreshData();accountManagement()}catch(err){alert("Account konnte nicht gelöscht werden: "+err.message)}});
 document.querySelectorAll("[data-open-recruit-account]").forEach(b=>b.onclick=()=>{selectedRecruit=b.dataset.openRecruitAccount;recruitRecordClosed=false;recruitRecordsOnly=true;admin()});
}
let recruitRecordsOnly=false;
function recruitRecordsView(){
 if(!isTrainer(current)) return;
 recruitRecordsOnly=true;
 recruitRecordClosed=true;
 selectedRecruit=null;
 admin();
}
function admin(){
 if(!isTrainer(current)) return dashboard();
 setActive('[data-view="admin"]');
 $("#pageTitle").textContent=recruitRecordsOnly?"Rekruten Ausbildungsakten":"Recruit-Verwaltung";
 const recruits=db.users.filter(x=>apdActiveRecruit(x));
 const trainers=db.users.filter(x=>x.role==="trainer");
 /* V5.3.3: Akte öffnet sich ausschließlich über „Öffnen“. */
 let sel=db.users.find(x=>x.id===selectedRecruit && x.role==="recruit");
 const createRecruitCard=recruitRecordsOnly?"":canCreateRecruit()?`<div class="card account-create-card"><h3>Neuen Recruit anlegen</h3><form id="createRecruit" class="form-grid">
    <label>Name<input name="name" required placeholder="Recruit Name"></label>
    <label>Dienstnummer<input name="serviceNo" required placeholder="R-103"></label>
    <label>Benutzername<input name="username" required placeholder="vorname.nachname"></label>
    <label>Standardpasswort<input value="123456" disabled></label>
    <label>Leiter FTO<select name="fto" required>${v625FtoOptions(current.id,current.name,false)}</select></label>
    <label>Ausbildungsbeginn<input name="start" value="${new Date().toLocaleDateString("de-DE")}"></label>
    <button class="primary" type="submit">Recruit-Account erstellen</button>
   </form></div>`:`<div class="card"><h3>Recruit-Accounts</h3><p class="muted">Mit deinem aktuellen Zugriff kannst du Ausbildungsstände bearbeiten. Neue Accounts können nur mit Extra-Zugriff angelegt werden.</p></div>`;
 const trainerAdmin=(!recruitRecordsOnly&&isOwner())?`<div class="card trainer-admin"><div class="section-head compact"><div><div class="eyebrow">AUSBILDER</div><h3>Ausbilder-Accounts</h3></div><span class="access-badge owner">Nur Hauptadmin</span></div>
   <form id="createTrainer" class="form-grid">
    <label>Name<input name="name" required placeholder="Sgt Mustermann"></label>
    <label>Dienstnummer<input name="serviceNo" required placeholder="S-02"></label>
    <label>Rang<select name="rank" required><option>Chief of Police</option><option>Assistant Chief</option><option>Deputy Chief</option><option>Commander</option><option>Captain</option><option selected>Sergeant</option><option>Detective</option><option>Police Officer</option><option>Recruit</option></select></label>
    <label>Benutzername<input name="username" required placeholder="sgt.mustermann"></label>
    <label>Standardpasswort<input value="123456" disabled></label>
    <label>Status / Zugriff<select name="access"><option value="standard">Ausbilder</option><option value="extra">Ausbilder + Extra-Zugriff</option></select></label>
    <button class="primary" type="submit">Ausbilder-Account erstellen</button>
   </form>
   <div class="trainer-list">${trainers.map(t=>`<div class="trainer-row"><div><b>🎖️ ${esc(t.name)}</b><small>${esc(t.serviceNo)} · ${esc(t.username)}</small></div><select data-rank="${t.id}" aria-label="Rang"><option ${t.rank==="Chief of Police"?"selected":""}>Chief of Police</option><option ${t.rank==="Assistant Chief"?"selected":""}>Assistant Chief</option><option ${t.rank==="Deputy Chief"?"selected":""}>Deputy Chief</option><option ${t.rank==="Commander"?"selected":""}>Commander</option><option ${t.rank==="Captain"?"selected":""}>Captain</option><option ${t.rank==="Sergeant"?"selected":""}>Sergeant</option><option ${t.rank==="Detective"?"selected":""}>Detective</option><option ${t.rank==="Police Officer"?"selected":""}>Police Officer</option><option ${t.rank==="Recruit"?"selected":""}>Recruit</option></select><select data-access="${t.id}" aria-label="Zugriff"><option value="standard" ${t.access!=="extra"?"selected":""}>Ausbilder</option><option value="extra" ${t.access==="extra"?"selected":""}>Ausbilder + Extra-Zugriff</option></select><button class="secondary" data-reset-password="${t.id}" data-reset-name="${esc(t.name)}">🔑 Passwort zurücksetzen</button><button class="danger-btn" data-delete-trainer="${t.id}">Löschen</button></div>`).join("")||"<p class='muted'>Noch keine zusätzlichen Ausbilder-Accounts.</p>"}</div>
  </div>`:"";
 $("#content").innerHTML=`
 <div class="section-head"><div><div class="eyebrow">FTO / ADMINISTRATION</div><h1>${recruitRecordsOnly?"Rekruten Ausbildungsakten":"Recruit-Verwaltung"}</h1></div><span class="status">${esc(current.name)} · ${roleLabel(current)}</span></div>
 <div class="admin-grid ${sel?"":"record-is-closed"}">
  <div>
   ${createRecruitCard}
   <div class="card recruit-record-list" style="margin-top:${recruitRecordsOnly?"0":"14px"}"><h3>${recruitRecordsOnly?"Rekruten auswählen":"Recruit-Accounts"}</h3>
    ${recruits.map(r=>`<div class="recruit-row"><div><b>${esc(r.name)}</b><small>${esc(r.serviceNo)} · ${progress(r)}% · ${esc(r.fto)}</small></div><div class="recruit-row-actions"><button class="primary" data-edit="${r.id}">Öffnen</button><button class="secondary" data-close-record="${r.id}" ${selectedRecruit===r.id&&!recruitRecordClosed?"":"disabled"}>Schließen</button></div></div>`).join("")||"<p>Noch keine Recruit-Accounts.</p>"}
   </div>
  </div>
  ${sel?`<div class="record-workspace">${adminRecruit(sel)}</div>`:""}
 </div>
 ${trainerAdmin?`<div class="trainer-admin-wide">${trainerAdmin}</div>`:""}`;
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
 document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{recruitRecordClosed=false;selectedRecruit=b.dataset.edit;admin()});
 document.querySelectorAll("[data-close-record]").forEach(b=>b.onclick=()=>{if(selectedRecruit!==b.dataset.closeRecord)return;recruitRecordClosed=true;selectedRecruit=null;admin()});
 $("#closeRecruitRecord")?.addEventListener("click",()=>{recruitRecordClosed=true;selectedRecruit=null;admin()});
 $("#printRecruitRecord")?.addEventListener("click",()=>printRecruitRecord(sel));
 document.querySelectorAll("[data-record-jump]").forEach(b=>b.onclick=()=>activateRecordTab(b.dataset.recordJump));
 const _savedRecordTab=sessionStorage.getItem("alta_record_active_tab")||recordActiveTab||"overview";
 recordActiveTab=_savedRecordTab;
 activateRecordTab(_savedRecordTab,false);
 document.querySelectorAll("[data-check]").forEach(b=>b.onchange=async()=>{
  const tab="chapters",chapter=b.dataset.check,top=b.getBoundingClientRect().top;
  recordActiveTab=tab;try{sessionStorage.setItem("alta_record_active_tab",tab)}catch(_){}
  await toggleChapter(sel.id,+chapter);await refreshData();admin();
  requestAnimationFrame(()=>{
    activateRecordTab("chapters",false);
    const row=document.querySelector(`[data-check="${chapter}"]`);
    if(row){window.scrollBy({top:row.getBoundingClientRect().top-top,left:0,behavior:"instant"})}
  })
 });

 document.querySelectorAll("[data-phase-release]").forEach(b=>b.onclick=async()=>{
  const phase=+b.dataset.phaseRelease;
  if(!isTrainer(current))return;
  if(phase<1||phase>4)return;
  const label=ACADEMY_PHASES.find(x=>x.n===phase)?.name||`Phase ${phase}`;
  if(!confirm(`${sel.name} bis Phase ${phase} – ${label} freischalten?`))return;
  const y=window.scrollY,tab=recordActiveTab;
  const {error}=await sb.rpc("staff_set_recruit_phase",{target_id:sel.id,new_phase:phase});
  if(error){alert("Phase konnte nicht freigeschaltet werden: "+error.message);return}
  await refreshData();admin();requestAnimationFrame(()=>{activateRecordTab(tab,false);window.scrollTo({top:y,left:0,behavior:"instant"})});
  toast(`✓ Phase ${phase} freigeschaltet`);
 });
 document.querySelectorAll("[data-test-assign]").forEach(b=>b.onchange=async()=>{
  if(b.checked){
   const {error}=await sb.from("test_assignments").upsert({recruit_id:sel.id,test_id:b.dataset.testAssign,assigned_by:current.id,active:true},{onConflict:"recruit_id,test_id"});
   if(error) alert(error.message);
  }else{
   const {error}=await sb.from("test_assignments").update({active:false}).eq("recruit_id",sel.id).eq("test_id",b.dataset.testAssign);
   if(error) alert(error.message);
  }
  await refreshData();rerenderRecordKeepPosition();
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
 const leaderSel=v627SelectedFto("#editFto"),secondarySel=v627SelectedFto("#editSecondaryFto");
 const {error}=await sb.rpc("staff_update_recruit",{target_id:sel.id,new_fto:leaderSel.name,new_status:$("#editStatus").value,new_rank:$("#editRank").value});
 if(error){alert(error.message);return}
 const {error:secErr}=await sb.rpc("staff_update_secondary_fto",{target_id:sel.id,new_secondary_fto:secondarySel.name||""});
 if(secErr){alert("Weiterer FTO konnte nicht gespeichert werden: "+secErr.message);return}
 const {error:idErr}=await sb.rpc("staff_update_fto_assignments",{target_id:sel.id,new_leader_fto_id:leaderSel.id,new_secondary_fto_id:secondarySel.id});
 if(idErr){alert("FTO-Zuordnung konnte nicht gespeichert werden: "+idErr.message);return}
 await refreshData();admin();
});
 $("#v630FtoHandover")?.addEventListener("click",async()=>{
 const recipients=v62AssignedFtos(sel).filter(x=>x.id!==current.id);
 if(!recipients.length){alert("Für diesen Recruit ist kein anderer gültiger FTO-Account zugeordnet.");return}
 const body=v630HandoverSummary(sel);
 try{
  for(const u of recipients)await v62SendMessage({recipientId:u.id,subject:`FTO-Übergabe · ${sel.name}`,body,recruitId:sel.id,kind:"record_alert",sourceType:"handover"});
  await refreshData();alert("FTO-Übergabe wurde an "+recipients.map(x=>x.name).join(", ")+" gesendet.");
 }catch(err){alert("FTO-Übergabe konnte nicht gesendet werden: "+err.message)}
});
 $("#copyAccess")?.addEventListener("click",async()=>{const msg=`🎉 Willkommen beim MRPD, ${sel.rank||"Recruit"} ${sel.name}! 🎉\n\n📋 Deine Zugangsdaten:\n🆔 Benutzername: ${sel.username}\n🔑 Passwort: 123456\n🔗 Login: https://ybiene.github.io/MRPD-recruit-portal/\n\n🎖️ Deine Dienstdaten:\n🪪 Dienstnummer: ${sel.serviceNo||"—"}\n👮 Rang: ${sel.rank||"Recruit"}\n\n⚠️ WICHTIG: Ändere dein Passwort nach dem ersten Login und gib deine Zugangsdaten nicht weiter.\n\nViel Erfolg im Dienst! 👮🚔\nMission Row Police Department`;await navigator.clipboard.writeText(msg);alert("Zugangsnachricht kopiert.")});
 $("#addFieldReport")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target);const payload={recruit_id:sel.id,author_id:current.id,author_name:current.name,author_rank:current.rank||roleLabel(current),report_date:f.get("date"),duration_minutes:+f.get("duration")||0,topics:f.get("topics"),positive_points:f.get("positive"),improvement_points:f.get("improve"),next_steps:f.get("next")};const {data,error}=await sb.from("field_reports").insert(payload).select("id").single();if(error){alert(error.message);return}try{await v62NotifyFtos(sel,`Neue Praxisbewertung · ${sel.name}`,`Recruit: ${sel.name}\nEintrag: Praxis-/Ausbildungsfahrt\nErstellt von: ${current.rank||roleLabel(current)} ${current.name}\nDatum: ${f.get("date")||new Date().toLocaleDateString("de-DE")}\nDauer: ${f.get("duration")||0} Min.\nThemen: ${f.get("topics")||"—"}\nPositiv: ${f.get("positive")||"—"}\nVerbesserung: ${f.get("improve")||"—"}\nNächste Schritte: ${f.get("next")||"—"}\n\nÜber den Aktenanhang gelangst du direkt zu Praxis.`, "practice",data?.id)}catch(err){console.error(err);alert("Eintrag gespeichert, aber FTO-Nachricht fehlgeschlagen: "+err.message)}await refreshData();admin()});
 $("#addTrainingGoal")?.addEventListener("submit",async e=>{e.preventDefault();const text=$("#trainingGoalText").value.trim();if(!text)return;const {data,error}=await sb.from("training_goals").insert({recruit_id:sel.id,goal_text:text,author_id:current.id,author_name:current.name,author_rank:current.rank||roleLabel(current)}).select("id").single();if(error){alert("Ziel konnte nicht gespeichert werden: "+error.message);return}try{await v62NotifyFtos(sel,`Neues Ausbildungsziel · ${sel.name}`,`Recruit: ${sel.name}\nEintrag: Neues Ausbildungsziel\nErstellt von: ${current.rank||roleLabel(current)} ${current.name}\nZiel: ${text}\nStatus: Offen\n\nÜber den Aktenanhang gelangst du direkt zu Ziele.`,"goal",data?.id)}catch(err){console.error(err);alert("Eintrag gespeichert, aber FTO-Nachricht fehlgeschlagen: "+err.message)}await refreshData();admin()});
 document.querySelectorAll("[data-goal-toggle]").forEach(x=>x.onchange=async()=>{const {error}=await sb.from("training_goals").update({completed:x.checked,completed_at:x.checked?new Date().toISOString():null}).eq("id",x.dataset.goalToggle);if(error){alert(error.message);return}await refreshData();rerenderRecordKeepPosition()});
 document.querySelectorAll("[data-goal-delete]").forEach(b=>b.onclick=async()=>{if(!isOwner()||!confirm("Ausbildungsziel wirklich löschen?"))return;const {error}=await sb.from("training_goals").delete().eq("id",b.dataset.goalDelete);if(error){alert(error.message);return}await refreshData();admin()});
 $("#addRecruitNote")?.addEventListener("submit",async e=>{
  e.preventDefault();
  const text=$("#recruitNoteText").value.trim();
  if(!text){alert("Bitte einen Vermerk eintragen.");return}
  const {data,error}=await sb.from("recruit_notes").insert({recruit_id:sel.id,author_id:current.id,author_name:current.name,author_rank:current.rank||roleLabel(current),note_text:text}).select("id").single();
  if(error){alert("Vermerk konnte nicht gespeichert werden: "+error.message);return}
  try{await v62NotifyFtos(sel,`Neuer Aktenvermerk · ${sel.name}`,`Recruit: ${sel.name}\nEintrag: Ausbildungsvermerk\nErstellt von: ${current.rank||roleLabel(current)} ${current.name}\nVermerk: ${text}\n\nÜber den Aktenanhang gelangst du direkt zu Notizen.`,"note",data?.id)}catch(err){console.error(err);alert("Vermerk gespeichert, aber FTO-Nachricht fehlgeschlagen: "+err.message)}
  await refreshData();admin();
 });
 document.querySelectorAll("[data-delete-note]").forEach(b=>b.onclick=async()=>{
  if(!isOwner())return;
  if(!confirm("Vermerk wirklich löschen?"))return;
  const {error}=await sb.from("recruit_notes").delete().eq("id",b.dataset.deleteNote);
  if(error){alert(error.message);return}
  await refreshData();admin();
 });
 $("#v62RecordMessage")?.addEventListener("submit",async e=>{e.preventDefault();let f=new FormData(e.target);try{await v62SendMessage({recipientId:f.get("recipient"),subject:`Akte · ${sel.name}`,body:f.get("body").trim(),recruitId:sel.id,kind:"record_mail"});await refreshData();recordActiveTab="communication";admin();toast("✓ Aktennachricht gesendet")}catch(err){alert(err.message)}});
 document.querySelectorAll('.record-thread [data-read]').forEach(b=>b.onclick=async()=>{const y=window.scrollY;await sb.from("academy_messages").update({read_at:new Date().toISOString()}).eq("id",b.dataset.read).eq("recipient_id",current.id);await refreshData();recordActiveTab="communication";admin();requestAnimationFrame(()=>window.scrollTo(0,y))});
 document.querySelectorAll('.record-thread [data-reply]').forEach(b=>b.onclick=()=>v62Reply(b.dataset.reply));
 $("#resetRecruitPassword")?.addEventListener("click",async()=>{
  if(!isOwner())return;
  if(!confirm(`Passwort von ${sel.name} wirklich auf 123456 zurücksetzen?`))return;
  try{await invokeAccountAction({action:"reset_password",userId:sel.id});alert("Passwort wurde auf 123456 zurückgesetzt. Beim nächsten Login muss ein eigenes Passwort vergeben werden.");await refreshData();admin()}catch(err){alert("Passwort konnte nicht zurückgesetzt werden: "+err.message)}
 });
 $("#deleteRecruit")?.addEventListener("click",async()=>{
 if(!canCreateRecruit()){alert("Zum Archivieren ist Extra-Zugriff erforderlich.");return}
 if(confirm(sel.archivedAt?"Ausbildungsakte wiederherstellen?":"Ausbildungsakte unter Alte Rekruten archivieren? Alle Daten bleiben erhalten."))try{const {error}=await sb.rpc("apd_archive_recruit",{p_id:sel.id,p_archive:!sel.archivedAt});if(error)throw error;selectedRecruit=null;recruitRecordClosed=true;await refreshData();admin()}catch(err){alert(err.message)}
});
}
function v625FtoOptions(selectedId="",selectedName="",allowEmpty=false){
 const norm=v=>String(v||"").trim().toLowerCase(),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,staff=db.users.filter(u=>uuid.test(String(u.id||""))&&["admin","trainer"].includes(u.role)).slice().sort((a,b)=>v62RankLevel(b)-v62RankLevel(a)||String(a.name||"").localeCompare(String(b.name||""),"de"));
 let out=allowEmpty?`<option value="">— Kein weiterer FTO —</option>`:"";
 out+=staff.map(u=>{const label=`${u.rank||roleLabel(u)} · ${u.name}${u.serviceNo?` · #${u.serviceNo}`:""}`;const sel=(selectedId&&u.id===selectedId)||(!selectedId&&[u.name,u.username,`${u.rank||""} ${u.name}`].map(norm).includes(norm(selectedName)));return `<option value="${u.id}" ${sel?"selected":""}>${esc(label)}</option>`}).join("");return out;
}
function v627SelectedFto(id){const el=$(id),u=db.users.find(x=>x.id===el?.value);return {id:u?.id||null,name:u?.name||""}}

function adminRecruit(r){
 let p=progress(r);
 return `<div class="card">
  <div class="record-head"><div><div class="eyebrow">AUSBILDUNGSAKTE</div><h2>${esc(r.name)}</h2></div><button class="record-close-btn" id="closeRecruitRecord" type="button" title="Ausbildungsakte schließen">✕ Ausbildungsakte schließen</button></div>
  <p class="muted">${esc(r.serviceNo)} · ${esc(r.username)} · Ausbildungszeit <b>${fmtDuration(totalTrainingMinutes(r))}</b></p><div class="record-actions"><button class="secondary" id="printRecruitRecord" type="button">🖨️ Drucken</button><span class="readiness-pill ${readiness(r)[1]}">${readiness(r)[0]}</span></div>
  <div class="progress"><i style="width:${p}%"></i></div><p><b>${p}%</b> · ${r.completed.length}/22 Kapitel · ${stage(r)}</p>
  <div class="v640-record-meta">
   <div><small>Dienstnummer</small><b>${esc(r.serviceNo||"—")}</b></div><div><small>Rang</small><b>${esc(r.rank||"Recruit")}</b></div><div><small>Leiter FTO</small><b>${esc(r.fto||"—")}</b></div><div><small>Weiterer FTO</small><b>${esc(r.secondaryFto||"—")}</b></div><div><small>Status</small><b>${esc(r.status||"—")}</b></div>
  </div>
  <details class="v640-masterdata"><summary>⚙️ Stammdaten & FTO-Zuordnung bearbeiten <span>Verwaltung</span></summary><div class="v640-masterdata-body">
   <div class="grid account-grid">
    <label>Leiter FTO<select id="editFto">${v625FtoOptions(r.leaderFtoId,r.fto,false)}</select></label>
    <label>Weiterer FTO<select id="editSecondaryFto">${v625FtoOptions(r.secondaryFtoId,r.secondaryFto||"",true)}</select></label>
    <label>Status<select id="editStatus"><option ${r.status==="In Ausbildung"?"selected":""}>In Ausbildung</option><option ${r.status==="Pausiert"?"selected":""}>Pausiert</option><option ${r.status==="Streifenfreigabe"?"selected":""}>Streifenfreigabe</option><option ${r.status==="Ausbildung abgeschlossen"?"selected":""}>Ausbildung abgeschlossen</option><option ${r.status==="Archiviert"?"selected":""}>Archiviert</option></select></label>
    <label>Rang<input id="editRank" value="${esc(r.rank)}"></label>
   </div>
   <div class="v640-admin-actions"><button class="primary" id="saveRecruit">Stammdaten speichern</button><button class="secondary" id="copyAccess">📋 Zugangsdaten kopieren</button><button class="secondary" id="v630FtoHandover">🔄 FTO-Übergabe senden</button></div>
  </div></details>
  <div class="record-tabs v640-record-tabs"><button class="active" data-record-jump="overview">Übersicht</button><button data-record-jump="chapters">Ausbildung</button><button data-record-jump="practice">Praxis</button><button data-record-jump="tests">Tests</button><button data-record-jump="goals">Ziele</button><button data-record-jump="history">Dienstbuch</button><button data-record-jump="notes">Notizen</button></div><section class="record-tab-panel" data-record-panel="overview">
   <div class="v640-section-title"><div><div class="eyebrow">AKTENÜBERSICHT</div><h3>Ausbildungsstand auf einen Blick</h3></div><span class="readiness-pill ${readiness(r)[1]}">${readiness(r)[0]}</span></div>
   <div class="record-overview-grid v640-kpis"><div class="record-kpi"><small>Fortschritt</small><b>${p}%</b><span>${r.completed.length}/22 Kapitel</span></div><div class="record-kpi"><small>Aktuelle Phase</small><b>${stage(r)}</b><span>Freigegeben bis Phase ${r.unlockedPhase||1}</span></div><div class="record-kpi"><small>Ausbildungszeit</small><b>${fmtDuration(totalTrainingMinutes(r))}</b><span>Dokumentierte Praxis</span></div><div class="record-kpi"><small>Offene Ziele</small><b>${(r.goals||[]).filter(g=>!g.done).length}</b><span>${(r.goals||[]).filter(g=>g.done).length} erledigt</span></div></div>
   <div class="v640-overview-columns"><div class="card inner-card v640-next"><div class="eyebrow">➡️ NÄCHSTER SCHRITT</div><h3>${p===100?"Abschluss prüfen":(r.goals||[]).some(g=>!g.done)?"Offene Ausbildungsziele bearbeiten":"Ausbildung fortsetzen"}</h3><p class="muted">${p===100?"Alle Kapitel sind abgeschlossen. Prüfe Tests, Freigaben und Abschlussvoraussetzungen.":(r.goals||[]).some(g=>!g.done)?`${(r.goals||[]).filter(g=>!g.done).length} offene Ziele sind aktuell hinterlegt.`:`Weiter mit den noch offenen Kapiteln und der aktuellen Ausbildungsphase.`}</p><button class="secondary" type="button" data-record-jump="${p===100?"tests":(r.goals||[]).some(g=>!g.done)?"goals":"chapters"}">Bereich öffnen →</button></div><div class="card inner-card"><div class="eyebrow">👮 ZUSTÄNDIGKEIT</div><h3>FTO-Team</h3><div class="v640-fto-lines"><p><span>Leiter FTO</span><b>${esc(r.fto||"—")}</b></p><p><span>Weiterer FTO</span><b>${esc(r.secondaryFto||"—")}</b></p><p><span>Status</span><b>${esc(r.status||"—")}</b></p></div></div></div>
   <details class="v640-graduation"><summary>🎓 Abschlussbereitschaft & Voraussetzungen anzeigen</summary><div>${graduationChecklist(r)}</div></details>
  </section><section class="record-tab-panel" data-record-panel="chapters"><div id="record-chapters"></div>
  
  <div class="card inner-card apd-fto-permissions"><div class="eyebrow">🔐 KAPITELFREIGABEN</div><h3>Kapitel für diesen Rekruten freischalten</h3><p class="muted">Nur Ausbilder und höher. Jede Freigabe wird zentral gespeichert und protokolliert.</p><div class="apd-unlock-grid">${titles.map(x=>`<button type="button" class="apd-unlock ${r.unlockedChapters.includes(x.n)?"is-open":""}" data-unlock="${x.n}" aria-pressed="${r.unlockedChapters.includes(x.n)?"true":"false"}" aria-label="Kapitel ${chapterNumber(x.n)}: ${esc(x.title)} – ${r.unlockedChapters.includes(x.n)?"freigegeben":"gesperrt"}"><span class="apd-unlock-icon" aria-hidden="true">${r.unlockedChapters.includes(x.n)?"🔓":"🔒"}</span><span class="apd-unlock-body"><span class="apd-unlock-name"><em>${String(chapterNumber(x.n)).padStart(2,"0")}</em> ${esc(x.title)}</span><small><span class="apd-state-dot"></span>${r.unlockedChapters.includes(x.n)?"Freigegeben":"Gesperrt"}</small></span><span class="apd-unlock-arrow" aria-hidden="true">›</span></button>`).join("")}</div></div>
  <div class="card inner-card apd-fto-rating"><div class="eyebrow">⭐ AUSBILDUNGSBEWERTUNGEN</div><h3>FTO-Bewertung erfassen</h3><form id="apdRatingForm" class="apd-rating-form"><label>Funk<select name="funk">${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===3?"selected":""}>${n} / 5</option>`).join("")}</select></label><label>Streifendienst<select name="streife">${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===3?"selected":""}>${n} / 5</option>`).join("")}</select></label><label>Bürgerkontakt<select name="buerger">${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===3?"selected":""}>${n} / 5</option>`).join("")}</select></label><label>Verhalten<select name="verhalten">${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===3?"selected":""}>${n} / 5</option>`).join("")}</select></label><label class="apd-wide">Bemerkung<textarea name="note" maxlength="1000" placeholder="Beobachtungen und nächste Schritte"></textarea></label><button class="primary">Bewertung speichern</button></form><div class="apd-rating-list">${(r.ratings||[]).map(x=>`<p>⭐ ${esc(new Date(x.created_at).toLocaleDateString("de-DE"))} · Funk ${x.funk}/5 · Streife ${x.streife}/5 · Bürgerkontakt ${x.buerger}/5 · Verhalten ${x.verhalten}/5<br><small>${esc(x.note||"")}</small></p>`).join("")||"Noch keine Bewertungen."}</div></div>
  <div class="v640-section-title"><div><div class="eyebrow">📚 AUSBILDUNG</div><h3>Kapitel nach Ausbildungsphasen</h3></div><span>${r.completed.length}/22 abgeschlossen</span></div>
  <div class="v640-phase-groups">${CHAPTER_CATEGORIES.map(ph=>{const pts=titles.filter(x=>chapterCategory(x.n).n===ph.n),done=pts.filter(x=>r.completed.includes(x.n)).length;return `<details class="v640-phase-group" ${(+r.unlockedPhase||1)===ph.n?"open":""}><summary><div><b>Phase ${ph.n} · ${esc(ph.name)}</b><small>Kapitel ${ph.from}–${ph.to}</small></div><span>${done}/${pts.length} ✓</span></summary><div class="chapter-checks chapter-category-grid">${pts.map(x=>`<label class="check chapter-category-card" style="--chapter-bg:url(\'${chapterCardImages[x.n]}\')"><input type="checkbox" data-check="${x.n}" ${r.completed.includes(x.n)?"checked":""}><span><b>${chapterNumber(x.n)}.</b> ${esc(x.title)}</span></label>`).join("")}</div></details>`}).join("")}</div>
  </section><section class="record-tab-panel" data-record-panel="tests"><div id="record-tests"></div><h3>Tests zuweisen</h3>
  <p class="muted">Freigegebene Tests erscheinen beim Recruit unter „Tests“.</p>
  <div class="chapter-checks">${TESTS.map(t=>`<label class="check"><input type="checkbox" data-test-assign="${t.id}" ${(r.assignedTests||[]).includes(t.id)?"checked":""}><span><b>${esc(t.title)}</b><small>${esc(t.desc)}</small></span></label>`).join("")}</div>
  <h3 style="margin-top:22px">Test-Mappe</h3>
  <div>${(r.testResults||[]).length?r.testResults.slice().reverse().map(res=>{let t=TESTS.find(x=>x.id===res.testId);return `<div class="test-result-row"><div><b>${esc(t?.title||res.testId)}</b><small>${esc(res.date||"")} · ${res.score}/${res.total} Punkte · ${res.percent}%</small></div><span class="test-state ${res.passed?"passed":"failed"}">${res.passed?"BESTANDEN":"NICHT BESTANDEN"}</span></div>`}).join(""):"<p class='muted'>Noch keine abgeschlossenen Tests.</p>"}</div>
  </section><section class="record-tab-panel" data-record-panel="goals"><div id="record-goals"></div><div class="record-grid"><div class="card inner-card"><div class="eyebrow">🏅 QUALIFIKATIONEN</div><h3>Freigaben</h3>${qualificationHtml(r)}</div><div class="card inner-card"><div class="eyebrow">🎯 AUSBILDUNGSZIELE</div><h3>Offene Ziele</h3><form id="addTrainingGoal" class="goal-form"><input id="trainingGoalText" maxlength="300" required placeholder="z. B. Funkdisziplin im Einsatz verbessern"><button class="primary" type="submit">Ziel hinzufügen</button></form><div class="goal-list">${(r.goals||[]).filter(g=>!g.done).length?(r.goals||[]).filter(g=>!g.done).map(g=>`<div class="goal-admin"><label><input type="checkbox" data-goal-toggle="${g.id}"><span>${esc(g.text)}<small class="entry-author">Erstellt von ${esc(g.authorRank||"")} ${esc(g.authorName||"Ausbilder")}</small></span></label>${isOwner()?`<button data-goal-delete="${g.id}" class="note-delete">Löschen</button>`:""}</div>`).join(""):"<p class='muted'>✓ Keine offenen Ziele.</p>"}${(r.goals||[]).some(g=>g.done)?`<details class="v640-completed"><summary>✓ Erledigte Ziele (${(r.goals||[]).filter(g=>g.done).length})</summary><div>${(r.goals||[]).filter(g=>g.done).map(g=>`<div class="goal-admin done"><label><input type="checkbox" data-goal-toggle="${g.id}" checked><span>${esc(g.text)}<small class="entry-author">Erstellt von ${esc(g.authorRank||"")} ${esc(g.authorName||"Ausbilder")}</small></span></label>${isOwner()?`<button data-goal-delete="${g.id}" class="note-delete">Löschen</button>`:""}</div>`).join("")}</div></details>`:""}</div></div></div>
  </section><section class="record-tab-panel" data-record-panel="history"><div id="record-history"></div><div class="card inner-card activity-card"><div class="eyebrow">AKTIVITÄTSVERLAUF</div><h3>Ausbildungsakte · Verlauf</h3>${timelineHtml(r,12)}</div>
  </section><section class="record-tab-panel" data-record-panel="practice"><div id="record-practice"></div><div class="card inner-card"><div class="eyebrow">🚓 FTO-SCHICHTBERICHT</div><h3>Ausbildungsfahrten</h3><form id="addFieldReport" class="form-grid"><label>Datum<input name="date" type="date" value="${new Date().toISOString().slice(0,10)}" required></label><label>Dauer (Min.)<input name="duration" type="number" min="0" value="60"></label><label>Themen<input name="topics" required placeholder="Funk, Verkehrskontrolle …"></label><label>Positive Punkte<input name="positive" placeholder="Was lief gut?"></label><label>Verbesserungsbedarf<input name="improve" placeholder="Was wird weiter geübt?"></label><label>Nächste Schritte<input name="next" placeholder="Nächstes Ausbildungsziel"></label><button class="primary">Bericht speichern</button></form><div>${(r.reports||[]).slice().reverse().map(x=>`<article class="field-report"><b>${esc(x.date)} · ${esc(x.authorRank||"")} ${esc(x.author)}</b><small>${x.duration} Min.</small><p><strong>Themen:</strong> ${esc(x.topics)}</p><p><strong>Positiv:</strong> ${esc(x.positive||"—")}</p><p><strong>Verbesserung:</strong> ${esc(x.improve||"—")}</p><p><strong>Nächste Schritte:</strong> ${esc(x.next||"—")}</p></article>`).join("")||"<p class='muted'>Noch keine Ausbildungsfahrten dokumentiert.</p>"}</div></div>
  <div class="card inner-card graduation-card"><div class="eyebrow">🎓 ABSCHLUSS-CHECK</div><h3>Voraussetzungen</h3>${graduationChecklist(r)}</div></section><section class="record-tab-panel" data-record-panel="notes"><div id="record-notes"></div><div class="notes-admin-section"><div class="section-head compact"><div><div class="eyebrow">📝 AUSBILDUNGSVERMERKE</div><h3>Vermerke für ${esc(r.name)}</h3></div><span class="note-count">${(r.notes||[]).length}</span></div><form id="addRecruitNote" class="note-form"><textarea id="recruitNoteText" maxlength="1200" required placeholder="z. B. Gute Streifenfahrt, sichere Kommunikation und saubere Maßnahmenbegründung."></textarea><button class="primary" type="submit">➕ Vermerk hinzufügen</button></form><div class="note-list">${(r.notes||[]).length?r.notes.slice().reverse().map(n=>`<article class="note-entry"><div class="note-meta"><b>${esc(n.authorRank||"Ausbilder")} ${esc(n.authorName||"")}</b><span>${esc(n.date)}</span></div><p>${esc(n.text)}</p>${isOwner()?`<button class="note-delete" data-delete-note="${n.id}">Vermerk löschen</button>`:""}</article>`).join(""):`<div class="empty-note">Noch keine Vermerke vorhanden.</div>`}</div></div>
  </section><section class="record-tab-panel" data-record-panel="communication"><div class="card inner-card"><div class="eyebrow">💬 FTO-KOMMUNIKATION</div><h3>Interne Unterhaltung zu ${esc(r.name)}</h3><p class="muted">Nur für Ausbilder/Command. Nachrichten werden im Postfach gespeichert und können beantwortet bzw. als gelesen markiert werden.</p><form id="v62RecordMessage" class="note-form"><select name="recipient" required><option value="">Empfänger auswählen…</option>${v62AssignedFtos(r).filter(u=>u.id!==current.id).map(u=>`<option value="${u.id}">${String(r.fto||"").toLowerCase().includes(String(u.name||"").toLowerCase())?"Leiter FTO":"Weiterer FTO"} · ${esc(u.rank||"")} ${esc(u.name)}</option>`).join("")}${db.users.filter(u=>["trainer","admin"].includes(u.role)&&u.id!==current.id&&!v62AssignedFtos(r).some(f=>f.id===u.id)).map(u=>`<option value="${u.id}">${esc(u.rank||"")} ${esc(u.name)}</option>`).join("")}</select><textarea name="body" maxlength="3000" required placeholder="Nachricht zur Ausbildungsakte…"></textarea><button class="primary">Nachricht senden</button></form><div class="record-thread">${(db.messages||[]).filter(x=>x.recruit_id===r.id).slice(0,30).map(x=>`<article class="thread-msg ${x.recipient_id===current.id&&!x.read_at?'unread':''}"><div><b>${esc(v62UserLabel(x.sender_id))}</b><small>${new Date(x.created_at).toLocaleString("de-DE")}</small></div><p>${esc(x.body)}</p><div class="mail-actions">${x.recipient_id===current.id&&!x.read_at?`<button data-read="${x.id}">✓ Gelesen</button>`:""}<button data-reply="${x.id}">↩ Antworten</button></div></article>`).join("")||`<p class="muted">Noch keine Aktenkommunikation.</p>`}</div></div>
  </section>${isOwner()?`<button id="resetRecruitPassword" class="secondary" style="margin-top:18px">🔑 Passwort auf 123456 zurücksetzen</button>`:""}
  <button id="deleteRecruit" style="margin-top:18px;background:transparent;color:#ff7c87;border:1px solid #66333b;border-radius:8px;padding:9px 12px;cursor:pointer">${r.archivedAt?"Akte wiederherstellen":"In Alte Rekruten archivieren"}</button>
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
function startTestLegacy(id){
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
 $("#content").innerHTML=`<div class="section-head"><div><div class="eyebrow">DEPARTMENT NEWS</div><h1>📢 Mitteilungen</h1></div>${isOwner()?'<button class="primary" id="newAnnouncement">+ Mitteilung</button>':''}</div><div id="newsList">${(news||[]).map(n=>`<article data-announcement="${esc(n.id)}" class="card news-card ${n.pinned?'pinned':''}"><div class="eyebrow">${n.pinned?'📌 ANGEHEFTET':'MITTEILUNG'} · ${new Date(n.created_at).toLocaleDateString('de-DE')}</div><h2>${esc(n.title)}</h2><p>${esc(n.body)}</p><small>${esc(n.author_name||'MRPD')}</small>${!read.has(n.id)?`<button class="secondary" data-read-news="${n.id}">✓ Als gelesen bestätigen</button>`:'<span class="read-badge">✓ Gelesen</span>'}</article>`).join('')||'<div class="card"><p class="muted">Keine Mitteilungen.</p></div>'}</div>`;
 document.querySelectorAll('[data-read-news]').forEach(b=>b.onclick=async()=>{const {error}=await sb.from('announcement_reads').upsert({announcement_id:b.dataset.readNews,user_id:current.id},{onConflict:'announcement_id,user_id'});if(error){toast("⚠ "+error.message);return}newsView()});
 $("#newAnnouncement")?.addEventListener('click',async()=>{const title=prompt('Titel der Mitteilung:');if(!title)return;const body=prompt('Text der Mitteilung:');if(!body)return;const pinned=confirm('Mitteilung oben anheften?');const {error}=await sb.from('announcements').insert({title,body,pinned,author_id:current.id,author_name:current.name});if(error)alert(error.message);else newsView()});
}
function documentsView(){setActive('[data-view="documents"]');$("#pageTitle").textContent="Dokumente";$("#content").innerHTML=`<div class="section-head"><div><div class="eyebrow">INTERNER BEREICH</div><h1>📂 Dokumente & Schnellzugriff</h1></div></div><div class="grid chapter-grid"><div class="card"><h2>⭐ Favoriten</h2>${(current.favorites||[]).length?(current.favorites||[]).map(n=>`<button class="doc-link" data-doc-chapter="${n}">Kapitel ${chapterNumber(n)} · ${esc(CHAPTERS[n]?.title||'')}</button>`).join(''):'<p class="muted">Noch keine Favoriten. In einem Kapitel kannst du ☆ Als Favorit wählen.</p>'}</div><div class="card"><h2>🕘 Zuletzt angesehen</h2>${localStorage.getItem('alta_last_chapter')?`<button class="doc-link" data-doc-chapter="${localStorage.getItem('alta_last_chapter')}">Kapitel ${chapterNumber(localStorage.getItem('alta_last_chapter'))} · ${esc(CHAPTERS[localStorage.getItem('alta_last_chapter')]?.title||'')}</button>`:'<p class="muted">Noch kein Kapitel angesehen.</p>'}</div><div class="card"><h2>📚 Rekrutenhandbuch</h2><p>Alle 22 Kapitel sind über die Navigation erreichbar. Favorisiere häufig benötigte Inhalte für den Schnellzugriff.</p></div><div class="card"><h2>🖨️ Ausbildungsakte</h2><p>Unter „Mein Account“ kannst du deine aktuelle Ausbildungsübersicht drucken oder als PDF speichern.</p></div></div>`;document.querySelectorAll('[data-doc-chapter]').forEach(b=>b.onclick=()=>showChapter(+b.dataset.docChapter))}

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
  box.innerHTML=hits.length?hits.map(x=>`<div class="search-item" data-result="${x.n}"><b>Kapitel ${chapterNumber(x.n)}: ${esc(x.title)}</b><small>Inhalt im Handbuch gefunden</small></div>`).join(""):`<div class="search-item"><b>Keine Treffer</b><small>Versuche einen anderen Suchbegriff.</small></div>`;
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
 try{const {error:loginStampError}=await sb.rpc('touch_last_login');if(loginStampError)console.warn('Loginzeit konnte nicht erfasst werden');await refreshData()}catch(err){await sb.auth.signOut();$("#loginError").textContent="Portal-Profil konnte nicht geladen werden.";return}
 $("#loginView").classList.add("hidden");$("#app").classList.remove("hidden");
 $("#topName").textContent=current.name;$("#topRole").textContent=roleLabel(current);
 nav();setupSearch();setupMobileMenu();setupTopAccountLink();
 if(current.mustChangePassword){account()}
 else{
  try{sessionStorage.setItem("alta_pd_last_page_v613","#dashboard");history.replaceState({apdPortal:true,v632:true,route:"dashboard"},"","#dashboard")}catch{}
  dashboard();
 }
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
  nav();setupSearch();setupMobileMenu();
  if(current.mustChangePassword){account()}
  else if(location.hash && location.hash!=="#account"){restorePortalRoute()}
  else{try{history.replaceState({apdPortal:true,v632:true,route:"dashboard"},"","#dashboard")}catch{}dashboard()}
 }catch(err){console.error(err);await sb.auth.signOut()}
})();

