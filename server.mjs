import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {JobService} from './backend/jobs.mjs';
for(const file of ['.env','.env.local'])if(existsSync(file))process.loadEnvFile(file);
const root=resolve('.'),port=Number(process.env.PORT||5173);
const base=process.env.POIXE_BASE_URL||'https://api-eu-central-1-dc8.poixe.com';
if(!['https://api.poixe.com','https://api-eu-central-1-dc8.poixe.com','https://api-eu-central-1-dc15.poixe.com'].includes(base))throw new Error('Unsupported POIXE_BASE_URL');
const jobs=new JobService({dir:resolve(process.env.STORY_DATA_DIR||'.local-data/jobs'),key:process.env.POIXE_API_KEY,base,concurrency:Number(process.env.STORY_CONCURRENCY||2)});await jobs.init();
const sweep=setInterval(async()=>{for(const j of jobs.jobs.values()){if(['QUEUED','GENERATING','WAITING_RECOVERY'].includes(j.state)&&Date.now()>j.deadline){j.state='FAILED';j.stage='已超过 30 分钟截止';j.error='生成已停止，原画仍保留。';delete j.pending;delete j.pendingPage1;delete j.pendingPage2;await jobs.persist(j);}}},30000);sweep.unref();
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function body(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>9*1024*1024)throw Object.assign(new Error('请求过大'),{status:413});chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString());}
http.createServer(async(req,res)=>{try{
 if(![`localhost:${port}`,`127.0.0.1:${port}`].includes(req.headers.host)){res.writeHead(403);return res.end();}
 const path=new URL(req.url,'http://localhost').pathname;
 if(path.startsWith('/api/')){
  if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return send(res,403,{error:'来源不受支持'});
  if(req.method!=='GET'&&req.headers['content-type']!=='application/json')return send(res,415,{error:'需要 JSON 请求'});
  if(path==='/api/config'&&req.method==='GET'){if(!jobs.key&&existsSync('.env.local')){process.loadEnvFile('.env.local');jobs.key=process.env.POIXE_API_KEY;jobs.pump();}return send(res,200,{configured:Boolean(jobs.key),imageModel:jobs.imageModel,textModel:jobs.textModel,technicalTest:true});}
  const token=req.headers['x-client-token'];jobs.owner(token);
  if(path==='/api/jobs'&&req.method==='POST')return send(res,202,await jobs.create(await body(req),token));
  const match=path.match(/^\/api\/jobs\/([a-f0-9-]{36})(?:\/(recover|cancel))?$/);
  if(match){const [,id,op]=match;if(req.method==='GET'&&!op)return send(res,200,jobs.view(jobs.get(id,token)));if(req.method==='DELETE'&&!op)return send(res,200,await jobs.remove(id,token));if(req.method==='POST'&&op==='recover')return send(res,202,await jobs.resume(id,token));if(req.method==='POST'&&op==='cancel')return send(res,200,await jobs.remove(id,token,'CANCELLED'));}
  return send(res,404,{error:'接口不存在'});
 }
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
 // Explicit public-file allowlist: credentials, source modules and job files are never served.
 const file=path==='/'?'index.html':path.slice(1);
 if(!['index.html','app.js','style.css'].includes(file)&&!/^assets\/[a-zA-Z0-9_-]+\.svg$/.test(file)){res.writeHead(404);return res.end('Not found');}
 const data=await readFile(resolve(root,file));res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
 }catch(error){send(res,error.status||500,{error:error.status?error.message:'操作未完成，请重试；已提交的任务请先找回。'});}
}).listen(port,'127.0.0.1',()=>console.log(`画活了 → http://localhost:${port} · Poixe ${jobs.key?'已配置':'未配置'}`));
