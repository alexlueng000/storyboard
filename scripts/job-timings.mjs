// Prints timings only: never emits images, story text, tokens or credentials.
import {readdir,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const dir=resolve(process.env.STORY_DATA_DIR||'.local-data/jobs');
const jobs=[];
try{for(const file of await readdir(dir)){if(!file.endsWith('.json'))continue;const j=JSON.parse(await readFile(join(dir,file),'utf8'));jobs.push(j);}}catch(e){if(e.code==='ENOENT'){console.log('暂无任务记录');process.exit(0)}throw e}
for(const j of jobs.sort((a,b)=>b.createdAt-a.createdAt).slice(0,5)){
 console.log(JSON.stringify({id:j.id,state:j.state,parallelImages:Boolean(j.parallelImages),calls:(j.attempts||[]).map(a=>({stage:a.stage,status:a.status,seconds:Number.isFinite(a.elapsedMs)?Math.round(a.elapsedMs/1000):null}))}));
}
