// Valores de exibição derivados exclusivamente da planilha de mensalidades.
// Nenhuma operação Pix é editada ou convertida em quitação por esta função.
const centsFromSheet=v=>v===null||v===undefined||v===''?0:Math.round(Number(v)*100);
const keyStudent=v=>String(v??'').trim();
const cleanPayerName=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

export function visaoPagantesPlanilha(state){
 if(!state || !Array.isArray(state.students) || !Array.isArray(state.months) || !Array.isArray(state.payers))
  throw Error('Dados de alunos, meses ou pagantes indisponíveis');
 const students=state.students;
 const ids=new Set();
 for(const s of students){if(!s || !keyStudent(s.id) || ids.has(keyStudent(s.id)))throw Error('Aluno com ID duplicado');ids.add(keyStudent(s.id));}
 const payerIndex=state.payers.filter(p=>p&&p.id&&p.name&&cleanPayerName(p.name)!=='kristopher flauzino da cunha');
 const rows=students.map(student=>{
  let totalCents=0,paidCents=0,openCents=0;
  const months=state.months.map(month=>{
   const original=student.payments?.[month.id];
   if(original!==null&&original!==undefined&&original!==''&&!Number.isFinite(Number(original)))throw Error('Mensalidade inválida');
   const amountCents=centsFromSheet(original);
   totalCents+=amountCents;
   if(amountCents>0)paidCents+=amountCents;
   if(amountCents<0)openCents-=amountCents;
   return {id:month.id,label:month.label||month.id,amountCents,empty:original===null||original===undefined||original===''};
  });
  const confirmed=payerIndex.filter(p=>(p.studentIds||[]).includes(student.id));
  const suggested=payerIndex.filter(p=>!confirmed.some(c=>c.id===p.id)&&(p.suggestions||[]).includes(student.id));
  const links=confirmed.length?confirmed:suggested;
  const status=confirmed.length?'confirmado':suggested.length?'sugerido':'sem_pagante';
  return {
   id:student.id,name:student.name,className:student.className,
   payerNames:links.map(p=>p.name),payerIds:links.map(p=>p.id),status,
   totalCents,paidCents,openCents,months,
   // Mesma referência exibida nas duas colunas. Não é receita bancária.
   payerReferenceCents:totalCents
  };
 });
 const totalCents=rows.reduce((sum,r)=>sum+r.totalCents,0);
 const positiveCents=rows.reduce((sum,r)=>sum+r.paidCents,0);
 const openCents=rows.reduce((sum,r)=>sum+r.openCents,0);
 const usedPayers=new Set(rows.flatMap(r=>r.payerIds));
 return {
  rows,totalCents,positiveCents,openCents,
  confirmedCount:rows.filter(r=>r.status==='confirmado').length,
  suggestedCount:rows.filter(r=>r.status==='sugerido').length,
  missingCount:rows.filter(r=>r.status==='sem_pagante').length,
  orphanPayers:payerIndex.filter(p=>!usedPayers.has(p.id)).map(p=>({id:p.id,name:p.name}))
 };
}
