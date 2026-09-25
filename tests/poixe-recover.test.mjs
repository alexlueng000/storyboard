import {mkdtemp, mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=await mkdtemp(join(tmpdir(),'poixe-recovery-test-'));
try{
 const folder=join(root,'huahuole-poixe-fixture');await mkdir(folder);
 const now=Date.now();await writeFile(join(folder,'report.json'),JSON.stringify({createdAt:new Date(now).toISOString(),imageModel:'gemini-2.5-flash-image',error:'Network error or timeout'}));
 const mock=join(root,'mock.mjs');
 await writeFile(mock,`import assert from 'node:assert/strict';
 let original,calls=0;
 globalThis.fetch=async(url,options)=>{
 calls++;assert.ok(url.startsWith('https://api.poixe.com/v1/recoveries/'));
 if(url.endsWith('/lookup')){assert.equal(options.method,'POST');original=JSON.parse(options.body);return Response.json({items:process.env.TEST_CASE==='empty'?[]:[{request_id:'fixture',created_at:${Math.floor(now/1000)}}]})}
 assert.equal(options.method,'GET');return Response.json({request:{body_raw:JSON.stringify(original)},response:{body_raw:JSON.stringify({candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:'aGVsbG8='}}]}}]})}});
 };
 process.on('exit',()=>assert.equal(calls,process.env.TEST_CASE==='empty'?1:2));`);
 for(const testCase of ['empty','found']){
  const result=spawnSync(process.execPath,['--import',mock,resolve('scripts/poixe-recover.mjs')],{env:{...process.env,TMPDIR:root,POIXE_API_KEY:'local-fixture-only',TEST_CASE:testCase},encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const report=JSON.parse(await readFile(join(folder,'recovery-report.json'),'utf8'));
  assert.equal(report.recovered,testCase==='found');
  assert.ok(!result.stdout.includes('local-fixture-only'));
 }
 console.log('PASS: lookup-only empty/found paths, exact request matching, response extraction, no generation endpoints, no key output. Mock data only.');
}finally{await rm(root,{recursive:true,force:true})}
