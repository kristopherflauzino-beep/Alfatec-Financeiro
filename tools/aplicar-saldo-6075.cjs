'use strict';
const fs=require('node:fs');
const file='private/dashboard.html', marker='ALFATEC_SALDO_CONTABIL_PIX_V5';
let html=fs.readFileSync(file,'utf8');
if(html.includes(marker)){console.log('Conferência do saldo já aplicada.');process.exit(0)}
for(const a of ['</style>','function renderPayers(){','${bankBanner()}']){
 if(!html.includes(a))throw Error('Painel incompatível. Não foi modificado: '+a);
}
const css=`
/* ${marker} */
.pix-ledger{margin:16px 0;padding:19px;background:#10243a;border:1px solid #355473;border-radius:14px}
.pix-ledger h2{margin:0 0 5px;font-size:19px}
.pix-ledger .pix-ledger-sub{margin:0 0 14px;color:#a9bfd6;font-size:13px}
.pix-ledger-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:10px}
.pix-ledger-stats div{background:#0a1d31;border:1px solid #31516c;border-radius:10px;padding:13px;min-width:0}
.pix-ledger-stats small{font-size:12px;color:#b3ccdf;display:block;min-height:28px}
.pix-ledger-stats strong{display:block;margin-top:7px;font-size:21px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.pix-ledger-note{margin-top:13px;font-size:13px;line-height:1.55;color:#d1dfed}
.pix-ledger-warning{padding:12px;border-radius:9px;border:1px solid #7b6441;background:#362d1e;color:#ffdaaa}
@media(max-width:760px){.pix-ledger{padding:14px}.pix-ledger-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.pix-ledger-stats strong{font-size:17px}}
`;
html=html.replace('</style>',css+'</style>');
const pure=fs.readFileSync('lib/resumo-contabil-pix.js','utf8').replace('export function resumoContabilPix','function resumoContabilPix');
const ui=String.raw`
// ${marker}: valor líquido da planilha NÃO é total de recebimentos Pix.
function painelSaldoContabilPix(){
 const c=resumoContabilPix(db);
 const money=x=>fmt(x/100);
 const cells=[['Saldo líquido da planilha',c.net],['Pix recebidos elegíveis',c.pix],['Diferença entre totais',c.differenceToNet],['Mensalidades comprovadas',c.proven]];
 const figures=cells.map(([name,val])=>'<div><small>'+esc(name)+'</small><strong>'+money(val)+'</strong></div>').join('');
 const note=c.differenceToNet===0
 ?'Os totais matemáticos são iguais, mas isso NÃO comprova que cada Pix pertence à mesma competência e ao aluno correto.'
 :'Os totais não coincidem. Os Pix não serão excluídos, repartidos ou marcados como conciliados para forçar a igualdade.';
 return '<section class="pix-ledger" aria-label="Conferência de saldo e recebimentos"><h2>Conferência Pix × planilha</h2><p class="pix-ledger-sub">Saldo contábil e valor recebido são conceitos diferentes.</p><div class="pix-ledger-stats">'+figures+'</div><div class="pix-ledger-note">Mensalidades positivas: <b>'+money(c.positive)+'</b> · Valores negativos em aberto: <b>'+money(c.negative)+'</b> · Pix ainda não distribuídos integralmente: <b>'+money(c.unassigned)+'</b> ('+c.unassignedIds.length+' operações). Mensalidades com vínculo de valor exato: <b>'+c.exactMonths+'</b>.</div><p class="pix-ledger-note pix-ledger-warning">'+note+' Os extratos começam em junho/2026, enquanto a planilha inclui maio/2026. É necessário atribuir o ID Pix ao aluno e à competência para conciliar os lançamentos.'+(c.invalid.length?' Foram detectados '+c.invalid.length+' rateio(s) inválido(s).':'')+'</p></section>';
}
`;
html=html.replace('function renderPayers(){',pure+'\n'+ui+'\nfunction renderPayers(){');
html=html.replace('${bankBanner()}','${bankBanner()} ${painelSaldoContabilPix()}');
fs.writeFileSync(file,html,'utf8');
console.log('Painel de conferência Pix × saldo líquido instalado.');
