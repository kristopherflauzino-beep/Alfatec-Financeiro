import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRegistration} from '../lib/registration.js';
const data={username:' Novo.User ',display_name:'Pessoa de Teste',password:'abc123',confirm_password:'abc123'};
test('aceita senha de 6 caracteres e normaliza usuário',()=>{const r=validateRegistration(data);assert.equal(r.username,'novo.user');assert.equal(r.password,'abc123')});
test('rejeita senha menor que 6 caracteres',()=>assert.throws(()=>validateRegistration({...data,password:'12345',confirm_password:'12345'}),/pelo menos 6/));
test('rejeita confirmação de senha divergente',()=>assert.throws(()=>validateRegistration({...data,confirm_password:'abc124'}),/não coincidem/));
test('rejeita usuário inválido',()=>assert.throws(()=>validateRegistration({...data,username:'X @ X'}),/Usuário deve/));
