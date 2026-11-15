/* Night Operations — visual presentation only; existing actions and data stay authoritative. */
(()=>{'use strict';
const content=document.querySelector('#content'),navigation=document.querySelector('#nav');
if(!content)return;
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={
 badges:'M12 2 4 5v8c0 5 8 9 8 9s8-4 8-9V5ZM8 11l3 3 5-6',
 'rank-changes':'m5 12 7-7 7 7M5 20l7-7 7 7',
 departments:'M9 2h6v6H9ZM12 8v5M4 13h16M4 13v4m16-4v4M1 17h6v5H1Zm16 0h6v5h-6Z',
 feedback:'M3 3h18v14H9l-6 5ZM7 8h10M7 12h7',
 'staff-channel':'M3 4h14v11H9l-6 4ZM18 9h4v12l-4-3h-6',
 'officer-home':'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6ZM8 12l3 3 5-6',
 dashboard:'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',
 evidence:'M3 7h7l2-3h9v17H3ZM3 10h18M8 14h8',
 admin:'M4 3h16v18H4ZM8 7h8M8 17h8M10 11a2 2 0 1 0 4 0 2 2 0 0 0-4 0',
 tests:'M9 4H5v17h14V4h-4M9 3h6v4H9ZM8 14l3 3 5-6',
 radio:'M8 3 5 1M6 5h12v17H6ZM9 9h6M9 13h6M10 17h4',
 calendar:'M4 5h16v16H4ZM8 2v6M16 2v6M4 10h16M8 14h2M14 14h2M8 17h2',
 documents:'M5 2h10l4 4v16H5ZM14 2v5h5M9 11h6M9 15h6M9 19h4',
 messages:'M3 5h18v14H3ZM3 6l9 7 9-7',
 account:'M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0M4 22v-3a8 8 0 0 1 16 0v3',
 mapquiz:'M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16M15 5v16',
 command:'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6ZM8 12l3 3 5-6',
 scenario:'M3 4h18v16H3ZM9 8l7 4-7 4Z',
 rides:'M4 12l2-7h12l2 7M2 12h20v7H2ZM5 19v3M19 19v3M5 15h3M16 15h3',
 achievements:'M8 3h8v8a4 4 0 0 1-8 0ZM8 5H3v3a5 5 0 0 0 5 5M16 5h5v3a5 5 0 0 1-5 5M12 15v6M8 22h8',
 plan:'M4 3h16v18H4ZM8 7h8M8 12h8M8 17h5',
 news:'M4 3h16v18H4ZM8 7h8M8 11h3v4H8ZM14 11h2M14 15h2M8 18h8',
 chapter:'M12 5c-3-3-8-2-10-1v16c3-1 7-2 10 0 3-2 7-1 10 0V4c-2-1-7-2-10 1ZM12 5v15',
 outward:'M6 18 18 6M6 6h12v12',
 logout:'M9 3H3v18h6M8 12h14M17 7l5 5-5 5'
};
function svg(key){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[key]||paths.plan}"/></svg>`}
function icons(){document.querySelectorAll('.ux-nav-icon').forEach(i=>{if(i.dataset.noIcon)return;const b=i.closest('button'),key=b?.dataset.chapter?'chapter':b?.id==='logoutBtn'?'logout':b?.dataset.view;const normalized={'command-live':'command',accounts:'account',dienstbuch:'plan',leaderboard:'achievements',cad:'mapquiz'};i.innerHTML=svg(normalized[key]||key);i.dataset.noIcon='1'});const brand=document.querySelector('.brand small');if(brand&&brand.textContent!=='NIGHT OPERATIONS')brand.textContent='NIGHT OPERATIONS'}
function dashboard(){const hero=content.querySelector('.pr-winter');if(!hero||hero.closest('.no-dashboard-top'))return;
 const u=typeof current!=='undefined'?current:null;if(!u)return;
 const recruit=u.role==='recruit',staff=typeof db!=='undefined'?(db.users||[]).filter(r=>r.role==='recruit'&&!r.archivedAt&&r.status!=='Archiviert'&&(r.fto===u.name||r.secondaryFto===u.name)):[];
 const p=typeof progress==='function'?progress(u):0,role=typeof roleLabel==='function'?roleLabel(u):u.role||'Mitarbeiter';
 const top=document.createElement('div');top.className='no-dashboard-top';hero.before(top);top.append(hero);
 const card=document.createElement('aside');card.className='no-duty-card';card.setAttribute('aria-label','Persönliches Dienstprofil');
 card.innerHTML=`<div class="no-duty-top"><span class="no-overline">DIENSTPROFIL</span><span class="no-corner-code">APD</span></div><div class="no-duty-identity"><div class="no-duty-seal"><img src="${E(u.avatarUrl||'apd-logo-v2.png')}" alt="${u.avatarUrl?'Dein Profilbild':'Alta Police Department'}"></div><div><span class="no-duty-rank">${E(u.rank||role)}</span><h2>${E(u.name||'Officer')}</h2><span class="no-duty-number">DIENSTNUMMER / ${E(u.serviceNo||'—')}</span></div></div><div class="no-duty-status"><span></span>${E(u.status||role)}</div><dl class="no-duty-facts"><div><dt>Funktion</dt><dd>${E(role)}</dd></div><div><dt>${recruit?'Zuständiger FTO':'Zugeordnete Rekruten'}</dt><dd>${E(recruit?(u.fto||'Nicht zugewiesen'):staff.length)}</dd></div></dl>${recruit?`<div class="no-profile-progress"><div><span>Ausbildungsfortschritt</span><b>${p}%</b></div><div class="progress"><i style="width:${p}%"></i></div></div>`:''}<button type="button" class="no-profile-open">Mein Dienstprofil <span class="no-inline-icon">${svg('outward')}</span></button>`;
 top.append(card);card.querySelector('button').onclick=()=>{const trigger=document.querySelector('#topAccountBtn');if(trigger)trigger.click();else if(typeof showView==='function')showView('account')};
 hero.querySelector('.pr-season').textContent='LOS SANTOS / WINTER WATCH';
}
function record(){const head=content.querySelector('.record-head');if(!head||head.querySelector('.no-record-mark'))return;const badge=document.createElement('div');badge.className='no-record-mark';badge.setAttribute('aria-hidden','true');badge.innerHTML='<img src="apd-logo-v2.png" alt="">';head.prepend(badge);const r=typeof db!=='undefined'&&typeof selectedRecruit!=='undefined'?db.users.find(x=>x.id===selectedRecruit):null;if(r){const serial=document.createElement('span');serial.className='no-record-serial';serial.textContent='PERSONNEL FILE / '+(r.serviceNo||'—');head.querySelector('h2')?.after(serial)}}
function theme(){const active=navigation?.querySelector('button.active'),view=active?.dataset.view||'',chapter=active?.dataset.chapter;let key='academy';if(content.querySelector('.pr-winter'))key='dashboard';else if(content.querySelector('[data-zb-root]'))key='evidence';else if(content.querySelector('.record-workspace,.pr-record-header'))key='personnel';else if(['radio','cad','command-live','messages','staff-channel'].includes(view))key='dispatch';else if(['rides','scenario','mapquiz','officer-home'].includes(view))key='patrol';else if(['admin','accounts','account','command','dienstbuch','departments','rank-changes','badges'].includes(view))key='personnel';else if(['calendar','plan','news'].includes(view))key='planning';else if(view==='documents')key='documents';if(content.dataset.noTheme!==key)content.dataset.noTheme=key;
 content.querySelectorAll(':scope > .section-head').forEach(h=>{if(!h.querySelector('h1'))return;h.classList.add('no-section-banner');if(!h.querySelector('.no-banner-caption')){const caption=document.createElement('span');caption.className='no-banner-caption';caption.setAttribute('aria-hidden','true');caption.textContent={dispatch:'COMMUNICATIONS DIVISION',patrol:'PATROL OPERATIONS',personnel:'PERSONNEL & ACADEMY',planning:'DEPARTMENT SCHEDULE',documents:'RECORDS DIVISION'}[key]||'TRAINING DIVISION';h.append(caption)}});
}
let queued=false;function update(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;dashboard();record();theme();icons()})}
new MutationObserver(update).observe(content,{childList:true,subtree:true});if(navigation)new MutationObserver(update).observe(navigation,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});update();
})();
