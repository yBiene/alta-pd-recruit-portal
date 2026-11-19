(() => {
'use strict';
const escape = esc;
const node = (title, name = '', children = [], tone = '') => ({title,name,children,tone});
const initial = [node('Chief of Police','Gibson Juvanovic',[
 node('Assistant Chief of Police','',[node('Deputy Chief','Michi Mirano',[node('Commander','',[
 node('Patrol & FTO Division','',[node('Captain','Jan Schmidt',[node('Lieutenant FTO','Tony Guerrero',[node('Sergeant FTO','Anira Noctis')]),node('Lieutenant Patrol','Tyre Carter',[node('Sergeant Patrol','Bobby Glitter')])])],'blue'),
 node('DTU & Special Units','',[node('Captain','Gatorbait Winchester',[node('Lieutenant DTU','',[node('Sergeant DTU'),node('Sergeant S.W.A.T.'),node('Sergeant K9')])])],'gold')
 ])])])
])];
async function read(table,key,id) {
 const {data,error}=await sb.from(table).select('*').eq(key,id).maybeSingle();
 if(error)throw error;return data;
}
async function save(table,key,id,value,old) {
 const query=old?sb.from(table).update({...value,revision:old.revision+1}).eq(key,id).eq('revision',old.revision):sb.from(table).insert({[key]:id,...value});
 const {data,error}=await query.select(key).maybeSingle();
 if(error)throw error;
 if(!data)throw Error('Inzwischen geändert. Bitte neu öffnen und erneut bearbeiten.');
}
function dialog(title,html,submit) {
 const d=document.createElement('dialog');d.className='hub-dialog';
 d.innerHTML=`<header><h2>${escape(title)}</h2><button type="button" aria-label="Schließen">×</button></header><form class="hub-form">${html}<button class="primary">Speichern</button><p role="status"></p></form>`;
 d.querySelector('header button').onclick=()=>d.close();d.onclose=()=>d.remove();
 d.querySelector('form').onsubmit=async e=>{
  e.preventDefault();const form=e.currentTarget,b=form.querySelector('.primary');b.disabled=true;
  try{await submit(Object.fromEntries(new FormData(form)),form);d.close()}catch(err){form.querySelector('[role=status]').textContent=err.message}finally{b.disabled=false}
 };document.body.append(d);d.showModal();return d;
}
function insignia(title) {
 const ranks=[[/^Chief of Police/i,'★★★★'],[/^Assistant Chief/i,'★★★'],[/^Deputy Chief/i,'★★'],[/^Commander/i,'★'],[/^Captain/i,'▮▮'],[/^Lieutenant/i,'▮'],[/^Sergeant/i,'❮❮❮']];
 const symbol=ranks.find(([pattern])=>pattern.test(title))?.[1];
 return symbol?`<span class="mrpd-insignia" aria-hidden="true">${symbol}</span>`:'';
}
function chartAssignment(item, parents) {
 const division = parents.find(parent => parent.tone);
 const unit = /\bPatrol\b/i.test(item.title) ? 'Patrol Unit' :
  /\bFTO\b/i.test(item.title) ? 'FTO' : division?.title || 'Executive Staff';
 return {title:item.title,unit};
}
async function assignment(name) {
 const old=await read('mrpd_org_chart','id',1);
 const matches=[];
 function visit(items,parents=[]) {
  for(const item of items){
   if(item.name?.trim().toLowerCase()===name.trim().toLowerCase())matches.push(chartAssignment(item,parents));
   visit(item.children||[],[...parents,item]);
  }
 }
 visit(old?.tree||initial);
 return matches.length===1?matches[0]:null;
}
async function chart(options) {
 const {host,canEdit,people=[]}=options;
 const old=await read('mrpd_org_chart','id',1);
 if(!host.isConnected)return;
 const tree=structuredClone(old?.tree||initial), cards=[];
 function branch(items,tone='blue',parents=[]) {
  return '<ul>'+items.map(item=>{
   const matches=item.name?people.filter(p=>p.name.trim().toLowerCase()===item.name.trim().toLowerCase()):[];
   const profile=matches.length===1?matches[0]:null;
   const id=cards.push({item,items,profile,info:chartAssignment(item,parents)})-1;
   const name=profile?`<button type="button" class="mrpd-position-name mrpd-position-profile" data-position-profile="${id}">${escape(item.name)}</button>`:`<span class="mrpd-position-name">${escape(item.name||(item.children?.length?'':'Unbesetzt'))}</span>`;
   const color=item.tone==='gold'?'gold':item.tone==='blue'?'blue':tone;
   return `<li><div class="mrpd-position ${color}">${name}<strong>${insignia(item.title)}${escape(item.title)}</strong>${canEdit?`<button class="secondary mrpd-position-edit" type="button" data-position="${id}" aria-label="${escape(item.title)} bearbeiten">✎</button>`:''}</div>${item.children?.length?branch(item.children,color,[...parents,item]):''}</li>`;
  }).join('')+'</ul>';
 }

 host.innerHTML=`<section class="mrpd-chart"><header><img src="assets/mrpd-logo.svg" alt=""><div><h2>Mission Row Police Department</h2><p>Organigramm · Executive Staff</p></div></header><div class="mrpd-chart-scroll">${branch(tree)}</div>${canEdit?'<button class="secondary" type="button" data-root-position>＋ Oberste Position</button>':''}</section>`;

 const persist=async()=>{await save('mrpd_org_chart','id',1,{tree},old);await chart(options)};
 function edit(item,items) {
  dialog(item?'Position bearbeiten':'Position hinzufügen',`<label>Position oder Bereich<input name="title" required value="${escape(item?.title)}"></label><label>Name<input name="name" value="${escape(item?.name)}"></label><label>Farbe<select name="tone"><option value="">Vom Bereich übernehmen</option><option value="blue" ${item?.tone==='blue'?'selected':''}>Blau</option><option value="gold" ${item?.tone==='gold'?'selected':''}>Gold</option></select></label>${item?'<label>Aktion<select name="action"><option value="edit">Position aktualisieren</option><option value="child">Untergeordnete Position hinzufügen</option><option value="remove">Position entfernen</option></select></label>':''}`,async f=>{
   const title=f.title.trim();if(!title)throw Error('Bitte eine Position eingeben.');
   if(f.action==='remove'){if(item.children?.length)throw Error('Bitte zuerst die untergeordneten Positionen entfernen.');items.splice(items.indexOf(item),1)}
   else if(f.action==='child'){(item.children ||= []).push(node(title,f.name,[],f.tone))}
   else if(item)Object.assign(item,{title,name:f.name,tone:f.tone});
   else items.push(node(title,f.name,[],f.tone));
   await persist();
  });
 }
 host.querySelectorAll('[data-position-profile]').forEach(b=>b.onclick=()=>{const c=cards[Number(b.dataset.positionProfile)];window.MRPDDuty?.profile(c.profile.id,c.info)});
 host.querySelectorAll('[data-position]').forEach(b=>b.onclick=()=>{const c=cards[Number(b.dataset.position)];edit(c.item,c.items)});
 host.querySelector('[data-root-position]')?.addEventListener('click',()=>edit(null,tree));

}
window.MRPDDepartments={...window.MRPDDepartments,render:chart,assignment};
function format(body) {
 return body.split(/\r?\n/).map(line=>{
  const h=line.match(/^(#{1,3}) (.*)$/);
  if(h){const n=h[1].length+1;return `<h${n}>${escape(h[2])}</h${n}>`}
  const inline=escape(line).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>');
  return line.startsWith('- ')?'<div>• '+inline.slice(2)+'</div>':inline?'<div>'+inline+'</div>':'<br>';
 }).join('');
}
const richPrefix='MRPD-RICH-V1\n';
function cleanRich(html) {
 const template=document.createElement('template');
 template.innerHTML=html;
 const tags=new Set('p div span h2 h3 h4 h5 h6 strong b em i u s strike br ul ol li blockquote pre code table thead tbody tfoot tr th td hr font'.split(' '));
 const classes=new Set('eyebrow mnemonic notice step-dot step-row table-wrap'.split(' '));
 for(const el of [...template.content.querySelectorAll('*')]){
  if(!tags.has(el.localName)||el.namespaceURI!=='http://www.w3.org/1999/xhtml'){
   if(el.namespaceURI!=='http://www.w3.org/1999/xhtml'||['script','style','iframe','object','template'].includes(el.localName))el.remove();
   else el.replaceWith(...el.childNodes);
   continue;
  }
  const names=[...el.classList].filter(c=>classes.has(c));
  const color=el.style.color||el.getAttribute('color'), bg=el.style.backgroundColor;
  const spans=['colspan','rowspan'].map(name=>[name,el.getAttribute(name)]);
  for(const attr of [...el.attributes])el.removeAttribute(attr.name);
  if(names.length)el.className=names.join(' ');
  if(color)el.style.color=color;
  if(bg)el.style.backgroundColor=bg;
  for(const [name,value] of spans)if(value&&/^\d{1,2}$/.test(value))el.setAttribute(name,value);
 }
 return template.innerHTML;
}
function chapterHtml(body,chapter) {
 if(body==null)return cleanRich(CHAPTERS[chapter].html);
 return body.startsWith(richPrefix)?cleanRich(body.slice(richPrefix.length)):format(body);
}
async function decorate() {
 const article=document.querySelector('#content .chapter-body article.article');
 if(!current||!article||article.dataset.editorial)return;
 const chapter=Number(localStorage.getItem('alta_last_chapter'));
 if(!CHAPTERS[chapter])return;
 article.dataset.editorial='1';
 const block=document.createElement('section');block.className='mrpd-chapter-edit';
 let old;
 try{old=await read('mrpd_chapter_content','chapter',chapter)}catch(err){if(article.isConnected){const hint=document.createElement('p');hint.textContent='Kapiteltext konnte nicht aktualisiert werden.';article.prepend(hint)}return}
 if(!article.isConnected)return;
 const gallery=article.querySelector('.gallery');
 const galleryTitle=gallery?.previousElementSibling;
 const draw=()=>{
  if(old){article.replaceChildren(block);block.innerHTML='<div class="mrpd-formatted">'+chapterHtml(old.body,chapter)+'</div>';if(gallery){if(galleryTitle)article.append(galleryTitle);article.append(gallery)}}
  if(window.APD_HUB?.plus(current)){
   const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='✎ Kapiteltext bearbeiten';
   button.onclick=()=>{
    const d=dialog('Kapitel '+chapterNumber(chapter)+' bearbeiten',`<div class="hub-wide mrpd-format-bar" aria-label="Textformatierung"><button type="button" data-command="formatBlock" data-value="h3">Überschrift</button><button type="button" data-command="bold">Fett</button><button type="button" data-command="italic">Kursiv</button><button type="button" data-command="insertUnorderedList">Liste</button><button type="button" data-command="foreColor" data-value="#e2bc72">Gold</button><button type="button" data-command="foreColor" data-value="#73c6ee">Blau</button><button type="button" data-original>Originaltext wieder laden</button></div><div class="hub-wide mrpd-rich-editor" contenteditable="true" role="textbox" aria-label="Kapiteltext und Formationen" aria-multiline="true"></div>`,async (_f,form)=>{
      const editor=form.querySelector('.mrpd-rich-editor');
      const body=cleanRich(editor.innerHTML);
      if(!editor.textContent.trim())throw Error('Bitte Kapiteltext eingeben.');
      await save('mrpd_chapter_content','chapter',chapter,{body:richPrefix+body},old);old=await read('mrpd_chapter_content','chapter',chapter);button.remove();draw();
    });
    const editor=d.querySelector('.mrpd-rich-editor');
    editor.innerHTML=chapterHtml(old?.body,chapter);
    editor.addEventListener('paste',e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'))});
    editor.addEventListener('drop',e=>e.preventDefault());
    d.querySelectorAll('[data-command]').forEach(b=>{
     b.onmousedown=e=>e.preventDefault();
     b.onclick=()=>{editor.focus();document.execCommand(b.dataset.command,false,b.dataset.value||null)};
    });
    d.querySelector('[data-original]').onclick=()=>{if(confirm('Den Originaltext in den Editor laden? Gespeichert wird erst mit „Speichern“.'))editor.innerHTML=chapterHtml(null,chapter)};

   };article.prepend(button);
  }
 };
 draw();
}
const content=document.querySelector('#content');
function refinePortal() {
 decorate();
 for(const field of document.querySelectorAll('#hubRankForm textarea[name="reason"], dialog textarea[name="reason"]')){
  const label=field.closest('label');
  if(label?.firstChild?.nodeType===Node.TEXT_NODE&&label.firstChild.textContent!=='Kommentar zur Dienstgradänderung')label.firstChild.textContent='Kommentar zur Dienstgradänderung';
  field.placeholder='Grund oder persönlicher Kommentar zur Beförderung';
 }
 const mail=content?.querySelector('.mail-desktop');
 if(!mail||mail.dataset.refined)return;
 mail.dataset.refined='1';
 const back=document.createElement('button');
 back.type='button';back.className='secondary mail-back-to-list';
 back.textContent='← Zur Nachrichtenliste';
 mail.querySelector('.mail-toolbar')?.prepend(back);
 back.onclick=()=>mail.classList.remove('mail-reading-active');
 mail.addEventListener('click',e=>{
  if(e.target.closest('[data-select-mail]'))mail.classList.add('mail-reading-active');
  if(e.target.closest('[data-folder]'))mail.classList.remove('mail-reading-active');
 });
}
if(content)new MutationObserver(refinePortal).observe(document.body,{childList:true,subtree:true});
decorate();
})();
