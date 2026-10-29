/* Saisonale APD-Halloween-Dekoration – rein visuell, ohne externe Bilder oder Abhängigkeiten. */
(()=>{
 const overlay=document.createElement('div');
 overlay.className='apd-halloween';
 overlay.setAttribute('aria-hidden','true');
 overlay.innerHTML=`
  <svg class="apd-hw-web apd-hw-web-tr" viewBox="0 0 220 220" focusable="false"><path d="M220 0H0v220M220 30 30 220M220 70 70 220M220 110 110 220M220 150 150 220M190 0 0 190M150 0 0 150M110 0 0 110M70 0 0 70M30 0 0 30M0 0q0 110 110 110T220 220M0 0q0 70 70 70t150 150M0 0q0 35 35 35t185 185"/></svg>
  <svg class="apd-hw-web apd-hw-web-bl" viewBox="0 0 190 190" focusable="false"><path d="M0 190h190V0M0 160 160 0M0 120 120 0M0 80 80 0M0 40 40 0M30 190 190 30M70 190 190 70M110 190 190 110M150 190 190 150M0 190q0-95 95-95t95-95M0 190q0-60 60-60t130-130M0 190q0-30 30-30t160-160"/></svg>
  <svg class="apd-hw-spider" viewBox="0 0 60 78" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2"><path d="M30 0v27M20 28 8 17m12 18L4 36m17 8L8 56m18-8L18 70M40 28l12-11m-12 18 16 1m-17 8 13 12m-18-8 8 22"/><ellipse cx="30" cy="38" rx="8" ry="11" fill="#111923"/><circle cx="30" cy="26" r="6" fill="#172435"/></g><circle cx="27" cy="26" r="1.3" fill="#ffb347"/><circle cx="33" cy="26" r="1.3" fill="#ffb347"/></svg>
  <svg class="apd-hw-ghost" viewBox="0 0 100 120" focusable="false"><path d="M50 5C23 5 12 29 12 55v53l18-11 18 13 19-13 21 11V55C88 29 77 5 50 5Z" fill="url(#ghostGlow)" stroke="#d7ebff" stroke-width="2"/><defs><radialGradient id="ghostGlow"><stop stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#b6d8ff" stop-opacity=".22"/></radialGradient></defs><ellipse cx="37" cy="49" rx="4" ry="7" fill="#182536"/><ellipse cx="62" cy="49" rx="4" ry="7" fill="#182536"/><path d="M44 67q6 7 12 0" fill="none" stroke="#182536" stroke-width="3" stroke-linecap="round"/></svg>
  <svg class="apd-hw-pumpkin" viewBox="0 0 120 94" focusable="false"><path d="M57 17q-5-9 3-15 8 6 5 15" fill="none" stroke="#6bb36b" stroke-width="7" stroke-linecap="round"/><path d="M60 18C45 6 15 20 12 49 7 76 26 88 60 88s53-12 48-39C105 20 75 6 60 18Z" fill="#f27a22" stroke="#ffab48" stroke-width="3"/><path d="M60 17c-8 18-8 51 0 71M42 16c-8 20-8 53 1 69m35-68c8 20 8 50-1 68" fill="none" stroke="#bd4d17" stroke-width="4" opacity=".8"/><path d="m34 39 12 8-12 8m52-16-12 8 12 8M48 66q12 12 24 0l-4 12H52Z" fill="#142033"/></svg>
  <span class="apd-hw-mist apd-hw-mist-one"></span><span class="apd-hw-mist apd-hw-mist-two"></span>
 `;
 document.body.append(overlay);
})();
