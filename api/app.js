import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {requireUser,noStore,withError} from '../lib/auth.js';
import {getDocument} from '../lib/db.js';
const path=resolve(dirname(fileURLToPath(import.meta.url)),'../private/dashboard.html');
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).end();
 try{
  const user=await requireUser(req,res);if(!user)return;
  const doc=await getDocument();
  const raw=JSON.stringify({user,state:doc.state,version:doc.version}).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  const src=await readFile(path,'utf8');
  if(!src.includes('<script>'))throw Error('Template inválido');
  const html=src.replace('<script>',`<script>window.__ALFATEC_SERVER__=${raw};</script><script>`);
  noStore(res);
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  res.status(200).end(html);
 }catch(err){withError(res,err)}
}
