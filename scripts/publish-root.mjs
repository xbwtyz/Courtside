/** Prepare and verify the exact single-file root distributable, without touching source. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { build } from './build.mjs';
import { RELEASE_VERSION } from '../src/release/version.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const rootHTML=join(root,'courtside.html');

export async function publishRoot({ check=false, destination=rootHTML }={}){
  const generated=await build();
  const candidate=await readFile(generated.path);
  if(!check)await writeFile(destination,candidate);
  let committed;
  try{committed=await readFile(destination);}
  catch(error){if(error?.code==='ENOENT')throw Error('Distribution missing: run npm run release:prepare first');throw error;}
  if(!candidate.equals(committed))
    throw Error('Distribution mismatch: courtside.html differs from the reproducible modular build');
  const sha256=createHash('sha256').update(committed).digest('hex');
  if(sha256!==generated.sha256)
    throw Error('Distribution SHA-256 unexpectedly differs from generated HTML');
  const html=committed.toString('utf8');
  if(!html.includes('Courtside '+RELEASE_VERSION+' — Live NBA Scores')||
    !html.includes('aria-label="Courtside version '+RELEASE_VERSION+'"')||
    !html.includes('<span>Courtside v'+RELEASE_VERSION+'</span>'))
    throw Error('The standalone distribution does not display the expected release version');
  if((html.match(/<script\b/gi)||[]).length!==1 ||
     (html.match(/<style\b/gi)||[]).length!==1 ||
     /<script[^>]*\btype\s*=\s*["']module/.test(html))
    throw Error('Distribution must contain exactly one classic script and one stylesheet');
  return {path:destination,sha256,bytes:committed.length,version:RELEASE_VERSION};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const result=await publishRoot({check:process.argv.includes('--check')});
    console.log((process.argv.includes('--check')?'Verified':'Prepared')+
      ' '+result.path+' ('+result.bytes+' bytes; v'+result.version+'; SHA-256 '+result.sha256+')');
  }catch(error){console.error(error.message);process.exitCode=1;}
}
