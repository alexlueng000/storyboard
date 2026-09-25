// Accept complete JSON normally. Salvage a truncated response only when all
// three captions and the complete cast survived; never use an unfinished string.
export function parseStoryPlan(result){
 const choice=result.choices?.[0];
 const raw=choice?.message?.content;
 if(typeof raw!=='string')throw new Error('故事内容未完整返回。');
 const cleaned=raw.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
 let plan;
 try{plan=JSON.parse(cleaned)}catch{
  if(choice.finish_reason!=='length')throw new Error('故事结构无法读取，原画仍保留。');
  const string='("(?:[^"\\\\]|\\\\.)*")';
  const cast=cleaned.match(new RegExp('"characters"\\s*:\\s*'+string));
  const captions=[...cleaned.matchAll(new RegExp('"text"\\s*:\\s*'+string,'g'))];
  if(!cast||captions.length!==3)throw new Error('故事返回被截断，尚未收到完整三页内容。');
  plan={characters:JSON.parse(cast[1]),pages:captions.map(c=>{const text=JSON.parse(c[1]);return {text,prompt:`Illustrate this page's main visible action: ${text}. Use the fixed cast description; each participating character appears once. Compose one clear scene with the relevant props and expressions. Do not include written text.`};})};
 }
 if(typeof plan.characters!=='string'||!plan.characters.trim()||!Array.isArray(plan.pages)||plan.pages.length!==3||plan.pages.some(p=>typeof p.text!=='string'||!p.text.trim()||p.text.length>200||typeof p.prompt!=='string'||!p.prompt.trim()||p.prompt.length>4000))throw new Error('故事缺页或文字格式无效，未继续生图。');
 return plan;
}
