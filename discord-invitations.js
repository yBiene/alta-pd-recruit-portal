/* MRPD: private invitation preview, text and PNG. No channel/webhook delivery. */
(()=>{'use strict';
const LOGO='https://ybiene.github.io/alta-pd-recruit-portal/assets/mrpd-invite-logo.png';
const PORTAL='https://ybiene.github.io/alta-pd-recruit-portal/';
let activeDialog=null;
function dmText(c){return '**🚔 MRPD – Dein persönlicher Portalzugang**\n\nWillkommen beim Mission Row Police Department!\n**Portal:** '+PORTAL+'\n**Benutzername:** `'+c.username+'`\n**Passwort:** '+c.password+'\n\n🔐 Bitte ändere dein Startpasswort beim ersten Login unter **Mein Konto**. Bewahre deine Zugangsdaten für dich auf.'}
async function invitationImage(c){
 const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=760;const ctx=canvas.getContext('2d');
 ctx.fillStyle='#313338';ctx.fillRect(0,0,1200,760);ctx.fillStyle='#2b2d31';ctx.fillRect(42,38,1116,684);ctx.fillStyle='#f1c40f';ctx.fillRect(42,38,7,684);
 ctx.fillStyle='#b5bac1';ctx.font='bold 18px Arial';ctx.fillText('MRPD · PERSONALVERWALTUNG',78,86);
 ctx.fillStyle='#00a8fc';ctx.font='bold 28px Arial';ctx.fillText('Dein persönlicher Portalzugang',78,142);
 ctx.fillStyle='#dbdee1';ctx.font='22px Arial';ctx.fillText('Willkommen beim Mission Row Police Department!',78,185);
 try{const logo=await new Promise((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=reject;img.src=LOGO});ctx.drawImage(logo,988,65,125,125)}catch{ctx.fillStyle='#e4c46d';ctx.font='bold 26px Arial';ctx.fillText('MRPD',1005,125)}
 ctx.fillStyle='#f2f3f5';ctx.font='bold 19px Arial';ctx.fillText('Portal',78,263);ctx.fillStyle='#00a8fc';ctx.font='22px Arial';ctx.fillText(PORTAL,78,300);
 ctx.fillStyle='#f2f3f5';ctx.font='bold 19px Arial';ctx.fillText('Benutzername',78,372);ctx.fillText('Passwort',650,372);
 ctx.fillStyle='#1e1f22';ctx.fillRect(78,392,525,54);ctx.fillRect(650,392,450,54);ctx.fillStyle='#dbdee1';ctx.font='22px monospace';ctx.fillText(String(c.username).slice(0,40),92,427);ctx.fillText(String(c.password).slice(0,34),664,427);
 ctx.fillStyle='#f2f3f5';ctx.font='bold 19px Arial';ctx.fillText('Erster Login',78,514);ctx.fillStyle='#dbdee1';ctx.font='22px Arial';ctx.fillText('Bitte ändere dein Startpasswort beim ersten Login unter Mein Konto.',78,553);ctx.fillText('Bewahre deine Zugangsdaten für dich auf.',78,589);
 ctx.fillStyle='#b5bac1';ctx.font='17px Arial';ctx.fillText('MRPD · Persönliche Einladung',78,683);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Die Einladungskarte konnte nicht erstellt werden.')),'image/png'));
}
function open(c,payload){
 if(activeDialog){activeDialog.focus();return}
 const invitation=structuredClone(payload);invitation.avatar_url=LOGO;invitation.allowed_mentions={parse:[]};
 const embed=invitation.embeds[0],dialog=document.createElement('dialog');activeDialog=dialog;
 dialog.className='hub-dialog mrpd-discord-dialog';dialog.setAttribute('aria-labelledby','mrpd-discord-title');
 dialog.innerHTML=`<header><div><span class="mrpd-discord-eyebrow">MRPD · PERSONALVERWALTUNG</span><h2 id="mrpd-discord-title">Einladung als Privatnachricht</h2><p class="muted">Persönliche Einladung für den neuen Mitarbeiter.</p></div><button type="button" data-close aria-label="Schließen">×</button></header>
 <div class="mrpd-discord-preview" aria-label="Vorschau der Discord-Nachricht"><img class="mrpd-discord-avatar" alt="MRPD" src="${LOGO}"><div class="mrpd-discord-message"><div class="mrpd-discord-sender">MRPD · Personalverwaltung <span>APP</span><time>Vorschau</time></div><article class="mrpd-discord-embed"><img class="mrpd-discord-thumbnail" src="${LOGO}" alt="MRPD Logo"><a class="mrpd-discord-title" href="${PORTAL}" target="_blank" rel="noopener noreferrer"></a><p class="mrpd-discord-description"></p><div class="mrpd-discord-fields"></div><footer></footer></article></div></div>
 <section class="mrpd-discord-form"><p class="muted">Discord-Privatnachricht öffnen, Einladungstext kopieren und dort einfügen. Die Karte mit Logo kannst du zusätzlich als Bild einfügen oder anhängen.</p><div class="mrpd-discord-actions"><button class="primary" type="button" data-copy-text>Text für Privatnachricht kopieren</button><button class="secondary" type="button" data-copy-image>Einladungskarte kopieren</button><button class="secondary" type="button" data-save-image>Karte herunterladen</button></div><p class="muted">Ein echtes, automatisch gesendetes Discord-Embed in einer DM benötigt einen Discord-Bot. Es wird keine Nachricht in einen Kanal gesendet.</p><p class="mrpd-discord-status" role="status" aria-live="polite"></p></section>`;
 const title=dialog.querySelector('.mrpd-discord-title'),description=dialog.querySelector('.mrpd-discord-description'),fields=dialog.querySelector('.mrpd-discord-fields');
 title.textContent=embed.title;description.textContent=embed.description;
 for(const field of embed.fields){const item=document.createElement('div');item.className='mrpd-discord-field'+(field.inline?' is-inline':'');const label=document.createElement('b');label.textContent=field.name;item.append(label);if(field.name==='Portal'){const a=document.createElement('a');a.href=PORTAL;a.target='_blank';a.rel='noopener noreferrer';a.textContent='MRPD-Portal öffnen ↗';item.append(a)}else{const text=document.createElement(field.inline?'code':'p');text.textContent=field.value;item.append(text)}fields.append(item)}
 dialog.querySelector('.mrpd-discord-embed footer').textContent=embed.footer?.text||'';
 const status=dialog.querySelector('[role=status]'),close=dialog.querySelector('[data-close]');
 dialog.addEventListener('close',()=>{dialog.remove();activeDialog=null},{once:true});close.onclick=()=>dialog.close();
 dialog.querySelector('[data-copy-text]').onclick=async()=>{try{await navigator.clipboard.writeText(dmText(c));status.textContent='✓ Einladungstext kopiert. Jetzt in die Discord-Privatnachricht einfügen.'}catch{status.textContent='Bitte die Zugangsdaten aus der Vorschau markieren und kopieren.'}};
 dialog.querySelector('[data-copy-image]').onclick=async e=>{const button=e.currentTarget;button.disabled=true;try{if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw Error('Bildkopie nicht verfügbar');const image=invitationImage(c);await navigator.clipboard.write([new ClipboardItem({'image/png':image})]);status.textContent='✓ Einladungskarte kopiert. Jetzt in die Discord-Privatnachricht einfügen.'}catch{status.textContent='Die Bildkopie wird von diesem Browser nicht unterstützt. Bitte „Karte herunterladen“ wählen und die Datei an die Privatnachricht anhängen.'}finally{button.disabled=false}};
 dialog.querySelector('[data-save-image]').onclick=async e=>{const button=e.currentTarget;button.disabled=true;try{const blob=await invitationImage(c),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='MRPD-Einladung-'+String(c.username).replace(/[^a-zA-Z0-9._-]/g,'_')+'.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='✓ Einladungskarte heruntergeladen. Bitte an die private Discord-Nachricht anhängen.'}catch{status.textContent='Die Karte konnte nicht erstellt werden. Bitte den Einladungstext kopieren.'}finally{button.disabled=false}};
 document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-copy-text]').focus();
}
window.MRPDDiscord=Object.freeze({open,dmText,invitationImage});
})();
