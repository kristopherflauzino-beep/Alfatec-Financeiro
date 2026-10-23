import {requireUser,checkWrite,bodyJSON,response,withError} from '../lib/auth.js';
import {getDocument,sqlClient} from '../lib/db.js';
import {mergeBankImport} from '../lib/payer-import.js';
import {validateState,diffState} from '../lib/audit.js';

export default async function handler(req,res){
  try{
    const user=await requireUser(req,res,['main_admin']);if(!user)return;
    if(req.method!=='POST')return response(res,405,{error:'Método não permitido'});
    if(!checkWrite(req))return response(res,403,{error:'Origem não autorizada'});
    const body=await bodyJSON(req,1600000);
    if(!['preview','apply'].includes(body.mode))return response(res,400,{error:'Modo inválido'});
    const doc=await getDocument();
    const {state,conflicts,summary}=mergeBankImport(doc.state,body.data);
    if(body.mode==='preview')return response(res,200,{version:doc.version,summary,conflicts:conflicts.slice(0,30)});
    if(!Number.isInteger(body.version)||body.version!==doc.version)return response(res,409,{error:'Os dados mudaram. Refaça a prévia da importação.'});
    if(conflicts.length)return response(res,409,{error:'Existem IDs divergentes. Confira os conflitos antes de importar.',conflicts:conflicts.slice(0,30)});
    const json=validateState(state),edits=diffState(doc.state,state);
    if(!edits.length)return response(res,200,{version:doc.version,summary,changed:0});
    const sql=sqlClient();
    const audit={resumo:summary,alteracoes:edits};
    const rows=await sql`WITH updated AS (
      UPDATE app_document SET state=${json}::jsonb,version=version+1,updated_at=now()
      WHERE id='main' AND version=${body.version} RETURNING version
    ), logged AS (
      INSERT INTO app_audit(user_id,username,action,changes)
      SELECT ${user.id},${user.username},'EXTRATOS_IMPORTADOS',${JSON.stringify(audit)}::jsonb FROM updated
      RETURNING id
    ) SELECT version FROM updated`;
    if(!rows.length)return response(res,409,{error:'Outra alteração ocorreu. Refaça a prévia.'});
    return response(res,200,{version:rows[0].version,summary,changed:edits.length});
  }catch(err){
    if(/Arquivo de pagantes|Importação acima|Arquivo de importação|Pagante com|Operação inválida|Estado do sistema|Requisição muito grande/.test(String(err?.message)))return response(res,400,{error:err.message});
    return withError(res,err);
  }
}
