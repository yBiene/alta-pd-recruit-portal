/* Shared usability: active navigation, compact dashboard and explicit write feedback. */
(()=>{'use strict';
const root=document.querySelector('#content'),nav=document.querySelector('#nav');
const notice=document.createElement('div');notice.className='ux-save-status';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');notice.hidden=true;document.body.append(notice);
let noticeTimer=0;
function status(message,state='idle'){clearTimeout(noticeTimer);notice.textContent=message;notice.dataset.state=state;notice.hidden=false;if(['saved','idle'].includes(state))noticeTimer=setTimeout(()=>notice.hidden=true,4500)}
window.APD_UX={status};
const edits=new Map();let writes=0,writeFailed=false,saveScope=null;
document.addEventListener('submit',e=>{saveScope=e.target},true);
document.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&/speichern|übernehmen|save/i.test(b.textContent+' '+b.id))saveScope=b.closest('form,.card,.zb-panel')},true);
const editable=el=>el.matches('input:not([type=search]):not([type=hidden]):not([type=file]):not([readonly]),textarea,select')&&!el.disabled&&!el.closest('[data-zb-root],#testForm,#apdSheetForm,.apd-sheet-dialog')&&!['globalSearch','learningNotes'].includes(el.id)&&!el.matches('[data-pr-search]');
function value(el){return el.type==='checkbox'||el.type==='radio'?el.checked:el.value}
function connectedEdits(){for(const [el] of edits)if(!el.isConnected)edits.delete(el);return edits.size}
document.addEventListener('focusin',e=>{if(root?.contains(e.target)&&editable(e.target)&&!e.target.dataset.uxInitial)e.target.dataset.uxInitial=JSON.stringify(value(e.target))});
document.addEventListener('input',changed);document.addEventListener('change',changed);
function changed(e){const el=e.target;if(!root?.contains(el)||!editable(el))return;const initial=el.dataset.uxInitial;if(initial!==undefined&&JSON.stringify(value(el))===initial)edits.delete(el);else edits.set(el,value(el));status(connectedEdits()?'Ungespeicherte Änderungen':'Bereit',connectedEdits()?'dirty':'idle')}
// Feedback follows confirmed server responses; failed writes retain the changed fields.
const originalFetch=window.fetch;
window.fetch=async function(input,init){const url=typeof input==='string'?input:input?.url||String(input),method=(init?.method||input?.method||'GET').toUpperCase();const write=/\/rest\/v1\//.test(url)&&['POST','PATCH','PUT','DELETE'].includes(method)&&!url.includes('/rpc/apd_evidence_')&&(!url.includes('/rpc/')||/\/rpc\/(update|save|mark|apd_archive)/.test(url));
if(!write)return originalFetch.apply(this,arguments);
const snapshot=new Map([...edits].filter(([el])=>el.isConnected&&saveScope?.contains(el)));if(!writes)writeFailed=false;writes++;status('Wird gespeichert …','saving');
try{const response=await originalFetch.apply(this,arguments);if(response.ok){for(const [el,v] of snapshot)if(el.isConnected&&value(el)===v){edits.delete(el);el.dataset.uxInitial=JSON.stringify(v)}}else writeFailed=true;return response}catch(error){writeFailed=true;throw error}finally{writes--;if(!writes)status(writeFailed?'Speichern fehlgeschlagen – Eingaben prüfen':connectedEdits()?'Weitere ungespeicherte Änderungen':'Gespeichert',writeFailed?'error':connectedEdits()?'dirty':'saved')}};
function canLeave(){if(writes){status('Speicherung läuft. Bitte kurz warten.','saving');return false}if(!connectedEdits())return true;if(!confirm('Ungespeicherte Änderungen verwerfen und diesen Bereich verlassen?'))return false;edits.clear();notice.hidden=true;return true}
document.addEventListener('click',e=>{if(!e.target.closest('#nav button,.sidebar-bottom button,#topAccountBtn,[data-record-tab],[data-record-jump],.pr-record-back,[data-pr-open],[data-v630-recruit],.chapter-card[data-open]'))return;if(!canLeave()){e.preventDefault();e.stopImmediatePropagation()}},true);
window.addEventListener('beforeunload',e=>{if(writes||connectedEdits()){e.preventDefault();e.returnValue=''}});
function activeNav(){if(!nav)return;nav.querySelectorAll('[aria-current]').forEach(b=>{if(!b.classList.contains('active'))b.removeAttribute('aria-current')});nav.querySelectorAll('button.active').forEach(b=>{b.setAttribute('aria-current','page');const group=b.closest('details');if(group&&!group.open)group.open=true});nav.querySelectorAll('details').forEach(g=>g.classList.toggle('ux-current-group',!!g.querySelector('button.active')))}
// One consistent monochrome symbol per destination; chapter labels stay intact.
const symbols={dashboard:'⌂',evidence:'▤',admin:'▣',tests:'✓',cad:'▦',scenario:'◇',radio:'◉',mapquiz:'⌖',rides:'↗',dienstbuch:'≡',achievements:'☆',leaderboard:'≡',calendar:'▦',plan:'≡',news:'≡',documents:'▤',messages:'✉',command:'◈','command-live':'◈',accounts:'⚙',account:'○'};
function icons(){document.querySelectorAll('#nav button.nav-btn,.sidebar-bottom .nav-btn').forEach(b=>{if(b.querySelector('.ux-nav-icon'))return;const label=b.textContent.replace(/^[^\p{L}\p{N}]+/u,'').trim();if(!label)return;const i=document.createElement('span');i.className='ux-nav-icon';i.setAttribute('aria-hidden','true');i.textContent=symbols[b.dataset.view]||(b.dataset.chapter?'·':'↗');b.replaceChildren(i,document.createTextNode(label));b.title=label})}
function dashboardLayout(){const hero=root?.querySelector('.pr-winter');if(!hero)return;const priority=root.querySelector('.v630-command-grid')||root.querySelector('.v61-continue')||root.querySelector('.v53-dashboard-space');if(priority&&hero.nextElementSibling!==priority)hero.after(priority);const appointments=root.querySelector('.v53-dashboard-space');if(appointments&&priority&&appointments!==priority&&priority.nextElementSibling!==appointments)priority.after(appointments);const duplicate=root.querySelector('.v61-fto-today');if(duplicate&&root.querySelector('.v630-command-grid'))duplicate.remove()}
let scheduled=false;function update(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;activeNav();icons();dashboardLayout();connectedEdits()})}
if(nav)new MutationObserver(update).observe(nav,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});if(root)new MutationObserver(update).observe(root,{childList:true});update();
})();
