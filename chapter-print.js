(() => {
 'use strict';

 const content = document.querySelector('#content');
 const paperWidth = 960;
 const maxHeight = 6000;
 const style = document.createElement('style');
 style.textContent = `
 .chapter-print-actions { display:flex; flex-wrap:wrap; align-items:center; gap:12px; margin:18px 0 0; }
 .chapter-print-actions [role=status] { font-size:.9rem; }
 .chapter-print-preview { position:absolute; left:-10000px; top:0; pointer-events:none; }
 .chapter-print-paper { box-sizing:border-box; width:960px; background:#fff; color:#182b40;
  font:19px/1.53 Arial,sans-serif; text-align:left; overflow-wrap:anywhere; }
 .chapter-print-paper header { display:flex; gap:24px; align-items:center; padding:36px 52px;
  color:#fff; background:#102945; border-top:8px solid #c79a4a; }
 .chapter-print-paper header img { width:82px; height:auto; flex:none; }
 .chapter-print-paper header p { margin:0 0 7px; color:#f3ce87; font-size:15px; font-weight:700; letter-spacing:1px; }
 .chapter-print-paper header h1 { margin:0; color:#fff; font:700 36px/1.14 Arial,sans-serif; }
 .chapter-print-paper section { padding:30px 52px 26px; }
 .chapter-print-paper section h2,.chapter-print-paper section h3,.chapter-print-paper section h4,
 .chapter-print-paper section h5,.chapter-print-paper section h6 {
  margin:22px 0 9px; color:#123f65; font:700 23px/1.28 Arial,sans-serif; border-bottom:1px solid #d7e2ed; padding-bottom:6px; }
 .chapter-print-paper section p { margin:0 0 12px; }
 .chapter-print-paper section ul,.chapter-print-paper section ol { padding-left:30px; margin:0 0 14px; }
 .chapter-print-paper .mnemonic,.chapter-print-paper .notice,.chapter-print-paper blockquote {
  margin:12px 0; padding:12px 16px; border-left:4px solid #bf8c37; background:#fbf2df; color:#563c19; }
 .chapter-print-paper .mnemonic { font-weight:700; }
 .chapter-print-paper .step-row { display:flex; gap:10px; }
 .chapter-print-paper .step-dot { color:#17633b; font-weight:700; }
 .chapter-print-paper .table-wrap { overflow:visible; }
 .chapter-print-paper table { width:100%; border-collapse:collapse; margin:10px 0 18px; }
 .chapter-print-paper th,.chapter-print-paper td { padding:8px 12px; border:1px solid #c9d7e5; vertical-align:top; }
 .chapter-print-paper th { background:#224769; color:#fff; }
 .chapter-print-paper tr:nth-child(even) td { background:#edf3f8; }
 .chapter-print-paper .gallery { display:block; }
 .chapter-print-paper section img { display:block; max-width:100%; width:auto; height:auto; max-height:none; margin:10px auto 18px; border-radius:0; }
 .chapter-print-paper pre { white-space:pre-wrap; }
 .chapter-print-paper footer { padding:12px 52px; border-top:1px solid #d7e2ed; background:#edf3f8; color:#23496e;
  font-size:14px; font-weight:700; letter-spacing:.5px; }
 `;
 document.head.append(style);

 function download(canvas, filename) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
   if (!blob || blob.type !== 'image/jpeg') {
    reject(new Error('JPEG konnte nicht erzeugt werden.'));
    return;
   }
   const url = URL.createObjectURL(blob);
   const link = document.createElement('a');
   link.href = url;
   link.download = filename;
   document.body.append(link);
   link.click();
   link.remove();
   setTimeout(() => URL.revokeObjectURL(url), 60000);
   resolve();
  }, 'image/jpeg', .94));
 }

 async function exportChapter(article, title, number) {
  const preview = document.createElement('div');
  preview.className = 'chapter-print-preview';
  preview.setAttribute('aria-hidden', 'true');
  preview.inert = true;
  const paper = document.createElement('div');
  paper.className = 'chapter-print-paper';
  paper.innerHTML = '<header><img src="assets/mrpd-logo.svg" alt=""><div><p></p><h1></h1></div></header><section></section><footer>MISSION ROW POLICE DEPARTMENT · FTO-AKADEMIE</footer>';
  paper.querySelector('header p').textContent = `MRPD AKADEMIE · LERNZETTEL · KAPITEL ${number}`;
  paper.querySelector('h1').textContent = title;
  const copy = article.cloneNode(true);
  copy.querySelectorAll('button, input, select, textarea, [role="status"], script').forEach(element => element.remove());
  copy.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
  copy.querySelectorAll('img').forEach(image => {
   image.removeAttribute('onclick');
   image.loading = 'eager';
  });
  paper.querySelector('section').replaceChildren(...copy.childNodes);
  preview.append(paper);
  document.body.append(preview);
  try {
   await Promise.all([...paper.querySelectorAll('img')].map(image => image.decode()));
   const renderer = window.MRPDExportRenderer();
   const height = Math.ceil(paper.getBoundingClientRect().height);
   const filename = 'MRPD-Kapitel-' + number + '-Lernzettel';
   for (let y = 0, part = 1; y < height; y += maxHeight, part++) {
    const canvas = await renderer(paper, {
     width: paperWidth, height: Math.min(height - y, maxHeight), y,
     scale: 1.5, backgroundColor: '#fff', logging: false
    });
    try {
     await download(canvas, filename + (height > maxHeight ? '-Teil-' + part : '') + '.jpg');
    } finally {
     canvas.width = canvas.height = 0;
    }
   }
   return Math.ceil(height / maxHeight);
  } finally {
   preview.remove();
  }
 }

 function addPrintButton() {
  const article = content.querySelector('.chapter-body article.article');
  const caption = content.querySelector('.apd-banner-caption');
  const number = caption?.querySelector('.chapter-no')?.textContent.match(/\d+/)?.[0];
  const title = caption?.querySelector('h1')?.textContent.trim();
  if (!article || !number || !title || content.querySelector('.chapter-print-actions')) return;

  const actions = document.createElement('div');
  actions.className = 'chapter-print-actions';
  actions.innerHTML = '<button type="button" class="primary">Drucken</button><span role="status"></span>';
  const button = actions.querySelector('button');
  const status = actions.querySelector('[role="status"]');
  button.title = 'Kapitel als JPEG-Lernzettel herunterladen';
  button.onclick = async () => {
   button.disabled = true;
   status.textContent = 'Lernzettel wird erstellt …';
   try {
    const parts = await exportChapter(article, title, number);
    status.textContent = parts === 1 ? 'JPEG-Download gestartet.' : `${parts} JPEG-Downloads gestartet.`;
   } catch (error) {
    console.error('MRPD Lernzettel', error);
    status.textContent = 'Der Lernzettel konnte nicht heruntergeladen werden.';
   } finally {
    button.disabled = false;
   }
  };
  content.append(actions);
 }

 if (content) {
  new MutationObserver(addPrintButton).observe(content, { childList: true, subtree: true });
  addPrintButton();
 }
})();
