import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('painel exige verificar sessão e autenticação antes de expor ações',()=>{
 assert.ok(html.includes('<main id="admin-main" hidden>'));
 assert.ok(html.includes('<form id="auth-form" hidden>'));
 assert.ok(script.endsWith('validateSession();\n'));
 assert.ok(!script.endsWith('load();\n'));
 assert.ok(script.includes("credentials:'same-origin'"));
});

test('painel contém JavaScript válido',()=>{
 assert.ok(script);
 assert.doesNotThrow(()=>new Function(script));
});

test('sessão 401 exige login e reexecuta somente a prévia de importação',async()=>{
 const elements=new Map();
 const get=id=>{
  if(!elements.has(id))elements.set(id,{
   hidden:id==='admin-main'||id==='auth-form',style:{},value:'',textContent:'',disabled:false,checked:false,
   focus(){},append(){},replaceChildren(){},setAttribute(){},
  });
  return elements.get(id);
 };
 get('limit').value='50';get('auth-username').value='kristopher';get('auth-password').value='testpass';
 let loggedIn=false,previews=0,applications=0;
 const fetch=async(url,options={})=>{
  if(url==='/api/me')return {status:loggedIn?200:401,ok:loggedIn,async json(){return loggedIn?{user:{role:'main_admin'}}:{error:'Autenticação necessária'}}};
  if(url==='/api/login'){
   loggedIn=true;
   return {status:200,ok:true,async json(){return {user:{role:'main_admin'}}}};
  }
  if(url==='/api/admin')return {status:loggedIn?200:401,ok:loggedIn,async json(){return loggedIn?{users:[],logs:[],pending:[]}:{error:'Autenticação necessária'}}};
  if(url==='/api/sheet-sync'){
   if(!loggedIn)return {status:401,ok:false,async json(){return {error:'Autenticação necessária'}}};
   const body=JSON.parse(options.body);
   if(body.mode==='apply')applications++;else previews++;
   return {status:200,ok:true,async json(){return {version:0,snapshot:body.snapshot,summary:{sourceStudents:16,newStudents:16,updatedStudents:0,conflicts:0,sheetNet:6075,sheetOutstanding:2700,existingBankTransactionsPreserved:0},conflicts:[],changed:16}}};
  }
  throw new Error('Unexpected '+url);
 };
 const document={getElementById:get,createElement:(tag)=>({...get('__'+tag),className:'',append(){}})};
 runInNewContext(script,{document,fetch,location:{href:'/'},confirm:()=>true,alert:()=>{},console});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(get('admin-main').hidden,true);
 assert.equal(get('auth-form').hidden,false);
 await get('auth-form').onsubmit({preventDefault(){}});
 assert.equal(get('admin-main').hidden,false);
 assert.equal(get('auth-screen').hidden,true);
 const file={size:200,async text(){return JSON.stringify({students:[{id:'abc'}]})}};
 await get('sheet-file').onchange({currentTarget:{files:[file]}});
 assert.equal(previews,1);
 assert.equal(applications,0);
 loggedIn=false;
 await get('sheet-file').onchange({currentTarget:{files:[file]}});
 assert.equal(get('auth-screen').hidden,false);
 assert.equal(get('admin-main').hidden,true);
 await get('auth-form').onsubmit({preventDefault(){}});
 assert.equal(previews,2);
 assert.equal(applications,0);
 assert.equal(get('admin-main').hidden,false);
 assert.equal(get('sheet-apply').hidden,false);
});
