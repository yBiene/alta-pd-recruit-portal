/* Run with Playwright and a headless Chromium on the module path. Backend permissions
   are tested separately in database/department_operations.tests.sql. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium:pw}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const chromium=require(process.env.CHROMIUM_MODULE||'@sparticuz/chromium').default;
 const browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://mrpd.test/**',route=>route.request().url().endsWith('.svg')?route.fulfill({contentType:'image/svg+xml',body:fs.readFileSync(path.resolve(__dirname,'..','assets/mrpd-logo.svg'),'utf8')}):route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="de"><head></head><body><div id="app"><aside id="nav"><div class="unit-nav-links"></div></aside><h1 id="pageTitle"></h1><main id="content"></main></div></body></html>'}));
  await page.goto('https://mrpd.test/');
  for(const file of ['style.css','unit-workspaces.css','department-hub.css','department-operations.css','zellenbereich.css'])await page.addStyleTag({path:path.resolve(__dirname,'..',file)});
  await page.evaluate(()=>{
   window.current={id:'11111111-1111-4111-8111-111111111111',name:'Rekrut Schmidt',rank:'Rekrut',serviceNo:'44',mustChangePassword:false,role:'admin'};
   window.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   window.units=[{id:'22222222-2222-4222-8222-222222222222',name:'Patrol Division',workspace_kind:'patrol'}];
   window.records=[];window.files=[];window.calls=[];
   const query=table=>{
    let filters=[],single=false,begin=0,end=999;
    const q={select(){return q;},eq(k,v){filters.push(r=>String(k).includes('->>')?String(r.fields[k.split('->>')[1]])===String(v):r[k]===v);return q;},in(k,v){filters.push(r=>v.includes(r[k]));return q;},gte(){return q;},lt(){return q;},ilike(k,v){filters.push(r=>r[k].toLowerCase().includes(v.replaceAll('%','').toLowerCase()));return q;},order(){return q;},range(a,b){begin=a;end=b;return q;},limit(v){end=v-1;return q;},maybeSingle(){single=true;return q;},single(){single=true;return q;},update(){return q;},then(resolve){const all=table==='mrpd_ops_records'?records:table==='mrpd_portal_files'?files:table==='portal_hub_departments'?units:[];const result=all.filter(r=>filters.every(f=>f(r))).slice(begin,end+1);return Promise.resolve({data:single?result[0]||null:result,error:null}).then(resolve);}};return q;
   };
   window.sb={from:query,auth:{onAuthStateChange(){},async getUser(){return {data:{user:{id:current.id}},error:null};}},storage:{from(){return{async upload(){return{error:null};},async createSignedUrl(){return{data:{signedUrl:window.picture},error:null};},async createSignedUrls(paths){return{data:paths.map(()=>({signedUrl:window.picture})),error:null};}};}},async rpc(name,args){
    calls.push({name,args});
    if(name==='mrpd_file_command'){
     if(args.p_action==='prepare'){const f={id:args.p_id,...args.p_data,ready:false};files.push(f);return{data:f,error:null};}
     const f=files.find(f=>f.id===args.p_id);f.ready=true;return{data:f,error:null};
    }
    if(name==='mrpd_ops_command'){
     let row=records.find(r=>r.id===args.p_id);
     if(args.p_action==='save'){
      const data=args.p_data;if(row)Object.assign(row,data,{revision:row.revision+1});
      else{row={id:args.p_id,...data,author_id:current.id,created_at:new Date().toISOString(),status:['vehicle','equipment','person'].includes(data.kind)?'active':'draft',revision:0,archived:false};records.unshift(row);}
     }else if(args.p_action==='transition'){row.status=args.p_data.status;row.revision++;}
     else if(args.p_action==='checks')return{data:[],error:null};
     else if(args.p_action==='clock_in'){row={id:crypto.randomUUID(),kind:'shift',author_id:current.id,status:'active',revision:0,fields:{started_at:new Date().toISOString()}};records.push(row);}
     return{data:structuredClone(row),error:null};
    }
    if(name==='apd_evidence_detail')return{data:window.evidence,error:null};
    if(name==='apd_evidence_directory')return{data:[],error:null};
    return{data:{items:[],stats:{},total:0},error:null};
   }};
   window.APD_HUB={state:{people:[current],generation:0},RANKS:['Rekrut','Police Officer'],plus:()=>true,staff:()=>true,updateBell(){},setArea(){}};
   window.MRPDUnits={load:async()=>{},units:()=>units,canManage:()=>true,stop(){}};
   window.showView=()=>{};window.nav=()=>{};window.setActive=()=>{};
   window.textDrawn=[];const fill=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){textDrawn.push(text);return fill.call(this,text,...args);};
   const c=document.createElement('canvas');c.width=1280;c.height=720;const x=c.getContext('2d');x.fillStyle='#226644';x.fillRect(0,0,1280,720);x.fillStyle='#eeee44';x.fillRect(370,230,540,270);window.picture=c.toDataURL('image/png');
  });
  for(const file of ['bodycam-frames.js','portal-files.js','unit-workspaces.js','department-operations.js'])await page.addScriptTag({path:path.resolve(__dirname,'..',file)});
  await page.evaluate(()=>MRPDUnits.open(units[0].id,'operations'));assert.equal(await page.locator('[data-unit-tab=operations][aria-current=page]').count(),1);
  await page.evaluate(()=>showView('department-operations'));
  await page.getByRole('button',{name:'Erstellen',exact:true}).click();
  let dialog=page.locator('.ops-dialog[open]');await dialog.locator('input[name=title]').fill('Abwesenheit · Test');await dialog.locator('input[name=from]').fill('2026-11-20');await dialog.locator('input[name=to]').fill('2026-11-22');await dialog.getByRole('button',{name:'Speichern',exact:true}).click();
  await page.getByRole('button',{name:'Zur Freigabe einreichen'}).click();await page.getByRole('button',{name:'Freigeben',exact:true}).click();
  assert.equal(await page.evaluate(()=>records[0].status),'approved');assert.equal(await page.getByRole('button',{name:'Bearbeiten',exact:true}).count(),0);
  await page.locator('.ops-dialog[open] header button').click();
  await page.locator('.ops-modules summary').filter({hasText:'Vorgänge'}).click();await page.getByRole('button',{name:'Berichte & Freigaben',exact:true}).click();await page.getByRole('button',{name:'Erstellen',exact:true}).click();
  dialog=page.locator('.ops-dialog[open]');await dialog.locator('input[name=title]').fill('Einsatzbericht');await dialog.locator('textarea[name=body]').fill('Sachverhalt mit <b>literalem Inhalt</b>');await dialog.getByRole('button',{name:'Speichern',exact:true}).click();
  await page.locator('.portal-files input[type=file]').setInputFiles({name:'Beweis.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6tN8AAAAASUVORK5CYII=','base64')});
  await page.getByRole('button',{name:'Anhänge hochladen'}).click();await page.getByText('Anhänge gespeichert.',{exact:true}).waitFor();assert.equal(await page.locator('.portal-file').count(),1);
  assert.equal(await page.locator('.unit-document-body b').count(),0);
  await page.locator('.ops-dialog[open] header button').click();
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile overflow');await page.setViewportSize({width:1400,height:1000});
  await page.screenshot({path:'/tmp/mrpd-ops-overview.png',fullPage:true});
  // Real canvas rendering, old images and new uploader snapshots.
  const bodycam=await page.evaluate(async()=>{
   const meta={id:'test',uploaded_by_name:'Schmidt',officer_rank:'Rekrut',officer_service_no:'44',created_at:'2026-11-19T10:22:00Z',title:'Barrikade intakt'};
   const url=await MRPDBodycam.render(picture,meta);const i=new Image();i.src=url;await i.decode();document.querySelector('#content').replaceChildren(i);i.style.width='100%';
   return{width:i.naturalWidth,height:i.naturalHeight,texts:textDrawn};
  });
  assert.equal(bodycam.width,1280);assert(bodycam.height>720);assert(bodycam.texts.includes('MRPD BODYCAM'));assert(bodycam.texts.some(t=>t.includes('Rekrut · Schmidt · DN 44')));assert(bodycam.texts.includes('Zeitangabe = Upload-Zeit'));
  await page.screenshot({path:'/tmp/mrpd-bodycam-frame.png',fullPage:true});
  await page.evaluate(()=>{
   window.printed=0;window.print=()=>printed++;
   const c={id:'33333333-3333-4333-8333-333333333333',name:'Beweisakte Test',number:'TEST-01',status:'Offen',creator:'Schmidt',created_at:'2026-11-19T10:22:00Z',updated_at:'2026-11-19T10:22:00Z',version:1,officers:[]};
   window.evidence={record:c,history:[],images:[{id:'test',path:'fixture.png',uploaded_by_name:'Schmidt',officer_rank:'Rekrut',officer_service_no:'44',created_at:c.created_at,original_name:'Beweis.png',sha256:'a'.repeat(64),bytes:100,title:'Barrikade intakt'}]};
   // Avoid a native dialog but exercise the actual generated print document.
   const append=Element.prototype.append;Element.prototype.append=function(...items){const r=append.apply(this,items);for(const node of items)if(node instanceof HTMLIFrameElement)node.contentWindow.print=()=>window.printed++;return r;};
  });
  await page.addScriptTag({path:path.resolve(__dirname,'..','zellenbereich.js')});
  await page.evaluate(()=>APD_EVIDENCE.render(document.querySelector('#content'),evidence.record.id));
  await page.locator('[data-image="0"]').click();assert.equal(await page.locator('.zb-lightbox[open]').count(),1);assert((await page.locator('.zb-lightbox img').getAttribute('src')).startsWith('data:image/jpeg;'));
  await page.locator('[data-action=close]').click();await page.locator('[data-action=print]').click();await page.waitForFunction(()=>document.querySelector('#apd-evidence-print')?.contentDocument.querySelector('.evidence img')?.naturalWidth>0);await page.locator('[data-action=print]:not([disabled])').waitFor();
  const frame=page.frameLocator('#apd-evidence-print');assert((await frame.locator('.evidence img').getAttribute('src')).startsWith('data:image/jpeg;'));assert.equal(await frame.locator('.evidence img').evaluate(i=>i.naturalWidth),1280);
  const downloadEvent=page.waitForEvent('download');await page.locator('[data-bodycam-download="0"]').click();const download=await downloadEvent;assert(download.suggestedFilename().startsWith('MRPD-Bodycam-'));
  assert.deepEqual(errors,[]);
  console.log('PASS: Browser create/submit/approve, readonly decision, private attachment upload, escaped text, responsive layout, Bodycam metadata/canvas, existing-case viewer, JPEG download and framed print.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
