import './render-demo.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const port=Number(process.env.PORT||4173);
createServer(async(req,res)=>{
 const language=req.url==='/en'?'en':'zh';
 try {res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(await readFile(new URL(`../demo/${language}.html`,import.meta.url)));}
 catch {res.writeHead(500);res.end('Preview unavailable');}
}).listen(port,'127.0.0.1',()=>console.log(`Demo previews: http://127.0.0.1:${port}/zh and /en`));
