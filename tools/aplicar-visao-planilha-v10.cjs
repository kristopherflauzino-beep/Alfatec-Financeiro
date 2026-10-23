const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const dest=path.join(root,'private','dashboard.html');
const importPath=path.join(root,'lib','payer-import.js');
if(!fs.existsSync(dest)||!fs.existsSync(importPath))throw Error('Arquivos do projeto ausentes. Abra a pasta correta.');
const original=fs.readFileSync(dest,'utf8');
const bankCode=fs.readFileSync(importPath,'utf8');
const MARK='ALFATEC_PAGANTES_PLANILHA_V10';
if(original.includes(MARK)){console.log('Versão v10 já instalada: sem duplicações.');process.exit(0);}
const anchor='\nrender();';
const required=['function renderPayers(', 'function renderLinks(', 'function payerReportHTML(', 'function bankExportCSV(', 'function openBankImport(', anchor];
for(const key of required)if(!original.includes(key))throw Error('Versão do painel incompatível (faltando '+key+'). Nenhum arquivo alterado.');
const report=fs.readFileSync(path.join(root,'lib','visao-pagantes-planilha.js'),'utf8').replace(/^export /gm,'');
const ui=fs.readFileSync(path.join(root,'tools','painel-pagantes-planilha-v10.js'),'utf8');
let patched=original.replace(anchor,()=> '\n'+report+'\n'+ui+'\n'+anchor.slice(1));
const css=`
/* ALFATEC_PAGANTES_PLANILHA_V10_ESTILO */
.v10-planilha-table td{vertical-align:top}.v10-planilha-table details{min-width:150px}
.v10-planilha-table details summary{cursor:pointer;color:var(--cyan);font-weight:600}
.v10-month-grid{display:grid;grid-template-columns:repeat(2,minmax(120px,1fr));gap:8px;min-width:250px;padding:10px 0}
.v10-month-grid span{font-size:12px;white-space:nowrap}
.v10-orphans{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:9px}
.v10-orphan{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px;border:1px solid var(--outline);border-radius:10px}
.v10-kpis{margin-bottom:15px}.v10-notice{margin-bottom:16px}
@media(max-width:760px){.v10-planilha-table{min-width:850px}.v10-orphan{flex-wrap:wrap}.v10-orphan button{width:100%}}
`;
patched=patched.replace('</style>',()=>css+'</style>');

