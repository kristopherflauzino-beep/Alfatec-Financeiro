import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const dashboard=new URL('../private/dashboard.html',import.meta.url);
const source=new URL('../tools/painel-pagantes-planilha-v10.js',import.meta.url);
const html=readFileSync(dashboard,'utf8');
const js=readFileSync(source,'utf8');
function runConfirmation({admin=true,approved=true}={}){
 const s=js.indexOf('async function confirmarVinculosV11(){');
 const e=js.indexOf('function renderSheetV10(tabName){',s);
 assert.ok(s>=0&&e>s);
 const func=js.slice(s,e);
 const sandbox={
  SERVER:{user:{role:admin?'main_admin':'viewer'}},
  db:{students:[{id:'a'},{id:'b'}],payers:[
   {id:'p1',name:'Paula',studentIds:['a'],suggestions:[]},
   {id:'p2',name:'Outro',studentIds:[],suggestions:['a','b']},
   {id:'p3',name:'Pagante sem aluno',studentIds:[],suggestions:[]}],
   payTransactions:[{id:'PIX-123',amount:135,status:'recebido'}]},
  saveChain:Promise.resolve(),syncBlocked:false,window:{confirm:()=>approved},
  toast:()=>{},render:()=>{},save:()=>{sandbox.snap=structuredClone(sandbox.db);return true},
  Set,Promise,
 };
 const fn=vm.runInNewContext(func+'\nconfirmarVinculosV11',sandbox);
 return {sandbox,call:()=>fn()};
}
test('a lista de pagantes sem aluno não é exibida',()=>{
 assert.match(html,/ALFATEC_VINCULOS_CONFIRMADOS_V11/);
 assert.doesNotMatch(html,/Pagantes ainda sem aluno relacionado/);
 assert.doesNotMatch(js,/Pagantes ainda sem aluno relacionado/);
 assert.match(html,/v11-confirm-links/);
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
 new vm.Script(js);
});
test('confirma todas associações sugeridas sem adicionar ou editar operações Pix',async()=>{
 const {sandbox,call}=runConfirmation();
 const old=JSON.stringify(sandbox.db.payTransactions);
 await call();
 assert.equal(JSON.stringify(sandbox.db.payTransactions),old);
 assert.equal(sandbox.db.payers[1].studentIds.join(','),'a,b');
 assert.deepEqual(sandbox.db.payers[1].suggestions,[]);
 assert.equal(sandbox.db.payers[2].studentIds.length,0);
 assert.ok(sandbox.snap);
});
test('sem aprovação explícita, não altera associações',async()=>{
 const {sandbox,call}=runConfirmation({approved:false});
 await call();
 assert.equal(sandbox.db.payers[1].studentIds.length,0);
 assert.equal(sandbox.snap,undefined);
});
test('perfil leitor não pode confirmar',async()=>{
 const {sandbox,call}=runConfirmation({admin:false});
 await call();
 assert.equal(sandbox.db.payers[1].studentIds.length,0);
 assert.equal(sandbox.snap,undefined);
});
