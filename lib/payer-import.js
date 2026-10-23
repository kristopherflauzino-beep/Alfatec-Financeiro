// Concilia registros históricos sem sobrescrever vínculos, rateios ou pagamentos existentes.
// Nunca publique o arquivo JSON com os pagantes em um repositório público.
const str=(v,n=220)=>typeof v==='string'&&v.length>0&&v.length<=n;
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const cents=v=>Math.round(Number(v)*100);
export function validateBankImport(input){
  if(!input||!Array.isArray(input.payers)||!Array.isArray(input.payTransactions))throw Error('Arquivo de pagantes inválido');
  if(input.payers.length>4000||input.payTransactions.length>20000)throw Error('Importação acima do limite');
  if(JSON.stringify(input).length>1500000)throw Error('Arquivo de importação muito grande');
  // ALFATEC_EXCLUSAO_TRANSFERENCIAS_V6 — Identificadores para excluir após revisão.
  const excludedOperationIds=input.excludedOperationIds??[];
  if(!Array.isArray(excludedOperationIds)||excludedOperationIds.length>100||
     new Set(excludedOperationIds).size!==excludedOperationIds.length||
     excludedOperationIds.some(id=>typeof id!=='string'||!/^\d{6,40}$/.test(id)))
    throw Error('Lista de exclusões inválida');
  const seenPayers=new Set(),seenTx=new Set();
  for(const p of input.payers){
    if(!p||!str(p.id,80)||!str(p.name,200)||seenPayers.has(p.id))throw Error('Pagante com ID, nome ou duplicidade inválida');
    seenPayers.add(p.id);
  }
  for(const tx of input.payTransactions){
    if(!tx||!str(tx.id,80)||seenTx.has(tx.id)||!/^\d{4}-\d\d-\d\d$/.test(tx.date)||!Number.isFinite(tx.amount)||tx.amount<=0||tx.amount>1e8||!str(tx.rawName,220)||!seenPayers.has(tx.groupId)||!['recebido','revisar','interno','ignorar'].includes(tx.status)||!str(tx.source,130)||!/\.pdf$/i.test(tx.source)||!Number.isInteger(tx.page)||tx.page<1||tx.page>999)throw Error('Operação inválida, duplicada ou sem pagante');
    seenTx.add(tx.id);
  }
  return {payers:input.payers,payTransactions:input.payTransactions,excludedOperationIds};
}
export function mergeBankImport(state,input){
  const incoming=validateBankImport(input);
  if(!state||!Array.isArray(state.payers)||!Array.isArray(state.payTransactions))throw Error('Estado do sistema inválido');
  // Exclusões explícitas no arquivo privado são auditadas pela API /api/payers-import.
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
  const ids=new Map(next.payers.map(p=>[p.id,p])),names=new Map(next.payers.map(p=>[norm(p.name),p]));
  const incomingToExisting=new Map();let newPayers=0,oldPayers=0,newTransactions=0,duplicates=0;
  let updatedPayerLinks=0,updatedSuggestions=0;
  const studentIdsKnown=new Set((next.students||[]).map(s=>s.id));
  function mergeRelationV10(target,p){
    const links=new Set(target.studentIds||[]), hints=new Set(target.suggestions||[]);
    for(const sid of p.studentIds||[]){if(studentIdsKnown.has(sid)&&!links.has(sid)){links.add(sid);updatedPayerLinks++}}
    for(const sid of p.suggestions||[]){if(studentIdsKnown.has(sid)&&!links.has(sid)&&!hints.has(sid)){hints.add(sid);updatedSuggestions++}}
    target.studentIds=[...links];target.suggestions=[...hints].filter(sid=>!links.has(sid));
  }
  for(const p of incoming.payers.filter(p=>incoming.payTransactions.length===0 || importPayers.has(p.id))){
    let target=ids.get(p.id),byName=names.get(norm(p.name));
    if(target&&norm(target.name)!==norm(p.name)){
      if(byName){target=byName}else{errors.push({id:p.id,reason:'Mesmo ID de pagante com nome diferente'});continue}
    }
    target=target||byName;
    if(target){oldPayers++;incomingToExisting.set(p.id,target.id);mergeRelationV10(target,p);continue}
    const item={id:p.id,name:p.name,studentIds:[],suggestions:[],notes:''};mergeRelationV10(item,p);
    next.payers.push(item);ids.set(item.id,item);names.set(norm(item.name),item);incomingToExisting.set(p.id,item.id);newPayers++;
  }
  const byId=new Map(next.payTransactions.map(t=>[t.id,t]));
  for(const tx of importRows){
    const gid=incomingToExisting.get(tx.groupId);
    if(!gid){errors.push({id:tx.id,reason:'Pagante não conciliado'});continue}
    const existing=byId.get(tx.id);
    if(existing){
      if(existing.date!==tx.date||cents(existing.amount)!==cents(tx.amount)||norm(existing.rawName)!==norm(tx.rawName))errors.push({id:tx.id,reason:'Operação de mesmo ID com data, valor ou origem divergente'});
      else duplicates++;
      continue; // Nenhum rateio/vínculo/status existente é sobrescrito.
    }
    const item={
      id:tx.id,date:tx.date,amount:tx.amount,rawName:tx.rawName,groupId:gid,
      source:tx.source,page:tx.page,status:tx.status,studentId:'',competence:tx.date.slice(0,7),memo:'',allocations:[]
    };
    next.payTransactions.push(item);byId.set(item.id,item);newTransactions++;
  }
  const valid=importRows.filter(t=>t.status==='recebido'&&cents(t.amount)>0&&cents(t.amount)%13500===0);
  return {state:next,conflicts:errors,summary:{newPayers,matchedPayers:oldPayers,newTransactions,duplicates,updatedPayerLinks,updatedSuggestions,conflicts:errors.length,eligibleCount:valid.length,eligibleAmount:valid.reduce((a,t)=>a+t.amount,0),sourceCount:new Set(incoming.payTransactions.map(t=>t.source)).size,totalTransactions:importRows.length,excludedExisting,excludedRequested:excluded.size,ignoredInternalInFile:incoming.payTransactions.length-importRows.length}};
}
