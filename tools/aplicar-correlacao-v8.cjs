'use strict';
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');const htmlPath=path.join(root,'private','dashboard.html');
const jsPath=path.join(root,'lib','conciliacao-detalhada.js');
if(!fs.existsSync(htmlPath)||!fs.existsSync(jsPath))throw Error('Execute dentro da raiz do AlfaTec Financeiro (private/dashboard.html e lib/conciliacao-detalhada.js ausentes).');
let html=fs.readFileSync(htmlPath,'utf8');const marker='ALFATEC_CORRELACAO_DETALHADA_V8';
if(html.includes(marker)){console.log('Conciliação v8 já aplicada; nenhuma duplicação.');process.exit(0)}
const start='function renderPayers(){';const target='${bankBanner()} ${painelSaldoContabilPix()} ${renderPixSheetMatch()}';
if(!html.includes(start)||!html.includes(target))throw Error('Versão do painel incompatível; nenhum arquivo modificado. Atualize o projeto sem forçar alterações.');
let js=fs.readFileSync(jsPath,'utf8').replace('export function correlacaoDetalhada(state)', 'function correlacaoDetalhada(state)');
const view=`
// ${marker}: cruza valores por grupo de pagantes/alunos. NÃO quita competências.
${js}
function painelCorrelacaoDetalhada(){
 const r=correlacaoDetalhada(db),money=x=>fmt(x/100),t=r.totals;
 const badges=[['Pagamentos positivos na planilha',t.positive],['Pix elegíveis nos extratos',t.pix],['Mensalidades em aberto (valor absoluto)',t.open],['Saldo líquido da planilha',t.net]];
 const status={SUGERIDO:'Sugestão: confirmar vínculo',SUGERIDO_RATEIO:'Sugestão: conferir rateio',VINCULO_CONFIRMADO_SEM_COMPETENCIA:'Pagante-aluno confirmado · meses pendentes',VINCULO_CONFIRMADO_SEM_COMPETENCIA_RATEIO:'Vínculo confirmado · conferir rateio',SEM_ALUNO_IDENTIFICADO:'Sem aluno identificado',SEM_PAGANTE_IDENTIFICADO:'Sem pagante identificado'};
 return '<article class="panel bank-panel" data-v8-correlacao="true"><div class="panel-header"><div><h2>Correlação Pix × alunos e mensalidades</h2><p>Comparação por pagante e aluno: valores iguais são apenas compatíveis, não prova de qual mês foi quitado. Vínculos sugeridos não são confirmados.</p></div></div>'+
 '<div class="payer-kpis">'+badges.map(([name,value])=>'<div class="payer-kpi"><small>'+esc(name)+'</small><strong>'+money(value)+'</strong></div>').join('')+'</div>'+
 '<p class="repnote"><b>Diferença de critérios:</b> Pix menos saldo líquido = <b>'+money(t.differenceToNet)+'</b>. Pix menos pagamentos positivos = <b>'+money(t.differenceToPositive)+'</b>. Não elimine operações para forçar R$ 6.075,00.</p>'+
 '<div class="table-wrap"><table class="data-table"><thead><tr><th>Pagante(s) do extrato</th><th>Aluno(s) da planilha</th><th>Pix</th><th>Pagos positivos</th><th>Em aberto</th><th>Diferença (Pix − positivos)</th><th>Correlação</th></tr></thead><tbody>'+
 r.components.map(c=>'<tr><td>'+ (c.payers.length?c.payers.map(p=>esc(p.name)).join(' / '):'—')+'</td><td>'+(c.students.length?c.students.map(s=>esc(s.name)).join(' / '):'—')+'</td><td>'+money(c.amount)+'</td><td>'+money(c.positive)+'</td><td>'+money(c.open)+'</td><td class="'+(c.difference?'money-bad':'money-good')+'">'+money(c.difference)+'</td><td>'+esc(status[c.status]||'Conferir')+'</td></tr>').join('')+
 '</tbody></table></div><p class="source-caption">Os totais cobrem os 39 Pix elegíveis, cada ID contabilizado uma vez; depósitos de meses diferentes não atribuem competência automaticamente. Valores negativos da planilha não são recebimentos negativos no banco.</p>'+
 (r.errors.length?'<p class="money-bad">Atenção: '+r.errors.length+' conflito(s) de ID/operação; revise antes de importar.</p>':'')+'</article>';
}
`;
html=html.replace(start,view+'\n'+start);
html=html.replace(target,target+' ${painelCorrelacaoDetalhada()}');
fs.writeFileSync(htmlPath,html,'utf8');console.log('Painel atualizado: correlação detalhada sem alteração do banco.');
