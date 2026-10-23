// Conciliação financeira transparente. Não realiza alocação nem altera pagamentos.
// Vínculos sugeridos são hipóteses, NÃO prova de competência ou pagamento.
// Montantes em centavos para evitar arredondamentos binários.
const toCent = v => Number.isFinite(Number(v)) ? Math.round(Number(v)*100) : 0;
const normalizeId = value => {
  const x=String(value??'').trim();
  return /^[\d.\s-]+$/.test(x) ? x.replace(/\D/g,'') : x.toUpperCase();
};
export function correlacaoDetalhada(state) {
 if(!state || !Array.isArray(state.students) || !Array.isArray(state.payers) || !Array.isArray(state.payTransactions) || !Array.isArray(state.months)) throw Error('Estrutura financeira inválida');
 const fee=toCent(state.settings?.monthlyFee??135);
 if(fee<=0)throw Error('Mensalidade inválida');
 const students=new Map(state.students.map(s=>[s.id,s]));
 const payers=new Map(state.payers.map(p=>[p.id,p]));
 const receiptByPayer=new Map();const seen=new Map();const errors=[];
 let pix=0,count=0;
 for(const t of state.payTransactions){
   const id=normalizeId(t.id),v=toCent(t.amount);
   if(!id){errors.push({id:String(t.id),reason:'Operação sem ID'});continue}
   if(seen.has(id)){
     const old=seen.get(id);
     if(old.amount!==v||old.date!==t.date||old.groupId!==t.groupId)errors.push({id,reason:'ID repetido com informações diferentes'});
     continue;
   }
   seen.set(id,{amount:v,date:t.date,groupId:t.groupId});
   if(t.status!=='recebido'||v<=0||v%fee!==0)continue;
   if(!payers.has(t.groupId)){errors.push({id,reason:'Pagante ausente'});continue}
   const a=receiptByPayer.get(t.groupId)||{amount:0,count:0,ids:[]};
   a.amount+=v;a.count++;a.ids.push(t.id);receiptByPayer.set(t.groupId,a);pix+=v;count++;
 }
 const adj=new Map();
 const connect=(p,s)=>{
   const pkey='P:'+p,skey='S:'+s;
   if(!adj.has(pkey))adj.set(pkey,new Set());
   if(!adj.has(skey))adj.set(skey,new Set());
   adj.get(pkey).add(skey);adj.get(skey).add(pkey);
 };
 const edgeType=new Map();
 for(const p of state.payers){
   const linked=new Set((p.studentIds||[]).filter(id=>students.has(id)));
   const suggested=new Set((p.suggestions||[]).filter(id=>students.has(id)));
   for(const id of linked){connect(p.id,id);edgeType.set(p.id+'|'+id,'confirmado')}
   for(const id of suggested){if(!linked.has(id)){connect(p.id,id);edgeType.set(p.id+'|'+id,'sugerido')}}
 }
 const keys=[...receiptByPayer.keys()].map(id=>'P:'+id).concat([...students.keys()].map(id=>'S:'+id));
 const visited=new Set(),components=[];
 for(const start of keys){
   if(visited.has(start))continue;
   const queue=[start];visited.add(start);const pids=[],sids=[];
   while(queue.length){
     const k=queue.shift();if(k.startsWith('P:'))pids.push(k.slice(2));else sids.push(k.slice(2));
     for(const dest of adj.get(k)||[]){if(!visited.has(dest)){visited.add(dest);queue.push(dest)}}
   }
   const receipts=pids.map(id=>receiptByPayer.get(id)).filter(Boolean);
   const amount=receipts.reduce((n,a)=>n+a.amount,0), pixCount=receipts.reduce((n,a)=>n+a.count,0);
   const ledger=sids.map(id=>students.get(id));
   let positive=0,open=0;
   for(const s of ledger){for(const m of state.months){const v=toCent(s.payments?.[m.id]);if(v>0)positive+=v;else if(v<0)open+=-v}}
   const links=[];
   for(const pid of pids)for(const sid of sids){const type=edgeType.get(pid+'|'+sid);if(type)links.push({payerId:pid,studentId:sid,type})}
   let status='SEM_VINCULO';
   if(links.length){
     if(links.some(l=>l.type==='sugerido'))status='SUGERIDO';
     else status='VINCULO_CONFIRMADO_SEM_COMPETENCIA';
     if(pids.length>1 || sids.length>1)status=status+'_RATEIO';
   }
   if(!pids.length)status='SEM_PAGANTE_IDENTIFICADO';
   if(!sids.length)status='SEM_ALUNO_IDENTIFICADO';
   components.push({payers:pids.map(id=>({id,name:payers.get(id)?.name||id})),students:sids.map(id=>({id,name:students.get(id)?.name||id,className:students.get(id)?.className||''})),amount,pixCount,positive,open,net:positive-open,difference:amount-positive,links,status,receiptIds:receipts.flatMap(r=>r.ids)});
 }
 let positive=0,open=0;
 for(const s of state.students)for(const m of state.months){const val=toCent(s.payments?.[m.id]);if(val>0)positive+=val;else if(val<0)open+=-val}
 components.sort((a,b)=>{const A=a.payers.length>0,B=b.payers.length>0;return Number(B)-Number(A)|| b.amount-a.amount||a.students.map(s=>s.name).join().localeCompare(b.students.map(s=>s.name).join(),'pt-BR')});
 return {components,errors,totals:{pix,count,positive,open,net:positive-open,differenceToPositive:pix-positive,differenceToNet:pix-(positive-open),monthCount:state.months.length,students:students.size}};
}
