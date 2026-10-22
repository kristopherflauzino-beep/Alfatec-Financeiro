import test from 'node:test';
import assert from 'node:assert/strict';
import {diffState,validateState} from '../lib/audit.js';
function db(){return {settings:{monthlyFee:135},students:[{id:'aluno-1',name:'Aluno Teste',className:'1º ao 5º',payments:{'2026-10':-135}}],months:[{id:'2026-10',label:'Outubro',year:2026}],payers:[],payTransactions:[]}}
test('registra qual mensalidade mudou',()=>{const before=db();const after=structuredClone(before);after.students[0].payments['2026-10']=135;const d=diffState(before,after);assert.equal(d.length,1);assert.match(d[0].campo,/students\[aluno-1\]\.payments\.2026-10/);assert.equal(d[0].anterior,-135);assert.equal(d[0].novo,135)});
test('um objeto idêntico não gera eventos',()=>assert.deepEqual(diffState(db(),structuredClone(db())),[]));
test('rejeita valores de mensalidade não numéricos',()=>{const data=db();data.students[0].payments['2026-10']='135';assert.throws(()=>validateState(data))});
test('aceita o estado válido',()=>assert.ok(validateState(db()).includes('Alun')));
