#!/usr/bin/env node
// ALFATEC_EXCLUSAO_TRANSFERENCIAS_V6
// Aplica alteração mínima aos arquivos atuais do repositório. Sem dados privados.
const fs=require('node:fs');
const path=require('node:path');
const base=process.cwd();
function patch(relative,apply,marker){
 const p=path.join(base,relative);
 if(!fs.existsSync(p))throw Error(`Arquivo inexistente: ${relative}. Execute na raiz do projeto.`);
 const old=fs.readFileSync(p,'utf8');
 if(old.includes(marker)){console.log(`Sem mudança: ${relative} já atualizado`);return}
 const updated=apply(old);
 if(updated===old||!updated.includes(marker))throw Error(`Não foi possível aplicar a atualização em ${relative}. Não sobrescreva suas alterações.`);
 fs.writeFileSync(p,updated,'utf8');console.log(`Atualizado: ${relative}`);
}
function replaceOne(s,search,replacement,label){
 const a=s.indexOf(search);
 if(a<0||s.indexOf(search,a+search.length)>=0)throw Error(`Trecho não encontrado ou duplicado: ${label}`);
 return s.replace(search,replacement);
}
patch('lib/payer-import.js',s=>{
 s=replaceOne(s,
 "  const seenPayers=new Set(),seenTx=new Set();",
 `  // ALFATEC_EXCLUSAO_TRANSFERENCIAS_V6 — Identificadores para excluir após revisão.
  const excludedOperationIds=input.excludedOperationIds??[];
  if(!Array.isArray(excludedOperationIds)||excludedOperationIds.length>100||
     new Set(excludedOperationIds).size!==excludedOperationIds.length||
     excludedOperationIds.some(id=>typeof id!=='string'||!/^\\d{6,40}$/.test(id)))
    throw Error('Lista de exclusões inválida');
  const seenPayers=new Set(),seenTx=new Set();`, 'validação de importação');
 s=replaceOne(s,
 "  return {payers:input.payers,payTransactions:input.payTransactions};",
 "  return {payers:input.payers,payTransactions:input.payTransactions,excludedOperationIds};", 'retorno da validação');
 s=replaceOne(s,
 "  const next=structuredClone(state),errors=[],ids=new Map(next.payers.map(p=>[p.id,p])),names=new Map(next.payers.map(p=>[norm(p.name),p]));",
 `  // Exclusões explícitas no arquivo privado são auditadas pela API /api/payers-import.
  // Nunca apagamos operação já atribuída a mensalidade: requer conferência humana.
  const next=structuredClone(state),errors=[],excluded=new Set(incoming.excludedOperationIds);
  const excludedPayerIds=new Set();let excludedExisting=0;
  for(const t of next.payTransactions){
    if(!excluded.has(t.id))continue;
    if((Array.isArray(t.allocations)&&t.allocations.length>0)||t.studentId){
      errors.push({id:t.id,reason:'Operação a excluir possui vínculo com aluno. Remova o vínculo apenas após conferência.'});
    }else{excludedPayerIds.add(t.groupId);excludedExisting++}
  }
  const blocked=new Set(errors.filter(e=>excluded.has(e.id)).map(e=>e.id));
  next.payTransactions=next.payTransactions.filter(t=>!excluded.has(t.id)||blocked.has(t.id));
  const stillUsed=new Set(next.payTransactions.map(t=>t.groupId));
  next.payers=next.payers.filter(p=>!excludedPayerIds.has(p.id)||stillUsed.has(p.id)||(p.studentIds||[]).length>0);
  // Não trazer créditos classificados como transferência interna ou ignorados.
  const importRows=incoming.payTransactions.filter(t=>!excluded.has(t.id)&&t.status!=='interno'&&t.status!=='ignorar');
  const importPayers=new Set(importRows.map(t=>t.groupId));
  const ids=new Map(next.payers.map(p=>[p.id,p])),names=new Map(next.payers.map(p=>[norm(p.name),p]));`, 'merge + exclusões');
 s=replaceOne(s,
 "  for(const p of incoming.payers){",
 "  for(const p of incoming.payers.filter(p=>importPayers.has(p.id))){", 'pessoas elegíveis');
 s=replaceOne(s,
 "  for(const tx of incoming.payTransactions){\n    const gid=incomingToExisting.get(tx.groupId);",
 "  for(const tx of importRows){\n    const gid=incomingToExisting.get(tx.groupId);", 'operações elegíveis');
 s=replaceOne(s,
 "  const valid=incoming.payTransactions.filter(t=>t.status==='recebido'&&cents(t.amount)>0&&cents(t.amount)%13500===0);",
 "  const valid=importRows.filter(t=>t.status==='recebido'&&cents(t.amount)>0&&cents(t.amount)%13500===0);", 'total Pix');
 s=replaceOne(s,
 "totalTransactions:incoming.payTransactions.length}};",
 "totalTransactions:importRows.length,excludedExisting,excludedRequested:excluded.size,ignoredInternalInFile:incoming.payTransactions.length-importRows.length}};", 'resumo');
 return s;
},'ALFATEC_EXCLUSAO_TRANSFERENCIAS_V6');
patch('private/dashboard.html',s=>{
 s=replaceOne(s,
 'function bankRows(){return db.payTransactions||[]}',
 `// ALFATEC_EXCLUSAO_TRANSFERENCIAS_V6: não exibir transferências internas e operações ignoradas.
function bankRows(){return (db.payTransactions||[]).filter(t=>t.status!=='interno'&&t.status!=='ignorar')}
function visibleBankPayers(){
  const shown=new Set(bankRows().map(t=>t.groupId));
  const hasAny=new Set((db.payTransactions||[]).map(t=>t.groupId));
  return (db.payers||[]).filter(p=>shown.has(p.id)||!hasAny.has(p.id)||(p.studentIds||[]).length>0);
}`, 'visão operacional');
 s=replaceOne(s,
 "const data=db.payers.filter(p=>norm(p.name+' '+linkedStudents(p).join(' ')).includes(norm(q)))",
 "const data=visibleBankPayers().filter(p=>norm(p.name+' '+linkedStudents(p).join(' ')).includes(norm(q)))", 'vínculos');
 s=replaceOne(s,
 "const list=pid?db.payers.filter(p=>p.id===pid):db.payers;",
 "const list=pid?visibleBankPayers().filter(p=>p.id===pid):visibleBankPayers();", 'relatórios');
 s=replaceOne(s,
 "const opts=db.payers.filter(x=>x.id!==id);",
 "const opts=visibleBankPayers().filter(x=>x.id!==id);", 'unir nomes');
 return s;
},'ALFATEC_EXCLUSAO_TRANSFERENCIAS_V6');
