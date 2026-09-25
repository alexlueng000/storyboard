import {JobService} from '../backend/jobs.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const token='a'.repeat(64),image='data:image/png;base64,'+Buffer.alloc(40,1).toString('base64');
const plan={characters:'蓝色小狗，红围巾',pages:[1,2,3].map(n=>({text:'小狗安静地坐在池塘边，陪月亮一起看星星。',prompt:'Blue dog beside pond '+n}))};
const png={candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:Buffer.alloc(40,2).toString('base64')}}]}}]};
const pause=()=>new Promise(r=>setTimeout(r,10));
async function until(fn){for(let n=0;n<300;n++){if(fn())return;await pause()}throw new Error('state wait timed out')}
const dirs=[];
const dir=async()=>{const d=await mkdtemp(join(tmpdir(),'story-jobs-test-'));dirs.push(d);return d};
function payload(){return {id:randomUUID(),image,setting:'蓝色小狗找月亮',words:'我的月亮',consent:true}}
try{
 let requests=[];
 const normal=async(url,opts)=>{requests.push({url,body:JSON.parse(opts.body)});return Response.json(url.includes('chat/completions')?{choices:[{message:{content:JSON.stringify(JSON.parse(opts.body).messages[0].content.includes("检查员")?{passed:true,issues:[]}:plan)}}]}:png)};
 const service=new JobService({dir:await dir(),key:'fixture',fetchImpl:normal});await service.init();const input=payload();await service.create(input,token);await service.create(input,token);await until(()=>service.jobs.get(input.id).state==='READY');assert.equal(requests.length,4);assert.equal(service.get(input.id,token).pages.length,3);assert.throws(()=>service.get(input.id,'b'.repeat(64)),/无权/);for(const request of requests.filter(r=>r.url.includes('generateContent')))assert.equal(request.body.contents[0].parts[1].inlineData.data,image.split(',')[1]);
 let pendingBody;let generated=0;let recoverable=false;
 const interrupted=async(url,opts)=>{if(url.includes('/lookup'))return Response.json({items:recoverable?[{request_id:'recovery',created_at:Math.floor(Date.now()/1000)}]:[]});if(url.includes('/recoveries/recovery'))return Response.json({request:{body_raw:JSON.stringify(pendingBody)},response:{body_raw:JSON.stringify(png)}});if(url.includes('/chat/'))return Response.json({choices:[{message:{content:JSON.stringify(JSON.parse(opts.body).messages[0].content.includes('检查员')?{passed:true,issues:[]}:plan)}}]});generated++;if(generated===1){pendingBody=JSON.parse(opts.body);throw new TypeError('fetch failed')}return Response.json(png)};
 const recoveryDir=await dir();const a=new JobService({dir:recoveryDir,key:'fixture',fetchImpl:interrupted});await a.init();const second=payload();await a.create(second,token);await until(()=>a.jobs.get(second.id).state==='WAITING_RECOVERY');assert.equal(generated,1);await until(()=>!a.running);a.closed=true;recoverable=true;
 const b=new JobService({dir:recoveryDir,key:'fixture',fetchImpl:interrupted});await b.init();await b.resume(second.id,token);await until(()=>b.jobs.get(second.id).state==='READY');assert.equal(generated,3,'recovery must not resubmit the lost page');assert.equal(b.jobs.get(second.id).pages.length,3);
 let release;const blocked=async()=>new Promise(r=>release=r);const c=new JobService({dir:await dir(),key:'fixture',fetchImpl:blocked});await c.init();const third=payload();await c.create(third,token);await until(()=>Boolean(release));await c.remove(third.id,token);release(Response.json({choices:[{message:{content:JSON.stringify(plan)}}]}));await until(()=>!c.running);assert.equal(c.jobs.get(third.id).state,'DELETED');assert.equal(c.jobs.get(third.id).input,undefined);assert.throws(()=>c.get(third.id,token));
 // Complete stories blocked by the old review are restored without any provider call.
 const finished=service.jobs.get(input.id);finished.artDirection='clean-story-scenes-v2';finished.state='FAILED';finished.error='本次画面未通过质量检查（角色、场景或动作不一致）';finished.qualityReview={passed:false,issues:['重复角色']};await service.persist(finished);
 const restored=new JobService({dir:service.dir,key:'fixture',fetchImpl:()=>{throw new Error('must not call provider')}});await restored.init();assert.equal(restored.jobs.get(input.id).state,'READY');assert.equal(restored.view(restored.jobs.get(input.id)).pages.length,3);
 const {continuationPrompt}=await import('../backend/art-direction.mjs');const prompt=continuationPrompt({...finished,artDirection:'pastel-picturebook-v3'},0);assert.match(prompt,/colored-pencil/);assert.match(prompt,/watercolor/);assert.match(prompt,/exactly ONCE/);
 console.log('PASS: 4-call pipeline, reference-image inputs, duplicate submission, owner isolation, durable recovery without rebilling, deletion during request. Mock provider only.');
}finally{for(const d of dirs)await rm(d,{recursive:true,force:true})}
