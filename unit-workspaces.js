/* Unit workspaces share the department directory and server-enforced memberships. */
(() => {
 'use strict';

 const hub = window.APD_HUB;
 const content = document.querySelector('#content');
 const roleNames = {member:'Mitglied',instructor:'Ausbilder',deputy:'Stellvertretende Leitung',lead:'Leitung'};
 const statuses = {open:'Offen',progress:'In Bearbeitung',done:'Erledigt'};
 const kinds = {notice:'Mitteilung',task:'Auftrag',case:'Fall',document:'Dokument',training:'Training',qualification:'Qualifikation'};
 const tabs = {overview:'Übersicht',tasks:'Aufträge & Übergabe',members:'Mitglieder',documents:'Dokumente',training:'Training',operations:'Dienstbetrieb',chat:'Chat'};
 const visuals = {
  general:'assets/personnel-honors.webp',patrol:'assets/patrol-training.webp',swat:'chapter-art-09.webp',
  cid:'assets/evidence-division.webp',sheriff:'chapter-art-06.webp',fto:'chapter-art-02.webp',custom:'assets/radio-communications.webp'
 };
 let directory = {uid:null,units:[],memberships:[]};
 let loading = null;
 let generation = 0;
 let refreshTimer = null;
 let currentPage = null;
 let restoredUser = null;
 const enabled = () => current && !current.mustChangePassword && !current.archivedAt && current.accountEnabled !== false && current.status !== 'Archiviert';
 const people = () => hub.state.uid === current?.id ? hub.state.people : [];
 const person = id => people().find(p => p.id === id);
 const dateTime = value => value ? new Date(value).toLocaleString('de-DE',{dateStyle:'medium',timeStyle:'short'}) : 'Termin offen';
 const date = value => value ? new Date(value+'T12:00:00').toLocaleDateString('de-DE') : '';
 const membership = (unit,user=current?.id) => directory.memberships.find(m => m.department_id === unit.id && m.user_id === user);
 const access = unit => enabled() && (hub.plus(current) || !!membership(unit) || (unit.workspace_kind==='general' && (hub.staff(current)||hub.rankIndex(current)>=1)));
 const manager = unit => access(unit) && (hub.plus(current)||['lead','deputy'].includes(membership(unit)?.unit_role));
 const unitMembers = unit => unit.workspace_kind==='general'
  ? people().filter(p => hub.staff(p)||hub.rankIndex(p)>=1)
  : people().filter(p => !!membership(unit,p.id));
 const canEdit = (unit,entry) => manager(unit)||(entry.author_id===current?.id&&['task','case'].includes(entry.kind));
 const canCreate = (unit,kind) => manager(unit)||['task','case'].includes(kind);
 const assertSession = uid => {if(current?.id!==uid||!enabled())throw Error('Die Sitzung hat sich geändert. Bitte neu öffnen.');};
 const result = async query => {
  const {data,error} = await query;
  if(error)throw error;
  return data;
 };
 const command = (action,args={}) => result(sb.rpc('mrpd_unit_command',{p_action:action,p_args:args}));
 function errorAt(host,error){console.error('MRPD Unit',error);if(host?.isConnected)host.textContent=error.message||'Daten konnten nicht geladen werden.';}
 function button(label,click,cls='secondary'){
  const el=document.createElement('button');el.type='button';el.className=cls;el.textContent=label;el.onclick=click;return el;
 }
 function modal(title,html){
  const el=document.createElement('dialog');el.className='hub-dialog unit-dialog';
  el.innerHTML=`<header><h2>${esc(title)}</h2><button type="button" aria-label="Schließen">×</button></header><div class="unit-dialog-body">${html}</div>`;
  el.querySelector('header button').onclick=()=>el.close();
  el.onclose=()=>el.remove();document.body.append(el);el.showModal();return el;
 }
 function submit(form,save){
  form.onsubmit=async event=>{
   event.preventDefault();if(!form.reportValidity())return;
   const control=event.submitter||form.querySelector('[type=submit]');
   const status=form.querySelector('[role=status]');control.disabled=true;status.textContent='';
   try{await save(Object.fromEntries(new FormData(form)));window.APD_UX?.clean(form);}
   catch(error){errorAt(status,error);}
   finally{control.disabled=false;}
  };
 }
 async function load(force=false){
  if(!enabled())return;
  const uid=current.id;
  if(loading?.uid===uid)return loading.promise;
  if(!force&&directory.uid===uid)return directory;
  const promise=(async()=>{
   const [units,memberships]=await Promise.all([
    result(sb.from('portal_hub_departments').select('*').order('name')),
    result(sb.from('portal_hub_memberships').select('*'))
   ]);
   assertSession(uid);
   directory={uid,units,memberships};return directory;
  })();
  loading={uid,promise};
  try{return await promise;}finally{if(loading?.promise===promise)loading=null;}
 }
 function membershipSignature(){
  return directory.memberships.map(m=>[m.id,m.department_id,m.user_id,m.unit_role].join(':')).sort().join('|');
 }
 function stop(){clearInterval(refreshTimer);refreshTimer=null;generation++;currentPage=null;}
 function begin(view,title){
  stop();hub.state.generation++;hub.state.currentView=view;hub.setArea('officer');
  window.MRPDWorkspace?.onView(view);content.dataset.hubView=view;
  document.querySelector('#pageTitle').textContent=title;
  setActive(view==='officer-home'?'[data-view="officer-home"]':'[data-view="unit-workspace"]');
  content.innerHTML='<div class="unit-loading" role="status">Department wird geladen …</div>';
  window.scrollTo({top:0,behavior:'instant'});content.scrollTop=0;
  return ++generation;
 }
 function isCurrent(token,host=content){return enabled()&&generation===token&&host.isConnected;}
 function pushRoute(path){
  if(location.hash===path)return;
  history.pushState({mrpdUnits:true},'',path);
 }
 async function home(push=true){
  if(!enabled())return;
  if(push)pushRoute('#department');
  const token=begin('officer-home','Department');
  try{
   await load(true);if(!isCurrent(token))return;
   const visible=directory.units.filter(access).sort((a,b)=>(a.workspace_kind==='general'?-1:b.workspace_kind==='general'?1:a.name.localeCompare(b.name,'de')));
   content.innerHTML=`<section class="unit-department-head"><div><p class="eyebrow">MISSION ROW POLICE DEPARTMENT</p><h1>Department</h1><p>Deine Units und gemeinsamen Arbeitsbereiche.</p></div>${hub.plus(current)?'<div data-unit-admin></div>':''}</section><div class="unit-grid"></div>${visible.length?'':'<section class="card"><h2>Deine Unit-Zuordnung</h2><p>Die Portalverwaltung kann dir unter „Units & Funktionen“ einen Arbeitsbereich zuweisen.</p></section>'}`;
   const grid=content.querySelector('.unit-grid');
   for(const unit of visible){
    const card=document.createElement('button');card.type='button';card.className='unit-card';card.style.setProperty('--unit-color',unit.color||'#6c91b3');
    const count=unitMembers(unit).length;
    card.innerHTML=`<img src="${esc(visuals[unit.workspace_kind]||visuals.custom)}" alt="" loading="lazy"><div><p class="eyebrow">${unit.workspace_kind==='general'?'GEMEINSAMER BEREICH':esc(roleNames[membership(unit)?.unit_role]||(hub.plus(current)?'Verwaltungszugriff':'UNIT'))}</p><h2>${esc(unit.name)}</h2><p>${esc(unit.description||'Unit-Arbeitsbereich')}</p><span>${count} Mitglieder <b aria-hidden="true">↗</b></span></div>`;
    card.onclick=()=>open(unit.id);grid.append(card);
   }
   window.MRPDOperations?.homeLinks(content);
   if(hub.plus(current))content.querySelector('[data-unit-admin]').append(button('Units verwalten',()=>settings()));
   updateSidebar();watch(token);
  }catch(error){if(isCurrent(token))errorAt(content,error);}
 }
 function watch(token){
  refreshTimer=setInterval(async()=>{
   if(!isCurrent(token)||!content.querySelector('.unit-shell,.unit-grid')){clearInterval(refreshTimer);return;}
   if(document.hidden)return;
   const uid=current.id;
   try{
    const before=membershipSignature();
    await load(true);assertSession(uid);
    if(!isCurrent(token))return;
    const unit=currentPage&&directory.units.find(d=>d.id===currentPage.id);
    if(currentPage&&(!unit||!access(unit))){await home(false);toast('Deine Unit-Zuordnung hat sich geändert.');return;}
    if(before!==membershipSignature()){
     await refreshData();assertSession(uid);if(!isCurrent(token))return;nav();
     updateSidebar();
     if(unit)await open(unit.id,currentPage.tab,false);else await home(false);
    }else if(currentPage?.tab==='chat'){
     await refreshChat(token);
    }
   }catch(error){console.error('Unit aktualisieren',error);}
  },30000);
 }
 async function open(id,tab='overview',push=true){
  if(!enabled())return;
  if(!Object.hasOwn(tabs,tab))tab='overview';
  if(push)pushRoute('#unit/'+id+'/'+tab);
  const token=begin('unit-workspace','Department');
  try{
   await load(true);if(!isCurrent(token))return;
   const unit=directory.units.find(d=>d.id===id);
   if(!unit||!access(unit)){
    content.innerHTML='<section class="card"><h1>Unit nicht verfügbar</h1><p>Für diesen Arbeitsbereich fehlt dir die Unit-Zuordnung.</p><div data-back></div></section>';
    content.querySelector('[data-back]').append(button('Zum Department',()=>home()));return;
   }
   currentPage={id,tab};
   document.querySelector('#pageTitle').textContent=unit.name;
   content.innerHTML=`<section class="unit-shell" style="--unit-color:${esc(/^#[0-9a-f]{6}$/i.test(unit.color)?unit.color:'#6c91b3')}"><div class="unit-breadcrumb"><button class="secondary" type="button" data-unit-home>← Department</button><span>${esc(unit.name)}</span></div><header class="unit-header"><img class="unit-header-photo" src="${esc(visuals[unit.workspace_kind]||visuals.custom)}" alt=""><div class="unit-header-copy"><img src="assets/mrpd-logo.svg" alt="MRPD"><div><p class="eyebrow">${unit.workspace_kind==='general'?'ALLGEMEINER DIENST':esc(roleNames[membership(unit)?.unit_role]||(hub.plus(current)?'VERWALTUNGSZUGRIFF':'UNIT'))}</p><h1>${esc(unit.name)}</h1><p>${esc(unit.description)}</p></div></div></header><nav class="unit-tabs" aria-label="Unit-Bereiche">${Object.entries(tabs).map(([key,title])=>`<button type="button" data-unit-tab="${key}" aria-current="${key===tab?'page':'false'}">${esc(key==='tasks'&&unit.workspace_kind==='cid'?'Fälle & Aufträge':title)}</button>`).join('')}</nav><div class="unit-content" aria-live="polite"></div></section>`;
   content.querySelector('[data-unit-home]').onclick=()=>home();
   content.querySelectorAll('[data-unit-tab]').forEach(b=>b.onclick=()=>open(id,b.dataset.unitTab));
   updateSidebar();
   const host=content.querySelector('.unit-content');
   const routes={overview:()=>overview(unit,host,token),tasks:()=>entryList(unit,host,token,'tasks'),documents:()=>entryList(unit,host,token,'document'),training:()=>training(unit,host,token),members:()=>members(unit,host,token),operations:()=>window.MRPDOperations.render(host,unit),chat:()=>chat(unit,host,token)};
   await routes[tab]();
   if(isCurrent(token))watch(token);
  }catch(error){if(isCurrent(token))errorAt(content.querySelector('.unit-content')||content,error);}
 }
 function entryCard(unit,row){
  const el=document.createElement('article');el.className='unit-entry';
  const label=row.kind==='qualification'?(row.due_on?'Gültig bis '+date(row.due_on):'Freigabe'):kinds[row.kind];
  el.innerHTML=`<div><small>${esc(label)}${row.archived?' · Archiviert':''}</small><h3>${esc(row.title)}</h3><p>${esc(row.body.slice(0,180))}${row.body.length>180?' …':''}</p><div class="unit-entry-meta">${['task','case'].includes(row.kind)?`<span class="unit-status ${esc(row.status)}">${esc(statuses[row.status])}</span>`:''}${row.assigned_to?`<span>${esc(person(row.assigned_to)?.name||'Ehemaliger Mitarbeiter')}</span>`:''}${row.starts_at?`<time>${esc(dateTime(row.starts_at))}</time>`:row.due_on&&row.kind!=='qualification'?`<time>Bis ${esc(date(row.due_on))}</time>`:''}</div></div><button type="button" class="secondary">Öffnen</button>`;
  el.querySelector('button').onclick=()=>entryDetail(unit,row.id);return el;
 }
 async function overview(unit,host,token){
  const base=()=>sb.from('mrpd_unit_entries').select('*').eq('unit_id',unit.id).eq('archived',false);
  const [notices,tasks,events]=await Promise.all([
   result(base().eq('kind','notice').order('created_at',{ascending:false}).limit(3)),
   result(base().in('kind',['task','case']).neq('status','done').order('due_on',{ascending:true,nullsFirst:false}).limit(5)),
   result(base().eq('kind','training').gte('starts_at',new Date().toISOString()).order('starts_at').limit(3))
  ]);
  if(!isCurrent(token,host))return;
  const leaders=unitMembers(unit).filter(p=>['lead','deputy'].includes(membership(unit,p.id)?.unit_role));
  host.innerHTML=`<div class="unit-overview-grid"><section class="unit-panel"><div class="unit-section-head"><h2>Unit-Mitteilungen</h2><div data-notice-add></div></div><div data-notices></div></section><section class="unit-panel"><h2>Unit-Leitung</h2><div data-leaders></div></section><section class="unit-panel"><div class="unit-section-head"><h2>Offene Aufgaben</h2><button type="button" class="secondary" data-all-tasks>Alle Aufgaben</button></div><div data-tasks></div></section><section class="unit-panel"><div class="unit-section-head"><h2>Nächste Trainings</h2><button type="button" class="secondary" data-all-training>Training öffnen</button></div><div data-events></div></section></div>`;
  const fill=(selector,rows,empty)=>{
   const target=host.querySelector(selector);target.className='unit-entry-list';
   if(!rows.length)target.textContent=empty;
   rows.forEach(row=>target.append(entryCard(unit,row)));
  };
  fill('[data-notices]',notices,'Noch keine Unit-Mitteilungen.');
  fill('[data-tasks]',tasks,'Keine offenen Aufgaben.');
  fill('[data-events]',events,'Keine kommenden Trainings.');
  const leaderHost=host.querySelector('[data-leaders]');
  if(!leaders.length)leaderHost.innerHTML='<p class="muted">Noch keine Leitung zugeordnet.</p>';
  leaders.forEach(p=>leaderHost.append(button(p.name+' · '+roleNames[membership(unit,p.id).unit_role],()=>window.MRPDDuty.profile(p.id))));
  if(manager(unit))host.querySelector('[data-notice-add]').append(button('Mitteilung erstellen',()=>entryEditor(unit,'notice')));
  host.querySelector('[data-all-tasks]').onclick=()=>open(unit.id,'tasks');
  host.querySelector('[data-all-training]').onclick=()=>open(unit.id,'training');
  if(unit.workspace_kind==='general'){
   const links=document.createElement('section');links.className='unit-panel unit-shared-links';links.innerHTML='<h2>Departmentweit</h2>';
   const defs=[['news','Mitteilungen'],['evidence','Zellenbereich'],['rank-changes','Up & Downranks'],['departments','Organigramm']];
   if(hub.staff(current))defs.push(['calendar','PD-Kalender']);
   defs.forEach(([view,label])=>links.append(button(label,()=>showView(view))));host.prepend(links);
  }
  if(unit.workspace_kind==='fto'){
   const link=document.createElement('section');link.className='unit-panel unit-shared-links';link.innerHTML='<h2>FTO Academy</h2>';
   link.append(button('Academy öffnen',()=>{hub.setArea('academy');showView('dashboard');}));
   if(hub.staff(current))link.append(button('Rekrutenakten',()=>showView('admin')));host.prepend(link);
  }
 }
 async function entryList(unit,host,token,type){
  const isTasks=type==='tasks';
  const title=isTasks?(unit.workspace_kind==='cid'?'Fälle & Aufträge':'Aufträge & Übergabe'):'Dokumente';
  host.innerHTML=`<div class="unit-section-head"><h2>${esc(title)}</h2><div class="unit-actions" data-create></div></div><div class="unit-filters"><label>Suchen<input type="search" placeholder="Titel durchsuchen" data-entry-search></label>${isTasks?'<label>Status<select data-entry-status><option value="active">Offen & in Bearbeitung</option><option value="open">Offen</option><option value="progress">In Bearbeitung</option><option value="done">Erledigt</option><option value="all">Alle</option></select></label>':''}<label>Ansicht<select data-entry-archive><option value="false">Aktuell</option><option value="true">Archiv</option></select></label></div><div class="unit-entry-list" data-entry-results></div><div class="unit-pagination"></div>`;
  const create=host.querySelector('[data-create]');
  if(canCreate(unit,isTasks?'task':'document'))create.append(button(isTasks?'Auftrag erstellen':'Dokument erstellen',()=>entryEditor(unit,isTasks?'task':'document'),'primary'));
  if(isTasks&&unit.workspace_kind==='cid')create.append(button('Fall anlegen',()=>entryEditor(unit,'case')));
  let page=0,request=0,timer;
  const target=host.querySelector('[data-entry-results]'),pagination=host.querySelector('.unit-pagination');
  const search=host.querySelector('[data-entry-search]'),status=host.querySelector('[data-entry-status]'),archive=host.querySelector('[data-entry-archive]');
  const reset=()=>{page=0;draw();};
  search.oninput=()=>{clearTimeout(timer);timer=setTimeout(reset,220);};
  if(status)status.onchange=reset;archive.onchange=reset;
  async function draw(){
   const currentRequest=++request;target.textContent='Einträge werden geladen …';pagination.replaceChildren();
   try{
    let query=sb.from('mrpd_unit_entries').select('*').eq('unit_id',unit.id).eq('archived',archive.value==='true');
    query=isTasks?query.in('kind',['task','case']):query.eq('kind',type);
    if(isTasks&&status.value==='active')query=query.neq('status','done');
    else if(isTasks&&status.value!=='all')query=query.eq('status',status.value);
    if(search.value.trim())query=query.ilike('title','%'+search.value.trim().replace(/[%_\\]/g,c=>'\\'+c)+'%');
    const rows=await result(query.order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*30,page*30+30));
    if(!isCurrent(token,host)||currentRequest!==request)return;
    target.replaceChildren();
    if(!rows.length)target.textContent='Keine passenden Einträge.';
    rows.slice(0,30).forEach(row=>target.append(entryCard(unit,row)));
    if(page>0)pagination.append(button('← Zurück',()=>{page--;draw();}));
    if(rows.length>30)pagination.append(button('Weitere Einträge →',()=>{page++;draw();}));
   }catch(error){if(isCurrent(token,host)&&request===currentRequest)errorAt(target,error);}
  }
  await draw();
 }
 const localTime=value=>{
  if(!value)return '';
  const d=new Date(value);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')+'T'+[d.getHours(),d.getMinutes()].map(n=>String(n).padStart(2,'0')).join(':');
 };
 function entryEditor(unit,kind,entry=null){
  if(!enabled()||!access(unit)||(entry?!canEdit(unit,entry):!canCreate(unit,kind)))return;
  const uid=current.id;
  const isTask=['task','case'].includes(kind),isTraining=kind==='training',isQualification=kind==='qualification';
  const members=unitMembers(unit);
  const selected=entry?.assigned_to;
  const options=members.map(p=>`<option value="${esc(p.id)}" ${p.id===selected?'selected':''}>${esc(p.name)}</option>`).join('');
  const el=modal((entry?'Bearbeiten · ':'Erstellen · ')+kinds[kind],`<form class="hub-form"><label class="hub-wide">Titel<input name="title" value="${esc(entry?.title)}" required maxlength="160"></label><label class="hub-wide">${isTask?'Beschreibung & nächster Schritt':isQualification?'Hinweise zur Freigabe':'Inhalt'}<textarea name="body" rows="8" maxlength="100000">${esc(entry?.body)}</textarea></label>${isTask||isQualification?`<label>${isQualification?'Person':'Zuständig'}<select name="assigned_to" ${isQualification?'required':''}><option value="">${isQualification?'Person wählen':'Noch nicht zugewiesen'}</option>${options}</select></label><label>${isQualification?'Gültig bis (optional)':'Frist (optional)'}<input type="date" name="due_on" value="${esc(entry?.due_on)}"></label>`:''}${isTask?`<label>Status<select name="status">${Object.entries(statuses).map(([value,title])=>`<option value="${value}" ${entry?.status===value?'selected':''}>${title}</option>`).join('')}</select></label>`:''}${isTraining?`<label>Beginn<input type="datetime-local" name="starts_at" required value="${esc(localTime(entry?.starts_at))}"></label><label>Ort<input name="location" maxlength="200" value="${esc(entry?.location)}"></label><label>Plätze (optional)<input type="number" name="capacity" min="1" max="500" value="${esc(entry?.capacity)}"></label>`:''}<div class="hub-wide unit-actions"><button class="primary" type="submit">Speichern</button>${entry?`<label class="unit-inline-check"><input type="checkbox" name="archived" ${entry.archived?'checked':''}> Archiviert</label>`:''}</div><p class="hub-wide" role="status"></p></form>`);
  submit(el.querySelector('form'),async fields=>{
   assertSession(uid);
   const values={title:fields.title.trim(),body:fields.body.trim()};
   if(isTask||isQualification){values.assigned_to=fields.assigned_to||null;values.due_on=fields.due_on||null;}
   if(isTask)values.status=fields.status;
   if(isTraining){values.starts_at=new Date(fields.starts_at).toISOString();values.location=fields.location.trim();values.capacity=fields.capacity?Number(fields.capacity):null;}
   if(entry){values.archived=fields.archived==='on';values.revision=entry.revision+1;}
   const query=entry?sb.from('mrpd_unit_entries').update(values).eq('id',entry.id).eq('revision',entry.revision):sb.from('mrpd_unit_entries').insert({...values,unit_id:unit.id,kind});
   const saved=await result(query.select('id').maybeSingle());
   if(!saved)throw Error('Inzwischen geändert. Bitte den Eintrag neu öffnen.');
   assertSession(uid);el.close();
   if(currentPage?.id===unit.id)await open(unit.id,currentPage.tab,false);
   await entryDetail(unit,saved.id);
  });
 }
 async function entryDetail(unit,id){
  if(!access(unit))return;
  const uid=current.id;
  const el=modal('Eintrag','<p role="status">Eintrag wird geladen …</p>');
  const host=el.querySelector('.unit-dialog-body');
  try{
   let entry=await result(sb.from('mrpd_unit_entries').select('*').eq('id',id).eq('unit_id',unit.id).maybeSingle());
   assertSession(uid);if(!el.isConnected)return;
   if(!entry)throw Error('Der Eintrag ist nicht mehr verfügbar.');
   el.querySelector('h2').textContent=entry.title;
   host.innerHTML=`<div class="unit-entry-meta"><span>${esc(kinds[entry.kind])}</span><span>${esc(person(entry.author_id)?.name||'Ehemaliger Mitarbeiter')} · ${esc(dateTime(entry.created_at))}</span>${entry.archived?'<span>Archiviert</span>':''}</div><div class="unit-document-body">${esc(entry.body)}</div><dl class="unit-entry-facts">${entry.assigned_to?`<dt>${entry.kind==='qualification'?'Person':'Zuständig'}</dt><dd>${esc(person(entry.assigned_to)?.name||'Ehemaliger Mitarbeiter')}</dd>`:''}${entry.due_on?`<dt>${entry.kind==='qualification'?'Gültig bis':'Frist'}</dt><dd>${esc(date(entry.due_on))}</dd>`:''}${entry.starts_at?`<dt>Beginn</dt><dd>${esc(dateTime(entry.starts_at))}</dd><dt>Ort</dt><dd>${esc(entry.location||'Noch offen')}</dd>`:''}</dl><div class="unit-actions" data-entry-actions></div><p role="status" data-entry-error></p><div data-attendance></div><section class="unit-comments"><h3>Rückmeldungen</h3><button type="button" class="secondary" data-comments-more>Weitere Rückmeldungen laden</button><div data-comments></div>${entry.archived?'':`<form><label>Rückmeldung<textarea name="body" required maxlength="8000" rows="3"></textarea></label><button type="submit" class="primary">Rückmeldung speichern</button><p role="status"></p></form>`}</section>`;
   const actions=host.querySelector('[data-entry-actions]');
   if(canEdit(unit,entry))actions.append(button('Bearbeiten',()=>{el.close();entryEditor(unit,entry.kind,entry);}));
   if(['task','case'].includes(entry.kind)){
    const label=document.createElement('label');label.textContent='Bearbeitungsstand';
    const select=document.createElement('select');
    select.innerHTML=Object.entries(statuses).map(([key,title])=>`<option value="${key}" ${entry.status===key?'selected':''}>${title}</option>`).join('');
    select.disabled=entry.archived||!(canEdit(unit,entry)||entry.assigned_to===uid);
    select.onchange=async()=>{
     select.disabled=true;
     try{entry=await command('status',{entry_id:id,revision:entry.revision,status:select.value});window.APD_UX?.clean(label);}
     catch(error){errorAt(host.querySelector('[data-entry-error]'),error);select.value=entry.status;}
     finally{select.disabled=entry.archived||!(canEdit(unit,entry)||entry.assigned_to===uid);}
    };
    label.append(select);actions.append(label);
   }
   window.MRPDOperations?.caseLinks(host,entry);
   window.MRPDPortalFiles?.mount(host,'entry',entry.id,!entry.archived&&canEdit(unit,entry));
   if(entry.kind==='training'&&!entry.archived)attendance(entry,host.querySelector('[data-attendance]'));
   const comments=host.querySelector('[data-comments]'),more=host.querySelector('[data-comments-more]');
   let offset=0;
   async function loadComments(){
    more.disabled=true;
    try{
     const rows=await result(sb.from('mrpd_unit_comments').select('*').eq('entry_id',id).order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+30));
     assertSession(uid);if(!el.isConnected)return;
     if(offset===0)comments.replaceChildren();
     rows.slice(0,30).forEach(row=>{
      const item=document.createElement('article');item.innerHTML=`<small>${esc(person(row.author_id)?.name||'Ehemaliger Mitarbeiter')} · ${esc(dateTime(row.created_at))}</small><p>${esc(row.body)}</p>`;comments.append(item);
     });
     offset+=30;more.hidden=rows.length<=30;
    }catch(error){errorAt(host.querySelector('[data-entry-error]'),error);}
    finally{more.disabled=false;}
   }
   more.onclick=loadComments;await loadComments();
   const form=host.querySelector('.unit-comments form');
   if(form)submit(form,async fields=>{
    assertSession(uid);await result(sb.from('mrpd_unit_comments').insert({entry_id:id,body:fields.body.trim()}));
    assertSession(uid);form.reset();offset=0;await loadComments();
   });
   el.addEventListener('close',()=>{if(currentPage?.id===unit.id&&currentPage.tab!=='chat')open(unit.id,currentPage.tab,false);},{once:true});
  }catch(error){errorAt(host,error);}
 }

 async function attendance(entry,host){
  const uid=current.id;
  const render=async accepted=>{
   host.querySelectorAll('button').forEach(b=>b.disabled=true);
   let status=host.querySelector('[role=status]');
   if(!status){status=document.createElement('p');status.setAttribute('role','status');host.append(status);}
   try{
    const args={entry_id:entry.id};if(accepted!==undefined)args.accepted=accepted;
    const rows=await command('attendance',args);assertSession(uid);if(!host.isConnected)return;
    const count=rows.filter(r=>r.accepted).length,my=rows.find(r=>r.user_id===uid);
    host.innerHTML=`<section class="unit-panel"><h3>Teilnahme</h3><p>${count}${entry.capacity?' / '+entry.capacity:''} Zusagen${entry.capacity?' · '+Math.max(0,entry.capacity-count)+' Plätze frei':''}</p><p>${my?.accepted===true?'Du hast zugesagt.':my?.accepted===false?'Du hast abgesagt.':'Du hast noch nicht geantwortet.'}</p><div class="unit-actions"></div><details><summary>Teilnehmer (${rows.length} Antworten)</summary><ul>${rows.map(r=>`<li>${esc(person(r.user_id)?.name||'Ehemaliger Mitarbeiter')} · ${r.accepted?'Zugesagt':'Abgesagt'}</li>`).join('')}</ul></details></section>`;
    if(Date.parse(entry.starts_at)>Date.now()){
     const yes=button('Zusagen',()=>render(true)),no=button('Absagen',()=>render(false));
     yes.disabled=my?.accepted===true||(entry.capacity!==null&&count>=entry.capacity);no.disabled=my?.accepted===false;
     host.querySelector('.unit-actions').append(yes,no);
    }
   }catch(error){errorAt(status,error);host.querySelectorAll('button').forEach(b=>b.disabled=false);}
  };
  await render();
 }
 async function training(unit,host,token){
  host.innerHTML='<div class="unit-section-head"><h2>Training & Qualifikationen</h2><div class="unit-actions" data-training-actions></div></div><div class="unit-filters"><label>Inhalt<select data-training-type><option value="training">Trainings</option><option value="qualification">Qualifikationen</option></select></label><label>Ansicht<select data-training-period><option value="active">Aktuell</option><option value="all">Alle</option><option value="archived">Archiviert</option></select></label></div><div class="unit-entry-list" data-training-list></div><div class="unit-pagination"></div>';
  const actions=host.querySelector('[data-training-actions]');
  window.MRPDOperations?.qualificationMatrix(actions,unit);
  if(manager(unit))actions.append(button('Training planen',()=>entryEditor(unit,'training'),'primary'),button('Qualifikation eintragen',()=>entryEditor(unit,'qualification')));
  const type=host.querySelector('[data-training-type]'),period=host.querySelector('[data-training-period]'),target=host.querySelector('[data-training-list]'),pagination=host.querySelector('.unit-pagination');
  let page=0,request=0;
  type.onchange=period.onchange=()=>{page=0;draw();};
  async function draw(){
   const ticket=++request;target.textContent='Einträge werden geladen …';pagination.replaceChildren();
   try{
    let query=sb.from('mrpd_unit_entries').select('*').eq('unit_id',unit.id).eq('kind',type.value).eq('archived',period.value==='archived');
    if(period.value==='active'){
     if(type.value==='training')query=query.gte('starts_at',new Date().toISOString());
     else query=query.or('due_on.is.null,due_on.gte.'+new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Berlin'}));
    }
    query=type.value==='training'?query.order('starts_at'):query.order('created_at',{ascending:false});
    const rows=await result(query.order('id').range(page*30,page*30+30));
    if(!isCurrent(token,host)||request!==ticket)return;
    target.replaceChildren();
    if(!rows.length)target.textContent=type.value==='training'?'Keine Trainings in dieser Ansicht.':'Keine Qualifikationen in dieser Ansicht.';
    rows.slice(0,30).forEach(row=>target.append(entryCard(unit,row)));
    if(page>0)pagination.append(button('← Zurück',()=>{page--;draw();}));
    if(rows.length>30)pagination.append(button('Weitere Einträge →',()=>{page++;draw();}));
   }catch(error){if(isCurrent(token,host)&&request===ticket)errorAt(target,error);}
  }
  await draw();
 }
 async function photo(host,p){
  if(!p.avatar_path)return;
  try{
   const data=await result(sb.storage.from('portal-avatars').createSignedUrl(p.avatar_path,300));
   if(!host.isConnected)return;
   const image=document.createElement('img');image.src=data.signedUrl;image.alt='';host.replaceChildren(image);
  }catch(error){console.error('Unit Profilbild',error);}
 }
 async function members(unit,host,token){
  host.innerHTML='<div class="unit-section-head"><h2>Mitglieder</h2><div data-member-admin></div></div><label class="unit-member-search">Mitglieder suchen<input type="search" placeholder="Name, Dienstgrad oder Funktion"></label><p data-member-count></p><div class="unit-members-grid"></div>';
  if(hub.plus(current))host.querySelector('[data-member-admin]').append(button('Units & Funktionen zuweisen',()=>chooseAccount()));
  const peopleList=unitMembers(unit).sort((a,b)=>{
   const order={lead:0,deputy:1,instructor:2,member:3};
   return (order[membership(unit,a.id)?.unit_role]??3)-(order[membership(unit,b.id)?.unit_role]??3)||a.name.localeCompare(b.name,'de');
  });
  let online=new Map();
  try{online=new Map((await result(sb.rpc('portal_member_statuses'))).map(p=>[p.id,p.online]));}
  catch(error){console.error('Unit Online-Status',error);}
  if(!isCurrent(token,host))return;
  const input=host.querySelector('input'),target=host.querySelector('.unit-members-grid');
  const draw=()=>{
   const needle=input.value.trim().toLocaleLowerCase('de');
   const matches=peopleList.filter(p=>(p.name+' '+p.rank+' '+roleNames[membership(unit,p.id)?.unit_role]).toLocaleLowerCase('de').includes(needle));
   host.querySelector('[data-member-count]').textContent=matches.length+' von '+peopleList.length+' Mitgliedern';
   target.replaceChildren();
   for(const p of matches){
    const card=document.createElement('article');card.className='unit-member';
    const present=online.get(p.id);
    card.innerHTML=`<span class="unit-avatar">${esc(p.name.split(/\s+/).slice(0,2).map(w=>w[0]).join(''))}</span><div><h3>${esc(p.name)}</h3><p>${esc(p.rank||'—')}</p><small>${esc(roleNames[membership(unit,p.id)?.unit_role]||'Department-Mitglied')}</small><p class="unit-presence"><i class="${present===true?'online':present===false?'offline':'unknown'}"></i>${present===true?'Online':present===false?'Offline':'Status unbekannt'}</p></div><div class="unit-actions" data-person-actions></div>`;
    const actions=card.querySelector('[data-person-actions]');
    actions.append(button('Profil',()=>window.MRPDDuty.profile(p.id)));
    if(hub.plus(current))actions.append(accountButton(p.id));
    target.append(card);photo(card.querySelector('.unit-avatar'),p);
   }
  };
  input.oninput=draw;draw();
 }
 let chatSession=null;
 async function chat(unit,host,token){
  host.innerHTML=`<div class="unit-section-head"><h2>Unit-Chat</h2><button class="secondary" type="button" data-chat-refresh>Aktualisieren</button></div><p class="muted">${unitMembers(unit).length} zugeordnete Mitglieder · Unit-Leitung und Portalverwaltung haben Zugriff.</p><div class="unit-chat"><button class="secondary" type="button" data-unit-chat-older>Ältere Nachrichten laden</button><div class="unit-chat-log" role="log" aria-label="Unit-Nachrichten"></div><form><label class="hub-sr">Nachricht<textarea name="body" required maxlength="8000"></textarea></label><div class="unit-actions"><button class="primary" type="submit">Senden</button><p role="status"></p></div></form></div>`;
  const form=host.querySelector('form');
  // Keep the input label visible to screen readers while the composer stays usable.
  form.querySelector('label').className='unit-chat-label';
  form.querySelector('textarea').placeholder='Nachricht an '+unit.name+' …';
  const session={unit,host,token,rows:new Map(),oldest:null,more:true,busy:false};chatSession=session;
  host.querySelector('[data-chat-refresh]').onclick=()=>refreshChat(token);
  host.querySelector('[data-unit-chat-older]').onclick=()=>fetchChat(session,true);
  submit(form,async fields=>{
   const uid=current.id;assertSession(uid);
   if(!fields.body.trim())throw Error('Bitte eine Nachricht eingeben.');
   await result(sb.from('mrpd_unit_messages').insert({unit_id:unit.id,body:fields.body.trim()}));
   assertSession(uid);if(!form.isConnected)return;form.reset();await fetchChat(session,false,true);
  });
  await fetchChat(session,false,true);
 }
 async function refreshChat(token){
  if(chatSession?.token===token&&chatSession.host.isConnected)await fetchChat(chatSession);
 }
 async function fetchChat(session,older=false,bottom=false){
  if(session.busy||!isCurrent(session.token,session.host))return;
  session.busy=true;
  const log=session.host.querySelector('.unit-chat-log'),oldHeight=log.scrollHeight,oldTop=log.scrollTop,nearBottom=oldHeight-oldTop-log.clientHeight<90;
  const more=session.host.querySelector('[data-unit-chat-older]');more.disabled=true;
  try{
   let query=sb.from('mrpd_unit_messages').select('*').eq('unit_id',session.unit.id);
   if(older&&session.oldest)query=query.or('created_at.lt.'+session.oldest.created_at+',and(created_at.eq.'+session.oldest.created_at+',id.lt.'+session.oldest.id+')');
   const rows=await result(query.order('created_at',{ascending:false}).order('id',{ascending:false}).limit(50));
   if(!isCurrent(session.token,session.host))return;
   if(older||!session.rows.size){session.more=rows.length===50;session.oldest=rows.at(-1)||session.oldest;}
   if(!older){
    const newest=[...session.rows.values()].sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id))[0];
    const oldest=rows.at(-1);
    const after=(a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id);
    if(!rows.length||(newest&&oldest&&rows.length===50&&after(oldest,newest)>0)){
     session.rows.clear();session.oldest=oldest||null;session.more=rows.length===50;bottom=true;
    }else if(oldest){
     const incoming=new Set(rows.map(row=>row.id));
     for(const row of session.rows.values())if(after(row,oldest)>=0&&!incoming.has(row.id))session.rows.delete(row.id);
    }
   }
   rows.forEach(row=>session.rows.set(row.id,row));
   const values=[...session.rows.values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
   const retained=new Map([...log.querySelectorAll(':scope > [data-unit-message]')].map(el=>[el.dataset.unitMessage,el]));
   const keep=new Set(values.map(row=>row.id));
   for(const node of [...log.childNodes])if(!keep.has(node.dataset?.unitMessage))node.remove();
   if(!values.length)log.textContent='Noch keine Nachrichten in dieser Unit.';
   for(const [index,row] of values.entries()){
    const signature=JSON.stringify([row.body,row.author_id]),existing=retained.get(row.id);
    if(existing?.dataset.signature===signature){if(log.children[index]!==existing)log.insertBefore(existing,log.children[index]||null);continue;}
    existing?.remove();
    const el=document.createElement('article');el.dataset.unitMessage=row.id;el.dataset.signature=signature;el.className='unit-chat-message'+(row.author_id===current.id?' own':'');
    el.innerHTML=`<header><button type="button" class="unit-chat-person">${esc(person(row.author_id)?.name||'Ehemaliger Mitarbeiter')}</button><time>${esc(dateTime(row.created_at))}</time></header><p>${esc(row.body)}</p>`;
    el.querySelector('.unit-chat-person').onclick=()=>window.MRPDDuty.profile(row.author_id);
    if(row.author_id===current.id||manager(session.unit))el.append(button('Entfernen',async event=>{
     if(!confirm('Diese Nachricht entfernen?'))return;
     const control=event.currentTarget;control.disabled=true;
     try{await result(sb.from('mrpd_unit_messages').delete().eq('id',row.id));session.rows.delete(row.id);await fetchChat(session);}
     catch(error){toast(error.message);control.disabled=false;}
    }));
    log.insertBefore(el,log.children[index]||null);window.MRPDPortalFiles?.mount(el,'message',row.id,row.author_id===current.id||manager(session.unit));
   }
   more.hidden=!session.more;
   if(bottom||nearBottom)log.scrollTop=log.scrollHeight;
   else if(older)log.scrollTop=oldTop+log.scrollHeight-oldHeight;
   else log.scrollTop=oldTop;
  }catch(error){const status=session.host.querySelector('[role=status]');errorAt(status,error);}
  finally{session.busy=false;more.disabled=false;}
 }

 function accountButton(id){return button('Units & Funktionen',()=>accountEditor(id));}
 async function accountEditor(id){
  if(!hub.plus(current)||!enabled())return;
  const uid=current.id,entry=person(id)||db.users.find(p=>p.id===id);
  if(!entry)return;
  const el=modal('Units & Funktionen · '+entry.name,'<p role="status">Zuordnungen werden geladen …</p>');
  const host=el.querySelector('.unit-dialog-body');
  try{
   await load(true);const saved=await command('memberships',{user_id:id});assertSession(uid);if(!el.isConnected)return;
   const values=new Map(saved.units.map(unit=>[unit.id,unit.role]));
   host.innerHTML=`<form><p>Mehrere Units sind möglich. Leitung und Stellvertretung dürfen die Inhalte ihrer Unit pflegen.</p><div class="unit-assignment-list">${directory.units.filter(unit=>unit.workspace_kind!=='general').map(unit=>`<div class="unit-assignment"><label><input type="checkbox" name="selected" value="${esc(unit.id)}" ${values.has(unit.id)?'checked':''}><span>${esc(unit.name)}</span></label><label>Funktion<select data-unit-role="${esc(unit.id)}" ${values.has(unit.id)?'':'disabled'}>${Object.entries(roleNames).map(([key,title])=>`<option value="${key}" ${values.get(unit.id)===key?'selected':''}>${title}</option>`).join('')}</select></label></div>`).join('')}</div><div class="unit-actions"><button type="submit" class="primary">Zuordnungen speichern</button></div><p role="status"></p></form>`;
   const form=host.querySelector('form');
   form.querySelectorAll('input[type=checkbox]').forEach(box=>box.onchange=()=>{form.querySelector(`[data-unit-role="${CSS.escape(box.value)}"]`).disabled=!box.checked;});
   submit(form,async()=>{
    assertSession(uid);
    const units=[...form.querySelectorAll('input:checked')].map(box=>({id:box.value,role:form.querySelector(`[data-unit-role="${CSS.escape(box.value)}"]`).value}));
    await command('memberships',{user_id:id,version:saved.version,units});
    assertSession(uid);await refreshData();nav();await load(true);el.close();
    updateSidebar();document.querySelector('.unit-own-card')?.remove();decorateAccount();
    for(const section of document.querySelectorAll('.unit-profile-memberships[data-profile-user]')){
     const parent=section.parentElement,profileId=section.dataset.profileUser;section.remove();profileUnits(parent,profileId);
    }
    if(currentPage){const previous={...currentPage};await open(previous.id,previous.tab,false);}
    toast('Unit-Zuordnungen gespeichert.');
   });
  }catch(error){errorAt(host,error);}
 }
 function chooseAccount(){
  if(!hub.plus(current))return;
  const el=modal('Account auswählen','<label>Name suchen<input type="search" autofocus placeholder="Name oder Dienstnummer"></label><div class="unit-account-results"></div>');
  const input=el.querySelector('input'),target=el.querySelector('.unit-account-results');
  const draw=()=>{
   const needle=input.value.trim().toLocaleLowerCase('de');target.replaceChildren();
   const matches=people().filter(p=>(p.name+' '+(p.serviceNo||'')).toLocaleLowerCase('de').includes(needle));
   for(const p of matches.slice(0,50))target.append(button(p.name+' · '+(p.rank||'—'),()=>{el.close();accountEditor(p.id);}));
   if(matches.length>50){const hint=document.createElement('p');hint.textContent='Suche eingrenzen, um weitere Accounts zu finden.';target.append(hint);}
   if(!matches.length)target.textContent='Keine Accounts gefunden.';
  };
  input.oninput=draw;draw();
 }
 async function ownCard(host,id=current?.id){
  if(!enabled()||!host||host.querySelector('.unit-own-card'))return;
  const uid=current.id;
  const section=document.createElement('section');section.className='card unit-own-card';section.innerHTML='<h2>Units & Funktionen</h2><div class="unit-chips">Zuordnungen werden geladen …</div><div data-own-unit-actions></div>';
  host.append(section);
  try{
   await load(true);assertSession(uid);if(!section.isConnected)return;
   const rows=directory.memberships.filter(m=>m.user_id===id),chips=section.querySelector('.unit-chips');chips.replaceChildren();
   if(!rows.length)chips.textContent='Noch keiner Unit zugeordnet.';
   for(const m of rows){const unit=directory.units.find(d=>d.id===m.department_id);if(!unit)continue;const chip=document.createElement('span');chip.textContent=unit.name+' · '+roleNames[m.unit_role];chips.append(chip);}
   if(hub.plus(current))section.querySelector('[data-own-unit-actions]').append(accountButton(id));
  }catch(error){errorAt(section.querySelector('.unit-chips'),error);}
 }
 async function profileUnits(host,id){
  if(!enabled()||!host)return;
  const uid=current.id;
  const section=document.createElement('section');section.className='unit-profile-memberships';section.dataset.profileUser=id;section.innerHTML='<h3>Units & Funktionen</h3><div class="unit-chips"></div>';host.append(section);
  try{
   await load();assertSession(uid);if(!section.isConnected)return;
   const target=section.querySelector('.unit-chips'),rows=directory.memberships.filter(m=>m.user_id===id);
   target.textContent=rows.length?'':'Noch keiner Unit zugeordnet.';
   rows.forEach(m=>{const unit=directory.units.find(d=>d.id===m.department_id);if(!unit)return;const item=document.createElement('span');item.textContent=unit.name+' · '+roleNames[m.unit_role];target.append(item);});
   if(hub.plus(current))section.append(accountButton(id));
  }catch(error){errorAt(section.querySelector('.unit-chips'),error);}
 }
 async function settings(){
  if(!hub.plus(current)||!enabled())return;
  await load(true);
  const el=modal('Units verwalten','<div class="unit-settings-list"></div><div class="unit-settings-add"></div>');
  const target=el.querySelector('.unit-settings-list');
  for(const unit of directory.units){
   const row=document.createElement('div');row.innerHTML=`<strong>${esc(unit.name)}</strong>`;row.append(button('Bearbeiten',()=>{el.close();unitEditor(unit);}));target.append(row);
  }
  el.querySelector('.unit-settings-add').append(button('Unit hinzufügen',()=>{el.close();unitEditor();},'primary'));
 }
 function unitEditor(unit=null){
  if(!hub.plus(current)||!enabled())return;
  const uid=current.id;
  const color=/^#[0-9a-f]{6}$/i.test(unit?.color)?unit.color:'#6c91b3';
  const el=modal(unit?'Unit bearbeiten':'Unit hinzufügen',`<form class="hub-form"><label>Name<input name="name" required minlength="2" maxlength="80" value="${esc(unit?.name)}"></label><label>Farbe<input name="color" type="color" value="${esc(color)}"></label><label class="hub-wide">Beschreibung<textarea name="description" maxlength="1000">${esc(unit?.description)}</textarea></label><button type="submit" class="primary">Unit speichern</button><p role="status"></p></form>`);
  submit(el.querySelector('form'),async fields=>{
   assertSession(uid);
   const data={name:fields.name.trim(),color:fields.color,description:fields.description.trim()};
   if(!data.name)throw Error('Bitte einen Namen eingeben.');
   const query=unit?sb.from('portal_hub_departments').update(data).eq('id',unit.id).eq('updated_at',unit.updated_at):sb.from('portal_hub_departments').insert(data);
   const saved=await result(query.select('id').maybeSingle());if(!saved)throw Error('Inzwischen geändert. Bitte die Unit neu öffnen.');
   assertSession(uid);await load(true);el.close();await home(false);
  });
 }

 function arrangeNavigation(host){
  if(!host||!enabled())return;
  const buttons=new Map([...host.querySelectorAll('button[data-view]')].map(b=>[b.dataset.view,b]));
  const chapters=[...host.querySelectorAll('button[data-chapter]')];
  const used=new Set();
  const group=(title,area=null)=>{
   const section=document.createElement('section');section.className='unit-nav-section';
   if(area)section.dataset.portalArea=area;
   const heading=document.createElement('h3');heading.textContent=title;section.append(heading);return section;
  };
  const take=(section,keys)=>{
   for(const key of keys){
    const node=buttons.get(key);if(!node||used.has(key))continue;
    node.removeAttribute('data-portal-area');section.append(node);used.add(key);
   }
  };
  const academy=group('Academy','academy');
  take(academy,['dashboard']);
  const handbook=document.createElement('details');handbook.className='unit-nav-handbook';handbook.innerHTML='<summary>Handbuch · Kapitel 1–22</summary>';
  chapters.forEach(node=>{node.removeAttribute('data-portal-area');handbook.append(node);});academy.append(handbook);
  take(academy,['tests','plan','radio','scenario','cad','mapquiz','rides','leaderboard','training-calendar']);
  const department=group('Department','officer');
  take(department,['officer-home']);
  const departmentHome=buttons.get('officer-home');if(departmentHome)departmentHome.textContent='Department-Übersicht';
  const unitLinks=document.createElement('div');unitLinks.className='unit-nav-links';department.append(unitLinks);
  const shared=group('Persönlich & gemeinsam');shared.dataset.unitNavShared='';
  take(shared,['messages','duty-marks','calendar','news','evidence','departments','documents','feedback','badges','account']);
  const admin=group('Verwaltung');
  take(admin,['accounts','admin','rank-changes','duty-history','command','command-live']);
  used.add('duty-handover');
  for(const [key,node] of buttons){
   if(used.has(key))continue;
   node.removeAttribute('data-portal-area');shared.append(node);
  }
  if(hub.plus(current)){
   admin.append(button('Units & Funktionen zuweisen',()=>chooseAccount(),'nav-btn'),button('Units verwalten',()=>settings(),'nav-btn'));
  }
  host.replaceChildren(academy,department,shared,...(admin.children.length>1?[admin]:[]));
  const switcher=document.querySelector('[data-hub-area="officer"]');
  if(switcher)switcher.textContent='Department';
  updateSidebar();
 }
 function updateSidebar(){
  const host=document.querySelector('.unit-nav-links');if(!host||directory.uid!==current?.id)return;
  host.replaceChildren();
  for(const unit of directory.units.filter(access)){
   const control=button(unit.name,()=>open(unit.id),'nav-btn unit-nav-link');control.dataset.unitId=unit.id;
   const activeUnit=currentPage?.id===unit.id;control.classList.toggle('active',activeUnit);
   control.setAttribute('aria-current',activeUnit?'page':'false');host.append(control);
  }
 }
 const previousNav=nav;
 nav=function(){
  previousNav.apply(this,arguments);
  if(!enabled())return;
  arrangeNavigation(document.querySelector('#nav'));
  const uid=current.id;
  load(true).then(()=>{if(current?.id===uid)updateSidebar();}).catch(console.error);
 };
 const previousShowView=showView;
 showView=function(view){
  if(!enabled())return previousShowView.apply(this,arguments);
  if(view==='officer-home'||view==='department')return home();
  if(view==='duty-handover')return (async()=>{
   await load();const patrol=directory.units.find(d=>d.workspace_kind==='patrol');
   return patrol&&access(patrol)?open(patrol.id,'tasks'):home();
  })();
  stop();return previousShowView.apply(this,arguments);
 };
 async function searchUnits(needle){
  await load();
  const uid=current.id;
  const words=needle.trim().toLocaleLowerCase('de').split(/\s+/);
  const matches=value=>words.every(word=>value.toLocaleLowerCase('de').includes(word));
  const found=directory.units.filter(unit=>access(unit)&&matches(unit.name+' '+unit.description))
   .map(unit=>({title:unit.name,description:'Unit-Arbeitsbereich',open:()=>open(unit.id)}));
  const term='%'+words[0].replace(/[%_\\]/g,c=>'\\'+c)+'%';
  const rows=(await Promise.all(['title','body'].map(field=>result(sb.from('mrpd_unit_entries').select('id,unit_id,kind,title,body').eq('archived',false).ilike(field,term).order('created_at',{ascending:false}).limit(25))))).flat();
  assertSession(uid);
  const seen=new Set();
  for(const row of rows){
   if(seen.has(row.id)||!matches(row.title+' '+row.body))continue;seen.add(row.id);
   const unit=directory.units.find(u=>u.id===row.unit_id);if(!unit||!access(unit))continue;
   found.push({title:row.title,description:unit.name+' · '+kinds[row.kind],open:async()=>{
    const tab=['task','case'].includes(row.kind)?'tasks':['training','qualification'].includes(row.kind)?'training':row.kind==='document'?'documents':'overview';
    await open(unit.id,tab);if(currentPage?.id===unit.id)await entryDetail(unit,row.id);
   }});
  }
  return found;
 }
 function decorateAccount(){
  if(!enabled())return;
  if(hub.state.currentView==='account'&&content.querySelector('.account-info-grid,.account-card'))ownCard(content);
  if(hub.plus(current))for(const copy of content.querySelectorAll('[data-copy-existing-account]')){
   const card=copy.closest('article');if(!card||card.querySelector('[data-unit-account]'))continue;
   const control=accountButton(copy.dataset.copyExistingAccount);control.dataset.unitAccount=copy.dataset.copyExistingAccount;copy.after(control);
  }
 }
 let decorateQueued=false;
 function decorate(){
  if(decorateQueued)return;decorateQueued=true;
  queueMicrotask(()=>{
   decorateQueued=false;if(!enabled())return;
   decorateAccount();
   if(restoredUser!==current.id){
    restoredUser=current.id;
    if(location.hash==='#department')home(false);
    const route=location.hash.match(/^#unit\/([0-9a-f-]{36})\/([a-z]+)$/i);
    if(route)open(route[1],route[2],false);
   }
   if(document.querySelector('#pageTitle')?.textContent==='Officer Dashboard'&&hub.state.currentView==='officer-home'&&!content.querySelector('.unit-grid,.unit-shell,.unit-loading'))home(false);
  });
 }
 if(content)new MutationObserver(decorate).observe(content,{childList:true,subtree:true});
 const navHost=document.querySelector('#nav');
 if(navHost)new MutationObserver(()=>{
  const shared=navHost.querySelector('[data-unit-nav-shared]');if(!shared)return;
  navHost.querySelectorAll(':scope > button[data-view]').forEach(node=>shared.append(node));
 }).observe(navHost,{childList:true});
 window.addEventListener('popstate',event=>{
  if(!enabled())return;
  const match=location.hash.match(/^#unit\/([0-9a-f-]{36})\/([a-z]+)$/i);
  if(!match&&location.hash!=='#department')return;
  event.stopImmediatePropagation();
  if(match)open(match[1],match[2],false);else home(false);
 },true);
 sb.auth.onAuthStateChange(event=>{
  if(event!=='SIGNED_OUT')return;
  stop();directory={uid:null,units:[],memberships:[]};loading=null;chatSession=null;restoredUser=null;
  document.querySelectorAll('.unit-dialog[open]').forEach(el=>el.close());
 });
 window.MRPDUnits=Object.freeze({home,open,load,stop,accountEditor,accountButton,profileUnits,openEntry:async id=>{await load();const row=await result(sb.from('mrpd_unit_entries').select('*').eq('id',id).single());const unit=directory.units.find(u=>u.id===row.unit_id);if(!unit)throw Error('Unit nicht verfügbar.');await open(unit.id,'tasks');await entryDetail(unit,id);},search:searchUnits,units:()=>directory.units,canManage:manager});
 if(enabled())nav();
 decorate();
})();
