import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {mergeBankImport} from '../lib/payer-import.js';
import {resumoContabilPix} from '../lib/resumo-contabil-pix.js';
const m=(id,amount,groupId,status='recebido')=>({id,date:'2026-07-28',amount,rawName:'Pagante Teste',groupId,source:'07.pdf',page:1,status});
const imported={payers:[{id:'alunos',name:'Responsável por aluno'},{id:'proprio',name:'Titular de teste'}],payTransactions:[m('900001',135,'alunos'),m('900002',270,'proprio','interno'),m('900003',34.28,'proprio','interno')]};
const blank=()=>({settings:{monthlyFee:135},months:[{id:'2026-07'}],students:[{id:'a',payments:{'2026-07':135}}],payers:[],payTransactions:[]});
test('não importa transferências internas nem cria o pagante sem outras operações',()=>{
 const a=mergeBankImport(blank(),imported);
 assert.equal(a.summary.newTransactions,1);assert.equal(a.summary.newPayers,1);
 assert.equal(a.summary.eligibleAmount,135);assert.equal(a.summary.eligibleCount,1);
 assert.equal(a.state.payTransactions.length,1);
 assert.equal(a.state.payers.length,1);
});
test('exclusão declarada em JSON remove transferências antigas e pagante órfão',()=>{
 const old=blank();old.payers=[{id:'alunos',name:'Responsável por aluno',studentIds:[]},{id:'proprio',name:'Titular de teste',studentIds:[]}];
 old.payTransactions=[m('900001',135,'alunos'),m('900002',270,'proprio','interno'),m('900003',34.28,'proprio','interno')];
 const req={...imported,payers:[imported.payers[0]],payTransactions:[imported.payTransactions[0]],excludedOperationIds:['900002','900003']};
 const got=mergeBankImport(old,req);
 assert.equal(got.summary.excludedExisting,2);assert.equal(got.state.payTransactions.length,1);
 assert.equal(got.state.payers.length,1);
 assert.equal(got.summary.eligibleAmount,135);assert.equal(got.conflicts.length,0);
 const repeat=mergeBankImport(got.state,req);assert.equal(repeat.summary.excludedExisting,0);assert.equal(repeat.summary.newTransactions,0);
});
test('não exclui transferência vinculada a uma mensalidade sem conferência',()=>{
 const old=blank();old.payers=[{id:'proprio',name:'Titular de teste',studentIds:[]}];const tx=m('900002',270,'proprio','interno');tx.allocations=[{studentId:'a',competence:'2026-07',amount:135}];old.payTransactions=[tx];
 const got=mergeBankImport(old,{payers:[],payTransactions:[],excludedOperationIds:['900002']});
 assert.equal(got.conflicts.length,1);assert.equal(got.state.payTransactions.length,1);
});
test('Pix e saldo não mudam por retirar transferências internas',()=>{
 const st=blank();st.payTransactions=[m('900001',135,'alunos'),m('900002',270,'proprio','interno'),m('900003',34.28,'proprio','interno')];
 const a=resumoContabilPix(st);assert.equal(a.pix,13500);assert.equal(a.eligibleCount,1);
 st.payTransactions=st.payTransactions.filter(t=>t.status!=='interno');const b=resumoContabilPix(st);
 assert.equal(b.pix,a.pix);assert.equal(b.net,a.net);
});
test('painel oculta transferências internas em extrato, CSV e relatórios',()=>{
 const h=readFileSync(new URL('../private/dashboard.html',import.meta.url),'utf8');
 assert.match(h,/ALFATEC_EXCLUSAO_TRANSFERENCIAS_V6/);
 assert.match(h,/function bankRows\(\)\{return \(db\.payTransactions\|\|\[\]\)\.filter/);
 assert.match(h,/const data=visibleBankPayers\(\)/);
 assert.match(h,/const list=pid\?visibleBankPayers\(\)/);
 for(const match of h.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
});
