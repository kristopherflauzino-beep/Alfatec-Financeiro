import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mergeBankImport,validateBankImport} from '../lib/payer-import.js';
const imported={payers:[{id:'p-1',name:'Pagante Exemplo',studentIds:[],suggestions:[]},{id:'p-2',name:'Outro Pagante'}],payTransactions:[
 {id:'1001',date:'2026-06-03',amount:135,rawName:'Pagante Exemplo',groupId:'p-1',status:'recebido',source:'06.pdf',page:1},
 {id:'1002',date:'2026-06-08',amount:270,rawName:'Pagante Exemplo',groupId:'p-1',status:'recebido',source:'06.pdf',page:2},
 {id:'1003',date:'2026-07-21',amount:150,rawName:'Outro Pagante',groupId:'p-2',status:'revisar',source:'07.pdf',page:2},
]};
function blank(){return {schema:2,settings:{monthlyFee:135,repassePercent:50},months:[],students:[],payers:[],payTransactions:[],bankAllocations:[]}}
test('valida importação e calcula apenas Pix de R$ 135 ou múltiplos',()=>{
 const data=validateBankImport(imported);
 assert.equal(data.payTransactions.length,3);
 const merged=mergeBankImport(blank(),imported);
 assert.equal(merged.summary.newPayers,2);
 assert.equal(merged.summary.newTransactions,3);
 assert.equal(merged.summary.eligibleCount,2);
 assert.equal(merged.summary.eligibleAmount,405);
 assert.equal(merged.summary.sourceCount,2);
 assert.equal(merged.conflicts.length,0);
});
test('reimportação não duplica operações nem altera rateio ou vínculo',()=>{
 const first=mergeBankImport(blank(),imported);
 const t=first.state.payTransactions[0];
 t.allocations=[{studentId:'alf-001',competence:'2026-06',amount:135}];
 const p=first.state.payers[0];p.studentIds=['alf-001'];
 const second=mergeBankImport(first.state,imported);
 assert.equal(second.summary.newTransactions,0);
 assert.equal(second.summary.duplicates,3);
 assert.equal(second.summary.newPayers,0);
 assert.equal(second.state.payTransactions.length,3);
 assert.deepEqual(second.state.payTransactions[0].allocations,t.allocations);
 assert.deepEqual(second.state.payers[0].studentIds,p.studentIds);
});
test('operação de mesmo ID com valor divergente não substitui o valor original',()=>{
 const first=mergeBankImport(blank(),imported),altered=structuredClone(imported);
 altered.payTransactions[0].amount+=135;
 const updated=mergeBankImport(first.state,altered);
 assert.equal(updated.conflicts.length,1);
 assert.equal(updated.summary.newTransactions,0);
 assert.equal(updated.state.payTransactions[0].amount,135);
});
test('rejeita recibos com pagante inexistente e IDs duplicados',()=>{
 const invalid=structuredClone(imported);invalid.payTransactions[0].groupId='fake';
 assert.throws(()=>validateBankImport(invalid),/Operação inválida/);
 const bad=structuredClone(imported);bad.payTransactions[1].id=bad.payTransactions[0].id;
 assert.throws(()=>validateBankImport(bad),/Operação inválida/);
});
test('UI usa menu lateral e importação protegida sem incluir extratos privados',()=>{
 const html=readFileSync(new URL('../private/dashboard.html',import.meta.url),'utf8');
 assert.match(html,/ALFATEC_PAGANTES_MOBILE_V3/);
 assert.match(html,/\/api\/payers-import/);
 assert.match(html,/mobile-nav-toggle/);
 assert.match(html,/mobile-nav-backdrop/);
 assert.match(html,/bank-import/);
 assert.doesNotMatch(html,/58238765 Maria Luiza De Freitas/);
});
