// Aplica a navegação lateral responsiva e a importação protegida de extratos.
// Executar na raiz de uma cópia limpa/atualizada do repositório.
const fs=require('node:fs');
const path='private/dashboard.html';
let src=fs.readFileSync(path,'utf8');
const marker='ALFATEC_PAGANTES_MOBILE_V3';
if(src.includes(marker)){console.log('Interface já atualizada.');process.exit(0)}
function replaceOnce(anchor,replacement){
  if(!src.includes(anchor))throw Error('Arquivo incompatível. Não foi modificado: '+anchor.slice(0,95));
  src=src.replace(anchor,replacement);
}
// Evita qualquer edição parcial quando o HTML não tem as âncoras esperadas.
const expected=['</style>','<aside class="sidebar">','function chooseTab(t){tab=t;','function renderPayers(){', 'id="bank-csv"','$(\'bank-csv\').onclick=bankExportCSV;', '\nrender();'];
for(const anchor of expected)if(!src.includes(anchor))throw Error('Âncora não encontrada: '+anchor);
const css=`
/* ${marker} */
.mobile-nav-toggle,.mobile-nav-backdrop,.mobile-nav-close{display:none}
@media(max-width:760px){
  .app{display:block!important;grid-template-columns:1fr!important}
  .sidebar{position:fixed!important;left:0!important;top:0!important;bottom:0!important;z-index:1202!important;width:min(88vw,310px)!important;max-width:310px!important;height:100dvh!important;transform:translateX(-106%);transition:transform .22s ease!important;overflow-y:auto!important;overflow-x:hidden!important;flex-direction:column!important;align-items:stretch!important;gap:6px!important;white-space:normal!important;padding:20px 14px 28px!important;box-shadow:18px 0 50px #0009!important;background:#0b1c32!important}
  .sidebar.mobile-visible{transform:translateX(0)!important}
  .sidebar .brand{padding:0 0 16px 0!important;margin-right:35px}
  .sidebar .brand img{width:49px!important;height:49px!important}
  .sidebar .brand b{font-size:19px!important}
  .sidebar .brand small,.sidebar .sidebar-kicker,.sidebar .side-foot{display:block!important}
  .sidebar #nav{display:flex!important;flex-direction:column!important;align-items:stretch!important;width:100%!important;gap:3px!important;flex:0 0 auto!important}
  .sidebar .navbtn{width:100%!important;min-height:46px;justify-content:flex-start!important;text-align:left!important;font-size:14px!important;padding:12px 13px!important;white-space:normal!important}
  .sidebar .navbtn .count{display:inline-block!important}
  .sidebar .sheet-shortcut{display:block!important;white-space:normal!important;margin-top:9px!important}
  .mobile-nav-toggle{display:flex!important;align-items:center;justify-content:center;position:fixed;left:13px;top:max(14px, env(safe-area-inset-top));z-index:1200;height:45px;width:45px;padding:9px;color:#eaf7ff;border:1px solid #3670a6;background:#112e4a;border-radius:12px;box-shadow:0 10px 22px #0008;cursor:pointer}
  .mobile-nav-toggle svg,.mobile-nav-close svg{width:23px;height:23px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round}
  .mobile-nav-backdrop{position:fixed;inset:0;background:#010817bd;z-index:1201;display:none}
  .mobile-nav-backdrop.mobile-visible{display:block}
  .mobile-nav-close{display:flex;position:absolute;top:18px;right:13px;align-items:center;justify-content:center;width:36px;height:36px;background:#172e49;color:white;border:1px solid #385e7d;border-radius:10px}
  .workspace{padding-top:78px!important}
  body.mobile-nav-locked{overflow:hidden}
}
@media(min-width:761px){.sidebar{transform:none!important}}
@media(prefers-reduced-motion:reduce){.sidebar{transition:none!important}}
`;
replaceOnce('</style>',css+'</style>');
const navControls=`<button class="mobile-nav-toggle" id="mobile-nav-toggle" type="button" aria-expanded="false" aria-controls="nav" aria-label="Abrir menu lateral"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button><div class="mobile-nav-backdrop" id="mobile-nav-backdrop" aria-hidden="true"></div>`;
replaceOnce('<aside class="sidebar">',navControls+'<aside class="sidebar" id="mobile-sidebar">');
replaceOnce('<div class="sidebar-kicker">Painel de controle</div>',`<button id="mobile-nav-close" class="mobile-nav-close" type="button" aria-label="Fechar menu lateral"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19"/></svg></button><div class="sidebar-kicker">Painel de controle</div>`);
replaceOnce('function chooseTab(t){tab=t;', 'function chooseTab(t){closeMobileNav();tab=t;');
replaceOnce('<button class="button secondary" id="bank-csv">Exportar CSV</button>',`4{SERVER.user.role==='main_admin'?'<button class="button secondary" id="bank-import">Importar extratos</button>':''}<button class="button secondary" id="bank-csv">Exportar CSV</button>`.replace('\u00024','$'));
replaceOnce("$('bank-csv').onclick=bankExportCSV;", "$('bank-import')?.addEventListener('click',openBankImport);$('bank-csv').onclick=bankExportCSV;");
const functions=`
function closeMobileNav(){
 const aside=$('mobile-sidebar'),toggle=$('mobile-nav-toggle'),backdrop=$('mobile-nav-backdrop');
 aside.classList.remove('mobile-visible');backdrop.classList.remove('mobile-visible');
 toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Abrir menu lateral');
 document.body.classList.remove('mobile-nav-locked');
 if(window.matchMedia('(max-width: 760px)').matches)aside.inert=true;
}
function openMobileNav(){
 const aside=$('mobile-sidebar'),toggle=$('mobile-nav-toggle'),backdrop=$('mobile-nav-backdrop');
 aside.inert=false;aside.classList.add('mobile-visible');backdrop.classList.add('mobile-visible');
 toggle.setAttribute('aria-expanded','true');toggle.setAttribute('aria-label','Menu lateral aberto');
 document.body.classList.add('mobile-nav-locked');
 aside.querySelector('.navbtn.active')?.focus();
}
function initializeMobileNav(){
 const btn=$('mobile-nav-toggle');
 btn.onclick=()=>($('mobile-sidebar').classList.contains('mobile-visible')?closeMobileNav():openMobileNav());
 $('mobile-nav-close').onclick=()=>{closeMobileNav();btn.focus()};
 $('mobile-nav-backdrop').onclick=()=>{closeMobileNav();btn.focus()};
 document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&$('mobile-sidebar').classList.contains('mobile-visible')){closeMobileNav();btn.focus()}});
 const match=window.matchMedia('(max-width: 760px)');
 const sync=()=>{if(!match.matches){closeMobileNav();$('mobile-sidebar').inert=false}else if(!$('mobile-sidebar').classList.contains('mobile-visible'))$('mobile-sidebar').inert=true};
 match.addEventListener('change',sync);sync();
}
async function openBankImport(){
 if(SERVER.user.role!=='main_admin'){toast('Somente o administrador principal pode importar extratos.',true);return}
 let payload=null,version=null,hasConflicts=false;
 $('modals').innerHTML=\`<div class="modal-overlay" id="payer-import-modal"><section role="dialog" aria-modal="true" aria-labelledby="payer-import-title" class="modal-dialog" style="max-width:650px"><div class="modal-head"><div><h2 id="payer-import-title">Importar extratos e pagantes</h2><p>Dados privados dos extratos Mercado Pago 06–10/2026. Importação só depois da prévia.</p></div><button type="button" class="iconbutton" id="payer-import-close" aria-label="Fechar">✕</button></div><div class="modal-body"><p class="notice">Selecione <b>AlfaTec_Extratos_Pagantes_PRIVADO.json</b>. O arquivo será enviado somente ao servidor autenticado. IDs já presentes não serão duplicados; vínculos e rateios anteriores serão preservados.</p><label class="form-field">Arquivo JSON privado<input type="file" id="payer-import-file" accept=".json,application/json"></label><div id="payer-import-result" aria-live="polite" class="notice">Escolha o arquivo para verificar os registros.</div></div><div class="modal-actions"><button type="button" class="button secondary" id="payer-import-cancel">Cancelar</button><button type="button" class="button primary" id="payer-import-apply" disabled>Confirmar importação</button></div></section></div>\`;
 const status=$('payer-import-result'),confirmBtn=$('payer-import-apply'),fileInput=$('payer-import-file');
 function close(){ $('modals').replaceChildren() }
 $('payer-import-close').onclick=$('payer-import-cancel').onclick=close;
 async function callImport(mode){
   const response=await fetch('/api/payers-import',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,data:payload,version})});
   const data=await response.json().catch(()=>({}));
   if(response.status===401){throw Error('Sessão expirada. Entre novamente para importar os extratos.')}
   if(!response.ok)throw Error(data.error||'Falha ao comunicar com o banco de dados');
   return data;
 }
 fileInput.onchange=async()=>{
   confirmBtn.disabled=true;payload=null;version=null;const file=fileInput.files?.[0];if(!file)return;
   try{
     if(file.size>1200000)throw Error('Arquivo acima do limite de 1,2 MB.');
     const data=JSON.parse(await file.text());
     if(!Array.isArray(data.payers)||!Array.isArray(data.payTransactions))throw Error('Este arquivo não contém pagantes e operações Pix.');
     payload={payers:data.payers,payTransactions:data.payTransactions};
     status.textContent='Conferindo extratos com o servidor…';
     const result=await callImport('preview'),s=result.summary;version=result.version;
     hasConflicts=Boolean(s.conflicts);
     status.textContent=\`\u0024{s.sourceCount} extratos • \u0024{s.newPayers} pagantes novos • \u0024{s.matchedPayers} pagantes encontrados • \u0024{s.newTransactions} operações novas • \u0024{s.duplicates} operações já existentes • \u0024{s.conflicts} conflitos. Recebimentos Pix elegíveis no arquivo: \u0024{fmt(s.eligibleAmount)} (\u0024{s.eligibleCount} operações).\u0024{hasConflicts?' Há divergências de IDs: confira antes de importar.':''}\`;
     confirmBtn.disabled=hasConflicts || s.newTransactions===0&&s.newPayers===0;
   }catch(error){status.textContent='Não foi possível validar a importação: '+error.message;confirmBtn.disabled=true}
 };
 confirmBtn.onclick=async()=>{
   if(!payload||version===null||hasConflicts)return;
   confirmBtn.disabled=true;status.textContent='Gravando operações no banco de dados e registrando auditoria…';
   try{const res=await callImport('apply');status.textContent='Importação salva ('+res.summary.newTransactions+' novas operações). Abrindo painel atualizado…';setTimeout(()=>location.reload(),500)}catch(e){status.textContent='Importação não concluída: '+e.message;confirmBtn.disabled=false}
 };
}
initializeMobileNav();
`;
replaceOnce('\nrender();','\n'+functions+'\nrender();');
fs.writeFileSync(path,src,'utf8');console.log('Interface Pagantes + menu lateral aplicada:',src.length,'caracteres');
