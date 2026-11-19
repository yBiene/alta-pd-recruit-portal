/* Bodycam presentation is rendered separately from the stored evidence file. */
(() => {
 'use strict';
 const stamp=value=>new Date(value).toLocaleString('de-DE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
 const officer=meta=>[meta.officer_rank,meta.uploaded_by_name,meta.officer_service_no?'DN '+meta.officer_service_no:''].filter(Boolean).join(' · ')||'Officer nicht erfasst';
 async function render(url,meta,width=1920){
  const image=new Image();image.crossOrigin='anonymous';image.src=url;await image.decode();
  if(!image.naturalWidth||!image.naturalHeight)throw Error('Bild ist nicht lesbar.');
  const ratio=image.naturalHeight/image.naturalWidth,frameRatio=Math.min(ratio,3);
  const w=Math.round(Math.min(width,Math.max(960,image.naturalWidth),Math.sqrt(16000000/(frameRatio+.25))));
  const h=Math.round(w*frameRatio),scale=Math.min(w/image.naturalWidth,h/image.naturalHeight);
  const font=Math.max(18,Math.round(w*.018)),pad=Math.round(w*.022),line=Math.round(font*1.45),top=pad*2+line*3;
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h+top;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#080b0e';ctx.fillRect(0,0,w,canvas.height);
  ctx.fillStyle='#c1a36b';ctx.fillRect(0,0,w,Math.max(3,w*.002));
  ctx.font='bold '+font+'px monospace';ctx.textBaseline='top';
  ctx.fillStyle='#f34545';ctx.beginPath();ctx.arc(pad+font*.32,pad+font*.44,font*.29,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#f4f6f8';ctx.fillText('REC',pad+font,pad);
  ctx.textAlign='right';ctx.fillText('MRPD BODYCAM · LOS SANTOS',w-pad,pad);
  ctx.font=Math.round(font*.85)+'px monospace';
  const when=meta.bodycam_recorded_at||meta.created_at;
  ctx.fillText(when?stamp(when):'Datum nicht erfasst',w-pad,pad+line);
  let officerSize=Math.round(font*.85);const label=officer(meta);
  while(ctx.measureText(label).width>w-pad*2&&officerSize>12){officerSize--;ctx.font=officerSize+'px monospace';}
  ctx.fillText(label,w-pad,pad+line*2);
  ctx.drawImage(image,(w-image.naturalWidth*scale)/2,top+(h-image.naturalHeight*scale)/2,image.naturalWidth*scale,image.naturalHeight*scale);
  const data=canvas.toDataURL('image/jpeg',.94);canvas.width=canvas.height=0;return data;
 }
 async function download(url,meta){
  const source=await render(url,meta,2400);const a=document.createElement('a');a.href=source;a.download='MRPD-Bodycam-'+meta.id+'.jpg';document.body.append(a);a.click();a.remove();
 }
 window.MRPDBodycam=Object.freeze({render,download,officer});
})();
