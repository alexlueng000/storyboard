import {readFile,writeFile,rename,chmod} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const key=process.env.POIXE_API_KEY?.trim();
if(!key||/[\r\n]/.test(key)){console.error('请在已经 export POIXE_API_KEY 的终端执行此命令。');process.exit(2)}
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const file=resolve(root,'.env.local');let old='';try{old=await readFile(file,'utf8')}catch(e){if(e.code!=='ENOENT')throw e}
// Preserve other local configuration; never print the key.
const lines=old.split('\n').filter(line=>!/^\s*(?:export\s+)?POIXE_API_KEY\s*=/.test(line));
if(/["'`\\]/.test(key)){console.error('密钥包含不支持的字符，请核对配置。');process.exit(2)}
lines.push(`POIXE_API_KEY="${key}"`);
const temp=file+'.tmp';await writeFile(temp,lines.join('\n')+'\n',{mode:0o600});await chmod(temp,0o600);await rename(temp,file);await chmod(file,0o600);
console.log('已将环境变量保存到本项目 .env.local（仅当前用户可读，已忽略版本管理）。刷新网页即可启用真实 AI 测试。');
