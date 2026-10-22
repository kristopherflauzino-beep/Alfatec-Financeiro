// Não confiar em informação de autoria recebida do navegador.
export function validateState(state){
  if(!state||typeof state!=='object'||Array.isArray(state))throw Error('Dados inválidos');
  if(!Array.isArray(state.students)||!Array.isArray(state.months)||!state.settings||!Array.isArray(state.payers)||!Array.isArray(state.payTransactions))throw Error('Estrutura inválida');
  if(state.students.length>1500||state.payTransactions.length>20000||state.payers.length>4000)throw Error('Limite excedido');
  const data=JSON.stringify(state);
  if(data.length>2_000_000)throw Error('Tamanho acima do permitido');
  for(const s of state.students){
    if(!s||typeof s.name!=='string'||s.name.length>180||typeof s.className!=='string'||typeof s.payments!=='object')throw Error('Aluno inválido');
    for(const val of Object.values(s.payments)){if(val!==null&&(!Number.isFinite(val)||Math.abs(val)>1e9))throw Error('Valor de mensalidade inválido')}
  }
  for(const t of state.payTransactions){if(!t||typeof t.id!=='string'||!Number.isFinite(t.amount)||t.amount<0)throw Error('Transação inválida')}
  return data;
}
function short(v){const s=JSON.stringify(v);return s && s.length>250?s.slice(0,248)+'…':v}
export function diffState(before,after){
  const edits=[];let omitted=0;
  function append(path,a,b){
    if(edits.length>=400){omitted++;return;}
    edits.push({campo:path,anterior:short(a),novo:short(b)});
  }
  function walk(a,b,path,depth=0){
    if(a===b)return;
    if(a===undefined||b===undefined||a===null||b===null||typeof a!=='object'||typeof b!=='object'||depth>7){if(JSON.stringify(a)!==JSON.stringify(b))append(path,a,b);return}
    if(Array.isArray(a)||Array.isArray(b)){
      if(!Array.isArray(a)||!Array.isArray(b)){append(path,a,b);return}
      const stable= a.concat(b).every(v=>v&&typeof v==='object'&&typeof v.id==='string');
      if(stable){const aa=new Map(a.map(x=>[x.id,x])),bb=new Map(b.map(x=>[x.id,x]));for(const k of new Set([...aa.keys(),...bb.keys()]))walk(aa.get(k),bb.get(k),path+'['+k+']',depth+1)}
      else {for(let i=0;i<Math.max(a.length,b.length);i++)walk(a[i],b[i],path+'['+i+']',depth+1)}
    } else for(const key of new Set([...Object.keys(a),...Object.keys(b)]))walk(a[key],b[key],path?path+'.'+key:key,depth+1);
  }
  walk(before,after,'');
  if(omitted)edits.push({campo:'…',anterior:null,novo:omitted+' alterações adicionais omitidas no resumo'});
  return edits;
}
