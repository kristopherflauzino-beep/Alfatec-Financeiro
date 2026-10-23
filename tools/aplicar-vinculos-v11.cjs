'use strict';
// Aplica a versao 11 sobre a versao 10 do painel sem sobrescrever
// dados locais, documentos privados, transacoes ou outras telas.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const files=['private/dashboard.html','tools/painel-pagantes-planilha-v10.js'];
const originals=files.map(p=>{
 const file=path.join(root,p);
 if(!fs.existsSync(file))throw Error(`Projeto incompleto: ${p} nao encontrado. Interrompido.`);
 return {file,source:fs.readFileSync(file,'utf8'),path:p};
});
function replaceOnce(source,find,replacement,label){
 const i=source.indexOf(find);
 if(i<0 || source.indexOf(find,i+1)!==-1)throw Error(`Painel incompatível: ${label}. Nenhum arquivo foi alterado.`);
 return source.slice(0,i)+replacement+source.slice(i+find.length);
}
function patch(source){
 if(source.includes('ALFATEC_VINCULOS_CONFIRMADOS_V11'))return source;
 if(!source.includes('ALFATEC_PAGANTES_PLANILHA_V10'))throw Error('Atualize primeiro para a versao 10. Nenhum arquivo foi alterado.');
 const start="(v.orphanPayers.length?";
 const finish="+'</div></article>':'');";
 const a=source.indexOf(start),b=source.indexOf(finish,a);
 if(a<0||b<0||source.indexOf(start,a+1)!==-1)throw Error('Painel incompatível (lista de pagantes sem vínculo). Nenhum arquivo foi alterado.');
 source=source.slice(0,a)+"''; // ALFATEC_VINCULOS_CONFIRMADOS_V11 — lista sem aluno removida somente da interface"+source.slice(b+finish.length);
 const startFunction='function renderSheetV10(tabName){';
 const helper=`// ALFATEC_VINCULOS_CONFIRMADOS_V11
async function confirmarVinculosV11(){
 if(SERVER.user.role!=='main_admin'){toast('Somente o administrador pode confirmar vínculos.',true);return;}
 if(syncBlocked){toast('Há um conflito de edição. Recarregue a página antes de confirmar.',true);return;}
 await saveChain;
 if(syncBlocked)return;
 const known=new Set(db.students.map(s=>s.id));
 const proposals=db.payers.flatMap(p=>(p.suggestions||[])
   .filter(id=>known.has(id)&&!(p.studentIds||[]).includes(id))
   .map(id=>({p,id})));
 if(!proposals.length){toast('Não há vínculos sugeridos a confirmar.');return;}
 if(!window.confirm('Confirmar '+proposals.length+' associação(ões) entre pagantes e alunos? Esta decisão ficará registrada na auditoria. Não confirma recebimento de Pix nem quitação de mensalidades.'))return;
 for(const p of db.payers){
   const additions=(p.suggestions||[]).filter(id=>known.has(id)&&!(p.studentIds||[]).includes(id));
   if(!additions.length)continue;
   p.studentIds=[...new Set([...(p.studentIds||[]),...additions])];
   p.suggestions=(p.suggestions||[]).filter(id=>!additions.includes(id));
 }
 if(!save()){toast('Alterações não gravadas. Verifique a sessão e recarregue.',true);return;}
 await saveChain;
 if(syncBlocked){toast('Confirmação não foi salva. Verifique o aviso do servidor.',true);return;}
 render();
 toast('Vínculos de alunos confirmados e registrados na auditoria.');
}
`;
 source=replaceOnce(source,startFunction,helper+startFunction,'função da página v10');
 const controls=" renderTop(tabName,'Alunos e pagantes vinculados · valores de referência exclusivos da planilha',controls);";
 const before=` if(SERVER.user.role==='main_admin'){
  const validStudentIds=new Set(db.students.map(s=>s.id));
  const pendingV11=db.payers.reduce((n,p)=>n+(p.suggestions||[])
    .filter(id=>validStudentIds.has(id)&&!(p.studentIds||[]).includes(id)).length,0);
  if(pendingV11)controls+='<button type="button" class="button secondary" id="v11-confirm-links">Confirmar '+pendingV11+' vínculo(s) sugerido(s)</button>';
 }
`;
 source=replaceOnce(source,controls,before+controls,'cabeçalho da página v10');
 source=replaceOnce(source,' const controls=`${SERVER.user.role',' let controls=`${SERVER.user.role','controle das ações do painel');
 const wire=" $('bank-import')?.addEventListener('click',openBankImport);";
 source=replaceOnce(source,wire," $('v11-confirm-links')?.addEventListener('click',confirmarVinculosV11);\n"+wire,'ligação do botão de confirmação');
 return source;
}
const writes=originals.map(o=>({...o,result:patch(o.source)}));
// Todas as verificações sintáticas são feitas antes da primeira gravação.
for(const w of writes){
 if(w.path.endsWith('.html')){
  let count=0;
  for(const m of w.result.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){new vm.Script(m[1]);count++}
  if(!count)throw Error('Nenhum script encontrado na página. Operação interrompida.');
 }else{new vm.Script(w.result)}
}
for(const w of writes){if(w.result!==w.source)fs.writeFileSync(w.file,w.result,'utf8')}
console.log('Atualização v11 aplicada: lista de pagantes sem aluno oculta; ação de confirmação disponível ao administrador.');
console.log('Nenhum dado Pix foi alterado por esta instalação.');
