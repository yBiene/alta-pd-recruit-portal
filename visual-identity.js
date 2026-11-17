/* Resolution-independent department insignia and page art. */
(()=>{'use strict';
const motifs={
activity:'<path d="M26 48h10l6-15 10 31 7-16h11"/>',
streak:'<path d="M48 28c7 13 20 19 17 32-2 9-9 14-17 14S31 68 31 59c0-9 10-17 10-23 5 3 7 8 7 13 4-7 3-14 0-21Z"/>',
cases:'<path d="M27 39h17l5-7h19v34H27Z"/><circle cx="47" cy="49" r="8"/><path d="m53 55 9 9"/>',
reports:'<path d="M27 34c8-3 15-2 21 3 6-5 13-6 21-3v31c-8-3-15-2-21 3-6-5-13-6-21-3ZM48 37v31M33 44h8m-8 8h8m14-8h8m-8 8h8"/>',
reads:'<path d="M31 29h25l10 10v31H31ZM55 29v12h11M38 50h20m-20 8h13"/><path d="m53 65 5 5 11-13"/>',
chapters:'<path d="m22 42 26-14 26 14-26 14ZM32 48v15q16 13 32 0V48M73 43v20"/>',
tests:'<path d="M32 32h32v38H32ZM40 28h16v9H40ZM39 52l6 6 13-14"/>',
notes:'<path d="M29 30h25v10M29 30v40h36V54M39 61l3-12 19-19 9 9-19 19Z"/>',
chat_days:'<path d="M25 31h46v30H46L33 71V61h-8ZM35 42h26M35 50h17"/>',
secret:'<path d="M32 45h32v25H32ZM38 45v-8a10 10 0 0 1 20 0v8"/><circle cx="48" cy="56" r="3"/><path d="M48 59v5"/>',
night_days:'<path d="M58 29a22 22 0 1 0 10 31A22 22 0 0 1 58 29Z"/><path d="m66 30 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/>',
early_days:'<path d="M25 61h46M33 55a15 15 0 0 1 30 0M48 27v8M24 39l7 5m34 0 7-5M40 69h16"/>',
weekend_days:'<path d="M28 33h40v36H28ZM28 43h40M37 27v12m22-12v12m-22 17 8 7 14-15"/>',
tenure:'<path d="m48 28 6 14 16 1-12 10 4 16-14-9-14 9 4-16-12-10 16-1Z"/>',
up:'<path d="m29 52 19-17 19 17M29 65l19-17 19 17M40 27l8-7 8 7"/>',
down:'<path d="m29 37 19 17 19-17M29 50l19 17 19-17"/>',
departments:'<path d="M48 28v13M27 52V41h42v11M39 61h18M22 52h11v15H22Zm41 0h11v15H63ZM42 22h12v12H42Z"/>',
calendar:'<path d="M27 34h42v36H27ZM27 44h42M37 27v13m22-13v13M37 55h5m12 0h5m-22 8h5"/>',
feedback:'<path d="M25 31h46v31H48L35 72V62H25ZM36 42h24m-24 9h16"/>',
account:'<circle cx="48" cy="39" r="10"/><path d="M28 70v-5a20 20 0 0 1 40 0v5"/>',
shield:'<path d="m48 25 20 8v15c0 12-10 20-20 25-10-5-20-13-20-25V33ZM38 48l7 7 14-16"/>'
};
function mark(kind='shield',tier=0,secret=false){const colors=[['#bd8b63','#f1cf9f'],['#94b5d0','#e3f1ff'],['#c7a756','#fff0b6'],['#87c6cf','#e5ffff'],['#b3addc','#f1ecff']],c=colors[Math.min(4,Math.max(0,tier))];return `<svg class="vi-insignia" viewBox="0 0 96 112" fill="none" aria-hidden="true" focusable="false" style="--vi-metal:${c[0]};--vi-light:${c[1]}"><path d="m28 79-6 28 22-10 4 12 4-12 22 10-6-28" fill="#24435b" stroke="${c[0]}" stroke-width="2"/><path d="M48 5 85 20v36c0 23-21 39-37 47C32 95 11 79 11 56V20Z" fill="#101f30" stroke="${c[0]}" stroke-width="2.5"/><path d="M48 12 78 25v30c0 18-15 32-30 41-15-9-30-23-30-41V25Z" fill="#1d3447" stroke="${c[1]}" stroke-opacity=".45"/><path d="M25 58q-1 17 15 27M71 58q1 17-15 27" stroke="${c[0]}" stroke-width="2"/><g stroke="${c[1]}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${motifs[secret?'secret':kind]||motifs.shield}</g>${!secret?Array.from({length:Math.min(5,tier+1)},(_,i)=>`<circle cx="${48+(i-tier/2)*7}" cy="83" r="1.8" fill="${c[1]}"/>`).join(''):''}</svg>`}
function badge(b,secret){const groups={days:[7,30,90,180,365],streak:[3,7,14,30,60],cases:[1,10,50,100,250],reports:[1,10,50,100],reads:[5,25,100]};return mark(b.metric==='days'?'activity':b.metric,Math.max(0,(groups[b.metric]||[b.target]).indexOf(b.target)),secret)}
window.APD_MARKS={mark,badge};
const art={
'rank-changes':['assets/personnel-honors.webp','Dienstgrade & Laufbahn','up'],badges:['assets/personnel-honors.webp','Auszeichnungen & Leistung','shield'],departments:['chapter-art-19.webp','Divisionen & Teams','departments'],
'staff-channel':['chapter-art-15.webp','MRPD Communications','chat_days'],calendar:['chapter-art-19.webp','Department Schedule','calendar'],news:['chapter-art-19.webp','Department Bulletin','reads'],documents:['assets/evidence-division.webp','Records Division','reads'],feedback:['chapter-art-15.webp','Deine Stimme im Department','feedback'],accounts:['chapter-art-19.webp','Personnel Administration','account'],account:['chapter-art-19.webp','Mein Dienstprofil','account'],'officer-home':['chapter-art-06.webp','Patrol Operations','shield'],tests:['chapter-art-11.webp','Academy Examinations','tests'],rides:['chapter-art-06.webp','Field Training','shield'],radio:['chapter-art-15.webp','Communications Training','chat_days'],scenario:['chapter-art-13.webp','Einsatztraining','shield'],mapquiz:['chapter-art-06.webp','Los Santos Operations','shield'],plan:['chapter-art-19.webp','Academy Planning','calendar'],command:['chapter-art-19.webp','Command & Personnel','departments'],'command-live':['chapter-art-15.webp','Operations Center','departments'],messages:['chapter-art-15.webp','Department Mail','chat_days'],dienstbuch:['assets/evidence-division.webp','Dienstbuch & Vorgänge','cases'],leaderboard:['assets/personnel-honors.webp','Academy Honors','shield']};
art['officer-channel']=['assets/radio-communications.webp','Officer Communications','chat_days'];art['rookie-channel']=['assets/radio-communications.webp','Rookie & FTO Communications','chat_days'];art.radio[0]='assets/radio-communications.webp';art['staff-channel'][0]='assets/radio-communications.webp';art.messages[0]='assets/radio-communications.webp';art.rides[0]='assets/patrol-training.webp';art['officer-home'][0]='assets/patrol-training.webp';art.feedback[0]='assets/anonymous-feedback.webp';
let scheduled=false;
function decorate(){scheduled=false;const content=document.querySelector('#content');if(!content)return;const active=document.querySelector('#nav button.active');let view=(content.querySelector('.hub-work')?content.dataset.hubView:null)||active?.dataset.view||content.dataset.viView||'academy';if(active?.dataset.chapter)view='chapter';const spec=art[view]||['kapitel-banner-polizei.webp','MRPD Academy','chapters'];content.dataset.viView=view;for(const h of content.querySelectorAll(':scope>.section-head:has(h1),:scope>.section-head:has(h2),:scope>.pr-record-header')){if(h.dataset.viArt===view)continue;h.dataset.viArt=view;h.querySelector('.vi-banner-art')?.remove();const frame=document.createElement('div');frame.className='vi-banner-art';frame.style.backgroundImage='url("'+spec[0]+'")';frame.setAttribute('aria-hidden','true');const img=document.createElement('img');img.src=spec[0];img.alt='';img.decoding='async';img.width=1920;img.height=1080;img.onerror=()=>{img.onerror=null;img.src='kapitel-banner-polizei.webp'};frame.append(img);h.prepend(frame);let emblem=h.querySelector('.vi-page-emblem');if(!emblem){emblem=document.createElement('span');emblem.className='vi-page-emblem';emblem.setAttribute('aria-hidden','true');h.append(emblem)}emblem.innerHTML=mark(spec[2],2);const caption=h.querySelector('.no-banner-caption');if(caption)caption.textContent=spec[1]}
}
function queue(){if(!scheduled){scheduled=true;requestAnimationFrame(decorate)}}
new MutationObserver(queue).observe(document.querySelector('#content')||document.body,{childList:true,subtree:true});document.querySelector('#nav')?.addEventListener('click',queue);queue();
})();
