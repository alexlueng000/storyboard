import {JobService} from '../backend/jobs.mjs';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const token='a'.repeat(64),image='data:image/png;base64,'+Buffer.alloc(40,1).toString('base64');
const plan={characters:'one blue dog',pages:[0,1,2].map(n=>({text:'第'+n+'幕',prompt:'scene '+n}))};
const result=n=>({candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:Buffer.alloc(40,n+2).toString('base64')}}]}}]});
async function until(fn){for(let i=0;i<400;i++){if(fn())return;await new Promise(r=>setTimeout(r,10))}throw Error('timeout')}
const dirs=[];
try{
 for(const mode of ['reverse','recover','delete']){
 const dir=await mkdtemp(join(tmpdir(),'parallel-images-'));dirs.push(dir);
 const gates={},calls=[];let lostBody,found=false;
 const fetchImpl=async(url,opts)=>{
  if(url.endsWith('/lookup'))return Response.json({items:found?[{request_id:'lost',created_at:Math.floor(Date.now()/1000)}]:[]});
  if(url.endsWith('/recoveries/lost'))return Response.json({request:{body_raw:JSON.stringify(lostBody)},response:{body_raw:JSON.stringify(result(1))}});
  const body=JSON.parse(opts.body);
  if(url.includes('/chat/'))return Response.json({choices:[{message:{content:JSON.stringify(plan)}}]});
  const n=Number(body.contents[0].parts[0].text.match(/This is page (\d)/)[1])-2;
  calls.push(n);if(n>0)assert.equal(body.contents[0].parts[2].inlineData.data,result(0).candidates[0].content.parts[0].inlineData.data);
  if(n===0)return Response.json(result(n));
  if(mode==='recover'&&n===1){lostBody=body;throw Error('network failure')}
  return new Promise(resolve=>{gates[n]=()=>resolve(Response.json(result(n)))});
 };
 const service=new JobService({dir,key:'fixture',fetchImpl});await service.init();const id=randomUUID();await service.create({id,image,setting:'story',consent:true},token);
 try{await until(()=>calls.length===3&&gates[2]&&(mode==='recover'||gates[1]));}catch(e){console.log({mode,calls,state:service.jobs.get(id).state,error:service.jobs.get(id).error});throw e;}
 if(mode==='delete')await service.remove(id,token);
 gates[2]();if(gates[1])gates[1]();await until(()=>!service.running);
 const job=service.jobs.get(id);
 if(mode==='delete'){assert.equal(job.state,'DELETED');assert.equal(job.pages.length,0);assert.equal(job.pendingPage1,undefined);continue;}
 if(mode==='recover'){
  assert.equal(job.state,'WAITING_RECOVERY');assert.ok(job.pages[2]);assert.equal(job.pages[1],undefined);
  service.closed=true;found=true;const restarted=new JobService({dir,key:'fixture',fetchImpl});await restarted.init();await restarted.resume(id,token);await until(()=>!restarted.running);assert.equal(restarted.jobs.get(id).state,'READY');
 }else assert.equal(job.state,'READY');
 const saved=JSON.parse(await readFile(join(dir,id+'.json')));
 assert.equal(saved.state,'READY');assert.deepEqual(calls,[0,1,2]);
 for(let n=0;n<3;n++){assert.equal(saved.pages[n].text,plan.pages[n].text);assert.ok(saved.pages[n].image.endsWith(Buffer.alloc(40,n+2).toString('base64')))}
 }
 console.log('PASS: parallel dispatch, reversed completion ordering, independent restart recovery without resubmission, cancellation while both pages run.');
}finally{for(const dir of dirs)await rm(dir,{recursive:true,force:true})}
