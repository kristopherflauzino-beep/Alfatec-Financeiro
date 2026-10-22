// Executar a partir da raiz do repositório: node tools/add-password-eye.cjs
// Aplica somente um acréscimo no HTML; mantém as rotas e as funções existentes.
const fs=require('node:fs');
const path=require('node:path');
const files=['public/index.html','public/admin.html'];
const marker='ALFATEC_PASSWORD_EYE_V1';
const css=`
/* ${marker} */
.password-eye-field{position:relative;display:block;width:100%;min-width:0}
.password-eye-field>input{width:100%;padding-right:52px!important}
.password-eye-toggle{position:absolute!important;right:7px;top:50%;transform:translateY(-50%);z-index:2;display:flex!important;align-items:center;justify-content:center;flex:0 0 auto;width:39px!important;height:39px!important;min-width:39px!important;margin:0!important;padding:0!important;border:0!important;border-radius:8px!important;background:transparent!important;box-shadow:none!important;color:#a9c6e7!important;cursor:pointer}
.password-eye-toggle:hover{background:rgba(115,163,208,.15)!important;color:white!important}
.password-eye-toggle:focus-visible{outline:2px solid #66d0ff!important;outline-offset:2px}
.password-eye-toggle svg{width:21px;height:21px;display:block;pointer-events:none}
`;
const script=`
<!-- ${marker} -->
<script>
(()=>{
  'use strict';
  const eyeOpen='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const eyeClosed='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.7 5.1c.4-.07.83-.1 1.3-.1 6.5 0 10 7 10 7a16.2 16.2 0 0 1-3 3.8M6.1 6.1A16.7 16.7 0 0 0 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.8-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18"/></svg>';
  for(const input of document.querySelectorAll('input[type="password"]')){
    if(input.closest('.password-eye-field'))continue;
    const box=document.createElement('span');
    box.className='password-eye-field';
    input.parentNode.insertBefore(box,input);
    box.append(input);
    const toggle=document.createElement('button');
    toggle.type='button';
    toggle.className='password-eye-toggle';
    toggle.setAttribute('aria-label','Mostrar senha');
    toggle.setAttribute('title','Mostrar senha');
    toggle.setAttribute('aria-pressed','false');
    toggle.innerHTML=eyeOpen;
    toggle.addEventListener('click',()=>{
      const reveal=input.type==='password';
      input.type=reveal?'text':'password';
      toggle.setAttribute('aria-label',reveal?'Ocultar senha':'Mostrar senha');
      toggle.setAttribute('title',reveal?'Ocultar senha':'Mostrar senha');
      toggle.setAttribute('aria-pressed',String(reveal));
      toggle.innerHTML=reveal?eyeClosed:eyeOpen;
      input.focus({preventScroll:true});
    });
    box.append(toggle);
  }
})();
</script>
`;
let patched=0;
for(const relative of files){
  const dest=path.resolve(process.cwd(),relative);
  if(!fs.existsSync(dest))throw new Error('Arquivo não encontrado: '+dest+'\nExecute o comando na pasta Alfatec-Financeiro.');
  let html=fs.readFileSync(dest,'utf8');
  if(html.includes(marker)){
    console.log('Já possui botão de olho: '+relative);
    continue;
  }
  if(!html.includes('</style>') || !html.includes('</body>'))throw new Error('Estrutura HTML inesperada em '+relative);
  html=html.replace('</style>',css+'</style>');
  html=html.replace('</body>',script+'</body>');
  fs.writeFileSync(dest,html,'utf8');
  patched++;
  console.log('Ícones de visualizar senha instalados: '+relative);
}
console.log('Arquivos atualizados: '+patched+'. Nenhum dado financeiro foi modificado.');
