// ALFATEC_PAGANTES_PLANILHA_V10
// Camada de visualização: valores por aluno são lidos do estado da planilha.
// Nunca sinaliza um Pix como quitado pela mera equivalência de valores.
function valorSheetV10(cents){return fmt(cents/100)}
function statusSheetV10(r){
 if(r.status==='confirmado')return '<span class="status-pill ok">Confirmado</span>';
 if(r.status==='sugerido')return '<span class="status-pill warn">Sugerido — confirmar</span>';
 return '<span class="status-pill warn">Pagante não identificado</span>';
}
function recordsSheetV10(report,query='',pid=''){
 const q=norm(query);
 return report.rows.filter(r=>(!pid||r.payerIds.includes(pid))&&(!q||norm([r.name,r.className,...r.payerNames].join(' ')).includes(q)));
}
function monthlySheetV10(r){
 return '<details><summary>Ver mensalidades</summary><div class="v10-month-grid">'+r.months.map(m=>'<span>'+esc(m.label)+': <strong class="'+(m.amountCents<0?'money-bad':m.amountCents>0?'money-good':'muted')+'">'+(m.empty?'—':valorSheetV10(m.amountCents))+'</strong></span>').join('')+'</div></details>';
}
function tableSheetV10(rows,allowEdit=false){
 const body=rows.map(r=>{
  const payers=r.payerNames.length?r.payerNames.map(esc).join(' / '):'<span class="muted">Não identificado</span>';
  const actions=allowEdit&&r.payerIds.length&&SERVER.user.role!=='viewer'?'<button class="button secondary slim" data-v10-link="'+esc(r.payerIds[0])+'">Revisar vínculo</button>':'';
  return '<tr><td><strong>'+esc(r.name)+'</strong><div class="muted">'+esc(r.className)+'</div></td>'+
   '<td>'+payers+'</td><td>'+statusSheetV10(r)+'</td>'+
   '<td class="num">'+valorSheetV10(r.totalCents)+'</td>'+
   '<td class="num">'+valorSheetV10(r.payerReferenceCents)+'</td>'+
   '<td>'+monthlySheetV10(r)+' '+actions+'</td></tr>';
 }).join('');
 return '<div class="table-wrap"><table class="data-table bank-table v10-planilha-table"><thead><tr>'+
  '<th>Aluno</th><th>Pagante(s) relacionado(s)</th><th>Vínculo</th><th>Valor do aluno · planilha</th>'+
  '<th>Valor de referência do pagante · planilha</th><th>Mensalidades / vínculo</th></tr></thead><tbody>'+
  (body||'<tr><td colspan="6">Nenhum registro para este filtro.</td></tr>')+'</tbody></table></div>';
}
function resumoSheetV10(view){
 return '<div class="payer-kpis v10-kpis"><div class="payer-kpi"><small>VALOR DOS ALUNOS · PLANILHA</small><strong>'+valorSheetV10(view.totalCents)+'</strong></div>'+
  '<div class="payer-kpi"><small>REFERÊNCIA DOS PAGANTES · PLANILHA</small><strong>'+valorSheetV10(view.totalCents)+'</strong></div>'+
  '<div class="payer-kpi"><small>ALUNOS NA PLANILHA</small><strong>'+view.rows.length+'</strong></div>'+
  '<div class="payer-kpi"><small>VÍNCULOS CONFIRMADOS / SUGERIDOS</small><strong>'+view.confirmedCount+' / '+view.suggestedCount+'</strong></div></div>';
}
function avisoSheetV10(view){
 return '<div class="notice v10-notice"><b>Base de cálculo: planilha.</b> As duas colunas de valores usam a mesma referência de mensalidades de cada aluno, '+
 'inclusive saldos negativos. Isso não significa que houve recebimento Pix do mesmo valor. '+
 'Vínculos sugeridos exigem confirmação; '+view.missingCount+' aluno(s) ainda sem pagante identificado. '+
 'Os comprovantes originais permanecem preservados no banco, fora desta visão.</div>';
}
function wireSheetV10(){
 document.querySelectorAll('[data-v10-link]').forEach(b=>b.onclick=()=>openPayerLink(b.dataset.v10Link));
}
function renderSheetV10(tabName){
 const v=visaoPagantesPlanilha(db);
 const controls=`${SERVER.user.role==='main_admin'?'<button type="button" class="button secondary" id="bank-import">Importar/atualizar pagantes</button>':''}`+
  '<button type="button" class="button secondary" id="bank-csv">Exportar planilha de vínculos</button>'+
  '<button type="button" class="button primary" id="bank-report">Gerar relatório</button>';
 renderTop(tabName,'Alunos e pagantes vinculados · valores de referência exclusivos da planilha',controls);
 const search=tabName==='Pagantes'?payerSearch:linkSearch;
 const rows=recordsSheetV10(v,search);
 $('page').innerHTML=resumoSheetV10(v)+avisoSheetV10(v)+
 '<article class="panel bank-panel"><div class="panel-header"><div><h2>Relação aluno ↔ pagante</h2>'+ 
 '<p>Um aluno aparece uma única vez, mesmo quando existem dois ou mais pagantes associados.</p></div></div>'+
 '<div class="flex-field"><div style="flex:1"><label>Buscar aluno ou pagante</label>'+
 '<input id="v10-search" style="width:100%" placeholder="Pesquisar nome" value="'+esc(search)+'"></div>'+
 '<button class="button secondary" type="button" id="v10-clear">Limpar</button></div>'+
 tableSheetV10(rows,true)+'<p class="source-caption">Valores financeiros vêm dos lançamentos de mensalidade e não dos saldos das contas bancárias.</p></article>'+
 (v.orphanPayers.length?'<article class="panel bank-panel"><h3>Pagantes ainda sem aluno relacionado</h3>'+ 
 '<p class="muted">Sem valores apresentados até que seja identificado o aluno correto.</p>'+ 
 '<div class="v10-orphans">'+v.orphanPayers.map(p=>'<div class="v10-orphan"><span>'+esc(p.name)+'</span>'+ 
 (SERVER.user.role!=='viewer'?'<button type="button" class="button secondary slim" data-v10-link="'+esc(p.id)+'">Vincular aluno</button>':'')+'</div>').join('')+'</div></article>':'');
 $('bank-import')?.addEventListener('click',openBankImport);
 $('bank-csv').onclick=bankExportCSV;
 $('bank-report').onclick=()=>printReport('payers');
 $('v10-clear').onclick=()=>{if(tabName==='Pagantes')payerSearch='';else linkSearch='';renderSheetV10(tabName)};
 $('v10-search').oninput=e=>{const pos=e.target.selectionStart;if(tabName==='Pagantes')payerSearch=e.target.value;else linkSearch=e.target.value;renderSheetV10(tabName);const el=$('v10-search');el.focus();try{el.setSelectionRange(pos,pos)}catch{}};
 wireSheetV10();responsiveBankTables();
}
renderPayers=function(){renderSheetV10('Pagantes')};
renderLinks=function(){renderSheetV10('Vínculos')};
payerReportHTML=function(pid=''){
 const v=visaoPagantesPlanilha(db),rows=recordsSheetV10(v,'',pid);
 return '<div class="repmetrics"><div><small>VALOR DOS ALUNOS · PLANILHA</small><strong>'+valorSheetV10(rows.reduce((n,r)=>n+r.totalCents,0))+'</strong></div>'+ 
 '<div><small>REFERÊNCIA DOS PAGANTES · PLANILHA</small><strong>'+valorSheetV10(rows.reduce((n,r)=>n+r.payerReferenceCents,0))+'</strong></div>'+ 
 '<div><small>ALUNOS</small><strong>'+rows.length+'</strong></div></div>'+ 
 '<p class="repnote">Valor de referência derivado apenas das mensalidades na planilha; não é recibo bancário nem confirmação de competência.</p>'+ 
 reportTable(rows.map(r=>[r.name,r.className,r.payerNames.join(' / ')||'Não identificado',r.status==='confirmado'?'Confirmado':r.status==='sugerido'?'Sugerido':'Pendente',valorSheetV10(r.totalCents),valorSheetV10(r.payerReferenceCents)]),['Aluno','Turma','Pagante(s)','Vínculo','Planilha aluno','Referência pagante']);
};
payerPendingReportHTML=function(){
 const v=visaoPagantesPlanilha(db);return '<h3>Vínculos pendentes</h3>'+reportTable(v.rows.filter(r=>r.status!=='confirmado').map(r=>[r.name,r.payerNames.join(' / ')||'Não identificado',r.status==='sugerido'?'Sugestão':'Sem pagante',valorSheetV10(r.totalCents)]),['Aluno','Pagante relacionado','Situação','Valor da planilha']);
};
payerAuditHTML=function(){return payerReportHTML()+payerPendingReportHTML()};
bankExportCSV=function(){
 const r=visaoPagantesPlanilha(db),heads=['Aluno','Turma','Pagantes relacionados','Status do vínculo','Valor aluno - planilha R$','Valor referência pagante - planilha R$',...db.months.map(m=>m.label+' '+m.year)];
 const rows=r.rows.map(s=>[s.name,s.className,s.payerNames.join(' / '),s.status,(s.totalCents/100).toFixed(2),(s.payerReferenceCents/100).toFixed(2),...s.months.map(m=>m.empty?'':(m.amountCents/100).toFixed(2))]);
 download('AlfaTec_Vinculos_Valores_da_Planilha.csv','\ufeff'+[heads,...rows].map(cols=>cols.map(csvQuote).join(';')).join('\r\n'),'text/csv;charset=utf-8');
 toast('Referências da planilha exportadas.');
};
