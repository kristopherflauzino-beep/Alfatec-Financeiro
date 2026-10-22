import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const login=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const signup=readFileSync(new URL('../public/cadastro.html',import.meta.url),'utf8');
test('login apresenta link para tela separada de cadastro',()=>{
  assert.match(login,/href="\/cadastro\.html"[^>]*>Criar usuário<\/a>/);
  assert.doesNotMatch(login,/id="register-form"/);
  assert.doesNotMatch(login,/create-toggle/);
  assert.match(login,/id="form"/);
  assert.match(login,/ALFATEC_PASSWORD_EYE_V1/);
});
test('cadastro oferece retorno ao login e mantém validações',()=>{
  assert.match(signup,/<title>AlfaTec Financeiro \| Criar usuário<\/title>/);
  assert.match(signup,/href="\/"[^>]*>← Voltar para o login<\/a>/);
  assert.match(signup,/id="register-form"/);
  assert.match(signup,/minlength="6"/);
  assert.match(signup,/id="rp"[^>]*type="password"/);
  assert.match(signup,/id="rc"[^>]*type="password"/);
  assert.match(signup,/fetch\('\/api\/register'/);
  assert.match(signup,/aprovação do administrador principal/);
});
test('olho de senha funciona no login e cadastro, sem enviar formulário',()=>{
  for(const html of [login,signup]){
    assert.match(html,/password-eye-field/);
    assert.match(html,/toggle\.type='button'/);
    assert.match(html,/input\.type=reveal\?'text':'password'/);
    assert.match(html,/Mostrar senha/);
    assert.match(html,/Ocultar senha/);
  }
});
