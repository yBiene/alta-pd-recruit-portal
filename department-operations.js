/* Manual Department workflows. Uses authenticated records shared through Supabase. */
(() => {
 'use strict';
 const hub=window.APD_HUB;
 const people=()=>hub.state.people;
 const who=id=>people().find(p=>p.id===id)?.name||'Ehemaliger Mitarbeiter';
 const date=v=>v?new Date(v).toLocaleString('de-DE',{dateStyle:'medium',timeStyle:'short'}):'—';
 const states={draft:'Entwurf',submitted:'Eingereicht',reviewed:'Unit-Freigabe',approved:'Freigegeben',rejected:'Zur Nacharbeit',active:'Aktiv',closed:'Abgeschlossen'};
 const groups={personnel:'Personal',fleet:'Fuhrpark',equipment:'Ausrüstung',records:'Vorgänge',special:'Spezialunits'};
 const modules={
  absence:{title:'Abwesenheiten',group:'personnel',flow:true,subject:true,fields:[['from','Von','date',true],['to','Bis','date',true]]},
  application:{title:'Bewerbungen',group:'personnel',flow:true,subject:true,fields:[['experience','Erfahrung','textarea'],['interview','Gesprächstermin','datetime-local']]},
  transfer:{title:'Unit-Wechsel',group:'personnel',flow:true,subject:true,fields:[['from_unit','Bisherige Unit','unit'],['interview','Gesprächstermin','datetime-local']]},
  promotion:{title:'Beförderungsvorschläge',group:'personnel',flow:true,subject:true,fields:[['rank','Zieldienstgrad','rank',true]]},
  promotion_rule:{title:'Beförderungsvoraussetzungen',group:'personnel',manage:true,fields:[['rank','Zieldienstgrad','rank',true],['days','Mindesttage im aktuellen Dienstgrad','number'],['qualifications','Erforderliche Qualifikationen · ein Titel pro Zeile','textarea']]},
  commendation:{title:'Lob & besondere Leistungen',group:'personnel',flow:true,subject:true,fields:[['award','Vorgeschlagene Auszeichnung','text']]},
  discipline:{title:'Disziplinarvorgänge',group:'personnel',flow:true,private:true,manage:true,subject:true,fields:[['measure','Maßnahme','text'],['expires','Ablaufdatum','date']]},
  ia:{title:'Interne Beschwerden',group:'personnel',flow:true,private:true,subject:true,fields:[['incident_at','Vorfallzeit','datetime-local'],['place','Ort','text']]},
  skill:{title:'Rufnamen & Funktionen',group:'personnel',manage:true,subject:true,fields:[['category','Art','category'],['callsign','Rufname / Kennung','text']]},
  shift:{title:'Dienstzeiten',group:'personnel',clock:true,fields:[]},
  vehicle:{title:'Fahrzeugakten',group:'fleet',manage:true,fields:[['plate','Kennzeichen','text',true],['number','Fahrzeugkennung','text'],['model','Modell','text'],['availability','Verfügbarkeit','availability'],['livery','Lackierung / Ausführung','text']]},
  damage:{title:'Schadensmeldungen',group:'fleet',fields:[['asset_id','Fahrzeug','vehicle',true],['incident_at','Zeitpunkt','datetime-local'],['place','Ort','text'],['repair','Reparatur / Freigabevermerk','textarea']]},
  inspection:{title:'Fahrzeugübernahme & Prüfung',group:'fleet',fields:[['asset_id','Fahrzeug','vehicle',true],['fuel','Tankstand','text'],['equipment','Ausstattung geprüft','text'],['condition','Zustand bei Übernahme','textarea'],['returned_at','Rückgabezeit','datetime-local']]},
  impound:{title:'Beschlagnahmte Fahrzeuge',group:'fleet',fields:[['plate','Kennzeichen','text',true],['place','Abstellort','text',true],['reason','Grund','text'],['release','Herausgabevermerk','textarea'],['evidence_id','Zellenakten-ID (optional)','text']]},
  uniform:{title:'Uniformkatalog',group:'equipment',manage:true,fields:[['rank','Freigabe ab Dienstgrad','rank'],['outfit','Bestandteile / Kennungen','textarea']]},
  equipment:{title:'Ausrüstungsverzeichnis',group:'equipment',manage:true,fields:[['serial','Serien- / Inventarnummer','text'],['availability','Verfügbarkeit','availability'],['condition','Zustand','textarea']]},
  checkout:{title:'Ausgabe & Rückgabe',group:'equipment',flow:true,subject:true,fields:[['asset_id','Fahrzeug oder Ausrüstung','asset',true],['until','Geplante Rückgabe','date'],['condition','Zustand / Übergabe','textarea']]},
  replacement:{title:'Verlust & Ersatz',group:'equipment',flow:true,fields:[['asset_id','Betroffener Gegenstand','asset'],['incident_at','Zeitpunkt','datetime-local'],['replacement','Benötigter Ersatz','textarea']]},
  report:{title:'Berichte & Freigaben',group:'records',flow:true,fields:[['report_type','Berichtsart','report_type'],['incident_at','Vorfallzeit','datetime-local'],['place','Ort','text'],['unit_case','Verknüpfte Unit-Akte','unit_case'],['evidence_id','Zellenakten-ID (optional)','text']]},
  person:{title:'Personenregister',group:'records',fields:[['birth','Geburtsdatum','date'],['phone','Telefon','text'],['address','Anschrift','text']]},
  bolo:{title:'Fahndungsübersicht',group:'records',fields:[['target','Person / Fahrzeug','text',true],['plate','Kennzeichen','text'],['last_seen','Letzter bekannter Ort','text'],['expires','Gültig bis','date'],['unit_case','Verknüpfte Unit-Akte','unit_case']]},
  request:{title:'Anträge & Freigaben',group:'records',flow:true,fields:[['request_type','Antragsart','text'],['until','Benötigt bis','date']]},
  renewal:{title:'Nachschulung & Verlängerung',group:'personnel',flow:true,subject:true,fields:[['qualification','Qualifikation','text',true],['appointment','Gewünschter Termin','datetime-local']]},
  k9:{title:'Diensthundeakten',group:'special',subject:true,fields:[['dog','Name / Kennung des Hundes','text',true],['training','Trainingsstand','textarea'],['incident_at','Letzter Einsatz / Training','datetime-local']]},
  flight:{title:'Flugprotokolle',group:'special',fields:[['asset_id','Luftfahrzeug','vehicle'],['started','Start','datetime-local',true],['ended','Landung','datetime-local'],['pilot','Pilot / Besatzung','text'],['route','Route / Auftrag','textarea'],['technical','Technische Meldung','textarea']]},
  traffic:{title:'Kontrollen & Unfallnachbesprechung',group:'special',fields:[['incident_at','Zeitpunkt','datetime-local'],['place','Ort','text'],['plate','Kennzeichen','text'],['result','Ergebnis / Nachbesprechung','textarea'],['unit_case','Verknüpfte Unit-Akte','unit_case']]}
 };
 const options={availability:{available:'Verfügbar',repair:'In Reparatur',retired:'Außer Dienst'},category:{callsign:'Rufname',function:'Zusatzfunktion'},report_type:{incident:'Einsatzbericht',arrest:'Festnahmebericht',interview:'Befragung',debrief:'Nachbesprechung'}};
 const result=async q=>{const {data,error}=await q;if(error)throw error;return data;};
 const rpc=(action,id=null,revision=0,data={})=>result(sb.rpc('mrpd_ops_command',{p_action:action,p_id:id,p_revision:revision,p_data:data}));
 const active=()=>current&&!current.mustChangePassword;
 const canManage=unit=>hub.plus(current)||(unit&&window.MRPDUnits.canManage(unit));
 const editable=row=>hub.plus(current)||(!modules[row.kind].private&&canManage(window.MRPDUnits.units().find(u=>u.id===row.unit_id)))||(row.author_id===current.id&&['draft','active','rejected'].includes(row.status)&&!modules[row.kind].manage&&!modules[row.kind].clock);
 const button=(label,fn,cls='secondary')=>{const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=label;b.onclick=async event=>{try{await fn(event);}catch(e){alert(e.message||'Aktion fehlgeschlagen. Bitte erneut versuchen.');}};return b;};
 let scope=null,routeToken=0,alerts=[],alertUser=null,alertTimer,restoredUser=null;
 function error(host,e){console.error('Department Vorgang',e);if(host?.isConnected)host.textContent=e.message||'Vorgang konnte nicht geladen werden.';}
 function dialog(title,html){
  const d=document.createElement('dialog');d.className='hub-dialog ops-dialog';d.innerHTML=`<header><h2>${esc(title)}</h2><button type="button" aria-label="Schließen">×</button></header><div class="ops-dialog-body">${html}</div>`;
  d.querySelector('header button').onclick=()=>d.close();d.onclose=()=>d.remove();document.body.append(d);d.showModal();return d;
 }
 function bind(form,fn){
  form.onsubmit=async e=>{e.preventDefault();if(!form.reportValidity())return;const b=e.submitter,status=form.querySelector('[role=status]');b.disabled=true;status.textContent='';try{await fn(new FormData(form));window.APD_UX?.clean(form);}catch(err){error(status,err);}finally{b.disabled=false;}};
 }
 const applicable=(key,unit)=>{
  if(!unit||unit.workspace_kind==='general')return true;
  if(modules[key].group==='personnel'||modules[key].group==='equipment'||modules[key].group==='records')return true;
  if(key==='k9')return /k9|hund/i.test(unit.name);
  if(key==='flight')return /air|luft|flug/i.test(unit.name);
  if(key==='traffic')return ['patrol','sheriff','custom'].includes(unit.workspace_kind);
  return true;
 };
 async function render(host,unit=null,selected=null){
  if(!active())return;
  const uid=current.id,token=++routeToken,viewGeneration=hub.state.generation;scope={host,unit,selected:selected||'absence'};
  await window.MRPDUnits.load();if(!host.isConnected||uid!==current?.id||token!==routeToken||hub.state.generation!==viewGeneration)return;
  host.innerHTML=`<section class="ops-head"><div><p class="eyebrow">MRPD / DIENSTBETRIEB</p><h2>${unit?esc(unit.name)+' · Dienstbetrieb':'Personal, Dienstbetrieb & Vorgänge'}</h2></div><div class="ops-clock"></div></section><div class="ops-layout"><nav class="ops-modules" aria-label="Dienstbetrieb-Bereiche"></nav><section class="ops-work" aria-live="polite"></section></div>`;
  const nav=host.querySelector('.ops-modules');
  for(const [group,label]of Object.entries(groups)){
   const keys=Object.keys(modules).filter(key=>modules[key].group===group&&applicable(key,unit));if(!keys.length)continue;
   const details=document.createElement('details');details.open=keys.includes(scope.selected);details.innerHTML=`<summary>${label}</summary>`;
   keys.forEach(key=>{const b=button(modules[key].title,()=>showModule(key),'ops-module');b.dataset.opsKind=key;details.append(b);});nav.append(details);
  }
  const clock=host.querySelector('.ops-clock');
  const drawClock=async()=>{
   try{
    const rows=await result(sb.from('mrpd_ops_records').select('*').eq('kind','shift').eq('author_id',uid).eq('status','active').limit(1));
    if(!clock.isConnected||uid!==current?.id)return;clock.replaceChildren();
    if(rows.length)clock.append(button('Dienst beenden · seit '+date(rows[0].fields.started_at),async()=>{await rpc('transition',rows[0].id,rows[0].revision,{status:'closed'});await drawClock();if(scope?.selected==='shift')showModule('shift');}));
    else clock.append(button('Dienst beginnen',async()=>{await rpc('clock_in',null,0,{unit_id:unit?.id||null});await drawClock();if(scope?.selected==='shift')showModule('shift');},'primary'));
   }catch(e){error(clock,e);}
  };
  async function showModule(key){
   if(!host.isConnected||uid!==current?.id)return;
   scope.selected=key;
   nav.querySelectorAll('[data-ops-kind]').forEach(b=>b.setAttribute('aria-current',b.dataset.opsKind===key?'page':'false'));
   nav.querySelector(`[data-ops-kind="${key}"]`)?.closest('details')?.setAttribute('open','');
   await list(host.querySelector('.ops-work'),unit,key,token);
  }
  await Promise.all([drawClock(),showModule(scope.selected)]);
 }
 async function list(host,unit,key,token){
  const config=modules[key];
  host.innerHTML=`<div class="unit-section-head"><h2>${esc(config.title)}</h2><div data-create></div></div>${config.private?'<p class="ops-private">Geschützter Vorgang · Zugriff für beteiligte Accounts und Portalverwaltung.</p>':''}<div class="unit-filters"><label>Titel durchsuchen<input type="search" data-search></label><label>Status<select data-status><option value="">Alle Status</option>${Object.entries(states).map(([v,label])=>`<option value="${v}">${label}</option>`).join('')}</select></label><label>Ansicht<select data-archive><option value="false">Aktuell</option><option value="true">Archiv</option></select></label></div><div class="ops-summary"></div><div class="unit-entry-list"></div><div class="unit-pagination"></div>`;
  if(!config.clock&&(!config.manage||canManage(unit))&&(key!=='discipline'||hub.plus(current)))host.querySelector('[data-create]').append(button('Erstellen',()=>editor(key,unit),'primary'));
  let page=0,request=0,debounce;
  const output=host.querySelector('.unit-entry-list'),pagination=host.querySelector('.unit-pagination'),search=host.querySelector('[data-search]'),filter=host.querySelector('[data-status]'),archive=host.querySelector('[data-archive]');
  const reset=()=>{page=0;draw();};search.oninput=()=>{clearTimeout(debounce);debounce=setTimeout(reset,180);};filter.onchange=archive.onchange=reset;
  async function draw(){
   const ticket=++request;output.textContent='Vorgänge werden geladen …';pagination.replaceChildren();
   try{
    let query=sb.from('mrpd_ops_records').select('*').eq('kind',key).eq('archived',archive.value==='true');
    if(unit)query=query.eq('unit_id',unit.id);
    if(filter.value)query=query.eq('status',filter.value);
    if(search.value.trim())query=query.ilike('title','%'+search.value.trim().replace(/[%_\\]/g,c=>'\\'+c)+'%');
    const rows=await result(query.order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*30,page*30+30));
    if(!host.isConnected||ticket!==request||token!==routeToken)return;
    output.replaceChildren();
    if(!rows.length)output.textContent='Keine passenden Vorgänge.';
    rows.slice(0,30).forEach(row=>{
     const card=document.createElement('article');card.className='unit-entry';
     let summary=row.body.slice(0,160);
     if(key==='shift')summary=date(row.fields.started_at)+' – '+(row.fields.ended_at?date(row.fields.ended_at):'läuft')+(row.fields.seconds?' · '+(row.fields.seconds/3600).toFixed(2)+' Std.':'');
     if(key==='absence')summary=(row.fields.from||'')+' bis '+(row.fields.to||'')+' · '+summary;
     card.innerHTML=`<div><small>${esc(states[row.status])}${row.applied_at?' · Übernommen':''}</small><h3>${esc(row.title)}</h3><p>${esc(summary)}</p><div class="unit-entry-meta"><span>${esc(who(row.subject_id||row.author_id))}</span><time>${esc(date(row.created_at))}</time></div></div>`;
     card.append(button('Öffnen',()=>detail(row.id)));output.append(card);
    });
    if(page>0)pagination.append(button('← Zurück',()=>{page--;draw();}));
    if(rows.length>30)pagination.append(button('Weitere Vorgänge →',()=>{page++;draw();}));
    const summary=host.querySelector('.ops-summary');summary.replaceChildren();
    if(key==='absence')summary.append(button('Abwesenheitskalender',()=>absenceCalendar(unit)));
    if(key==='shift')summary.append(button('Monatsübersicht & CSV',()=>shiftSummary(unit)));
   }catch(e){if(ticket===request)error(output,e);}
  }
  await draw();
 }
 async function editor(key,unit=null,row=null,defaults={}){
  const actor=current.id,config=modules[key],id=row?.id||crypto.randomUUID();
  if(row&&!editable(row))return;
  const d=dialog(config.title,'<p>Formular wird geladen …</p>');const host=d.querySelector('.ops-dialog-body');
  try{
   await window.MRPDUnits.load();
   const units=window.MRPDUnits.units();
   const assets=await result(sb.from('mrpd_ops_records').select('id,kind,title,fields').in('kind',['vehicle','equipment','person']).eq('archived',false).eq('status','active').order('title').limit(1000));
   const cases=await result(sb.from('mrpd_unit_entries').select('id,title').eq('kind','case').eq('archived',false).order('created_at',{ascending:false}).limit(500));
   if(!d.isConnected||current?.id!==actor)return;
   const selected=(value,label,active)=>`<option value="${esc(value)}" ${String(active||'')===String(value)?'selected':''}>${esc(label)}</option>`;
   const renderField=([name,label,type,required])=>{
    const value=row?.fields[name]??defaults[name]??'';let control;
    const attr=`name="${esc(name)}" ${required?'required':''}`;
    if(type==='textarea')control=`<textarea ${attr} rows="3">${esc(value)}</textarea>`;
    else if(['rank','unit','asset','vehicle','unit_case'].includes(type)||options[type]){
     let choices=[];
     if(type==='rank')choices=hub.RANKS.map(v=>[v,v]);
     else if(type==='unit')choices=units.map(u=>[u.id,u.name]);
     else if(type==='unit_case')choices=cases.map(c=>[c.id,c.title]);
     else if(type==='vehicle'||type==='asset')choices=assets.filter(a=>type==='asset'?['vehicle','equipment'].includes(a.kind):a.kind==='vehicle').map(a=>[a.id,a.title]);
     else choices=Object.entries(options[type]);
     control=`<select ${attr}><option value="">Bitte auswählen</option>${choices.map(([v,l])=>selected(v,l,value)).join('')}</select>`;
    }else control=`<input ${attr} type="${type}" value="${esc(value)}" ${type==='number'?'min="0"':''} maxlength="1000">`;
    return `<label class="${type==='textarea'?'hub-wide':''}">${esc(label)}${control}</label>`;
   };
   const targetUnits=units.filter(u=>!['application','transfer'].includes(key)||u.workspace_kind!=='general');
   const defaultUnit=row?.unit_id||(['application','transfer'].includes(key)?'':unit?.id)||'';
   host.innerHTML=`<form class="hub-form"><label class="hub-wide">Titel<input name="title" required maxlength="180" value="${esc(row?.title)}"></label><label>Bereich / Ziel-Unit<select name="unit_id" ${row?'disabled':''} ${['application','transfer'].includes(key)?'required':''}><option value="">Persönlich / departmentweit</option>${targetUnits.map(u=>selected(u.id,u.name,defaultUnit)).join('')}</select></label>${config.subject?`<label>Beteiligter Account<select name="subject_id"><option value="">Eigener Account</option>${people().map(p=>selected(p.id,p.name,row?.subject_id||actor)).join('')}</select></label>`:''}${config.fields.map(renderField).join('')}<label class="hub-wide">${key==='report'?'Bericht':key==='person'?'Hinweise zur Person':'Beschreibung / Begründung'}<textarea name="body" rows="7" maxlength="100000">${esc(row?.body)}</textarea></label><label class="hub-wide">Verknüpfte Personen / Fahrzeuge / Ausrüstung<select name="links" multiple size="4">${assets.filter(a=>a.id!==id).map(a=>`<option value="${esc(a.id)}" ${(row?.fields.links||[]).includes(a.id)?'selected':''}>${esc(a.title)}</option>`).join('')}</select></label><p class="hub-wide muted">Bilder und PDF-Dateien können nach dem Speichern als Anhänge ergänzt werden.</p><button type="submit" class="primary">Speichern</button><p class="hub-wide" role="status"></p></form>`;
   bind(host.querySelector('form'),async data=>{
    if(current?.id!==actor)throw Error('Die Sitzung hat sich geändert.');
    const fields=Object.fromEntries(config.fields.map(([name])=>[name,String(data.get(name)||'').trim()]));fields.links=data.getAll('links');
    const saved=await rpc('save',id,row?.revision||0,{kind:key,unit_id:row?.unit_id||data.get('unit_id')||null,title:String(data.get('title')).trim(),body:String(data.get('body')||'').trim(),subject_id:data.get('subject_id')||null,fields});
    d.close();if(scope?.host.isConnected)await render(scope.host,scope.unit,scope.selected);await detail(saved.id);
   });
  }catch(e){error(host,e);}
 }
 async function detail(id){
  const actor=current.id,d=dialog('Vorgang','<p>Vorgang wird geladen …</p>'),host=d.querySelector('.ops-dialog-body');
  try{
   let row=await result(sb.from('mrpd_ops_records').select('*').eq('id',id).maybeSingle());
   if(!row)throw Error('Vorgang nicht zugänglich.');if(!d.isConnected||actor!==current?.id)return;
   const config=modules[row.kind],unit=window.MRPDUnits.units().find(u=>u.id===row.unit_id),manager=canManage(unit)&&(!config.private||hub.plus(current));
   d.querySelector('h2').textContent=row.title;
   const fields=config.fields.map(([name,label,type])=>{const value=row.fields[name];if(!value)return '';const pretty=['asset','vehicle'].includes(type)?'Verknüpfter Datensatz':type==='unit'?window.MRPDUnits.units().find(u=>u.id===value)?.name||value:options[type]?.[value]||value;return `<dt>${esc(label)}</dt><dd>${esc(pretty)}</dd>`;}).join('');
   host.innerHTML=`<div class="unit-entry-meta"><span>${esc(config.title)} · ${esc(states[row.status])}</span><span>${esc(who(row.author_id))} · ${esc(date(row.created_at))}</span>${row.subject_id?`<span>Beteiligter Account · ${esc(who(row.subject_id))}</span>`:''}</div><p class="unit-document-body">${esc(row.body)}</p><dl class="unit-entry-facts">${fields}${row.kind==='shift'?`<dt>Dienstbeginn</dt><dd>${esc(date(row.fields.started_at))}</dd><dt>Dienstende</dt><dd>${esc(date(row.fields.ended_at))}</dd><dt>Stunden</dt><dd>${(Number(row.fields.seconds||0)/3600).toFixed(2)}</dd>`:''}</dl><div class="unit-actions" data-links></div><div class="unit-actions" data-actions></div><p role="status" data-error></p><div data-checks></div><section class="ops-timeline"><h3>Verlauf & Rückmeldungen</h3><div data-events></div><button class="secondary" type="button" data-more>Ältere Einträge laden</button><form><label>${config.private?'Stellungnahme / Einspruch / Rückmeldung':'Rückmeldung'}<textarea name="body" required maxlength="10000" rows="3"></textarea></label>${manager?'<label class="unit-inline-check"><input type="checkbox" name="internal"> Interner Vermerk</label>':''}<button type="submit" class="primary">Rückmeldung speichern</button><p role="status"></p></form></section>`;
   const links=host.querySelector('[data-links]');
   const ids=[...new Set([...(row.fields.links||[]),row.fields.asset_id].filter(Boolean))];
   for(const target of ids)links.append(button('Verknüpften Datensatz öffnen',()=>detail(target)));
   if(row.fields.unit_case)links.append(button('Unit-Akte öffnen',async()=>{d.close();try{await window.MRPDUnits.openEntry(row.fields.unit_case);}catch(e){alert(e.message);}}));
   if(row.fields.evidence_id)links.append(button('Zellenakte öffnen',()=>{d.close();window.APD_EVIDENCE.render(null,row.fields.evidence_id);}));
   const actions=host.querySelector('[data-actions]');
   const run=async(action,data)=>{
    actions.querySelectorAll('button').forEach(b=>b.disabled=true);
    try{await rpc(action,id,row.revision,data);d.close();if(scope?.host.isConnected)await render(scope.host,scope.unit,scope.selected);await detail(id);}
    catch(e){error(host.querySelector('[data-error]'),e);actions.querySelectorAll('button').forEach(b=>b.disabled=false);}
   };
   if(editable(row)&&!row.applied_at&&!row.archived&&['draft','active','rejected'].includes(row.status))actions.append(button('Bearbeiten',()=>{d.close();editor(row.kind,unit,row);}));
   if(config.flow&&['draft','rejected'].includes(row.status)&&(row.author_id===actor||manager))actions.append(button('Zur Freigabe einreichen',()=>run('transition',{status:'submitted'}),'primary'));
   if(config.flow&&['submitted','reviewed'].includes(row.status)&&manager){actions.append(button('Freigeben',()=>run('transition',{status:'approved'}),'primary'),button('Zur Nacharbeit',()=>{
    const reason=prompt('Begründung für die Nacharbeit');if(reason?.trim())run('transition',{status:'rejected',body:reason.trim()});
   }));}
   if(row.status==='approved'&&['promotion','application','transfer'].includes(row.kind)&&hub.plus(current)&&!row.applied_at)actions.append(button(row.kind==='promotion'?'Dienstgrad übernehmen':'Unit-Zuordnung übernehmen',()=>{if(confirm('Diese freigegebene Entscheidung jetzt übernehmen?'))run('apply',{});},'primary'));
   if(!row.applied_at&&!['closed','draft','rejected'].includes(row.status)&&(manager||(row.author_id===actor&&['checkout','absence','shift'].includes(row.kind))))actions.append(button(row.kind==='checkout'?'Rückgabe bestätigen':row.kind==='shift'?'Dienst beenden':'Abschließen',()=>run('transition',{status:'closed'})));
   if(editable(row))actions.append(button(row.archived?'Aus Archiv holen':'Archivieren',()=>run('archive',{})));
   actions.append(button('Drucken',()=>printRecord(row,config)));
   if(row.kind==='promotion'){
    const checks=await rpc('checks',id,row.revision);const target=host.querySelector('[data-checks]');
    target.innerHTML='<h3>Beförderungsvoraussetzungen</h3>'+(checks.length?'<ul>'+checks.map(c=>`<li>${c.passed?'✓':'○'} ${esc(c.title)}</li>`).join('')+'</ul>':'<p>Für diesen Dienstgrad sind keine zusätzlichen Voraussetzungen hinterlegt.</p>');
   }
   let before=null;
   const drawEvents=async(reset=false)=>{
    const output=host.querySelector('[data-events]'),more=host.querySelector('[data-more]');more.disabled=true;
    try{
     let q=sb.from('mrpd_ops_events').select('*').eq('record_id',id).order('id',{ascending:false}).limit(31);if(before&&!reset)q=q.lt('id',before);
     const events=await result(q);if(!d.isConnected||actor!==current?.id)return;
     if(reset)output.replaceChildren();events.slice(0,30).forEach(event=>{const el=document.createElement('article');el.innerHTML=`<small>${esc(who(event.actor_id))} · ${esc(date(event.created_at))}${event.internal?' · Intern':''}</small><b>${esc(event.action.startsWith('Status · ')?'Status · '+(states[event.action.slice(9)]||event.action.slice(9)):event.action)}</b><p>${esc(event.body)}</p>`;output.append(el);});
     before=events.slice(0,30).at(-1)?.id;more.hidden=events.length<=30;
    }catch(e){error(host.querySelector('[data-error]'),e);}finally{more.disabled=false;}
   };
   host.querySelector('[data-more]').onclick=()=>drawEvents();await drawEvents(true);
   bind(host.querySelector('.ops-timeline form'),async data=>{await rpc('comment',id,row.revision,{body:data.get('body'),internal:data.get('internal')==='on'});host.querySelector('.ops-timeline form').reset();await drawEvents(true);});
   window.MRPDPortalFiles.mount(host,'operation',id,editable(row)&&!row.archived&&!row.applied_at&&['draft','active','rejected'].includes(row.status));
  }catch(e){error(host,e);}
 }
 async function allRows(factory){
  const rows=[];for(let offset=0;;offset+=1000){const next=await result(factory().order('id').range(offset,offset+999));rows.push(...next);if(next.length<1000)return rows;}
 }
 async function absenceCalendar(unit){
  const d=dialog('Abwesenheitskalender','<label>Monat<input type="month"></label><div class="ops-absence-calendar"></div><p role="status"></p>');
  const input=d.querySelector('input');input.value=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Berlin'}).slice(0,7);
  const draw=async()=>{
   try{
    const from=input.value+'-01',next=new Date(input.value+'-01T12:00:00');next.setMonth(next.getMonth()+1);const to=next.toLocaleDateString('en-CA');
    const rows=await allRows(()=>{let q=sb.from('mrpd_ops_records').select('*').eq('kind','absence').eq('status','approved').eq('archived',false).lt('fields->>from',to).gte('fields->>to',from);return unit?q.eq('unit_id',unit.id):q;});
    if(!d.isConnected)return;
    const target=d.querySelector('.ops-absence-calendar');target.replaceChildren();
    if(!rows.length)target.textContent='Keine genehmigten Abwesenheiten in diesem Monat.';
    for(const row of rows){const card=document.createElement('article');card.innerHTML=`<b>${esc(who(row.subject_id||row.author_id))}</b><p>${esc(row.fields.from)} bis ${esc(row.fields.to)}</p>`;card.append(button('Öffnen',()=>detail(row.id)));target.append(card);}
   }catch(e){error(d.querySelector('[role=status]'),e);}
  };input.onchange=draw;await draw();
 }
 async function shiftSummary(unit){
  const d=dialog('Dienstzeiten · Monatsübersicht','<label>Monat<input type="month"></label><div class="ops-hours"></div><div class="unit-actions" data-export></div><p role="status"></p>');
  const input=d.querySelector('input');input.value=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Berlin'}).slice(0,7);
  const draw=async()=>{
   try{
    const from=new Date(input.value+'-01T00:00:00'),to=new Date(from);to.setMonth(to.getMonth()+1);
    const rows=await allRows(()=>{let q=sb.from('mrpd_ops_records').select('*').eq('kind','shift').lt('created_at',to.toISOString()).or('fields->>ended_at.gte.'+from.toISOString()+',status.eq.active');return unit?q.eq('unit_id',unit.id):q;});
    if(!d.isConnected)return;
    const secondsInMonth=r=>r.fields.ended_at?Math.max(0,Math.min(Number(r.fields.seconds||0),(Math.min(+to,+new Date(r.fields.ended_at))-Math.max(+from,+new Date(r.fields.started_at)))/1000)):0;
    const totals=new Map();rows.forEach(r=>totals.set(r.author_id,(totals.get(r.author_id)||0)+secondsInMonth(r)));
    d.querySelector('.ops-hours').innerHTML=`<table><thead><tr><th>Mitarbeiter</th><th>Abgeschlossene Stunden</th></tr></thead><tbody>${[...totals].map(([id,seconds])=>`<tr><td>${esc(who(id))}</td><td>${(seconds/3600).toFixed(2)}</td></tr>`).join('')}</tbody></table><p>${rows.length} Dienstzeiten · Laufende Zeiten sind in der Stundensumme erst nach Dienstende enthalten.</p>`;
    const target=d.querySelector('[data-export]');target.replaceChildren();target.append(button('CSV herunterladen',()=>{
     const cell=value=>'"'+String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
     const data=[['Mitarbeiter','Dienstbeginn','Dienstende','Stunden'],...rows.map(r=>[who(r.author_id),r.fields.started_at,r.fields.ended_at||'',(secondsInMonth(r)/3600).toFixed(2)])].map(row=>row.map(cell).join(';')).join('\r\n');
     const url=URL.createObjectURL(new Blob(['\ufeff'+data],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='MRPD-Dienstzeiten-'+input.value+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
    }));
   }catch(e){error(d.querySelector('[role=status]'),e);}
  };input.onchange=draw;await draw();
 }
 async function printRecord(row,config){
  const frame=document.createElement('iframe');frame.title='Druckansicht '+row.title;frame.style.cssText='position:fixed;left:-9999px;width:1px;height:1px';document.body.append(frame);
  const doc=frame.contentDocument;
  doc.open();doc.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(row.title)}</title><style>@page{size:A4;margin:18mm}body{font:12pt/1.55 Arial,sans-serif;color:#18334c}header{border-bottom:3px solid #18334c;padding-bottom:12px}header img{width:65px;float:right}h1{font-size:23pt}dl{display:grid;grid-template-columns:1fr 2fr;gap:10px}dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}p{white-space:pre-wrap;overflow-wrap:anywhere}small{color:#486277}footer{border-top:1px solid #bbcbd7;margin-top:30px;padding-top:10px}</style></head><body><header><img src="${esc(new URL('assets/mrpd-logo.svg',location.href).href)}" alt="MRPD"><b>Mission Row Police Department</b><div>${esc(config.title)}</div></header><h1>${esc(row.title)}</h1><small>${esc(states[row.status])} · Erstellt von ${esc(who(row.author_id))} · ${esc(date(row.created_at))}</small><p>${esc(row.body)}</p><dl>${config.fields.filter(([name])=>row.fields[name]).map(([name,label,type])=>`<dt>${esc(label)}</dt><dd>${esc(options[type]?.[row.fields[name]]||row.fields[name])}</dd>`).join('')}</dl><footer>MRPD · ${esc(row.id)} · Druck erstellt am ${esc(date(new Date()))}</footer></body></html>`);doc.close();
  await Promise.all([...doc.images].map(img=>img.decode().catch(()=>{})));frame.contentWindow.focus();frame.contentWindow.print();setTimeout(()=>frame.remove(),60000);
 }
 async function caseLinks(host,entry){
  if(entry.kind!=='case')return;
  const section=document.createElement('section');section.className='unit-panel';section.innerHTML='<h3>Berichte & Befragungen</h3><div data-related></div><div data-add></div>';host.append(section);
  try{
   const rows=await result(sb.from('mrpd_ops_records').select('*').eq('kind','report').eq('fields->>unit_case',entry.id).eq('archived',false).order('created_at',{ascending:false}).limit(50));
   if(!section.isConnected)return;
   const target=section.querySelector('[data-related]');if(!rows.length)target.textContent='Noch keine verknüpften Berichte.';
   rows.forEach(row=>target.append(button(row.title+' · '+states[row.status],()=>detail(row.id))));
   section.querySelector('[data-add]').append(button('Bericht / Befragung ergänzen',()=>editor('report',window.MRPDUnits.units().find(u=>u.id===entry.unit_id),null,{unit_case:entry.id})));
  }catch(e){error(section,e);}
 }
 function qualificationMatrix(host,unit){
  host.append(button('Qualifikationsübersicht',async()=>{
   const d=dialog('Qualifikationen · '+unit.name,'<p>Übersicht wird geladen …</p>');const target=d.querySelector('.ops-dialog-body');
   try{
    const rows=await allRows(()=>sb.from('mrpd_unit_entries').select('*').eq('unit_id',unit.id).eq('kind','qualification').eq('archived',false));
    if(!d.isConnected)return;
    const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Berlin'});
    target.innerHTML=`<table><thead><tr><th>Person</th><th>Qualifikation</th><th>Gültigkeit</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(who(r.assigned_to))}</td><td>${esc(r.title)}</td><td>${esc(r.due_on||'Unbefristet')}${r.due_on&&r.due_on<today?' · Abgelaufen':''}</td></tr>`).join('')}</tbody></table>`;
    target.append(button('Nachschulung / Verlängerung beantragen',()=>{d.close();editor('renewal',unit);}));
   }catch(e){error(target,e);}
  }));
 }
 function homeLinks(host){
  if(host.querySelector('.ops-home-links'))return;
  const section=document.createElement('section');section.className='unit-panel unit-shared-links ops-home-links';section.innerHTML='<h2>Personal & Dienstbetrieb</h2>';
  section.append(button('Verwaltung und Vorgänge öffnen',()=>showView('department-operations')));host.append(section);
 }
 async function search(needle){
  const words=needle.trim().toLocaleLowerCase('de').split(/\s+/),actor=current?.id;
  if(!actor||!words[0])return [];
  const term='%'+words[0].replace(/[%_\\]/g,c=>'\\'+c)+'%';
  const rows=await result(sb.from('mrpd_ops_records').select('id,kind,title,body,status').eq('archived',false).ilike('title',term).order('created_at',{ascending:false}).limit(60));
  if(current?.id!==actor)return [];
  return rows.filter(r=>words.every(w=>(r.title+' '+r.body).toLocaleLowerCase('de').includes(w))).map(r=>({title:r.title,description:modules[r.kind].title+' · '+states[r.status],open:()=>detail(r.id)}));
 }
 async function show(){
  if(!active())return;
  const root=document.querySelector('#content');window.MRPDUnits.stop();if(location.hash!=='#operations')history.pushState({mrpdOperations:true},'','#operations');root.dataset.hubView='department-operations';hub.state.generation++;hub.state.currentView='department-operations';hub.setArea('officer');window.MRPDWorkspace?.onView('department-operations');document.querySelector('#pageTitle').textContent='Dienstbetrieb';setActive('[data-view="department-operations"]');root.replaceChildren();await render(root);
 }
 async function loadAlerts(){
  const actor=current?.id;if(!actor)return;
  try{const rows=await result(sb.from('mrpd_ops_alerts').select('*').order('created_at',{ascending:false}).limit(100));if(current?.id!==actor)return;alerts=rows;alertUser=actor;hub.updateBell();}catch(e){console.error('Qualifikationshinweise',e);}
 }
 async function markAlert(id){
  await result(sb.from('mrpd_ops_alerts').update({read_at:new Date().toISOString()}).eq('id',id));await loadAlerts();
 }
 function notifications(){return alertUser===current?.id?alerts.map(r=>({key:'operation:'+r.id,id:r.id,kind:'operation',title:r.title,body:r.body,when:r.created_at,read:!!r.read_at,author:'Department'})):[];}
 const previousView=showView;showView=function(view){if(view==='department-operations')return show();return previousView.apply(this,arguments);};
 const previousNav=nav;nav=function(){
  previousNav.apply(this,arguments);if(!active())return;
  const unitLinks=document.querySelector('.unit-nav-links');
  if(unitLinks&&!document.querySelector('[data-view="department-operations"]')){
   const b=button('Personal & Dienstbetrieb',()=>show(),'nav-btn');b.dataset.view='department-operations';unitLinks.before(b);
  }
  if(restoredUser!==current.id){restoredUser=current.id;if(location.hash==='#operations')show();}
  if(alertUser!==current.id){clearInterval(alertTimer);loadAlerts();alertTimer=setInterval(loadAlerts,60000);}
 };
 sb.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){routeToken++;scope=null;alerts=[];alertUser=null;restoredUser=null;clearInterval(alertTimer);document.querySelectorAll('.ops-dialog[open]').forEach(d=>d.close());}});
 window.MRPDOperations=Object.freeze({render,homeLinks,caseLinks,qualificationMatrix,notifications,mark:markAlert,detail,search});
 window.addEventListener('popstate',()=>{if(location.hash==='#operations'&&active())show();});
 if(active())nav();
})();
