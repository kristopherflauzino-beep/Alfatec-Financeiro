import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {correlacaoDetalhada} from '../lib/conciliacao-detalhada.js';
function state(){return {settings:{monthlyFee:135},months:[{id:'2026-05'},{id:'2026-06'}],students:[
{id:'h',name:'Henrique',payments:{'2026-05':135,'2026-06':135}},
{id:'v',name:'Vitor',payments:{'2026-05':135,'2026-06':-135}},
{id:'p',name:'Pedro',payments:{'2026-05':135,'2026-06':null}}],
payers:[{id:'paula',name:'Paula',studentIds:['h'],suggestions:[]},{id:'ferreira',name:'Agência Valin',studentIds:[],suggestions:['v']}],payTransactions:[
{id:'tx01',date:'2026-06-08',amount:270,groupId:'paula',status:'recebido'},
{id:'tx02',date:'2026-06-22',amount:270,groupId:'ferreira',status:'recebido'},
{id:'tx02',date:'2026-06-22',amount:270,groupId:'ferreira',status:'recebido'},
{id:'tx03',date:'2026-06-26',amount:150,groupId:'ferreira',status:'revisar'}]}}
test('cada ID de Pix é contado uma vez; sem crédito fictício',()=>{const r=correlacaoDetalhada(state());assert.equal(r.totals.pix,54000);assert.equal(r.totals.count,2);assert.equal(r.totals.positive,54000);assert.equal(r.totals.open,13500);assert.equal(r.totals.net,40500);assert.equal(r.totals.differenceToNet,13500)});
test('Paula vinculada não significa competência automaticamente quitada',()=>{const r=correlacaoDetalhada(state());const c=r.components.find(c=>c.payers.some(p=>p.name==='Paula'));assert.equal(c.amount,27000);assert.equal(c.positive,27000);assert.equal(c.status,'VINCULO_CONFIRMADO_SEM_COMPETENCIA');assert.ok(!c.hasOwnProperty('allocations'))});
test('excesso de Pix em vínculo apenas sugerido é exposto',()=>{const r=correlacaoDetalhada(state());const c=r.components.find(c=>c.payers.some(p=>p.name==='Agência Valin'));assert.equal(c.difference,13500);assert.equal(c.status,'SUGERIDO')});
test('aluno sem pagante é identificado sem atribuir Pix arbitrário',()=>{const r=correlacaoDetalhada(state());const c=r.components.find(c=>c.students.some(s=>s.name==='Pedro'));assert.equal(c.status,'SEM_PAGANTE_IDENTIFICADO');assert.equal(c.positive,13500)});
test('IDs repetidos com dados divergentes são sinalizados',()=>{const s=state();s.payTransactions.push({...s.payTransactions[0],amount:135});const r=correlacaoDetalhada(s);assert.equal(r.errors.length,1);assert.equal(r.totals.count,2)});
test('painel v10/v11 apresenta vínculos pelos valores da planilha e scripts válidos',()=>{const s=fs.readFileSync(new URL('../private/dashboard.html',import.meta.url),'utf8');assert.match(s,/ALFATEC_PAGANTES_PLANILHA_V10/);assert.match(s,/ALFATEC_VINCULOS_CONFIRMADOS_V11/);assert.match(s,/renderSheetV10/);assert.match(s,/VALOR DOS ALUNOS/);assert.match(s,/REFERÊNCIA DOS PAGANTES/);const scripts=[...s.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];for(const m of scripts)new vm.Script(m[1])});
