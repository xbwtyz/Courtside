import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {RELEASE_VERSION} from '../src/release/version.mjs';
import {publishRoot} from '../scripts/publish-root.mjs';
import {COURTSIDE_RELEASE,WHATS_NEW_RELEASES} from '../src/features/whats-new/releases.module.mjs';
import {build} from '../scripts/build.mjs';

test('1.7.1 version is consistent in the HTML, release notes, and Data Log JSON exporter',async()=>{
  assert.equal(RELEASE_VERSION,'1.7.1');
  assert.equal(COURTSIDE_RELEASE,RELEASE_VERSION);
  assert.equal(WHATS_NEW_RELEASES[0].version,RELEASE_VERSION);
  assert.equal(WHATS_NEW_RELEASES[0].title,'Maintenance & Release Safety');
  const html=(await readFile((await build()).path)).toString('utf8');
  assert.match(html,/<title>Courtside 1\.7\.1/);
  assert.match(html,/aria-label="Courtside version 1\.7\.1">v1\.7\.1/);
  assert.match(html,/<span>Courtside v1\.7\.1<\/span>/);
  assert.match(html,/New in v1\.7\.1:/);
  const dataSource=(await readFile(new URL('../src/features/data-log/core.module.mjs',import.meta.url),'utf8'));
  assert.match(dataSource,/version:RELEASE_VERSION,exportedAt:/);
  assert.match(dataSource,/import \{ RELEASE_VERSION \} from/);
  const legacy=(await build({verifyBaseline:true}));
  assert.equal(legacy.bytes,374363);
});

test('prepare root distribution in an isolated destination, verify exact bytes and reject drift',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'courtside-distribution-test-'));
  const destination=join(temp,'courtside.html');
  try{
    await assert.rejects(()=>publishRoot({check:true,destination}),/Distribution missing/);
    const prepared=await publishRoot({destination});
    const original=await readFile(destination);
    const checked=await publishRoot({check:true,destination});
    assert.equal(prepared.version,'1.7.1');
    assert.deepEqual(prepared,checked);
    assert.equal(prepared.bytes,original.length);
    assert.ok(original.includes(Buffer.from('v1.7.1')));
    await writeFile(destination,Buffer.concat([original,Buffer.from('\n<!-- drift -->')]));
    await assert.rejects(()=>publishRoot({check:true,destination}),/Distribution mismatch/);
    const replaced=await publishRoot({destination});
    assert.equal(replaced.sha256,prepared.sha256);
    assert.ok((await readFile(destination)).equals(original));
  }finally{await rm(temp,{recursive:true,force:true});}
});
