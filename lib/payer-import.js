// Concilia registros históricos sem sobrescrever vínculos, rateios ou pagamentos existentes.
// Nunca publique o arquivo JSON com os pagantes em um repositório público.
const str=(v,n=220)=>typeof v==='string'&&v.length>0&&v.length<=n;
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const cents=v=>Math.round(Number(v)*100);
export function validateBankImport(input){
  if(!input||!Array.isArray(input.payers)||!Array.isArray(input.payTransactions))throw Error('Arquivo de pagantes inválido');
  if(input.payers.length>4000||input.payTransactions.length>20000)throw Error('Importação acima do limite');
  if(JSON.stringify(input).length>1500000)throw Error('Arquivo de importação muito grande');
  const seenPayers=new Set(),seenTx=new Set();
  for(const p of input.payers){
    if(!p||!str(p.id,80)||!str(p.name,200)||seenPayers.has(p.id))throw Error('Pagante com ID, nome ou duplicidade inválida');
    seenPayers.add(p.id);
  }
  for(const tx of input.payTransactions){
    if(!tx||!str(tx.id,80)||seenTx.has(tx.id)||!/^\d{4}-\d\d-\d\d$/.test(tx.date)||!Number.isFinite(tx.amount)||tx.amount<=0||tx.amount>1e8||!str(tx.rawName,220)||!seenPayers.has(tx.groupId)||!['recebido','revisar','interno','ignorar'].includes(tx.status)||!str(tx.source,130)||!/\.pdf$/i.test(tx.source)||!Number.isInteger(tx.page)||tx.page<1||tx.page>999)throw Error('Operação inválida, duplicada ou sem pagante');
    seenTx.add(tx.id);
  }
  return {payers:input.payers,payTransactions:input.payTransactions};
}
export function mergeBankImport(state,input){
  const incoming=validateBankImport(input);
  if(!state||!Array.isArray(state.payers)||!Array.isArray(state.payTransactions))throw Error('Estado do sistema inválido');
  const next=structuredClone(state),errors=[],ids=new Map(next.payers.map(p=>[p.id,p])),names=new Map(next.payers.map(p=>[norm(p.name),p]));
  const incomingToExisting=new Map();let newPayers=0,oldPayers=0,newTransactions=0,duplicates=0;
  for(const p of incoming.payers){
    let target=ids.get(p.id),byName=names.get(norm(p.name));
    if(target&&norm(target.name)!==norm(p.name)){
      if(byName){target=byName}else{errors.push({id:p.id,reason:'Mesmo ID de pagante com nome diferente'});continue}
    }
    target=target||byName;
    if(target){oldPayers++;incomingToExisting.set(p.id,target.id);continue}
    const item={id:p.id,name:p.name,studentIds:[],suggestions:Array.isArray(p.suggestions)?p.suggestions.filter(x=>typeof x==='string').slice(0,40):[],notes:''};
    next.payers.push(item);ids.set(item.id,item);names.set(norm(item.name),item);incomingToExisting.set(p.id,item.id);newPayers++;
  }
  const byId=new Map(next.payTransactions.map(t=>[t.id,t]));
  for(const tx of incoming.payTransactions){
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
  const valid=incoming.payTransactions.filter(t=>t.status==='recebido'&&cents(t.amount)>0&&cents(t.amount)%13500===0);
  return {state:next,conflicts:errors,summary:{newPayers,matchedPayers:oldPayers,newTransactions,duplicates,conflicts:errors.length,eligibleCount:valid.length,eligibleAmount:valid.reduce((a,t)=>a+t.amount,0),sourceCount:new Set(incoming.payTransactions.map(t=>t.source)).size,totalTransactions:incoming.payTransactions.length}};
}
