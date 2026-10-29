import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import type {IncomingMessage,ServerResponse} from 'node:http';
import type {Plugin} from 'vite';
type Entry={value:string|null;updatedAt:number};
type Snapshot={version:1;entries:Record<string,Entry>};
const prefix='gloomhaven-deck-companion:v2:';
export function createCampaignMiddleware(root:string) {
 let queue:Promise<void>=Promise.resolve();
 const load=async():Promise<Snapshot>=>{try{const saved=JSON.parse(await readFile(join(root,'campaign-state.json'),'utf8'));if(saved.version!==1||!saved.entries)throw new Error('Invalid campaign save');return saved;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return{version:1,entries:{}};throw error;}};
 const respond=(res:ServerResponse,status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const middleware=async(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{
  if(req.url?.split('?')[0]!=='/api/campaign'){next();return;}
  if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host){respond(res,403,{error:'Origin mismatch'});return;}}catch{respond(res,403,{error:'Invalid origin'});return;}}
  try{
   if(req.method==='GET'){await queue;respond(res,200,await load());return;}
   if(req.method!=='PATCH'){respond(res,405,{error:'Use GET or PATCH'});return;}
   if(!req.headers['content-type']?.startsWith('application/json')){respond(res,415,{error:'JSON required'});return;}
   let body='';for await(const chunk of req){body+=chunk;if(body.length>5_000_000){respond(res,413,{error:'Save too large'});return;}}
   const input=JSON.parse(body);if(!input.entries||typeof input.entries!=='object'||Array.isArray(input.entries)){respond(res,400,{error:'Invalid save'});return;}
   const entries:Record<string,Entry>={};
   for(const [key,raw] of Object.entries(input.entries)){
    const e=raw as Entry;
    if(!key.startsWith(prefix)||!e||(e.value!==null&&typeof e.value!=='string')||!Number.isFinite(e.updatedAt)||e.updatedAt<0||e.updatedAt>Date.now()+60_000){respond(res,400,{error:'Invalid save entry'});return;}
    if(e.value!==null)JSON.parse(e.value);
    entries[key]={value:e.value,updatedAt:e.updatedAt};
   }
   let result:Snapshot={version:1,entries:{}};
   const operation=queue.then(async()=>{
    result=await load();for(const [key,entry] of Object.entries(entries))if(!result.entries[key]||entry.updatedAt>=result.entries[key].updatedAt)result.entries[key]=entry;
    await mkdir(root,{recursive:true});
    // Keep a complete previous save, then replace the current file atomically.
    try{await writeFile(join(root,'campaign-state.backup.json'),await readFile(join(root,'campaign-state.json')));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    await writeFile(join(root,'campaign-state.tmp'),JSON.stringify(result,null,2)+'\n');await rename(join(root,'campaign-state.tmp'),join(root,'campaign-state.json'));
   });
   queue=operation.catch(()=>{});await operation;respond(res,200,{version:1,entries:Object.fromEntries(Object.keys(entries).map(key=>[key,result.entries[key]]))});
  }catch(error){respond(res,500,{error:error instanceof Error?error.message:'Save failed'});}
 };
 return middleware;
}
export function campaignPersistence():Plugin {
 let middleware:ReturnType<typeof createCampaignMiddleware>;
 return {name:'local-campaign-persistence',configResolved(config){middleware=createCampaignMiddleware(join(config.root,'work','campaign-data'));},configureServer(server){server.middlewares.use(middleware);},configurePreviewServer(server){server.middlewares.use(middleware);}};
}
