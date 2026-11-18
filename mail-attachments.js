/* Private Nachrichtenanhänge: Auswahl, Upload, Anzeige und Download. */
const MAIL_BUCKET='apd-mail-attachments',MAIL_MAX_FILES=5,MAIL_MAX_FILE=20*1024*1024,MAIL_MAX_TOTAL=50*1024*1024;
function mailSize(bytes){return bytes>=1024*1024?(bytes/1024/1024).toLocaleString('de-DE',{maximumFractionDigits:1})+' MB':Math.ceil(bytes/1024)+' KB'}
function mailValidateFiles(files){
 if(files.length>MAIL_MAX_FILES)throw new Error('Maximal 5 Dateien pro Nachricht.');
 if(files.some(f=>!f.size))throw new Error('Leere Dateien können nicht angehängt werden.');
 if(files.some(f=>f.size>MAIL_MAX_FILE))throw new Error('Eine Datei darf höchstens 20 MB groß sein.');
 if(files.reduce((sum,f)=>sum+f.size,0)>MAIL_MAX_TOTAL)throw new Error('Alle Anhänge zusammen dürfen höchstens 50 MB groß sein.');
}
function mailAttachmentsHtml(message){const items=Array.isArray(message.attachments)?message.attachments:[];if(!items.length)return '';
 return `<section class="mail-attachments"><h3>📎 Anhänge (${items.length})</h3>${items.map((f,i)=>`<button type="button" class="mail-file-download" data-mail-file-message="${esc(message.id)}" data-mail-file-index="${i}"><span>📄</span><span><b>${esc(f.name)}</b><small>${mailSize(+f.size||0)}</small></span><span>Herunterladen ↓</span></button>`).join('')}</section>`;
}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-mail-file-message]');if(!b)return;
 const m=(db.messages||[]).find(x=>x.id===b.dataset.mailFileMessage),file=m?.attachments?.[+b.dataset.mailFileIndex];if(!file||![m.sender_id,m.recipient_id].includes(current?.id))return;
 b.disabled=true;try{const {data,error}=await sb.storage.from(MAIL_BUCKET).createSignedUrl(file.path,60,{download:file.name});if(error)throw error;
 const link=document.createElement('a');link.href=data.signedUrl;link.download=file.name;link.rel='noopener';document.body.append(link);link.click();link.remove();
 }catch(err){toast('⚠ Datei konnte nicht geladen werden: '+err.message)}finally{b.disabled=false}
});
function mailInstallUploads(){
 const form=document.querySelector('#v62MailForm');if(!form)return;let files=[],sending=false;
 const body=form.querySelector('[name="body"]');body.required=false;
 body.insertAdjacentHTML('afterend',`<section class="mail-upload"><input type="file" id="mailFileInput" multiple hidden><button type="button" class="secondary" id="mailChooseFiles">📎 Dateien vom Rechner hinzufügen</button><p class="muted">Bis zu 5 Dateien · 20 MB pro Datei · insgesamt 50 MB</p><div id="mailSelectedFiles"></div><p id="mailUploadStatus" role="status" aria-live="polite"></p></section>`);
 const modal=document.querySelector('#v621ComposeModal');if(modal)modal.onclick=e=>{if(!sending&&e.target===modal)modal.classList.add('hidden')};
 const input=form.querySelector('#mailFileInput'),list=form.querySelector('#mailSelectedFiles'),status=form.querySelector('#mailUploadStatus'),submit=form.querySelector('button[type="submit"],footer .primary');
 const render=()=>{list.innerHTML=files.map((f,i)=>`<div class="mail-selected-file"><span><b>${esc(f.name)}</b><small>${mailSize(f.size)}</small></span><button type="button" data-remove-file="${i}" aria-label="${esc(f.name)} entfernen">Entfernen ×</button></div>`).join('');list.querySelectorAll('[data-remove-file]').forEach(b=>b.onclick=()=>{if(sending)return;files.splice(+b.dataset.removeFile,1);render()})};
 form.querySelector('#mailChooseFiles').onclick=()=>{if(!sending)input.click()};
 input.onchange=()=>{try{const added=[...input.files].filter(f=>!files.some(x=>x.name===f.name&&x.size===f.size&&x.lastModified===f.lastModified));const next=[...files,...added];mailValidateFiles(next);files=next;status.textContent='';render()}catch(err){status.textContent=err.message}input.value=''};
 form.onsubmit=async e=>{e.preventDefault();if(sending)return;const recipient=form.elements.recipient.value,subject=form.elements.subject.value.trim(),text=body.value.trim();
 if(!recipient||!subject){form.reportValidity();return}if(!text&&!files.length){status.textContent='Bitte eine Nachricht schreiben oder eine Datei hinzufügen.';return}
 try{mailValidateFiles(files)}catch(err){status.textContent=err.message;return}
 sending=true;submit.disabled=true;const close=document.querySelector('#v621ComposeClose');if(close)close.disabled=true;
 const uploaded=[],messageId=crypto.randomUUID(),senderId=current?.id;
 const isCurrent=()=>current?.id===senderId;
 try{
  const {data:{user},error:authError}=await sb.auth.getUser();if(authError||!user||user.id!==senderId)throw new Error('Bitte erneut anmelden.');
  for(let i=0;i<files.length;i++){
   if(!isCurrent())throw new Error('Die Sitzung wurde geändert.');const f=files[i];status.textContent=`Datei ${i+1}/${files.length} wird hochgeladen: ${f.name}`;
   const path=`${senderId}/${messageId}/${crypto.randomUUID()}`;
   const {error}=await sb.storage.from(MAIL_BUCKET).upload(path,f,{upsert:false,contentType:'application/octet-stream'});if(error)throw error;
   uploaded.push({path,name:f.name.slice(0,255),size:f.size});
  }
  if(!isCurrent())throw new Error('Die Sitzung wurde geändert.');status.textContent='Nachricht wird gesendet…';
  await v62SendMessage({recipientId:recipient,subject,body:text||'Dateien im Anhang.',messageId,attachments:uploaded});
  files=[];if(isCurrent()){await refreshData();toast('✓ Nachricht mit '+uploaded.length+' Anhängen gesendet');messagesView()}
 }catch(err){
  // Bei unklarer Antwort prüfen, ob die Nachricht bereits gespeichert ist.
  let delivered=false;
  if(uploaded.length&&isCurrent()){
   const {data,error}=await sb.from('academy_messages').select('id').eq('id',messageId).maybeSingle();
   if(!error&&data){delivered=true;files=[];await refreshData();messagesView();toast('✓ Nachricht wurde gesendet')}
   else if(!error&&!data){await sb.storage.from(MAIL_BUCKET).remove(uploaded.map(x=>x.path))}
  }
  if(!delivered)status.textContent='Senden fehlgeschlagen: '+err.message+' Prüfe, ob die neue SQL-Datei ausgeführt wurde. Deine Dateiauswahl bleibt erhalten.';
 }finally{sending=false;submit.disabled=false;if(close)close.disabled=false}
 };
}
const mailUploadMessagesBase=messagesView;
messagesView=function(){const result=mailUploadMessagesBase();mailInstallUploads();return result};

