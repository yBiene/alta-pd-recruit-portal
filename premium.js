/* Non-invasive animations: observes existing DOM, no backend/network requests. */
(()=>{'use strict';
 const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
 const content=document.getElementById('content');if(!content)return;
 let last=null;
 function enhance(){if(reduce.matches||document.body.classList.contains('cinematic-off'))return;
  const nodes=content.querySelectorAll(':scope > .hero,:scope > .grid,:scope > .chapter-header,:scope > .card');
  for(const node of nodes){if(node===last)continue;node.classList.remove('premium-entrance');void node.offsetWidth;node.classList.add('premium-entrance');}
  last=nodes[nodes.length-1]||null;
 }
 let pending=false;
 new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;enhance()})}).observe(content,{childList:true});
 document.getElementById('cinematicToggle')?.addEventListener('click',()=>{if(!document.body.classList.contains('cinematic-off'))enhance()});
 enhance();
})();
