import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,extname,sep,join} from 'node:path';
import {createCampaignMiddleware} from './campaignPersistence.ts';
const base=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const root=join(base,'dist');
const port=Number(process.env.COMPANION_PORT??5192);
const saveRoot=process.env.COMPANION_SAVE_DIR??join(base,'work','campaign-data');
const campaign=createCampaignMiddleware(saveRoot);
const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml','.jpeg':'image/jpeg','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 if(req.headers.host!==`127.0.0.1:${port}`&&req.headers.host!==`localhost:${port}`){res.writeHead(403);res.end();return;}
 res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
 res.setHeader('X-Content-Type-Options','nosniff');
 await campaign(req,res,()=>{void serve();});
 async function serve(){
  try{
   if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
   let pathname=decodeURIComponent(new URL(req.url??'/',`http://127.0.0.1:${port}`).pathname);
   if(pathname==='/')pathname='/index.html';
   const target=resolve(root,'.'+pathname);
   if(!target.startsWith(root+sep)){res.writeHead(403);res.end();return;}
   const info=await stat(target);if(!info.isFile()){res.writeHead(404);res.end();return;}
   const etag=`"${info.size}-${Math.floor(info.mtimeMs)}"`;
   res.setHeader('ETag',etag);
   res.setHeader('Cache-Control',pathname==='/index.html'||pathname.endsWith('/sw.js')?'no-cache':/\/assets\/.*-[\w-]+\.(js|css)$/.test(pathname)?'public, max-age=31536000, immutable':'public, max-age=86400');
   if(req.headers['if-none-match']===etag){res.writeHead(304);res.end();return;}
   res.setHeader('Content-Type',mime[extname(target)]??'application/octet-stream');res.setHeader('Content-Length',info.size);
   if(req.method==='HEAD'){res.end();return;}
   const stream=createReadStream(target);stream.on('error',()=>res.destroy());stream.pipe(res);
  }catch{res.writeHead(404);res.end('Not found');}
 }
});
server.on('error',error=>{console.error((error as NodeJS.ErrnoException).code==='EADDRINUSE'?`App already running or port occupied: http://127.0.0.1:${port}/`:error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Mindthief Companion: http://127.0.0.1:${port}/\nLocal only. Close this window to stop.`));
