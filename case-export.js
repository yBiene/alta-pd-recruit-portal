/* Image-only case documents. Source text and evidence files stay unchanged. */
(() => {
 'use strict';
 const W=1440,MAX_H=10000,M=92,INK='#233b96';
 let fontPromise;
 async function fonts(){
  if(!fontPromise)fontPromise=Promise.all([['Regular','400'],['Bold','700']].map(async([file,weight])=>{
   const url=new URL('assets/fonts/MRPDNotebook-'+file+'.woff',document.baseURI).href;
   const face=new FontFace('MRPD Case Hand','url("'+url+'")',{weight});await face.load();document.fonts.add(face);
  })).catch(e=>{fontPromise=null;throw Error('Die Schrift konnte nicht geladen werden. Bitte erneut versuchen.');});
  return fontPromise;
 }
 function plain(value){
  let text=String(value??'').replace(/\r\n?/g,'\n');
  if(/<(?:p|br|div|h[1-6]|li|ul|ol|table|strong|b|span|script|style)\b/i.test(text)){
   const doc=new DOMParser().parseFromString(text,'text/html');
   doc.querySelectorAll('script,style,iframe,object,img').forEach(el=>el.remove());
   doc.querySelectorAll('br').forEach(el=>el.replaceWith('\n'));
   doc.querySelectorAll('li').forEach(el=>el.prepend('• '));
   doc.querySelectorAll('td,th').forEach(el=>el.append('  '));
   doc.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li,tr').forEach(el=>el.append('\n'));
   text=doc.body.textContent;
  }
  return text.replace(/\u0000/g,'').replace(/\n{3,}/g,'\n\n').trim();
 }
 function photoTitle(photo,index){
  const title=plain(photo.title);
  return !title||title===photo.original_name||/\.(?:png|jpe?g|webp|gif|heic)$/i.test(title)?'Beweisfoto '+(index+1):'Beweisfoto '+(index+1)+' – '+title;
 }
 const real=value=>{const text=plain(value);return text&&!/^[-—–]+$/.test(text)?text:'';};
 const filename=value=>plain(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,70)||'Akte';
 const day=value=>new Date(value||Date.now()).toLocaleDateString('de-DE',{timeZone:'Europe/Berlin'});
 const cancel=()=>Object.assign(Error('Abgebrochen'),{cancelled:true});
 async function image(url){const img=new Image();img.crossOrigin='anonymous';img.src=url;await img.decode();return img;}
 const blob=(canvas,type)=>new Promise((resolve,reject)=>canvas.toBlob(file=>file&&file.type===type?resolve(file):reject(Error('Das Bild konnte nicht erstellt werden.')),type,type==='image/jpeg'?.96:undefined));
 function wrap(ctx,text,width){
  const lines=[];let line='';
  for(const word of text.split(/\s+/).filter(Boolean)){
   if(ctx.measureText(word).width>width){
    if(line){lines.push(line);line='';}
    let segment='';for(const ch of word){if(segment&&ctx.measureText(segment+ch).width>width){lines.push(segment);segment='';}segment+=ch;}line=segment;
   }else if(line&&ctx.measureText(line+' '+word).width>width){lines.push(line);line=word;}
   else line+=(line?' ':'')+word;
  }
  if(line)lines.push(line);return lines.length?lines:[''];
 }
 function tape(ctx,x,y,angle){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.shadowColor='#3a445044';ctx.shadowBlur=8;ctx.shadowOffsetY=3;
  const gradient=ctx.createLinearGradient(0,-22,0,22);gradient.addColorStop(0,'#e9ece6a8');gradient.addColorStop(.5,'#ffffff9c');gradient.addColorStop(1,'#c4c8c2a0');
  ctx.fillStyle=gradient;ctx.strokeStyle='#aeb5ae78';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(-70,-22);ctx.lineTo(68,-22);ctx.lineTo(63,-15);ctx.lineTo(69,-8);ctx.lineTo(64,0);ctx.lineTo(70,8);ctx.lineTo(65,22);ctx.lineTo(-67,22);ctx.lineTo(-62,12);ctx.lineTo(-70,4);ctx.lineTo(-64,-5);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
 }
 async function render(data,options={}){
  await fonts();
  const valid=options.valid||(()=>true),check=()=>{if(!valid())throw cancel();};check();
  const size=Number(options.fontSize)||40,line=Math.round(size*1.43),type=options.type==='image/jpeg'?'image/jpeg':'image/png';
  const pages=[];let canvas,ctx,y,pageNumber=0;
  function start(){
   canvas=document.createElement('canvas');canvas.width=W;canvas.height=MAX_H;ctx=canvas.getContext('2d');ctx.fillStyle='#fcfcfb';ctx.fillRect(0,0,W,MAX_H);
   ctx.strokeStyle='#dce6ee99';ctx.lineWidth=1;
   for(let at=30;at<MAX_H;at+=28){ctx.beginPath();ctx.moveTo(0,at);ctx.lineTo(W,at);ctx.stroke();}
   ctx.strokeStyle='#cbd8e455';ctx.beginPath();ctx.moveTo(62,0);ctx.lineTo(62,MAX_H);ctx.stroke();
   y=76;pageNumber++;
   if(pageNumber>1){ctx.font='700 34px "MRPD Case Hand"';ctx.fillStyle=INK;ctx.textBaseline='top';ctx.fillText('Mission Row Police Department · Fortsetzung',M,y);y+=65;}
  }
  async function finish(){
   check();const output=document.createElement('canvas');output.width=W;output.height=Math.min(MAX_H,Math.max(1050,Math.ceil(y+M)));
   try{output.getContext('2d').drawImage(canvas,0,0,W,output.height,0,0,W,output.height);canvas.width=canvas.height=0;const file=await blob(output,type);check();pages.push({blob:file,width:W,height:output.height});}
   finally{output.width=output.height=0;}
  }
  async function space(height){check();if(y+height>MAX_H-M){await finish();start();}check();}
  async function text(value,{bold=false,heading=false,font=size,indent=0,underline=false}={}){
   const paragraphs=plain(value).split('\n');
   for(const paragraph of paragraphs){
    if(!paragraph.trim()){y+=Math.round(line*.5);continue;}
    ctx.font=(bold||heading?'700 ':'400 ')+font+'px "MRPD Case Hand"';
    const lines=wrap(ctx,paragraph,W-M*2-indent),step=heading?Math.round(font*1.35):line;
    if(heading)await space(Math.min(MAX_H-M*2,lines.length*step+line));
    for(const row of lines){
     await space(step);ctx.fillStyle=INK;ctx.font=(bold||heading?'700 ':'400 ')+font+'px "MRPD Case Hand"';ctx.textBaseline='top';ctx.textAlign='left';ctx.fillText(row,M+indent,y);
     if(underline||heading){ctx.strokeStyle=INK;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(M+indent,y+font*1.1);ctx.lineTo(Math.min(W-M,M+indent+ctx.measureText(row).width),y+font*1.1);ctx.stroke();}
     y+=step;
    }
   }
  }
  const section=async label=>{y+=24;await text(label,{heading:true,font:size+5});y+=12;};
  start();
  try{
   const c=data.record;
   await text('Los Santos, '+day(options.date||c.created_at),{bold:true});
   await text(options.recipient?plain(options.recipient):'Mission Row Police Department',{bold:true});y+=10;
   await text(real(c.name)||'Beweis- und Vorgangsakte',{heading:true,font:size+12});y+=18;
   if(real(c.number))await text('Aktenzeichen: '+real(c.number),{bold:true});
   const description=plain(c.description);
   if(description){
    const first=description.split('\n').find(v=>v.trim())||'';
    if(!/^(?:#{1,4}\s|\d+[.)]\s)/.test(first))await section('Sachverhalt');
    for(const paragraph of description.split('\n')){
     const match=paragraph.match(/^#{1,4}\s+(.+)$/)||paragraph.match(/^\*\*(.+)\*\*\s*:?'?$/);
     const numbered=/^\d+[.)]\s+\S/.test(paragraph)&&paragraph.length<115;
     if(match||numbered)await section(match?match[1]:paragraph);
     else await text(paragraph.replace(/\*\*([^*]+)\*\*/g,'$1'));
    }
   }
   if(real(c.people)){await section('Beteiligte Personen');await text(c.people);}
   if(c.officers?.length){await section('Beteiligte Officer');for(const o of c.officers)await text([o.rank,o.name,o.service_no?'DN '+o.service_no:''].filter(Boolean).join(' · '));}
   if(real(c.creator)){y+=30;await text('Verfasst von',{bold:true});await text(c.creator,{font:size+7});}
   if(data.images.length){
    await section('Beweisanlagen');
    for(const [i,pic]of data.images.entries())await text('• '+photoTitle(pic,i));y+=32;
    for(const [i,pic]of data.images.entries()){
     check();options.progress?.('Beweisbild '+(i+1)+' von '+data.images.length+' wird eingefügt …');
     const framed=await window.MRPDBodycam.render(pic.url,pic,1920);check();
     const photo=await image(framed);check();
     const iw=W-M*2-64,ih=Math.min(4700,iw*photo.naturalHeight/photo.naturalWidth),scale=Math.min(iw/photo.naturalWidth,ih/photo.naturalHeight),pw=photo.naturalWidth*scale,ph=photo.naturalHeight*scale;
     ctx.font='700 '+(size+5)+'px "MRPD Case Hand"';const titleHeight=wrap(ctx,photoTitle(pic,i),W-M*2).length*Math.round((size+5)*1.35);
     await space(ph+titleHeight+105);await text(photoTitle(pic,i),{heading:true,font:size+5});y+=36;
     const x=(W-pw)/2;
     ctx.save();ctx.shadowColor='#25313d40';ctx.shadowBlur=18;ctx.shadowOffsetY=8;ctx.fillStyle='#fff';ctx.fillRect(x-14,y-14,pw+28,ph+28);ctx.restore();ctx.drawImage(photo,x,y,pw,ph);
     tape(ctx,x+20,y+12,-.65);tape(ctx,x+pw-20,y+12,.65);tape(ctx,x+20,y+ph-10,.65);tape(ctx,x+pw-20,y+ph-10,-.65);y+=ph+45;
     if(real(pic.caption))await text(pic.caption);y+=28;
     // The decoded frame can be released before the next evidence file is loaded.
     photo.src='';
    }
   }
   await finish();return pages;
  }finally{if(canvas)canvas.width=canvas.height=0;}
 }
 function download(file,name){const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
 function open(data){
  const actor=current?.id;if(!actor)return Promise.reject(Error('Bitte anmelden.'));
  return new Promise(resolve=>{
   const d=document.createElement('dialog');d.className='case-export-dialog';d.dataset.actor=actor;
   d.innerHTML='<header><div><p>Mission Row Police Department</p><h2>Akte als Bild speichern</h2></div><button type="button" data-close aria-label="Schließen">×</button></header><div class="case-export-options"><label>Format<select name="format"><option value="image/png">PNG · scharfe Schrift</option><option value="image/jpeg">JPEG · kleinere Datei</option></select></label><label>Schriftgröße<select name="size"><option value="40">Groß</option><option value="46">Sehr groß</option><option value="34">Kompakt</option></select></label><label>Adresszeile (optional)<input name="recipient" maxlength="120" placeholder="An das Department of Justice"></label></div><p class="case-export-status" role="status"></p><div class="case-export-pages"></div>';
   const target=d.querySelector('.case-export-pages'),status=d.querySelector('[role=status]'),format=d.querySelector('[name=format]'),size=d.querySelector('[name=size]'),recipient=d.querySelector('[name=recipient]');
   let generation=0,chain=Promise.resolve(),urls=[],debounce;
   function clear(){for(const url of urls)URL.revokeObjectURL(url);urls=[];target.replaceChildren();}
   d.querySelector('[data-close]').onclick=()=>d.close();
   d.addEventListener('close',()=>{generation++;clearTimeout(debounce);clear();d.remove();resolve();},{once:true});
   function schedule(){
    const ticket=++generation;clear();status.textContent='Akte wird gestaltet …';
    const options={type:format.value,fontSize:Number(size.value),recipient:recipient.value.trim(),valid:()=>d.isConnected&&d.open&&current?.id===actor&&ticket===generation,progress:text=>{if(ticket===generation)status.textContent=text;}};
    chain=chain.catch(()=>{}).then(async()=>{
     if(!options.valid())return;
     try{
      const pages=await render(data,options);if(!options.valid())return;
      const suffix=options.type==='image/png'?'png':'jpg';
      for(const [index,page]of pages.entries()){
       const url=URL.createObjectURL(page.blob);urls.push(url);const card=document.createElement('section');card.className='case-export-page';
       const label=pages.length>1?'Teil '+(index+1)+' von '+pages.length:'Gesamte Akte';
       const image=document.createElement('img');image.src=url;image.alt=label+' · '+real(data.record.name);image.loading='lazy';image.width=page.width;image.height=page.height;
       const button=document.createElement('button');button.type='button';button.className='primary';button.textContent=label+' als '+(suffix==='jpg'?'JPEG':'PNG')+' herunterladen';
       button.onclick=()=>{if(current?.id===actor)download(page.blob,'MRPD-'+filename(real(data.record.number)||data.record.name)+(pages.length>1?'-Teil-'+(index+1):'')+'.'+suffix);};card.append(button,image);target.append(card);
      }
      status.textContent=pages.length>1?'Die vollständige Akte umfasst '+pages.length+' Bildteile. Alle Teile können einzeln heruntergeladen werden.':'Vorschau fertig. Die vollständige Akte kann heruntergeladen werden.';
     }catch(e){if(!e.cancelled&&options.valid())status.textContent=e.message||'Die Akte konnte nicht erstellt werden.';}
    });
   }
   format.onchange=size.onchange=schedule;recipient.oninput=()=>{clearTimeout(debounce);debounce=setTimeout(schedule,350);};
   document.body.append(d);d.showModal();schedule();
  });
 }
 if(typeof sb!=='undefined')sb.auth.onAuthStateChange((event,session)=>{document.querySelectorAll('.case-export-dialog[open]').forEach(d=>{if(event==='SIGNED_OUT'||(session?.user?.id&&session.user.id!==d.dataset.actor))d.close();});});
 window.MRPDCaseExport=Object.freeze({open,render,plain,photoTitle});
})();
