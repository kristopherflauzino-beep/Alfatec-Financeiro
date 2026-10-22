import {randomUUID} from 'node:crypto';
import {requireUser,checkWrite,bodyJSON,response,withError,safeVerify} from '../lib/auth.js';
import {sqlClient,hashPassword} from '../lib/db.js';
const actions=new Set(['create_user','disable_user','enable_user','reset_password','change_own_password','change_role','approve_user','reject_user']);
export default async function handler(req,res){
 try{
  const user=await requireUser(req,res,['main_admin']);if(!user)return;
  const sql=sqlClient();
  if(req.method==='GET'){
    const users=await sql`SELECT id,username,display_name,role,is_active,approval_status,created_at FROM app_users ORDER BY created_at`;
    const pending=users.filter(u=>!u.is_active&&u.approval_status==='pending');
    const logs=await sql`SELECT id,username,action,changes,created_at FROM app_audit ORDER BY id DESC LIMIT 500`;
    return response(res,200,{users,logs,pending});
  }
  if(req.method!=='POST')return response(res,405,{error:'Método não permitido'});
  if(!checkWrite(req))return response(res,403,{error:'Origem não autorizada'});
  const b=await bodyJSON(req,25000);
  if(!actions.has(b.action))return response(res,400,{error:'Ação desconhecida'});
  let audit;
  if(b.action==='change_own_password'){
    const current=await sql`SELECT password_hash FROM app_users WHERE id=${user.id}`;
    if(!safeVerify(b.current_password,current[0]?.password_hash))return response(res,403,{error:'Senha atual incorreta'});
    const newHash=hashPassword(b.password);
    await sql`UPDATE app_users SET password_hash=${newHash} WHERE id=${user.id}`;
    await sql`DELETE FROM app_sessions WHERE user_id=${user.id}`;
    audit={action:'SENHA_ADMIN_ALTERADA',changes:[{campo:'usuário',novo:user.username}]};
  }else if(b.action==='create_user'){
    const username=String(b.username||'').trim().toLowerCase();
    const display=String(b.display_name||'').trim();
    const role=b.role;
    if(!/^[\p{L}\p{N}_.-]{3,40}$/u.test(username)||display.length<2||display.length>120||!['editor','viewer'].includes(role))return response(res,400,{error:'Usuário, nome ou permissão inválidos'});
    const hash=hashPassword(b.password),id=randomUUID();
    await sql`INSERT INTO app_users(id,username,display_name,password_hash,role) VALUES (${id},${username},${display},${hash},${role})`;
    audit={action:'USUARIO_CRIADO',changes:[{campo:'usuário',novo:username},{campo:'papel',novo:role}]};
  }else{
    const id=String(b.id||'');
    const matches=await sql`SELECT id,username,role,is_active,approval_status FROM app_users WHERE id=${id} LIMIT 1`;
    const target=matches[0];
    if(!target)return response(res,404,{error:'Usuário inexistente'});
    if(target.role==='main_admin')return response(res,403,{error:'Admin principal protegido. Não pode ser desativado ou alterado por essa operação.'});
    if(b.action==='approve_user'||b.action==='reject_user'){
      if(target.approval_status!=='pending')return response(res,409,{error:'A solicitação já foi tratada.'});
      const approved=b.action==='approve_user';
      const role=approved?(b.role==='editor'?'editor':'viewer'):'viewer';
      const updated=await sql`WITH applied AS (
        UPDATE app_users SET is_active=${approved},role=${role},approval_status=${approved?'approved':'rejected'}
        WHERE id=${target.id} AND approval_status='pending'
        RETURNING id,username
      ), logged AS (
        INSERT INTO app_audit(user_id,username,action,changes)
        SELECT ${user.id},${user.username},${approved?'USUARIO_APROVADO':'USUARIO_REJEITADO'},${JSON.stringify([{campo:'usuário',novo:target.username},{campo:'perfil',novo:role}])}::jsonb
        FROM applied RETURNING id
      ) SELECT id FROM applied`;
      if(!updated.length)return response(res,409,{error:'Solicitação já processada.'});
      return response(res,200,{ok:true});
    }
    if(b.action==='change_role'){
      if(!['viewer','editor'].includes(b.role))return response(res,400,{error:'Permissão inválida'});
      await sql`UPDATE app_users SET role=${b.role} WHERE id=${target.id}`;
      audit={action:'PERMISSAO_ALTERADA',changes:[{campo:'usuário',novo:target.username},{campo:'permissão',anterior:target.role,novo:b.role}]};
    }else if(b.action==='reset_password'){
      const hash=hashPassword(b.password);
      await sql`UPDATE app_users SET password_hash=${hash} WHERE id=${target.id}`;
      await sql`DELETE FROM app_sessions WHERE user_id=${target.id}`;
      audit={action:'SENHA_REDEFINIDA',changes:[{campo:'usuário',novo:target.username}]};
    }else{
      if(target.approval_status!=='approved')return response(res,409,{error:'A solicitação deve ser aprovada antes de ativar a conta.'});
      const enabled=b.action==='enable_user';
      await sql`UPDATE app_users SET is_active=${enabled} WHERE id=${target.id}`;
      if(!enabled)await sql`DELETE FROM app_sessions WHERE user_id=${target.id}`;
      audit={action:enabled?'USUARIO_ATIVADO':'USUARIO_DESATIVADO',changes:[{campo:'usuário',novo:target.username}]};
    }
  }
  await sql`INSERT INTO app_audit(user_id,username,action,changes) VALUES (${user.id},${user.username},${audit.action},${JSON.stringify(audit.changes)}::jsonb)`;
  response(res,200,{ok:true});
 }catch(err){if(/Senha fora|senha deve|duplicate key|unique constraint/i.test(err.message))return response(res,400,{error:/duplicate key|unique constraint/i.test(err.message)?'Este usuário já existe':'A senha deve ter no mínimo 6 caracteres'});withError(res,err)}
}
