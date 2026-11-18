import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const files=['app.js','legacy-academy.js','academy-workflow.js','quiz-engine.js','mail-attachments.js','cad-simulator.js'];
const root=new URL('../',import.meta.url);
const contents=await Promise.all(files.map(f=>readFile(new URL(f,root),'utf8')));
await writeFile(new URL('portal-core.js',root),contents.join(''));
console.log('Built portal-core.js from '+files.length+' source modules.');
