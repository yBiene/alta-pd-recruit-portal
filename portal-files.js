/* Private attachments for Unit documents, messages and Department operations. */
(() => {
 'use strict';
 const bucket='mrpd-portal-files';
 const result=async query=>{const {data,error}=await query;if(error)throw error;return data;};
 const rpc=(action,id,data={})=>result(sb.rpc('mrpd_file_command',{p_action:action,p_id:id,p_data:data}));
 async function mount(host,type,id,editable=false){
  const actor=current?.id;if(!actor||!host||host.querySelector(':scope > [data-portal-files]'))return;
  const section=document.createElement('section');section.dataset.portalFiles='';section.className='portal-files';
  section.innerHTML='<h3>Anhänge</h3><div data-file-list>Dateien werden geladen …</div><p role="status"></p>';
  host.append(section);
  if(type==='message'){section.innerHTML='<details><summary>Anhänge</summary>'+section.innerHTML+'</details>';}
  const body=section.querySelector('details')||section;
  let pending=[];
  const status=section.querySelector('[role=status]');
  const load=async()=>{
   const files=await result(sb.from('mrpd_portal_files').select('*').eq('target_type',type).eq('target_id',id).eq('ready',true).order('created_at'));
   if(!section.isConnected||current?.id!==actor)return;
   const list=section.querySelector('[data-file-list]');list.replaceChildren();
   if(!files.length)list.textContent='Noch keine Anhänge.';
   for(const file of files){
    const row=document.createElement('a');row.target='_blank';row.rel='noopener';row.className='portal-file';row.textContent=file.name+' · '+(file.bytes/1048576).toFixed(2)+' MB';list.append(row);
    try{
     const signed=await result(sb.storage.from(bucket).createSignedUrl(file.id,600));
     if(!row.isConnected||current?.id!==actor)continue;row.href=signed.signedUrl;
     if(file.mime.startsWith('image/')){const img=document.createElement('img');img.src=signed.signedUrl;img.alt=file.name;img.loading='lazy';row.prepend(img);}
    }catch(error){row.textContent=file.name+' · Datei konnte nicht geladen werden.';}
   }
  };
  if(editable){
   const form=document.createElement('form');form.innerHTML='<label>Dateien ergänzen · Bilder oder PDF<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple></label><button type="submit" class="secondary">Anhänge hochladen</button>';
   body.append(form);
   const input=form.querySelector('input'),button=form.querySelector('button');
   input.onchange=()=>{pending=[...input.files].map(file=>({id:crypto.randomUUID(),file}));};
   form.onsubmit=async event=>{
    event.preventDefault();button.disabled=true;input.disabled=true;
    try{
     if(current?.id!==actor)throw Error('Die Sitzung hat sich geändert.');
     for(const item of pending){
      if(item.done)continue;
      const file=item.file;
      if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)||file.size<1||file.size>10485760)throw Error('Bitte Bilder oder PDF bis 10 MB je Datei wählen.');
      status.textContent='Wird hochgeladen · '+file.name;
      const meta=await rpc('prepare',item.id,{target_type:type,target_id:id,name:file.name.slice(0,255),mime:file.type,bytes:file.size});
      if(!meta.ready){
       const {error}=await sb.storage.from(bucket).upload(item.id,file,{contentType:file.type,upsert:false});
       if(error&&!/already exists|duplicate/i.test(error.message||'')&&String(error.statusCode)!=='409')throw error;
       await rpc('finish',item.id);
      }
      item.done=true;
     }
     pending=[];form.reset();status.textContent='Anhänge gespeichert.';await load();window.APD_UX?.clean(form);
    }catch(error){status.textContent=error.message+' Bereits gespeicherte Dateien bleiben erhalten. Der Upload kann erneut gestartet werden.';}
    finally{button.disabled=false;input.disabled=false;}
   };
  }
  if(type==='message'){section.querySelector('details').addEventListener('toggle',async event=>{if(event.target.open){try{await load();}catch(error){status.textContent=error.message;}}});}
  else try{await load();}catch(error){status.textContent=error.message;}
 }
 window.MRPDPortalFiles=Object.freeze({mount});
})();
