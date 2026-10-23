// Mantém os recebimentos brutos separados dos lançamentos líquidos da planilha.
// Nunca escolhe ou descarta operações apenas para igualar totais.
const moneyCent=v=>Number.isFinite(Number(v))?Math.round(Number(v)*100):0;
export function resumoContabilPix(state){
 if(!state||!Array.isArray(state.students)||!Array.isArray(state.payTransactions)||!Array.isArray(state.months))throw Error('Dados da planilha ou dos Pix indisponíveis');
 const expected=new Map();let positive=0,negative=0;
 for(const s of state.students){
   for(const m of state.months){
     const n=s.payments?.[m.id],amount=n===null||n===undefined?null:moneyCent(n);
     if(amount!==null){if(amount>0)positive+=amount;else if(amount<0)negative+=-amount;}
     expected.set(`${s.id}|${m.id}`,amount);
   }
 }
 const fee=moneyCent(state.settings?.monthlyFee || 135);
 if(fee<=0)throw Error('Mensalidade inválida');
 const allocatedByMonth=new Map(),invalid=[],receiptIds=[],unassignedIds=[];
 let pix=0,allocated=0;
 for(const t of state.payTransactions){
   const amount=moneyCent(t.amount);
   if(t.status!=='recebido'||amount<=0||amount%fee!==0)continue;
   pix+=amount;receiptIds.push(t.id);
   const parts=Array.isArray(t.allocations)&&t.allocations.length?t.allocations:(t.studentId?[{studentId:t.studentId,competence:t.competence,amount:t.amount}]:[]);
   if(!parts.length){unassignedIds.push(t.id);continue;}
   let txSum=0;let issue='';const txParts=[];const seen=new Set();
   for(const a of parts){
     const cents=moneyCent(a.amount),key=`${a.studentId}|${a.competence}`;
     if(!expected.has(key)||cents<=0||seen.has(key)){issue='Rateio inválido, duplicado ou com aluno/competência inexistente';break}
     seen.add(key);txSum+=cents;txParts.push({key,cents});
   }
   if(txSum>amount)issue='Rateio maior que o Pix recebido';
   if(issue){invalid.push({id:t.id,reason:issue});unassignedIds.push(t.id);continue;}
   allocated+=txSum;
   for(const a of txParts)allocatedByMonth.set(a.key,(allocatedByMonth.get(a.key)||0)+a.cents);
   if(txSum<amount)unassignedIds.push(t.id);
 }
 let proven=0,exactMonths=0,divergentMonths=0;
 const monthRows=[];
 for(const [key,amount] of expected){
   const assigned=allocatedByMonth.get(key)||0;
   if(amount>0&&assigned===amount){proven+=assigned;exactMonths++}
   else if(assigned>0)divergentMonths++;
   monthRows.push({key,amount,assigned,status:amount>0&&assigned===amount?'conciliado':assigned>0?'divergente':amount<0?'em_aberto':'sem_vinculo'});
 }
 return {positive,negative,net:positive-negative,pix,differenceToNet:pix-(positive-negative),differenceToPositive:pix-positive,
  allocated,unassigned:pix-allocated,proven,exactMonths,divergentMonths,eligibleCount:receiptIds.length,
  unassignedIds,invalid,monthRows};
}
