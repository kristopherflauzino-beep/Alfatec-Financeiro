import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {visaoPagantesPlanilha} from '../lib/visao-pagantes-planilha.js';
import {mergeBankImport} from '../lib/payer-import.js';
const input=()=>({months:[{id:'2026-05',label:'Maio'},{id:'2026-06',label:'Junho'}],students:[
 {id:'a',name:'Henrique',className:'6º ao 9º',payments:{'2026-05':135,'2026-06':135}},
 {id:'b',name:'Outro aluno',className:'1º ao 5º',payments:{'2026-05':135,'2026-06':-135}},
 {id:'c',name:'Sem pagante',className:'1º ao 5º',payments:{'2026-05':0,'2026-06':-135}}
],payers:[
 {id:'p1',name:'Paula',studentIds:['a'],suggestions:[]},
 {id:'p2',name:'Paula alias',studentIds:[],suggestions:['a']},
 {id:'p3',name:'Outro possível',studentIds:[],suggestions:['b']},
 {id:'p4',name:'Sem vínculo',studentIds:[],suggestions:[]}
],payTransactions:[{id:'PIX01',amount:7560,status:'recebido'}]});
test('o valor espelhado vem da planilha, jamais da soma do Pix',()=>{
 const r=visaoPagantesPlanilha(input());assert.equal(r.totalCents,13500);
 assert.equal(r.rows.reduce((n,s)=>n+s.payerReferenceCents,0),r.totalCents);
 assert.deepEqual(r.rows.map(s=>s.totalCents),[27000,0,-13500]);
 assert.equal(r.rows.length,3);
});
test('Paula vinculada a Henrique, sem duplicar duas associações ao mesmo aluno',()=>{
 const r=visaoPagantesPlanilha(input());assert.deepEqual(r.rows[0].payerNames,['Paula']);assert.equal(r.rows[0].status,'confirmado');
 assert.equal(r.rows[1].status,'sugerido');assert.equal(r.rows[2].status,'sem_pagante');
});
test('pagante com dois alunos não duplica o valor total da planilha',()=>{
 const a=input();a.payers[0].studentIds.push('b');const r=visaoPagantesPlanilha(a);
 assert.equal(r.rows.filter(x=>x.payerIds.includes('p1')).length,2);assert.equal(r.totalCents,13500);
});
test('transferências próprias nunca tornam-se pagantes sugeridos',()=>{
 const a=input();a.payers.push({id:'p5',name:'Kristopher Flauzino da Cunha',studentIds:['c'],suggestions:[]});
 assert.equal(visaoPagantesPlanilha(a).rows[2].status,'sem_pagante');
});
test('vínculos pendentes não são convertidos em quitação ou competência',()=>{
 const a=input();const before=JSON.stringify(a);const r=visaoPagantesPlanilha(a);
 assert.equal(JSON.stringify(a),before);assert.ok(r.rows.some(s=>s.status==='sugerido'));
 assert.equal(r.rows.some(s=>Object.hasOwn(s,'paidByPix')),false);
});
test('script inserido no HTML é válido e não renderiza totais brutos na visão v10',()=>{
 const html=readFileSync(new URL('../private/dashboard.html',import.meta.url),'utf8');
 assert.match(html,/ALFATEC_PAGANTES_PLANILHA_V10/);
 assert.match(html,/renderPayers=function\(\)/);
 assert.match(html,/renderLinks=function\(\)/);
 assert.match(html,/payerReportHTML=function\(/);
 assert.match(html,/bankExportCSV=function\(/);
 assert.match(html,/VALOR DOS ALUNOS · PLANILHA/);
 for(const s of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(s[1]);
});

test('JSON apenas de vínculos importa pagantes e sugestões sem incluir ou duplicar Pix',()=>{
 const data=input();const state={...data,payers:[{id:'p1',name:'Paula',studentIds:['a'],suggestions:[],notes:''}],payTransactions:[{id:'pix-existente',date:'2026-06-12',amount:135,groupId:'p1',rawName:'Paula',status:'recebido',allocations:[{studentId:'a',competence:'2026-05',amount:135}]}]};
 const snapshot=structuredClone(state.payTransactions);
 const file={payers:[{id:'p1',name:'Paula',studentIds:['a'],suggestions:[]},{id:'p2',name:'Novo pagante',studentIds:[],suggestions:['b']}],payTransactions:[]};
 const first=mergeBankImport(state,file);
 assert.equal(first.summary.newTransactions,0);assert.equal(first.summary.updatedPayerLinks,0);
 assert.equal(first.summary.newPayers,1);assert.equal(first.summary.updatedSuggestions,1);
 assert.deepEqual(first.state.payTransactions,snapshot);
 assert.ok(first.state.payers.some(p=>p.name==='Novo pagante'&&p.suggestions.includes('b')));
 const second=mergeBankImport(first.state,file);
 assert.equal(second.summary.newPayers,0);assert.equal(second.summary.updatedSuggestions,0);
 assert.equal(second.state.payTransactions.length,1);
});
