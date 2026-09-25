import {imageRequest} from './poixe-image-request.mjs';
// One text request followed by one image request; --image-only skips text. No automatic retries.
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
for(const file of ['.env','.env.local']) {
  if(existsSync(file)&&!process.env.POIXE_API_KEY) process.loadEnvFile(file);
}
const key=process.env.POIXE_API_KEY?.trim();
if(!key){console.error('POIXE_API_KEY is not available. Configure it in the process environment or project .env.local; do not paste it into chat.');process.exit(2)}
const output=join(tmpdir(),`huahuole-poixe-${Date.now()}`);
await mkdir(output,{recursive:true,mode:0o700});
const imageOnly=process.argv.includes('--image-only');
const modelArg=process.argv.find(arg=>arg.startsWith('--model='));
const imageModel=modelArg?.slice('--model='.length)||'gemini-3.1-flash-image-preview';
const imageBody=imageRequest(imageModel);
const report={createdAt:new Date().toISOString(),mode:imageOnly?'image-only':'text-and-image',imageModel,calls:[]};
const redact=value=>String(value??'').replaceAll(key,'[redacted]').replace(/Bearer\s+[^\s"']+/gi,'Bearer [redacted]').replace(/sk-[A-Za-z0-9_-]+/g,'[redacted]').slice(0,3000);
async function call(path,headers,body,label){
 const start=Date.now();
 const info={label,startedAt:new Date(start).toISOString(),status:null};
 report.calls.push(info);
 await writeFile(join(output,`${label}-request.json`),JSON.stringify(body),{mode:0o600});
 try{
  const response=await fetch(`https://api.poixe.com${path}`,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body),signal:AbortSignal.timeout(180000),redirect:'error'});
  Object.assign(info,{status:response.status,elapsedMs:Date.now()-start,requestId:response.headers.get('x-request-id')||response.headers.get('request-id')});
  const raw=await response.text();
  let result;try{result=JSON.parse(raw)}catch{result=null}
  if(!response.ok||!result){
   const error=result?.error;
   info.error={
    code:redact(error?.code??result?.code),
    type:redact(error?.type??error?.status),
    message:redact(typeof error==='string'?error:error?.message??result?.message??(!result?raw:'No provider error message')),
   };
   console.log(JSON.stringify(info));
   throw new Error(`HTTP ${response.status}: ${info.error.message}; no automatic retry.`);
  }
  info.model=result.model||result.modelVersion;
  info.usage=result.usage||result.usageMetadata;
  info.responseId=result.id||result.responseId;
  console.log(JSON.stringify(info));return result;
 }catch(e){info.elapsedMs=Date.now()-start;info.networkError={name:redact(e.name),code:redact(e.cause?.code)};if(e.name==='TimeoutError'||e.message==='fetch failed')throw new Error('Network error or timeout. Outcome may be unknown; check provider recoveries before retrying.');throw e;}
}
try{
 if(!imageOnly){
 const text=await call('/v1/chat/completions',{'Authorization':`Bearer ${key}`},{model:'gpt-5.2',stream:false,max_completion_tokens:1024,messages:[{role:'user',content:'用中文写一句适合亲子共读的旁白：蓝色小狗在池塘边看月亮。不要超过40个汉字。'}]},'text');
 const narration=text.choices?.[0]?.message?.content;
 if(typeof narration!=='string'||!narration.trim())throw new Error('No usable text in the response.');
 await writeFile(join(output,'narration.txt'),narration,{mode:0o600});
 console.log('Text result saved.');
 }
 console.log(`Starting one image request: ${imageModel}.`);
 const result=await call(`/v1beta/models/${imageModel}:generateContent`,{'x-goog-api-key':key},imageBody,'image');
 const image=result.candidates?.[0]?.content?.parts?.find(p=>p.inlineData?.data&&/^image\/(png|jpeg|webp)$/.test(p.inlineData.mimeType))?.inlineData;
 if(!image)throw new Error('No image returned; inspect model availability or safety outcome.');
 const bytes=Buffer.from(image.data,'base64');
 if(!bytes.length)throw new Error('Image was empty.');
 const ext=image.mimeType.split('/')[1];
 report.imageFile=join(output,`puppy.${ext}`);report.imageBytes=bytes.length;
 await writeFile(report.imageFile,bytes,{mode:0o600});
 report.success=true;
}catch(error){report.success=false;report.error=error.message.replaceAll(key,'[redacted]');console.error(report.error);process.exitCode=1;}
await writeFile(join(output,'report.json'),JSON.stringify(report,null,2),{mode:0o600});
console.log(JSON.stringify({success:report.success,report:join(output,'report.json'),image:report.imageFile}));
