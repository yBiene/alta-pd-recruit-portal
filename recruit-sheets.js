/* APD document editor. No real test limits are implied; FTO enters server rules. */
(function(){
'use strict';
const common=[['serviceNo','Dienstnummer'],['name','Name / Rookie'],['start','Einstellungsdatum'],['rank','Dienstgrad'],['fto','Leiter FTO'],['secondaryFto','Weiterer FTO']];
const definitions={
 sport:{title:'Sporttest',sub:'LEISTUNGSNACHWEIS · ACADEMY',sections:[['REKRUT & PRÜFUNG',[...common,['date','Prüfungsdatum'],['examiner','Prüfer / FTO']]],['DISZIPLINEN & ERGEBNISSE',[['run','Ausdauerlauf · Distanz / Zeit'],['runTarget','Vorgabe / Ergebnis'],['strength','Krafttest · Übung / Leistung'],['strengthTarget','Vorgabe / Ergebnis'],['obstacle','Parcours · Zeit / Leistung'],['obstacleTarget','Vorgabe / Ergebnis'],['extra','Weitere Disziplin'],['extraTarget','Vorgabe / Ergebnis']]],['GESAMTBEWERTUNG',[['result','Gesamtergebnis'],['repeat','Nachprüfung / nächster Termin'],['notes','Bemerkungen',true],['confirmed','Bestätigt durch / Datum']]]]},
 info:{title:'Infoblatt',sub:'RECRUIT PROFILE · PERSONALÜBERSICHT',sections:[['PERSON & DIENST',[...common,['username','Portal-Benutzername'],['status','Ausbildungsstatus']]],['AUSBILDUNGSÜBERSICHT',[['phase','Aktuelle Ausbildungsphase'],['progress','Kapitel / Fortschritt'],['time','Dokumentierte Ausbildungszeit'],['tests','Bestandene Tests'],['radio','Funkkennung / Rufname'],['availability','Erreichbarkeit / Dienstzeiten']]],['FTO-KURZPROFIL',[['strengths','Stärken / Vorkenntnisse',true],['goals','Aktuelle Ziele / Trainingsbedarf',true],['notes','Weitere Hinweise',true],['confirmed','Erstellt / aktualisiert durch']]]]}
};
const cache=new Map();
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fields=kind=>definitions[kind].sections.flatMap(s=>s[1]);
function defaults(r,kind){return {serviceNo:r.serviceNo||'',name:r.name||'',start:r.start||'',rank:r.rank||'Recruit',fto:r.fto||'',secondaryFto:r.secondaryFto||'',username:r.username||'',status:r.status||'',phase:stage(r),progress:`${r.completed.length}/22 · ${progress(r)} %`,time:fmtDuration(totalTrainingMinutes(r)),tests:String((r.testResults||[]).filter(t=>t.passed).length),goals:(r.goals||[]).filter(g=>!g.done).map(g=>g.text).join('; '),date:new Date().toLocaleDateString('de-DE'),examiner:current.name||'',confirmed:current.name||'',...kind==='sport'?{result:'Noch nicht bewertet'}:{}}}
async function fetchSheet(r,kind){
 const {data,error}=await sb.from('academy_recruit_sheets').select('*').eq('recruit_id',r.id).eq('kind',kind).maybeSingle();
 if(error)throw Error('Dokumentenablage nicht erreichbar. Bitte zuerst APD_Dokumente_Setup.sql in Supabase ausführen. Details: '+error.message);
 if(data)cache.set(r.id+':'+kind,data);else cache.delete(r.id+':'+kind);
 return data;
}
// Shared A4 layout for PDF and image export, coordinates in points.
function layout(kind){let y=150;const out=[];for(const [title,items] of definitions[kind].sections){out.push({section:title,y});y+=24;for(let i=0;i<items.length;){const f=items[i];if(f[2]){out.push({key:f[0],label:f[1],x:34,y,w:527,h:50,multi:true});y+=61;i++}else{for(let j=0;j<2&&i<items.length&&!items[i][2];j++,i++){const a=items[i];out.push({key:a[0],label:a[1],x:34+j*270,y,w:257,h:36})}y+=46}}y+=9}return out}
function textLines(ctx,text,maxWidth,maxLines){let lines=[];for(const paragraph of String(text||'').split('\n')){let line='';for(const word of paragraph.split(/\s+/)){if(ctx.measureText(line+(line?' ':'')+word).width>maxWidth&&line){lines.push(line);line=word}else line+=(line?' ':'')+word}lines.push(line)}if(lines.length>maxLines){lines=lines.slice(0,maxLines);lines[maxLines-1]=lines[maxLines-1].slice(0,-3)+'…'}return lines}
function canvas(kind,values={},blank=false){
 const c=document.createElement('canvas');c.width=1785;c.height=2526;const x=c.getContext('2d');x.scale(3,3);
 x.fillStyle='#f4f8fc';x.fillRect(0,0,595,842);x.fillStyle='#0b2238';x.fillRect(0,0,595,131);x.fillStyle='#2bb6ed';x.fillRect(0,131,595,4);
 x.fillStyle='#70d3ff';x.font='bold 10px Arial';x.fillText('ALTA POLICE DEPARTMENT',34,36);x.fillStyle='#fff';x.font='bold 32px Arial';x.fillText(definitions[kind].title,34,79);x.fillStyle='#b8d1e4';x.font='10px Arial';x.fillText(definitions[kind].sub,35,104);
 x.strokeStyle='#5faac9';x.lineWidth=1;x.strokeRect(504,29,57,57);x.fillStyle='#fff';x.font='bold 18px Arial';x.fillText('APD',512,64);
 for(const f of layout(kind)){if(f.section){x.fillStyle='#126c9c';x.font='bold 10px Arial';x.fillText(f.section,34,f.y);continue}x.fillStyle='#fff';x.fillRect(f.x,f.y,f.w,f.h);x.strokeStyle='#d5e2ec';x.strokeRect(f.x,f.y,f.w,f.h);x.fillStyle='#5d7486';x.font='8px Arial';x.fillText(f.label.toUpperCase(),f.x+10,f.y+12);if(!blank){x.save();x.beginPath();x.rect(f.x+8,f.y+17,f.w-16,f.h-19);x.clip();x.fillStyle='#102d44';x.font='11px Arial';const lines=textLines(x,values[f.key],f.w-22,f.multi?2:1);lines.forEach((s,i)=>x.fillText(s,f.x+10,f.y+29+i*14));x.restore()}}
 x.fillStyle='#6d8191';x.font='8px Arial';x.fillText('APD ACADEMY  /  INTERNER AUSBILDUNGSNACHWEIS',34,815);x.fillText('01 / 01',528,815);
 return c;
}
function winAnsi(value){return String(value||'').replace(/[^\x20-\x7e\xa0-\xff\n]/g,c=>({'–':'-','—':'-','…':'...','✓':'OK','’':"'",'„':'"','“':'"'}[c]||'?'))}
async function pdf(kind,values,editable){
 if(!window.PDFLib)throw Error('PDF-Modul fehlt. Bitte den Ordner vendor mit hochladen.');
 const {PDFDocument,StandardFonts,rgb}=PDFLib;const doc=await PDFDocument.create();doc.setTitle('APD · '+definitions[kind].title);const page=doc.addPage([595,842]);const bg=await doc.embedPng(canvas(kind,{},true).toDataURL('image/png'));page.drawImage(bg,{x:0,y:0,width:595,height:842});
 const form=doc.getForm(),font=await doc.embedFont(StandardFonts.Helvetica);
 for(const f of layout(kind).filter(f=>f.key)){const field=form.createTextField(f.key);if(f.multi)field.enableMultiline();field.setText(winAnsi(values[f.key]));field.addToPage(page,{x:f.x+9,y:842-f.y-f.h+4,width:f.w-18,height:f.h-21,font,borderWidth:0,textColor:rgb(.06,.17,.26)});field.setFontSize(11)}
 form.updateFieldAppearances(font);if(!editable)form.flatten();return new Blob([await doc.save()],{type:'application/pdf'});
}
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000)}
const imageBlob=(c,type)=>new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('Bildexport fehlgeschlagen')),type,.95));
async function open(r,kind){
 if(!isTrainer(current))return;
 document.querySelector('#apdSheetEditor')?.remove();
 const prior=document.activeElement,dialog=document.createElement('dialog');dialog.id='apdSheetEditor';dialog.className='apd-sheet-editor';
 dialog.innerHTML=`<header><div><small>APD · DOKUMENTENSTUDIO</small><h2>${definitions[kind].title} <span>· ${E(r.name)}</span></h2></div><button type="button" data-close aria-label="Editor schließen">✕</button></header><p class="apd-sheet-help">Links bearbeiten · PDF-Vorschau rechts. „Speichern“ übernimmt den Stand in die Akte. PNG/JPEG speichert den Stand ebenfalls und lädt das Bild herunter.</p><div class="apd-sheet-work"><form id="apdSheetForm">${definitions[kind].sections.map(([title,items])=>`<fieldset><legend>${title}</legend><div>${items.map(([key,label,multi])=>`<label class="${multi?'full':''}">${label}${multi?`<textarea name="${key}" rows="2" maxlength="220"></textarea>`:`<input name="${key}" maxlength="100">`}</label>`).join('')}</div></fieldset>`).join('')}</form><div class="apd-sheet-preview"><iframe title="PDF-Vorschau des ${definitions[kind].title}s"></iframe><canvas aria-label="Bildvorschau" hidden></canvas></div></div><footer><span id="apdSheetStatus" role="status" aria-live="polite">Letzten Stand laden …</span><div><button type="button" data-action="save">✓ Speichern</button><button type="button" data-action="png">⬇ PNG</button><button type="button" data-action="jpeg">⬇ JPEG</button><button type="button" data-action="pdf">🖨️ PDF</button></div></footer>`;
 document.body.append(dialog);dialog.showModal();
 const form=dialog.querySelector('form'),status=dialog.querySelector('#apdSheetStatus'),buttons=[...dialog.querySelectorAll('[data-action]')];
 let values=defaults(r,kind),loaded=false,dirty=false,busy=false,url=null,revision=0,timer;
 const ownerId=current.id;
 const value=()=>Object.fromEntries(new FormData(form));
 const info=text=>status.textContent=text;
 const enable=()=>buttons.forEach(b=>b.disabled=!loaded||busy);
 const close=()=>{if(busy){info('Speicherung läuft. Bitte kurz warten.');return}if(dirty&&!confirm('Ungespeicherte Änderungen verwerfen?'))return;clearTimeout(timer);revision++;if(url)URL.revokeObjectURL(url);dialog.close();dialog.remove();prior?.focus()};
 dialog.querySelector('[data-close]').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close()});form.onsubmit=e=>e.preventDefault();
 async function preview(){const id=++revision;try{const blob=await pdf(kind,value(),false);if(id!==revision||!dialog.isConnected)return;const next=URL.createObjectURL(blob);dialog.querySelector('iframe').src=next+'#toolbar=0&navpanes=0&view=FitH';if(url)URL.revokeObjectURL(url);url=next}catch(e){info(e.message);const output=dialog.querySelector('canvas'),img=canvas(kind,value());output.hidden=false;output.width=img.width;output.height=img.height;output.getContext('2d').drawImage(img,0,0);dialog.querySelector('iframe').hidden=true}}
 form.addEventListener('input',()=>{dirty=true;info('Ungespeicherte Änderungen');clearTimeout(timer);timer=setTimeout(preview,450)});
 enable();try{const saved=await fetchSheet(r,kind);if(!dialog.isConnected)return;values={...values,...saved?.fields};for(const f of fields(kind)){form.elements[f[0]].value=values[f[0]]||''}loaded=true;info(saved?'Zuletzt gespeichert: '+new Date(saved.updated_at).toLocaleString('de-DE')+' · '+saved.author_name:'Neue Vorlage · noch nicht gespeichert');enable();await preview()}catch(e){info(e.message);form.querySelectorAll('input,textarea').forEach(el=>el.disabled=true)}
 for(const button of buttons)button.onclick=async()=>{
  if(!loaded||busy)return;if(current?.id!==ownerId)return info('Sitzung geändert. Editor schließen und erneut öffnen.');
  busy=true;enable();form.inert=true;const data=value(),action=button.dataset.action;
  try{
   // Prepare export first, so a failed render never creates a misleading saved snapshot.
   let blob;if(action==='pdf')blob=await pdf(kind,data,true);else if(action==='png'||action==='jpeg')blob=await imageBlob(canvas(kind,data),'image/'+action);
   const {data:saved,error}=await sb.from('academy_recruit_sheets').upsert({recruit_id:r.id,kind,fields:data,author_id:ownerId,author_name:current.name},{onConflict:'recruit_id,kind'}).select().single();
   if(error)throw Error('Nicht gespeichert: '+error.message);
   cache.set(r.id+':'+kind,saved);dirty=false;
   info('✓ In der Akte gespeichert · '+new Date(saved.updated_at).toLocaleString('de-DE'));
   if(blob)download(blob,`APD_${kind==='sport'?'Sporttest':'Infoblatt'}_${String(r.serviceNo||'Rookie').replace(/[^a-zA-Z0-9_-]/g,'_')}.${action==='jpeg'?'jpg':action}`);
  }catch(e){info(e.message)}finally{busy=false;form.inert=false;enable()}
 };
}
async function printAttachments(r){
 let sheets;try{const {data,error}=await sb.from('academy_recruit_sheets').select('*').eq('recruit_id',r.id);if(error)throw error;sheets=data||[]}catch(e){throw Error('Dokumente konnten nicht geladen werden. Die Gesamtakte wurde nicht erstellt, damit kein gespeicherter Sporttest fehlt. '+e.message)}
 return ['sport','info'].map(kind=>{const s=sheets.find(x=>x.kind===kind);if(!s)return '';return `<section class="section apd-saved-sheet" style="break-before:page"><div class="section-title"><div><small>GESPEICHERTER DOKUMENTENSTAND</small><h3>${definitions[kind].title}</h3></div><span>${E(new Date(s.updated_at).toLocaleString('de-DE'))} · ${E(s.author_name)}</span></div><img alt="Zuletzt gespeicherter ${definitions[kind].title}" src="${canvas(kind,s.fields).toDataURL('image/png')}" style="width:auto;max-width:100%;max-height:230mm;height:auto;display:block;margin:auto"></section>`}).join('');
}
const baseAdmin=admin;admin=function(){baseAdmin();const root=document.querySelector('.apd-record-compact'),r=db.users.find(x=>x.id===selectedRecruit);if(!root||!r)return;const actions=root.querySelector('.record-actions'),print=root.querySelector('#printRecruitRecord');if(!actions||!print)return;print.textContent='🖨️ Gesamt Akte';print.title='Vollständige Ausbildungsakte mit gespeicherten Dokumenten';if(!actions.querySelector('[data-sheet-kind]'))for(const [kind,label] of [['sport','🖨️ Sporttest'],['info','📋 Infoblatt']]){const b=document.createElement('button');b.type='button';b.className='secondary apd-document-button';b.dataset.sheetKind=kind;b.textContent=label;b.onclick=()=>open(r,kind);print.after(b)}const pill=actions.querySelector('.readiness-pill');if(pill)actions.append(pill);const sport=actions.querySelector('[data-sheet-kind="sport"]'),info=actions.querySelector('[data-sheet-kind="info"]');if(sport&&info)sport.after(info)};
window.APD_SHEETS={open,canvas,pdf,printAttachments,definitions};
})();
