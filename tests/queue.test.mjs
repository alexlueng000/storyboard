import {JobService} from '../backend/jobs.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'story-queue-'));
const image='data:image/png;base64,'+Buffer.alloc(40,1).toString('base64');
const plan={characters:'小狗',pages:[1,2,3].map(n=>({text:'第'+n+'页',prompt:'dog scene '+n}))};
const text=()=>Response.json({choices:[{message:{content:JSON.stringify(plan)}}]});
const picture=()=>Response.json({candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:Buffer.alloc(40,2).toString('base64')}}]}}]});
async function until(fn){for(let n=0;n<500;n++){if(fn())return;await new Promise(r=>setTimeout(r,10))}throw Error('timeout')}
let service;
try{
 const gates={},started=[];
 service=new JobService({dir,key:'fixture',concurrency:2,fetchImpl:async(url,opts)=>{
  if(url.endsWith('/lookup'))return Response.json({items:[]});
  if(!url.includes('/chat/'))return picture();
  const setting=JSON.parse(JSON.parse(opts.body).messages[1].content[0].text).setting;
  started.push(setting);
  if(setting==='waiting')throw Error('network lost');
  return new Promise(resolve=>{gates[setting]=()=>resolve(text())});
 }});await service.init();
 const tokens=['a','b','c','d','e'].map(x=>x.repeat(64));
 const inputs=['one','two','waiting','cancel','five'].map(setting=>({id:randomUUID(),image,setting,consent:true}));
 await Promise.all(inputs.map((p,n)=>service.create(p,tokens[n])));
 await until(()=>started.length===2);assert.equal(service.activeJobs.size,2);
 assert.equal(service.view(service.jobs.get(inputs[2].id)).queuePosition,1);
 assert.equal(service.view(service.jobs.get(inputs[4].id)).queuePosition,3);
 assert.throws(()=>service.get(inputs[0].id,tokens[1]),/无权/);
 await service.create(inputs[0],tokens[0]);assert.equal(started.length,2);
 await service.remove(inputs[3].id,tokens[3]);
 gates.one();await until(()=>gates.five);
 assert.deepEqual(started,['one','two','waiting','five']);
 assert.equal(service.jobs.get(inputs[2].id).state,'WAITING_RECOVERY');
 assert.equal(service.activeJobs.size,2,'waiting job releases its slot');
 gates.two();gates.five();await until(()=>!service.running);
 assert.equal(service.jobs.get(inputs[4].id).state,'READY');
 // Resume does not block unrelated jobs or duplicate the uncertain paid request.
 const calls=started.length;await service.resume(inputs[2].id,tokens[2]);await until(()=>!service.running);assert.equal(started.length,calls);
 // Pending queue survives restart, retains FIFO order and concurrency limit.
 service.closed=true;await service.create({id:randomUUID(),image,setting:'restart-a',consent:true},tokens[0]);await service.create({id:randomUUID(),image,setting:'restart-b',consent:true},tokens[1]);
 const old=service;service=new JobService({dir,key:'fixture',concurrency:1,fetchImpl:old.fetchImpl});await service.init();await until(()=>gates['restart-a']);assert.equal(gates['restart-b'],undefined);gates['restart-a']();await until(()=>gates['restart-b']);gates['restart-b']();await until(()=>!service.running);
 assert.throws(()=>new JobService({dir,concurrency:0}),/STORY_CONCURRENCY/);
 console.log('PASS: concurrent users, FIFO queue positions, capacity, cancellation, recovery slot release, isolation, idempotency, durable queue restart.');
}finally{if(service)service.closed=true;await rm(dir,{recursive:true,force:true})}
