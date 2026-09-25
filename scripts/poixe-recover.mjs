// Read-only recovery of the most recent interrupted smoke test. Never generates.
import {existsSync} from 'node:fs';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {imageRequest} from './poixe-image-request.mjs';
for(const file of ['.env','.env.local'])if(existsSync(file)&&!process.env.POIXE_API_KEY)process.loadEnvFile(file);
const key=process.env.POIXE_API_KEY?.trim();
if(!key){console.error('POIXE_API_KEY unavailable in this terminal.');process.exit(2)}
const redact=s=>String(s??'').replaceAll(key,'[redacted]').replace(/sk-[A-Za-z0-9_-]+/g,'[redacted]').slice(0,2000);
let output;
async function request(path,body){
 const response=await fetch(`https://api.poixe.com/v1/recoveries${path}`,{method:body?'POST':'GET',headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000),redirect:'error'});
 const raw=await response.text();let json;try{json=JSON.parse(raw)}catch{throw new Error(`Recovery HTTP ${response.status}: non-JSON response`)}
 if(!response.ok)throw new Error(`Recovery HTTP ${response.status}: ${redact(json.error?.message||json.message||json.error)}`);
 return json;
}
try{
 const reports=[];
 for(const entry of await readdir(tmpdir()))if(entry.startsWith('huahuole-poixe-')){
  const path=join(tmpdir(),entry,'report.json');
  try{const data=JSON.parse(await readFile(path,'utf8'));if(data.error?.startsWith('Network error or timeout')&&data.imageModel)reports.push({path,data})}catch{}
 }
 reports.sort((a,b)=>Date.parse(b.data.createdAt)-Date.parse(a.data.createdAt));
 const target=reports[0];if(!target)throw new Error('No interrupted image test report found.');
 output=dirname(target.path);
 const requestPath=join(output,'image-request.json');
 const body=existsSync(requestPath)?JSON.parse(await readFile(requestPath,'utf8')):imageRequest(target.data.imageModel);
 console.log(JSON.stringify({action:'lookup-only',model:target.data.imageModel,originalReport:target.path}));
 const lookup=await request('/lookup',body);
 if(!Array.isArray(lookup.items))throw new Error('Unexpected recovery lookup response; no new generation submitted.');
 const started=Date.parse(target.data.createdAt)/1000;
 const matches=lookup.items.filter(i=>Number(i.created_at)>=started-60&&Number(i.created_at)<=started+1800);
 const summary={checkedAt:new Date().toISOString(),originalReport:target.path,candidates:matches.map(i=>({requestId:i.request_id,createdAt:i.created_at})),recovered:false};
 if(matches.length!==1){summary.message=matches.length?'Multiple matching requests; use provider logs to identify the original request.':'No matching temporary response yet. This does not prove no charge or no generation. Check provider logs.';}
 else{
  const result=await request('/'+encodeURIComponent(matches[0].request_id));
  const recoveredRequest=JSON.parse(result.request?.body_raw||'null');
  const canonical=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  if(JSON.stringify(canonical(recoveredRequest))!==JSON.stringify(canonical(body)))throw new Error('Recovered request does not match this smoke test.');
  const response=JSON.parse(result.response?.body_raw||'null');
  const image=response?.candidates?.[0]?.content?.parts?.find(p=>p.inlineData?.data&&/^image\/(png|jpeg|webp)$/.test(p.inlineData.mimeType))?.inlineData;
  if(image){const bytes=Buffer.from(image.data,'base64');if(!bytes.length)throw new Error('Recovered image was empty');summary.image=join(output,'recovered.'+image.mimeType.split('/')[1]);await writeFile(summary.image,bytes,{mode:0o600});summary.recovered=true;summary.usage=response.usageMetadata;}
  else summary.message='Temporary response found, but contains no usable image.';
 }
 await writeFile(join(output,'recovery-report.json'),JSON.stringify(summary,null,2),{mode:0o600});
 console.log(JSON.stringify(summary));
}catch(e){const message=redact(e.message);console.error(message);if(output)await writeFile(join(output,'recovery-error.json'),JSON.stringify({checkedAt:new Date().toISOString(),error:message}),{mode:0o600});process.exitCode=1}
