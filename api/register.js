import {randomUUID,createHash} from 'node:crypto';
import {checkWrite,requireMethod,bodyJSON,response,withError} from '../lib/auth.js';
import {sqlClient,setup,hashPassword} from '../lib/db.js';
import {validateRegistration} from '../lib/registration.js';
export default async function handler(req,res){
  if(!requireMethod(req,res,'POST'))return;
  if(!checkWrite(req))return response(res,403,{error:'Origem não autorizada'});
  try{
    const b=await bodyJSON(req,8192);
    const {username,displayName,password}=validateRegistration(b);
    await setup();
    const sql=sqlClient();
    // Limita solicitações por origem sem publicar ou gravar o IP em claro.
    const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'sem-ip').split(',')[0].trim();
    const key=createHash('sha256').update(ip).digest('hex');
    const limits=await sql`INSERT INTO app_signup_limits(key,window_start,attempts)
      VALUES (${key},now(),1)
      ON CONFLICT(key) DO UPDATE SET
        attempts=CASE WHEN app_signup_limits.window_start < now()-INTERVAL '1 hour' THEN 1 ELSE app_signup_limits.attempts+1 END,
        window_start=CASE WHEN app_signup_limits.window_start < now()-INTERVAL '1 hour' THEN now() ELSE app_signup_limits.window_start END
      RETURNING attempts`;
    if(limits[0].attempts>5)return response(res,429,{error:'Muitas solicitações. Tente novamente mais tarde.'});
    const id=randomUUID(),hash=hashPassword(password);
    const inserted=await sql`WITH created AS (
      INSERT INTO app_users(id,username,display_name,password_hash,role,is_active)
      VALUES (${id},${username},${displayName},${hash},'viewer',false)
      ON CONFLICT(username) DO NOTHING RETURNING id,username
    ), logged AS (
      INSERT INTO app_audit(user_id,username,action,changes)
      SELECT id,username,'CADASTRO_SOLICITADO','[]'::jsonb FROM created RETURNING id
    ) SELECT id FROM created`;
    // Mensagem neutra impede verificação pública de nomes cadastrados.
    return response(res,202,{message:'Solicitação recebida. O administrador principal deve aprovar sua conta antes do acesso.'});
  }catch(err){
    if(/Usuário deve|Informe seu nome|senha deve|senhas digitadas|Requisição muito grande/.test(String(err.message)))return response(res,400,{error:err.message});
    return withError(res,err);
  }
}
