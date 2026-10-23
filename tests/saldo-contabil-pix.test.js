import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {resumoContabilPix} from '../lib/resumo-contabil-pix.js';
const state=()=>({settings:{monthlyFee:135},months:[{id:'2026-05'},{id:'2026-06'}],students:[
{id:'a',payments:{'2026-05':135,'2026-06':-135}},{id:'b',payments:{'2026-05':135,'2026-06':135}}],payTransactions:[]});
const tx=(id,amount,extra={})=>({id,amount,status:'recebido',...extra});
test('saldo líquido da planilha não é a soma de Pix',()=>{const s=state();s.payTransactions=[tx('p1',270),tx('p2',135)];const r=resumoContabilPix(s);assert.equal(r.net,27000);assert.equal(r.positive,40500);assert.equal(r.negative,13500);assert.equal(r.pix,40500);assert.equal(r.differenceToNet,13500);assert.equal(r.proven,0)});
test('só Pix de entrada e múltiplo exato de 135',()=>{const s=state();s.payTransactions=[tx('a',135),tx('b',270),tx('c',150),tx('d',-135),tx('e',135,{status:'interno'}),tx('f',810)];const r=resumoContabilPix(s);assert.equal(r.eligibleCount,3);assert.equal(r.pix,121500)});
test('um Pix pode atender duas mensalidades se alocações são comprovadas',()=>{const s=state();s.payTransactions=[tx('a',270,{allocations:[{studentId:'a',competence:'2026-05',amount:135},{studentId:'b',competence:'2026-05',amount:135}]})];const r=resumoContabilPix(s);assert.equal(r.proven,27000);assert.equal(r.exactMonths,2);assert.equal(r.unassigned,0)});
test('rateios acima do valor não são confirmados',()=>{const s=state();s.payTransactions=[tx('a',135,{allocations:[{studentId:'a',competence:'2026-05',amount:270}]})];const r=resumoContabilPix(s);assert.equal(r.invalid.length,1);assert.equal(r.proven,0);assert.equal(r.unassigned,13500)});
test('Pix sem aluno ou competência permanece não atribuído',()=>{const s=state();s.payTransactions=[tx('a',135,{studentId:''})];const r=resumoContabilPix(s);assert.equal(r.unassignedIds.length,1);assert.equal(r.proven,0)});
test('interface contém painel de conciliação e script válido',()=>{
 const h=readFileSync(new URL('../private/dashboard.html',import.meta.url),'utf8');
 assert.match(h,/ALFATEC_SALDO_CONTABIL_PIX_V5/);assert.match(h,/painelSaldoContabilPix\(\)/);assert.match(h,/Diferença entre totais/);
 for(const m of h.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
});
