import {requireUser,requireMethod,checkWrite,bodyJSON,response,withError} from '../lib/auth.js';
import {getDocument,sqlClient} from '../lib/db.js';
import {validateState,diffState} from '../lib/audit.js';
export default async function handler(req,res){
 try{
  const role=req.method==='PUT'?['main_admin','editor']:[];
  const user=await requireUser(req,res,role);if(!user)return;
  if(req.method==='GET'){const doc=await getDocument();return response(res,200,doc)}
  if(req.method!=='PUT')return response(res,405,{error:'Método não permitido'});
  if(!checkWrite(req))return response(res,403,{error:'Origem não autorizada'});
  const body=await bodyJSON(req);
  if(!Number.isInteger(body.version)||body.version<0)return response(res,400,{error:'Versão inválida'});
  const data=validateState(body.data);const doc=await getDocument();
  if(doc.version!==body.version)return response(res,409,{error:'Versão desatualizada. Recarregue os dados.'});
  const before=doc.state,edits=diffState(before,body.data);
  if(!edits.length)return response(res,200,{version:doc.version,changed:0});
  const sql=sqlClient();
  const rows=await sql`WITH updated AS (
    UPDATE app_document SET state=${data}::jsonb,version=version+1,updated_at=now()
    WHERE id='main' AND version=${body.version} RETURNING version
  ), logged AS (
    INSERT INTO app_audit(user_id,username,action,changes)
    SELECT ${user.id},${user.username},'DADOS_ALTERADOS',${JSON.stringify(edits)}::jsonb FROM updated
    RETURNING id
  ) SELECT version FROM updated`;
  if(!rows.length)return response(res,409,{error:'Outra edição ocorreu antes da sua. Recarregue.'});
  return response(res,200,{version:rows[0].version,changed:edits.length});
 }catch(err){if(['Dados inválidos','Estrutura inválida','Limite excedido','Aluno inválido','Valor de mensalidade inválido','Transação inválida','Tamanho acima do permitido','Requisição muito grande'].includes(err.message))return response(res,400,{error:err.message});withError(res,err)}
}
