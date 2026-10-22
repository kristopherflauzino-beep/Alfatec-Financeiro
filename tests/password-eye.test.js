import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const pages=['public/index.html','public/admin.html'];
for (const page of pages){
  test(page+': olho presente e botão não envia formulários',()=>{
    const html=readFileSync(new URL('../'+page,import.meta.url),'utf8');
    assert.match(html,/ALFATEC_PASSWORD_EYE_V1/);
    assert.match(html,/password-eye-toggle/);
    assert.match(html,/toggle\.type='button'/);
    assert.match(html,/input\.type=reveal\?'text':'password'/);
    assert.match(html,/Mostrar senha/);
    assert.match(html,/Ocultar senha/);
    assert.match(html,/aria-pressed/);
  });
}
