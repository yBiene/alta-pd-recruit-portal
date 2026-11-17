/* MRPD: visual Discord invitations. Webhooks stay in this dialog only. */
(()=>{'use strict';
const LOGO='https://ybiene.github.io/alta-pd-recruit-portal/assets/mrpd-invite-logo.png';
const PORTAL='https://ybiene.github.io/alta-pd-recruit-portal/';
let activeDialog=null;
function webhookURL(value){
 let url;try{url=new URL(String(value).trim())}catch{throw new Error('Bitte eine gültige Discord-Webhook-URL einfügen.')}
 if(url.protocol!=='https:'||!['discord.com','discordapp.com'].includes(url.hostname)||url.port||url.username||url.password||!/^\/api(?:\/v\d+)?\/webhooks\/\d{16,22}\/[A-Za-z0-9_-]{20,200}\/?$/.test(url.pathname))throw new Error('Bitte den Webhook direkt aus Discord kopieren (Kanal bearbeiten → Integrationen → Webhooks).');
 const thread=url.searchParams.get('thread_id');
 if(thread&&!/^\d{16,22}$/.test(thread))throw new Error('Die Thread-ID in der Webhook-URL ist ungültig.');
 url.hostname='discord.com';url.hash='';url.search='';url.searchParams.set('wait','true');
 if(thread)url.searchParams.set('thread_id',thread);
 return url.href;
}
async function sendInvitation(value,payload,request=fetch){
 const url=webhookURL(value),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  let response;try{response=await request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal})}catch{const err=new Error('Sendestatus unbekannt. Bitte zuerst im Discord-Kanal prüfen, ob die Einladung angekommen ist, bevor du erneut sendest.');err.uncertain=true;throw err}
  if(response.status===429){const data=await response.json().catch(()=>({}));const seconds=Math.max(1,Math.ceil(Number(data.retry_after)||5));throw new Error('Discord begrenzt gerade Anfragen. Bitte '+seconds+' Sekunden warten und dann erneut senden.')}
  if(!response.ok){await response.body?.cancel().catch(()=>{});throw new Error(response.status===401||response.status===404?'Der Webhook ist ungültig oder wurde gelöscht. Bitte in Discord einen aktuellen Webhook kopieren.':response.status===403?'Discord verweigert das Senden in diesen Kanal. Bitte die Kanalberechtigungen prüfen.':'Discord hat die Einladung abgelehnt (Status '+response.status+'). Bitte Webhook und Kanal prüfen.')}
  const message=await response.json().catch(()=>null);
  if(!message?.id){const err=new Error('Discord hat den Versand nicht eindeutig bestätigt. Bitte zuerst im Kanal prüfen, ob die Einladung angekommen ist.');err.uncertain=true;throw err}
  return message;
 }finally{clearTimeout(timer)}
}
function open(c,payload){
 if(activeDialog){activeDialog.focus();return}
 const invitation=structuredClone(payload);invitation.avatar_url=LOGO;invitation.allowed_mentions={parse:[]};
 const embed=invitation.embeds[0],dialog=document.createElement('dialog');activeDialog=dialog;
 dialog.className='hub-dialog mrpd-discord-dialog';dialog.setAttribute('aria-labelledby','mrpd-discord-title');
 dialog.innerHTML=`<header><div><span class="mrpd-discord-eyebrow">MRPD · PERSONALVERWALTUNG</span><h2 id="mrpd-discord-title">Einladung für Discord</h2><p class="muted">So erscheint deine Einladung im Discord-Kanal.</p></div><button type="button" data-close aria-label="Schließen">×</button></header>
 <div class="mrpd-discord-preview" aria-label="Vorschau der Discord-Nachricht"><img class="mrpd-discord-avatar" alt="MRPD" src="${LOGO}"><div class="mrpd-discord-message"><div class="mrpd-discord-sender">MRPD · Personalverwaltung <span>APP</span><time>Vorschau</time></div><article class="mrpd-discord-embed"><img class="mrpd-discord-thumbnail" src="${LOGO}" alt="MRPD Logo"><a class="mrpd-discord-title" href="${PORTAL}" target="_blank" rel="noopener noreferrer"></a><p class="mrpd-discord-description"></p><div class="mrpd-discord-fields"></div><footer></footer></article></div></div>
 <form class="mrpd-discord-form" autocomplete="off"><label for="mrpd-discord-webhook">Webhook des gewünschten Discord-Kanals</label><input id="mrpd-discord-webhook" type="password" required autocomplete="off" spellcheck="false" placeholder="https://discord.com/api/webhooks/…" aria-describedby="mrpd-discord-help"><p id="mrpd-discord-help" class="muted">In Discord: Kanal bearbeiten → Integrationen → Webhooks → Webhook-URL kopieren. Die URL wird nicht gespeichert und beim Schließen entfernt.</p><p class="mrpd-discord-destination">Die Einladung enthält Zugangsdaten und ist für alle Mitglieder im Zielkanal sichtbar.</p><div class="mrpd-discord-actions"><button class="primary" type="submit">Einladung an Discord senden</button><button class="secondary" type="button" data-copy-text>Einladungstext kopieren</button></div><p class="mrpd-discord-status" role="status" aria-live="polite"></p><button class="secondary" type="button" data-check-delivery hidden>Kanal geprüft – erneut versuchen</button></form>`;
 const title=dialog.querySelector('.mrpd-discord-title'),description=dialog.querySelector('.mrpd-discord-description'),fields=dialog.querySelector('.mrpd-discord-fields');
 title.textContent=embed.title;description.textContent=embed.description;
 for(const field of embed.fields){const item=document.createElement('div');item.className='mrpd-discord-field'+(field.inline?' is-inline':'');const label=document.createElement('b');label.textContent=field.name;item.append(label);if(field.name==='Portal'){const a=document.createElement('a');a.href=PORTAL;a.target='_blank';a.rel='noopener noreferrer';a.textContent='MRPD-Portal öffnen ↗';item.append(a)}else{const text=document.createElement(field.inline?'code':'p');text.textContent=field.value;item.append(text)}fields.append(item)}
 dialog.querySelector('.mrpd-discord-embed footer').textContent=embed.footer?.text||'';
 const form=dialog.querySelector('form'),input=form.querySelector('input'),submit=form.querySelector('[type=submit]'),status=form.querySelector('[role=status]'),retry=form.querySelector('[data-check-delivery]'),close=dialog.querySelector('[data-close]');
 let sending=false,sent=false,uncertain=false;const actor=typeof current!=='undefined'?current?.id:null;
 const destroy=()=>{input.value='';dialog.remove();activeDialog=null};
 dialog.addEventListener('close',destroy,{once:true});dialog.addEventListener('cancel',e=>{if(sending)e.preventDefault()});close.onclick=()=>{if(!sending)dialog.close()};
 form.querySelector('[data-copy-text]').onclick=async()=>{const text='🚔 MRPD – Einladung zum Mitarbeiterportal\n\nWillkommen beim Mission Row Police Department!\nPortal: '+PORTAL+'\nBenutzername: '+c.username+'\nPasswort: '+c.password+'\n\nBitte ändere dein Startpasswort beim ersten Login unter Mein Konto.';try{await navigator.clipboard.writeText(text);status.textContent='Einladungstext kopiert. Für die Karte mit Logo bitte den Senden-Button verwenden.'}catch{status.textContent='Kopieren wurde vom Browser blockiert. Bitte die Zugangsdaten aus der Vorschau markieren und kopieren.'}};
 retry.onclick=()=>{uncertain=false;retry.hidden=true;submit.disabled=false;status.textContent='Du kannst den Versand jetzt erneut auslösen.'};
 form.onsubmit=async e=>{e.preventDefault();if(sending||sent||uncertain||!form.reportValidity())return;if(actor&&(typeof current==='undefined'||current?.id!==actor||!['admin','trainer'].includes(current.role))){status.textContent='Deine Anmeldung hat sich geändert. Bitte die Einladung schließen und erneut öffnen.';return}try{webhookURL(input.value)}catch(err){status.textContent=err.message;return}
 sending=true;submit.disabled=true;close.disabled=true;input.readOnly=true;submit.textContent='Wird gesendet …';status.textContent='Einladung wird an Discord gesendet …';
 try{await sendInvitation(input.value,invitation);sent=true;input.value='';status.dataset.state='success';status.textContent='✓ Einladung mit Logo erfolgreich im Discord-Kanal gesendet.';submit.textContent='An Discord gesendet'}catch(err){uncertain=!!err.uncertain;status.dataset.state='error';status.textContent=err.message;retry.hidden=!uncertain;submit.textContent='Einladung an Discord senden'}finally{sending=false;close.disabled=false;input.readOnly=sent;submit.disabled=sent||uncertain}
 };
 document.body.append(dialog);dialog.showModal();input.focus();
}
window.MRPDDiscord=Object.freeze({open,webhookURL,sendInvitation});
})();
