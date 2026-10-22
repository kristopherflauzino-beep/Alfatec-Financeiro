export const SHEET_ID='1Q4wj9MWI6ZPnKD6BxOh-t1kJVZxEYWNJ25fRvbfL9Q4';
export const CLASSES=['1º ao 5º','6º ao 9º'];
export const BASE_MONTHS=[
  {id:'2026-05',label:'Maio',year:2026},{id:'2026-06',label:'Junho',year:2026},
  {id:'2026-07',label:'Julho',year:2026},{id:'2026-08',label:'Agosto',year:2026},
  {id:'2026-09',label:'Setembro',year:2026},{id:'2026-10',label:'Outubro',year:2026}
];
function validMoney(v){return v===null||v===undefined||Number.isFinite(v)&&Math.abs(v)<=1e9}
function norm(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim()}
const compare=(s)=>norm(s.className)+'|'+norm(s.name);
export function fromSheetRows(first,second){
  const students=[];
  let n=0;
  for(const [className,rows] of [[CLASSES[0],first],[CLASSES[1],second]]){
    if(!Array.isArray(rows))throw Error('Aba da planilha inválida');
    for(const [idx,r] of rows.entries()){
      const name=String(r?.[0]??'').trim();
      if(!name||name==='Robótica'||name===className||name==='VALOR TOTAL FINAL')continue;
      if(!/^\S/.test(name)||name.length>180)throw Error('Nome de aluno inválido');
      const raw=r.slice(2,8);
      const payments=Object.fromEntries(BASE_MONTHS.map((m,i)=>[m.id,raw[i]===undefined||raw[i]===''?null:raw[i]]));
      for(const value of Object.values(payments))if(!validMoney(value))throw Error('Mensalidade da planilha inválida');
      let enrollment=r[1]===undefined||r[1]===''||r[1]===null?null:r[1];
      if(!validMoney(enrollment))throw Error('Matrícula inválida');
      students.push({id:`alf-${String(++n).padStart(3,'0')}`,name,className,enrollment,payments,notes:String(r[9]||''),active:true});
    }
  }
  return makeSnapshot(students);
}
export function makeSnapshot(students){
  const result={kind:'alfatec_sheet_snapshot',spreadsheetId:SHEET_ID,months:BASE_MONTHS,students};
  return validateSnapshot(result);
}
export function validateSnapshot(input){
  if(!input||input.kind!=='alfatec_sheet_snapshot'||input.spreadsheetId!==SHEET_ID||!Array.isArray(input.students)||input.students.length>1500||!Array.isArray(input.months))throw Error('Arquivo não corresponde à planilha AlfaTec');
  const ids=new Set(),keys=new Set();
  for(const s of input.students){
    if(!s||typeof s.id!=='string'||s.id.length>80||typeof s.name!=='string'||s.name.length<2||s.name.length>180||!CLASSES.includes(s.className)||!s.payments||typeof s.payments!=='object'||Array.isArray(s.payments))throw Error('Aluno inválido na planilha');
    if(ids.has(s.id)||keys.has(compare(s)))throw Error('Aluno repetido na planilha');
    ids.add(s.id);keys.add(compare(s));
    if(!validMoney(s.enrollment))throw Error('Matrícula inválida');
    for(const m of BASE_MONTHS)if(!validMoney(s.payments[m.id]))throw Error('Mensalidade inválida');
  }
  return {kind:input.kind,spreadsheetId:SHEET_ID,months:BASE_MONTHS,students:input.students.map(s=>({id:s.id,name:s.name,className:s.className,enrollment:s.enrollment??null,payments:Object.fromEntries(BASE_MONTHS.map(m=>[m.id,s.payments[m.id]??null])),notes:String(s.notes||'').slice(0,2000),active:s.active!==false}))};
}
export function mergeSheet(current,untrusted,{overwrite=false}={}){
  const snapshot=validateSnapshot(untrusted);
  const result=structuredClone(current);
  const currentIds=new Map(result.students.map(s=>[s.id,s]));
  const currentNames=new Map(result.students.map(s=>[compare(s),s]));
  const warnings=[];
  let added=0,updated=0,unchanged=0;
  for(const s of snapshot.students){
    let target=currentIds.get(s.id)||currentNames.get(compare(s));
    if(!target){
      let id=s.id;
      if(currentIds.has(id)){id='sheet-'+s.id+'-'+String(added+1)}
      target={...structuredClone(s),id};result.students.push(target);currentIds.set(id,target);currentNames.set(compare(target),target);added++;continue;
    }
    let changed=false;
    const changes=[['enrollment',s.enrollment]];
    for(const m of BASE_MONTHS)changes.push(['payments.'+m.id,s.payments[m.id]]);
    for(const [path,newV] of changes){
      const oldV=path.startsWith('payments.')?target.payments?.[path.slice(9)]:target.enrollment;
      if((oldV??null)===(newV??null))continue;
      if(oldV!==null&&oldV!==undefined&&!(overwrite)){
        warnings.push({student:target.name,className:target.className,field:path,current:oldV,sheet:newV});continue;
      }
      if(path.startsWith('payments.')){target.payments??={};target.payments[path.slice(9)]=newV}else target.enrollment=newV;
      changed=true;
    }
    if(changed)updated++;else unchanged++;
  }
  const ids=new Set(result.months.map(x=>x.id));for(const m of BASE_MONTHS)if(!ids.has(m.id))result.months.push(m);
  const net=snapshot.students.reduce((total,s)=>total+BASE_MONTHS.reduce((a,m)=>a+(s.payments[m.id]??0),0),0);
  const faltante=snapshot.students.reduce((total,s)=>total+BASE_MONTHS.reduce((a,m)=>a+Math.max(0,-(s.payments[m.id]??0)),0),0);
  const summary={sourceStudents:snapshot.students.length,newStudents:added,updatedStudents:updated,unchangedStudents:unchanged,conflicts:warnings.length,sheetNet:net,sheetOutstanding:faltante,sheetRegistrationNotIncluded:true,existingBankTransactionsPreserved:current.payTransactions?.length||0};
  return {state:result,summary,conflicts:warnings};
}
