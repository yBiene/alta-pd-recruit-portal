/* Shared duty overview, search and collaboration tools. */
(() => {
 'use strict';

 const root = document.querySelector('#content');
 const hub = window.APD_HUB;
 const active = () => current && !current.mustChangePassword && !current.archivedAt && current.status !== 'Archiviert' && current.accountEnabled !== false;
 const officer = () => hub.channelAccess(current, 'officer');
 const people = () => hub.state.uid === current?.id ? hub.state.people : [];
 const person = id => people().find(p => p.id === id) || db.users.find(p => p.id === id);
 const calendarDate = value => new Date(value).toLocaleString('de-DE', { dateStyle:'medium', timeStyle:'short' });
 const day = value => value ? new Date(value + 'T12:00:00').toLocaleDateString('de-DE') : '';
 const list = async query => {
  const {data,error} = await query;
  if (error) throw error;
  return data;
 };
 const warning = (host,error) => {
  console.error('MRPD Dienstablauf', error);
  host.textContent = error.message || 'Daten konnten nicht geladen werden.';
 };
 const card = title => {
  const el = document.createElement('section');
  el.className = 'card mrpd-duty-card';
  el.innerHTML = `<h2>${esc(title)}</h2><div data-duty-body></div>`;
  return el;
 };
 const bodyOf = el => el.querySelector('[data-duty-body]');
 const button = (label, click, style='secondary') => {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = style;
  el.textContent = label;
  el.onclick = click;
  return el;
 };
 function dialog(title, html) {
  const el = document.createElement('dialog');
  el.className = 'hub-dialog mrpd-duty-dialog';
  el.innerHTML = `<header><h2>${esc(title)}</h2><button type="button" aria-label="Schließen">×</button></header><div data-duty-body>${html}</div>`;
  el.querySelector('header button').onclick = () => el.close();
  el.addEventListener('close', () => el.remove(), {once:true});
  document.body.append(el);
  el.showModal();
  return el;
 }
 function bindForm(form, submit) {
  form.onsubmit = async event => {
   event.preventDefault();
   const control = event.submitter || form.querySelector('[type=submit]');
   control.disabled = true;
   const status = form.querySelector('[role=status]');
   status.textContent = '';
   try { await submit(Object.fromEntries(new FormData(form))); }
   catch (error) { warning(status,error); }
   finally { control.disabled = false; }
  };
 }
 async function mailTo(id) {
  await showView('messages');
  const select = root.querySelector('#v62MailForm [name=recipient]');
  if (!select || ![...select.options].some(option => option.value === id)) {
   toast('Empfänger im Postfach nicht verfügbar.');
   return;
  }
  select.value = id;
  select.dispatchEvent(new Event('change',{bubbles:true}));
  root.querySelector('#v621Compose')?.click();
  root.querySelector('#v62MailForm [name=subject]')?.focus();
 }
 function profile(id, assignment = {}) {
  if (!active()) return;
  const p = people().find(entry => entry.id === id);
  if (!p) return;
  const el = dialog(p.name, `<dl class="mrpd-duty-profile"><dt>Dienstgrad</dt><dd>${esc(p.rank || '—')}</dd><dt>Dienstnummer</dt><dd>${esc(p.serviceNo || '—')}</dd><dt>Unit</dt><dd data-unit>${esc(assignment.unit || '—')}</dd><dt>Zuständigkeit</dt><dd data-position>${esc(assignment.title || '—')}</dd></dl>`);
  if (!assignment.title) {
   window.MRPDDepartments.assignment?.(p.name).then(info => {
    if (!info || !el.isConnected) return;
    el.querySelector('[data-unit]').textContent = info.unit || '—';
    el.querySelector('[data-position]').textContent = info.title;
   }).catch(console.error);
  }
  window.MRPDUnits?.profileUnits(bodyOf(el),p.id);
  if (p.id !== current.id) bodyOf(el).append(button('Private Nachricht', () => {el.close();mailTo(id);}, 'primary'));
 }

 async function nextStep(el, recruit) {
  const host = bodyOf(el);
  try {
   const data = await list(sb.from('mrpd_next_steps').select('*').eq('recruit_id',recruit.id).maybeSingle());
   if (!el.isConnected) return;
   const trainers = people().filter(p => hub.staff(p));
   const suggested = data?.fto_id || recruit.leaderFtoId || current.id;
   host.innerHTML = `<form class="hub-form">
    <label class="hub-wide">Aufgabe<textarea name="task" required maxlength="1500">${esc(data?.task)}</textarea></label>
    <label>Zuständiger FTO<select name="fto_id" required><option value="">Bitte auswählen</option>${trainers.map(p=>`<option value="${esc(p.id)}" ${p.id===suggested?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>
    <label>Termin (optional)<input type="date" name="due_on" value="${esc(data?.due_on)}"></label>
    <p class="hub-wide" role="status"></p>
    <div class="hub-wide mrpd-duty-buttons"><button class="primary" type="submit">Speichern</button></div></form>`;
   const form = host.querySelector('form');
   const status = form.querySelector('[role=status]');
   bindForm(form,async fields => {
    await list(sb.from('mrpd_next_steps').upsert({recruit_id:recruit.id,task:fields.task.trim(),fto_id:fields.fto_id,due_on:fields.due_on||null}));
    await nextStep(el,recruit);
    const currentStatus = host.querySelector('[role=status]');
    if (currentStatus) currentStatus.textContent = 'Gespeichert.';
   });
   if (data) form.querySelector('.mrpd-duty-buttons').append(button('Als erledigt abschließen',async event => {
    const control = event.currentTarget;
    control.disabled = true;
    try {
     await list(sb.from('mrpd_next_steps').delete().eq('recruit_id',recruit.id));
     await nextStep(el,recruit);
    } catch (error) { warning(status,error);control.disabled=false; }
   }));
  } catch (error) { warning(host,error); }
 }

 function customView(key,title) {
  hub.state.generation++;
  hub.state.currentView = key;
  window.MRPDWorkspace?.onView(key);
  setActive(`[data-view="${key}"]`);
  document.querySelector('#pageTitle').textContent = title;
  const el = card(title);
  root.replaceChildren(el);
  return bodyOf(el);
 }
 const previousView = showView;
 showView = function(view) {
  if (!active()) return previousView.apply(this,arguments);
  if (view==='training-calendar') {
   hub.state.generation++;
   hub.state.currentView=view;
   window.MRPDWorkspace?.onView(view);
   calendarView();
   setActive('[data-view="training-calendar"]');
   return;
  }
  if (view==='duty-handover' && officer()) return handover();
  if (view==='duty-marks') return markedView();
  if (view==='duty-history' && hub.plus(current)) return history();
  return previousView.apply(this,arguments);
 };
 const previousNav = nav;
 nav = function() {
  previousNav.apply(this,arguments);
  if (!active()) return;
  const host = document.querySelector('#nav');
  const links = [
   ['calendar','PD Kalender',hub.staff(current)],
   ['training-calendar','Ausbildungskalender',!hub.staff(current)],
   ['duty-handover','Schichtübergabe',officer()],
   ['duty-marks','Merkliste & Aufgaben',true],
   ['duty-history','Änderungsverlauf',hub.plus(current)]
  ];
  for (const [key,label,allowed] of links) if (allowed && !host.querySelector(`[data-view="${key}"]`)) {
   const el = button(label,()=>showView(key),'nav-btn');
   el.dataset.view = key;
   host.append(el);
  }
 };

 async function handover() {
  const host = customView('duty-handover','Schichtübergabe · Patrol Unit');
  host.innerHTML = `<details class="hub-editor"><summary>Vorgang eintragen</summary><form class="hub-form">
   <label>Vorgang<input name="title" maxlength="160" required></label>
   <label>Zuständige Unit<input name="unit" maxlength="100" required value="Patrol Unit"></label>
   <label class="hub-wide">Nächster Schritt<textarea name="next_action" maxlength="1600" required></textarea></label>
   <button type="submit" class="primary">Vorgang speichern</button><p role="status"></p></form></details>
   <div class="mrpd-duty-list" aria-live="polite">Übergaben werden geladen …</div>`;
  const results = host.querySelector('.mrpd-duty-list');
  bindForm(host.querySelector('form'),async fields => {
   const values = Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,value.trim()]));
   await list(sb.from('mrpd_shift_handover').insert(values));
   if (host.isConnected) await handover();
  });
  try {
   const query = sb.from('mrpd_shift_handover').select('*').order('created_at',{ascending:false});
   const [open,closed] = await Promise.all([list(sb.from('mrpd_shift_handover').select('*').eq('resolved',false).order('created_at',{ascending:false})),list(query.eq('resolved',true).limit(30))]);
   if (!results.isConnected) return;
   results.replaceChildren();
   const render = (row,target) => {
    const el = document.createElement('article');
    el.innerHTML = `<h3>${esc(row.title)}</h3><small>${esc(row.unit)} · ${esc(calendarDate(row.created_at))}</small><p>${esc(row.next_action)}</p><p role="status"></p>`;
    const actions=document.createElement('div');
    actions.className='mrpd-duty-buttons';
    actions.append(button(row.resolved?'Wieder öffnen':'Erledigt',async event=>{
     const control=event.currentTarget;
     control.disabled=true;
     try {
      await list(sb.from('mrpd_shift_handover').update({resolved:!row.resolved}).eq('id',row.id));
      if (host.isConnected) await handover();
     } catch(error){warning(el.querySelector('[role=status]'),error);control.disabled=false;}
    }));
    if(!row.resolved)actions.append(button('Bearbeiten',()=>{
     const editor=dialog('Vorgang bearbeiten',`<form class="hub-form">
      <label>Vorgang<input name="title" maxlength="160" required value="${esc(row.title)}"></label>
      <label>Zuständige Unit<input name="unit" maxlength="100" required value="${esc(row.unit)}"></label>
      <label class="hub-wide">Nächster Schritt<textarea name="next_action" maxlength="1600" required>${esc(row.next_action)}</textarea></label>
      <button type="submit" class="primary">Speichern</button><p role="status"></p></form>`);
     bindForm(editor.querySelector('form'),async fields=>{
      const values=Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,value.trim()]));
      await list(sb.from('mrpd_shift_handover').update(values).eq('id',row.id));
      editor.close();
      if(host.isConnected)await handover();
     });
    }));
    el.append(actions);
    target.append(el);
   };
   const heading = document.createElement('h3');
   heading.textContent = `Offene Vorgänge (${open.length})`;
   results.append(heading);
   open.forEach(row=>render(row,results));
   if (closed.length) {
    const archived = document.createElement('details');
    archived.innerHTML = '<summary>Zuletzt erledigt</summary>';
    closed.forEach(row=>render(row,archived));
    results.append(archived);
   }
  } catch(error){ warning(results,error); }
 }

 let marksUser, marksPromise;
 const markKey = (source,id) => source + ':' + id;
 function loadMarks() {
  const uid = current?.id;
  if (marksUser !== uid || !marksPromise) {
   marksUser = uid;
   marksPromise = list(sb.from('mrpd_marked_messages').select('*').eq('user_id',uid))
    .then(rows=>new Map(rows.map(row=>[markKey(row.source,row.message_id),row])))
    .catch(error=>{if(marksUser===uid)marksPromise=null;throw error;});
  }
  return marksPromise;
 }
 async function markControls(host, source, id) {
  const uid = current.id;
  host.classList.add('mrpd-duty-buttons');
  host.textContent = 'Markierungen werden geladen …';
  try {
   const marks = await loadMarks();
   if (!host.isConnected || current?.id !== uid) return;
   const key = markKey(source,id);
   const status = document.createElement('small');
   status.setAttribute('role','status');
   const controls = ['saved','task'].map(field=>button('',async()=>{
    controls.forEach(control=>control.disabled=true);
    status.textContent='';
    try {
     const previous = marks.get(key) || {saved:false,task:false};
     const next = {saved:previous.saved,task:previous.task,[field]:!previous[field]};
     const values = {user_id:uid,source,message_id:id};
     if (next.saved || next.task) {
      await list(sb.from('mrpd_marked_messages').upsert({...values,...next}));
      marks.set(key,{...values,...next});
     } else {
      await list(sb.from('mrpd_marked_messages').delete().match(values));
      marks.delete(key);
     }
     draw();
     host.dispatchEvent(new CustomEvent('mrpd-mark-change',{bubbles:true}));
    } catch(error){warning(status,error);}
    finally {controls.forEach(control=>control.disabled=false);}
   }));
   function draw(){
    const item = marks.get(key);
    controls[0].textContent=item?.saved?'Gemerkt':'Für später merken';
    controls[1].textContent=item?.task?'Aufgabe abschließen':'Als Aufgabe markieren';
    controls[0].setAttribute('aria-pressed',String(!!item?.saved));
    controls[1].setAttribute('aria-pressed',String(!!item?.task));
   }
   draw();
   host.replaceChildren(...controls,status);
  }catch(error){warning(host,error);}
 }
 async function openMail(row) {
  const uid=current.id;
  try {
   if (!db.messages.some(message=>message.id===row.id)) {
    const full=await list(sb.from('academy_messages').select('*').eq('id',row.id).maybeSingle());
    if (current?.id!==uid) return;
    if (!full || ![full.sender_id,full.recipient_id].includes(uid)) throw Error('Die Nachricht ist nicht mehr verfügbar.');
    db.messages.push(full);
   }
   await showView('messages');
   root.querySelector(`[data-folder="${row.recipient_id===uid?'in':'out'}"]`)?.click();
   root.querySelector(`[data-select-mail="${CSS.escape(row.id)}"]`)?.click();
  } catch(error){toast(error.message);}
 }
 async function openChat(row) {
  if(!hub.channelAccess(current,row.channel))return;
  await showView(hub.CHANNELS[row.channel].view);
  const message=root.querySelector(`[data-chat-id="${CSS.escape(row.id)}"]`);
  if(!message)return;
  message.scrollIntoView({block:'center'});
  message.animate?.([{outline:'2px solid #a3ddff'},{outline:'2px solid transparent'}],2400);
 }
 async function markedView() {
  const host=customView('duty-marks','Merkliste & Aufgaben');
  const uid=current.id;
  const tabs=document.createElement('div');
  tabs.className='mrpd-duty-buttons';
  const results=document.createElement('div');
  results.className='mrpd-duty-list';
  let filter='task', generation=0;
  tabs.append(button('Offene Aufgaben',()=>{filter='task';draw();}),button('Für später gemerkt',()=>{filter='saved';draw();}));
  host.append(tabs,results);
  host.addEventListener('mrpd-mark-change',()=>draw());
  async function draw(){
   const token=++generation;
   [...tabs.children].forEach((tab,i)=>tab.setAttribute('aria-pressed',String(i===(filter==='task'?0:1))));
   results.textContent='Nachrichten werden geladen …';
   try {
    const marks=[...(await loadMarks()).values()].filter(mark=>mark[filter]);
    const ids=source=>marks.filter(mark=>mark.source===source).map(mark=>mark.message_id);
    const load=(source,table,fields)=>{
     const chunks=ids(source);
     return Promise.all(Array.from({length:Math.ceil(chunks.length/50)},(_,i)=>list(sb.from(table).select(fields).in('id',chunks.slice(i*50,i*50+50))))).then(parts=>parts.flat());
    };
    const [mails,chats]=await Promise.all([
     load('mail','academy_messages','id,subject,body,sender_id,recipient_id,created_at').then(rows=>rows.filter(row=>row.sender_id===uid||row.recipient_id===uid)),
     load('chat','portal_hub_staff_messages','id,channel,body,author_id,created_at')
    ]);
    if(!results.isConnected||current?.id!==uid||generation!==token)return;
    results.replaceChildren();
    const rows=[...mails.map(row=>({...row,source:'mail'})),...chats.map(row=>({...row,source:'chat'}))].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
    for(const row of rows){
     const el=document.createElement('article');
     const heading=row.subject || hub.CHANNELS[row.channel]?.label || 'Chat';
     el.innerHTML=`<h3>${esc(heading)}</h3><small>${esc(person(row.sender_id||row.author_id)?.name||'')} · ${esc(calendarDate(row.created_at))}</small><p>${esc(row.body||'Bildnachricht')}</p>`;
     const actions=document.createElement('div');
     el.append(button(row.source==='mail'?'Im Postfach öffnen':'Channel öffnen',()=>row.source==='mail'?openMail(row):openChat(row)),actions);
     results.append(el);
     markControls(actions,row.source,row.id);
    }
    if(!rows.length)results.textContent=filter==='task'?'Keine offenen Nachrichtenaufgaben.':'Keine gemerkten Nachrichten.';
   } catch(error){if(token===generation)warning(results,error);}
  }
  await draw();
 }

 const changes = {account_type:'Accounttyp',department_id:'Unit',unit_role:'Unit-Funktion',position:'Funktion',description:'Beschreibung',color:'Farbe',username:'Benutzername',name:'Name',service_no:'Dienstnummer',rank:'Dienstgrad',role:'Rolle',access_level:'Zugriff',status:'Status',fto:'FTO',secondary_fto:'Zweiter FTO',leader_fto_id:'Zuständiger FTO',secondary_fto_id:'Zweiter FTO',training_start:'Ausbildungsbeginn',account_enabled:'Aktivierung',archived_at:'Archivierung',from_rank:'Vorheriger Dienstgrad',to_rank:'Neuer Dienstgrad',body:'Kapiteltext',tree:'Organigramm'};
 async function history(){
  const host=customView('duty-history','Änderungsverlauf');
  host.innerHTML='<label>Bereich<select><option value="">Alle Bereiche</option><option>Account</option><option>Dienstgrad</option><option>Kapitel</option><option>Abteilungen</option><option>Units</option><option>Unit-Zuordnung</option></select></label><div class="mrpd-duty-list" aria-live="polite"></div><button class="secondary" type="button" hidden>Ältere Einträge laden</button>';
  const filter=host.querySelector('select'),results=host.querySelector('.mrpd-duty-list'),more=host.querySelector('button');
  let cursor=null,generation=0;
  filter.onchange=()=>{cursor=null;results.replaceChildren();draw();};
  more.onclick=()=>draw();
  async function draw(){
   const token=++generation;
   more.disabled=true;
   try {
    let query=sb.from('mrpd_change_history').select('*').order('id',{ascending:false}).limit(51);
    if(filter.value)query=query.eq('area',filter.value);
    if(cursor!==null)query=query.lt('id',cursor);
    const data=await list(query);
    if(!host.isConnected||token!==generation)return;
    more.hidden=data.length<=50;
    const batch=data.slice(0,50);
    cursor=batch.at(-1)?.id??cursor;
    for(const row of batch){
     const el=document.createElement('article');
     const target=row.area==='Kapitel'?'Kapitel '+chapterNumber(Number(row.target)):row.area==='Abteilungen'?'Organigramm':row.area==='Units'?'Unit':person(row.target)?.name||'Ehemaliger Account';
     const actor=row.actor_id ? person(row.actor_id)?.name||'Ehemaliger Account' : 'System';
     const change={INSERT:'Erstellt',UPDATE:'Geändert',DELETE:'Entfernt'}[row.action];
     el.innerHTML=`<h3>${esc(row.area)} · ${esc(target)}</h3><small>${esc(change)} von ${esc(actor)} · ${esc(calendarDate(row.changed_at))}</small><p>${esc([...new Set(row.fields.map(key=>changes[key]||key))].join(', '))}</p>`;
     results.append(el);
    }
    if(!results.children.length)results.innerHTML='<p>Seit der Einführung wurden hier noch keine Änderungen erfasst.</p>';
   } catch(error){if(token===generation)warning(results,error);}
   finally {if(token===generation)more.disabled=false;}
  }
  await draw();
 }

 async function calendarRsvp(host,event) {
  if(!active()||!hub.staff(current))return;
  const section=document.createElement('details');
  section.className='mrpd-rsvp';
  section.innerHTML='<summary>Teilnahme</summary><div aria-live="polite"></div>';
  host.append(section);
  const output=section.querySelector('div');
  const uid=current.id;
  section.ontoggle=()=>{if(section.open)draw();};
  async function draw(answer=null){
   const existing=output.querySelectorAll('button');
   existing.forEach(control=>control.disabled=true);
   const status=output.querySelector('[role=status]')||document.createElement('p');
   status.setAttribute('role','status');
   status.textContent='Teilnahme wird geladen …';
   if(!status.isConnected)output.append(status);
   try {
    const reply=await list(sb.rpc('mrpd_rsvp',{p_event:event.id,p_answer:answer}));
    if(!section.isConnected||current?.id!==uid)return;
    section.querySelector('summary').textContent=reply.capacity===null?`Teilnahme · ${reply.count} zugesagt`:`Teilnahme · ${reply.count} von ${reply.capacity} Plätzen belegt`;
    output.innerHTML=`<p>${reply.accepted===true?'Du hast zugesagt.':reply.accepted===false?'Du hast abgesagt.':'Du hast noch nicht geantwortet.'}</p>`;
    if(Date.parse(event.ends_at||event.starts_at)>Date.now()){
     const actions=document.createElement('div');
     actions.className='mrpd-duty-buttons';
     const yes=button('Zusagen',()=>draw(true));
     const no=button('Absagen',()=>draw(false));
     yes.disabled=reply.accepted===true||(reply.capacity!==null&&reply.count>=reply.capacity);
     no.disabled=reply.accepted===false;
     actions.append(yes,no);
     output.append(actions);
    }
    if(reply.attendees){
     const attendees=document.createElement('div');
     attendees.innerHTML=reply.attendees.length?`<ul>${reply.attendees.map(p=>`<li>${esc(p.name)} · ${p.accepted?'Zugesagt':'Abgesagt'}</li>`).join('')}</ul>`:'<p>Noch keine Antworten.</p>';
     output.append(attendees);
    }
   }catch(error){warning(status,error);existing.forEach(control=>control.disabled=false);}
  }
 }

 const search=document.querySelector('#globalSearch');
 const results=document.querySelector('#searchResults');
 const plain=html=>new DOMParser().parseFromString(html||'','text/html').body.textContent;
 const normalize=value=>String(value ?? '').toLocaleLowerCase('de-DE').normalize('NFD').replace(/\p{M}/gu,'').replace(/ß/g,'ss');
 let debounce, searchGeneration=0;
 function closeSearch(){clearTimeout(debounce);searchGeneration++;results.classList.add('hidden');}
 function searchInput(){
  closeSearch();
  if(!active()||!search.value.trim())return;
  const token=searchGeneration;
  debounce=setTimeout(()=>runSearch(token),180);
 }
 async function runSearch(token){
  const uid=current?.id;
  const words=normalize(search.value.trim()).split(/\s+/).filter(Boolean);
  if(!words.length)return;
  const hit=[];
  const matches=value=>words.every(word=>normalize(value).includes(word));
  const add=(title,description,open,extra='')=>{
   if(matches([title,description,extra].join(' ')))hit.push({title,description,open});
  };
  const staff=hub.staff(current);
  const permitted=Object.keys(CHAPTERS).map(Number).filter(id=>staff||(current.unlockedChapters||[]).includes(id));
  const term='%'+search.value.trim().split(/\s+/)[0].replace(/[%_\\]/g,c=>'\\'+c)+'%';
  const findEvents=()=>Promise.all(['title','location','notes'].map(field=>list(
   sb.from('portal_hub_pd_events').select('id,title,starts_at,location,notes').ilike(field,term).order('starts_at',{ascending:false}).limit(30)
  ))).then(groups=>[...new Map(groups.flat().map(event=>[event.id,event])).values()]);
  const [customEvents,edits,unitResults,operationResults]=await Promise.allSettled([
   staff?findEvents():Promise.resolve([]),
   permitted.length?list(sb.from('mrpd_chapter_content').select('chapter,body').in('chapter',permitted)):Promise.resolve([]),
   window.MRPDUnits?.search(search.value.trim())||Promise.resolve([]),
   window.MRPDOperations?.search(search.value.trim())||Promise.resolve([])
  ]);
  if(token!==searchGeneration||current?.id!==uid||!active())return;
  const edited=new Map((edits.value||[]).map(row=>[row.chapter,row.body]));
  for(const p of people())add(p.name,[p.rank,p.serviceNo].filter(Boolean).join(' · '),()=>profile(p.id));
  if(staff)for(const r of db.users.filter(r=>r.role==='recruit')){
   add(r.name,'Rekrutenakte · '+(r.serviceNo||'—'),()=>v630OpenRecruit(r.id),r.status);
  }
  for(const id of permitted){
   const c=CHAPTERS[id], body=edited.get(id);
   add(`Kapitel ${chapterNumber(id)} · ${c.title}`,'Rekrutenhandbuch',()=>showChapter(id),plain(body?.replace(/^MRPD-RICH-V1\n/,'')??c.html));
  }
  for(const event of customEvents.value||[])add(event.title,`PD-Kalender · ${calendarDate(event.starts_at)}`,()=>hub.openCalendarEvent(event),event.location+' '+event.notes);
  if(!staff)for(const event of trainingEvents)add(event.title,`Ausbildungskalender · ${calendarDate(event.starts_at)}`,()=>showView('training-calendar'),event.location);
  for(const item of unitResults?.value||[])hit.push(item);
  for(const item of operationResults?.value||[])hit.push(item);
  for(const view of document.querySelectorAll('#nav button[data-view]')){
   const key=view.dataset.view;
   const channel=Object.keys(hub.CHANNELS).find(name=>hub.CHANNELS[name].view===key);
   if(view.hidden||view.disabled||(channel&&!hub.channelAccess(current,channel)))continue;
   const title=view.textContent.trim();
   if(title)add(title,'Portalbereich',()=>showView(key));
  }
  results.replaceChildren();
  for(const item of hit.slice(0,18)){
   const control=button('',()=>{closeSearch();search.value='';item.open();},'search-item search-item-v543');
   control.innerHTML=`<span aria-hidden="true">→</span><span><b>${esc(item.title)}</b><small>${esc(item.description)}</small></span>`;
   results.append(control);
  }
  if(!hit.length)results.textContent='Keine Treffer.';
  if(customEvents.status==='rejected'||edits.status==='rejected'){
   const status=document.createElement('div');
   status.textContent='Ein Teil der Suchdaten konnte nicht geladen werden.';
   results.append(status);
  }
  results.classList.remove('hidden');
 }
 function installSearch(){
  if(!search||!results)return;
  search.placeholder='Personen, Kapitel, Termine und Akten suchen';
  search.setAttribute('aria-label','Portal durchsuchen');
 }
 search?.addEventListener('input',event=>{event.stopImmediatePropagation();searchInput();},{capture:true});
 search?.addEventListener('focus',()=>{if(search.value.trim())searchInput();});
 search?.addEventListener('keydown',event=>{
  if(event.key==='Escape'){closeSearch();return;}
  if(event.key==='ArrowDown'&&!results.classList.contains('hidden')){
   event.preventDefault();results.querySelector('button')?.focus();
  }
 });
 results?.addEventListener('keydown',event=>{
  const controls=[...results.querySelectorAll('button')];
  const index=controls.indexOf(document.activeElement);
  if(event.key==='Escape'){event.preventDefault();search.focus();closeSearch();}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();
   const next=index+(event.key==='ArrowDown'?1:-1);
   if(next<0){search.focus();closeSearch();}
   else controls[next]?.focus();
  }
 });
 document.addEventListener('pointerdown',event=>{if(search&&!search.closest('.searchbox')?.contains(event.target))closeSearch();});

 function decorate() {
  if(!active())return;
  installSearch();
  const view=hub.state.currentView;
  const pageTitle=document.querySelector('#pageTitle')?.textContent;
  const tabs=root.querySelector('.record-tabs');
  const recruit=tabs&&hub.staff(current)&&db.users.find(p=>p.id===selectedRecruit&&p.role==='recruit');
  if(recruit&&!root.querySelector('.mrpd-record-next')){
   const el=card('Nächster Ausbildungsschritt');
   el.classList.add('mrpd-record-next');
   bodyOf(el).textContent='Ausbildungsschritt wird geladen …';
   tabs.before(el);
   nextStep(el,recruit);
  }
  if(view==='plan'&&pageTitle==='Mein Plan'&&!hub.staff(current)&&hub.rankIndex(current)<=0&&!root.querySelector('.mrpd-plan-next')){
   const uid=current.id,el=card('Nächster Ausbildungsschritt');
   el.classList.add('mrpd-plan-next');
   root.prepend(el);
   const host=bodyOf(el);
   list(sb.from('mrpd_next_steps').select('*').eq('recruit_id',uid).maybeSingle()).then(step=>{
    if(!el.isConnected||current?.id!==uid)return;
    host.textContent=step?[step.task,person(step.fto_id)?.name||'FTO nicht mehr im Verzeichnis',day(step.due_on)].filter(Boolean).join(' · '):'Dein FTO hat noch keinen nächsten Schritt eingetragen.';
   }).catch(error=>warning(host,error));
  }
  const reader=root.querySelector('.mail-reader-actions');
  const reply=reader?.querySelector('[data-reply]');
  if(reply&&!reader.querySelector('[data-duty-mark]')){
   const host=document.createElement('span');
   host.dataset.dutyMark='';
   reader.append(host);
   markControls(host,'mail',reply.dataset.reply);
  }
  for(const message of root.querySelectorAll('[data-chat-id] .hub-message-actions')){
   if(message.querySelector('[data-duty-mark]'))continue;
   const host=document.createElement('span');
   host.dataset.dutyMark='';
   message.append(host);
   markControls(host,'chat',message.closest('[data-chat-id]').dataset.chatId);
  }
 }
 new MutationObserver(decorate).observe(root,{childList:true,subtree:true});
 sb.auth.onAuthStateChange(event=>{
  if(event!=='SIGNED_OUT')return;
  marksUser=marksPromise=null;
  if(search){closeSearch();search.value='';results.replaceChildren();}
  document.querySelectorAll('.mrpd-duty-dialog[open]').forEach(el=>el.close());
 });
 window.MRPDDuty={profile,calendarRsvp};
 decorate();
})();
