import {login,requireMethod,checkWrite,bodyJSON,response,withError} from '../lib/auth.js';
export default async function handler(req,res){
  if(!requireMethod(req,res,'POST'))return;
  if(!checkWrite(req))return response(res,403,{error:'Origem não autorizada'});
  try{
    const {username,password}=await bodyJSON(req,8192);
    if(typeof username!=='string'||typeof password!=='string'||username.length>70||password.length>256)return response(res,400,{error:'Login inválido'});
    const user=await login(username,password,res);
    if(!user)return response(res,401,{error:'Credenciais inválidas ou acesso temporariamente bloqueado'});
    return response(res,200,{user});
  }catch(err){withError(res,err)}
}
