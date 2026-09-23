#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { sourceFingerprint } from './lib/source-fingerprint.mjs';
const root=process.cwd();
const apps=['admin','pos','storefront','employee-portal'];
const output=path.join(root,'handoff/quality/ui-interaction-audit-latest.json');
const failures=[]; const result={};
function walk(dir,out=[]){if(!fs.existsSync(dir))return out;for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','.next','dist'].includes(e.name))continue;const p=path.join(dir,e.name);e.isDirectory()?walk(p,out):out.push(p)}return out}
function src(file){return fs.readFileSync(file,'utf8')}
for(const app of apps){
 const base=path.join(root,'apps',app); const files=walk(base); const tsx=files.filter(f=>f.endsWith('.tsx')); const css=files.filter(f=>f.endsWith('.css'));
 const source=tsx.map(src).join('\n'); const style=css.map(src).join('\n');
 const buttons=[...source.matchAll(/<button\b([^>]*)>/g)]; const links=[...source.matchAll(/<a\b([^>]*)>/g)];
 let inertButtons=0; let implicitSubmitButtons=0; for(const m of buttons){const a=m[1]; if(/onClick\s*=|type\s*=\s*["']submit["']|disabled/.test(a)) continue; const before=source.slice(0,m.index); const lastFormOpen=before.lastIndexOf('<form'); const lastFormClose=before.lastIndexOf('</form>'); if(lastFormOpen>lastFormClose){implicitSubmitButtons++;continue;} inertButtons++;}
 let inertLinks=0; for(const m of links){if(!/href\s*=/.test(m[1])) inertLinks++;}
 const item={tsxFiles:tsx.length,cssFiles:css.length,buttons:buttons.length,links:links.length,inertButtons,implicitSubmitButtons,inertLinks,tailwind:/@import\s+["']tailwindcss["']/.test(style),gradients:(style.match(/(?:linear|radial|conic)-gradient\s*\(/gi)||[]).length,horizontalOverflow:(style.match(/overflow-x\s*:\s*auto/gi)||[]).length};
 if(!item.tailwind)failures.push(`${app}: Tailwind import hilang`);
 if(item.gradients)failures.push(`${app}: gradient dekoratif ${item.gradients}`);
 if(item.horizontalOverflow)failures.push(`${app}: horizontal overflow ${item.horizontalOverflow}`);
 if(item.inertButtons)failures.push(`${app}: ${item.inertButtons} button tanpa handler/submit`);
 if(item.inertLinks)failures.push(`${app}: ${item.inertLinks} anchor tanpa href`);
 result[app]=item;
}
const data={generatedAt:new Date().toISOString(),status:failures.length?'FAIL':'PASS',sourceIdentity:sourceFingerprint(root),surfaces:result,failures,note:'Static interaction inventory is a mandatory companion to real browser UAT; it does not replace runtime click verification.'};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(data,null,2)+'\n');console.log(`UI source audit ${data.status}: ${Object.values(result).reduce((n,x)=>n+x.buttons+x.links,0)} controls inventoried.`);if(failures.length){failures.forEach(x=>console.error(`BLOCKER: ${x}`));process.exit(1)}
