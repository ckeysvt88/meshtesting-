import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const base='/meshtesting-/';
const mime={html:'text/html',js:'text/javascript',css:'text/css',webmanifest:'application/manifest+json',svg:'image/svg+xml',png:'image/png'};
createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 const file=path===base?'index.html':path.slice(base.length);
 if(!path.startsWith(base)||!/^[-\w.]+$/.test(file)||!mime[file.split('.').at(-1)]){res.writeHead(404).end();return;}
 try{res.writeHead(200,{'Content-Type':mime[file.split('.').at(-1)]}).end(await readFile(new URL('../'+file,import.meta.url)));}
 catch{if(!res.headersSent)res.writeHead(404);res.end();}
}).listen(4321,'127.0.0.1');