const pattern='Recebimentos Pix elegíveis no arquivo: ${fmt(s.eligibleAmount)} (${s.eligibleCount} operações).';
if(patched.includes(pattern))patched=patched.replace(pattern,'Operações elegíveis verificadas: ${s.eligibleCount}.');
// Renomeia os documentos, mas mantém o histórico bancário na base (não altera a conciliação existente).
patched=patched.replace('AlfaTec_Extratos_Pagantes_PRIVADO.json','AlfaTec_Vinculos_Pagantes_Planilha_v10_PRIVADO.json');
patched=patched.replace('Importar extratos e pagantes','Importar vínculos de pagantes');
patched=patched.replace('Dados privados dos extratos Mercado Pago 06–10/2026. Importação só depois da prévia.','Arquivo privado de vínculos. Nenhum Pix precisa ser reenviado. Importação somente após prévia.');
patched=patched.replace('Gravando operações no banco de dados e registrando auditoria…','Salvando vínculos no banco e registrando auditoria…');
patched=patched.replace('Relatório de pagantes — Mercado Pago','Relatório de alunos e pagantes');
patched=patched.replace('Totais por pagante, períodos, Pix e vínculos confirmados, sem misturar valores de outros tipos de operação.','Valores por aluno e pagante com referência exclusiva na planilha.');
patched=patched.replace('Conciliação dos extratos','Conferência de vínculos da planilha');
patched=patched.replace('Compara o dinheiro identificado nos extratos com os lançamentos da planilha, destacando o que precisa', 'Confere os vínculos entre pagantes e alunos da planilha, destacando o que precisa');
patched=patched.replace("title='Relatório de pagantes — Pix Mercado Pago'", "title='Relatório de vínculos — valores da planilha'");
patched=patched.replace("title='Conciliação Pix x Planilha'", "title='Conferência de vínculos da planilha'");
// Escopos do dashboard são validados em testes antes da publicação.
if(!patched.includes(MARK)||patched===original)throw Error('Não foi possível atualizar o painel.');
// Permite atualizar somente os relacionamentos de pagantes, sem reimportar movimentações.
let newImportCode=bankCode;
const v7Old='incoming.payers.filter(x=>importPayers.has(x.id))';
const v7New='incoming.payers.filter(x=>incoming.payTransactions.length===0 || importPayers.has(x.id))';
const v6Old='incoming.payers.filter(p=>importPayers.has(p.id))';
const v6New='incoming.payers.filter(p=>incoming.payTransactions.length===0 || importPayers.has(p.id))';
if(newImportCode.includes(v7Old)){
  newImportCode=newImportCode.replace(v7Old,v7New);
}else if(newImportCode.includes(v7New)){
  // Idempotente.
}else if(newImportCode.includes(v6Old)){
  const oldCounters='const incomingToExisting=new Map();let newPayers=0,oldPayers=0,newTransactions=0,duplicates=0;';
  const oldExists='if(target){oldPayers++;incomingToExisting.set(p.id,target.id);continue}';
  const oldAdd="const item={id:p.id,name:p.name,studentIds:[],suggestions:Array.isArray(p.suggestions)?p.suggestions.filter(x=>typeof x==='string').slice(0,40):[],notes:''};";
  const oldSummary='summary:{newPayers,matchedPayers:oldPayers,newTransactions,duplicates,conflicts:';
  for(const required of [oldCounters,oldExists,oldAdd,oldSummary])if(!newImportCode.includes(required))throw Error('Importador antigo com estrutura inesperada. Nenhuma alteração aplicada.');
  newImportCode=newImportCode.replace(v6Old,v6New);
  newImportCode=newImportCode.replace(oldCounters,oldCounters+`
  let updatedPayerLinks=0,updatedSuggestions=0;
  const studentIdsKnown=new Set((next.students||[]).map(s=>s.id));
  function mergeRelationV10(target,p){
    const links=new Set(target.studentIds||[]), hints=new Set(target.suggestions||[]);
    for(const sid of p.studentIds||[]){if(studentIdsKnown.has(sid)&&!links.has(sid)){links.add(sid);updatedPayerLinks++}}
    for(const sid of p.suggestions||[]){if(studentIdsKnown.has(sid)&&!links.has(sid)&&!hints.has(sid)){hints.add(sid);updatedSuggestions++}}
    target.studentIds=[...links];target.suggestions=[...hints].filter(sid=>!links.has(sid));
  }`);
  newImportCode=newImportCode.replace(oldExists,'if(target){oldPayers++;incomingToExisting.set(p.id,target.id);mergeRelationV10(target,p);continue}');
  newImportCode=newImportCode.replace(oldAdd,"const item={id:p.id,name:p.name,studentIds:[],suggestions:[],notes:''};mergeRelationV10(item,p);");
  newImportCode=newImportCode.replace(oldSummary,'summary:{newPayers,matchedPayers:oldPayers,newTransactions,duplicates,updatedPayerLinks,updatedSuggestions,conflicts:');
}else if(newImportCode.includes(v6New)){
  // Patch anterior aplicado.
}else{
  throw Error('Versão de importação incompatível: nenhum arquivo foi alterado.');
}
fs.writeFileSync(importPath,newImportCode,'utf8');
fs.writeFileSync(dest,patched,'utf8');
console.log('Painel atualizado: valores visíveis por aluno e pagante vêm somente da planilha; histórico Pix preservado.');
