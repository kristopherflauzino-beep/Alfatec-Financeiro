// Esta validação é compartilhada pelo cadastro público e pelos testes.
export function validateRegistration(input){
  const username=String(input?.username||'').trim().toLowerCase();
  const displayName=String(input?.display_name||'').trim();
  const password=input?.password;
  if(!/^[\p{L}\p{N}_.-]{3,40}$/u.test(username))throw Error('Usuário deve ter de 3 a 40 caracteres, sem espaços.');
  if(displayName.length<2||displayName.length>120)throw Error('Informe seu nome (2 a 120 caracteres).');
  if(typeof password!=='string'||password.length<6||password.length>256)throw Error('A senha deve ter pelo menos 6 caracteres.');
  if(password!==input?.confirm_password)throw Error('As senhas digitadas não coincidem.');
  return {username,displayName,password};
}
