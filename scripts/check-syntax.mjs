/** Inventory-driven syntax check for all source, script and test JavaScript. */
import {readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function discoverSyntaxFiles(directory=root){
 const files=[];
 async function visit(relative){
  const entries=await readdir(join(directory,relative),{withFileTypes:true});
  for(const d of entries.sort((a,b)=>a.name.localeCompare(b.name))){
   const sub=join(relative,d.name);
   if(d.isDirectory())await visit(sub);
   else if(d.isFile()&&/\.(?:m?js)$/.test(d.name))files.push(sub);
  }
 }
 for(const dir of ['src','scripts','tests'])await visit(dir);
 return files.sort();
}
export async function checkSyntax(){
 const files=await discoverSyntaxFiles();
 let failed=0;
 for(const file of files){
  const result=spawnSync(process.execPath,['--check',join(root,file)],{encoding:'utf8'});
  if(result.status!==0){failed++;process.stderr.write('Syntax failed: '+file+'\n'+(result.stderr||result.stdout||'Unknown error'));}
 }
 if(failed)throw Error(failed+' of '+files.length+' syntax checks failed');
 console.log('Syntax verified for '+files.length+' JavaScript files');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 checkSyntax().catch(error=>{console.error(error.message);process.exitCode=1});
}
