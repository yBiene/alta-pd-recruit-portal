(() => {
'use strict';
const escape = esc;
const previousRoleLabel = roleLabel;
roleLabel = function (user) {
 const profile = user ?? current;
 if (isFtoLead(profile) || profile?.name?.trim().toLowerCase() === 'tyre carter') return 'Patrol Unit';
 return previousRoleLabel(profile);
};
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
async function chart(options) {
 const {host,canEdit}=options;
 const old=await read('mrpd_org_chart','id',1);
 if(!host.isConnected)return;
 const tree=structuredClone(old?.tree||initial), cards=[];
 function branch(items,tone='blue') {
  return '<ul>'+items.map(item=>{
   const id=cards.push({item,items})-1;
   const color=item.tone==='gold'?'gold':item.tone==='blue'?'blue':tone;
   return `<li><div class="mrpd-position ${color}"><strong>${escape(item.title)}</strong><span>${escape(item.name|| (item.children?.length?'':'Unbesetzt'))}</span>${canEdit?`<button class="secondary" data-position="${id}" aria-label="${escape(item.title)} bearbeiten">✎</button>`:''}</div>${item.children?.length?branch(item.children,color):''}</li>`;
  }).join('')+'</ul>';
 }
 const original=document.createElement('div');
 host.innerHTML=`<section class="mrpd-chart"><header><img src="assets/mrpd-logo.svg" alt=""><div><h2>Mission Row Police Department</h2><p>Organigramm · Executive Staff</p></div></header><div class="mrpd-chart-scroll">${branch(tree)}</div>${canEdit?'<button class="secondary" type="button" data-root-position>＋ Oberste Position</button>':''}</section><details class="card"><summary>Abteilungen und Portalzuordnungen</summary></details>`;
 host.querySelector('details').append(original);
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
 host.querySelectorAll('[data-position]').forEach(b=>b.onclick=()=>{const c=cards[Number(b.dataset.position)];edit(c.item,c.items)});
 host.querySelector('[data-root-position]')?.addEventListener('click',()=>edit(null,tree));
 await originalDepartments({...options,host:original});
}
const originalDepartments=window.MRPDDepartments.render;
window.MRPDDepartments={...window.MRPDDepartments,render:chart};
function format(body) {
 return body.split(/\r?\n/).map(line=>{
  const h=line.match(/^(#{1,3}) (.*)$/);
  if(h){const n=h[1].length+1;return `<h${n}>${escape(h[2])}</h${n}>`}
  const inline=escape(line).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>');
  return line.startsWith('- ')?'<div>• '+inline.slice(2)+'</div>':inline?'<div>'+inline+'</div>':'<br>';
 }).join('');
}
function originalText(html) {
 const template=document.createElement('template');
 template.innerHTML=html.replace(/<br\s*\/?\s*>|<\/(?:p|div|h[1-6]|li|tr)>/gi,'$&\n');
 return template.content.textContent.trim();
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
  if(old){article.replaceChildren(block);block.innerHTML='<div class="mrpd-formatted">'+format(old.body)+'</div>';if(gallery){if(galleryTitle)article.append(galleryTitle);article.append(gallery)}}
  if(window.APD_HUB?.plus(current)){
   const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='✎ Kapiteltext bearbeiten';
   button.onclick=()=>{
    const d=dialog('Kapitel '+chapterNumber(chapter)+' bearbeiten',`<div class="hub-wide mrpd-format-bar"><button type="button" data-format="# ">Überschrift</button><button type="button" data-format="**">Fett</button><button type="button" data-format="*">Kursiv</button><button type="button" data-format="- ">Liste</button></div><label class="hub-wide">Kapiteltext und Formationen<textarea name="body" rows="18" required>${escape(old?.body??originalText(CHAPTERS[chapter].html))}</textarea></label>`,async f=>{
      await save('mrpd_chapter_content','chapter',chapter,{body:f.body},old);old=await read('mrpd_chapter_content','chapter',chapter);button.remove();draw();
    });
    const input=d.querySelector('textarea');
    d.querySelectorAll('[data-format]').forEach(b=>b.onclick=()=>{const mark=b.dataset.format,t=input.value.slice(input.selectionStart,input.selectionEnd);input.setRangeText(mark+t+(mark.endsWith(' ')?'':mark),input.selectionStart,input.selectionEnd,'end');input.focus()});
   };article.prepend(button);
  }
 };
 draw();
}
const content=document.querySelector('#content');
if(content)new MutationObserver(decorate).observe(content,{childList:true,subtree:true});
decorate();
})();
