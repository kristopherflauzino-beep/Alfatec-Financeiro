import {requireUser,checkWrite,bodyJSON,response,withError} from '../lib/auth.js';
import {getDocument,sqlClient} from '../lib/db.js';
import {validateState,diffState} from '../lib/audit.js';
import {mergeSheet} from '../lib/sheet-import.js';
import {loadOnlineSheet} from '../lib/google-sheets.js';
export default async function handler(req,res){
  try{
    const user=await requireUser(req,res,['main_admin']);if(!user)return;
    if(req.method!=='POST')return response(res,405,{error:'Método não permitido'});
    if(!checkWrite(req))return response(res,403,{error:'Origem não autorizada'});
    const body=await bodyJSON(req,500000);
    if(!['preview','apply'].includes(body.mode))return response(res,400,{error:'Modo desconhecido'});
    const snapshot=body.snapshot??await loadOnlineSheet();
    const doc=await getDocument(),overwrite=body.overwrite===true;
    const {state,summary,conflicts}=mergeSheet(doc.state,snapshot,{overwrite});
    if(body.mode==='preview')return response(res,200,{version:doc.version,summary,conflicts:conflicts.slice(0,100),snapshot});
    if(!Number.isInteger(body.version)||body.version!==doc.version)return response(res,409,{error:'Os dados mudaram. Gere uma nova prévia antes de importar.'});
    const json=validateState(state),edits=diffState(doc.state,state);
    if(!edits.length)return response(res,200,{version:doc.version,summary,changed:0});
    const sql=sqlClient(),log={summary,details:edits};
    const result=await sql`WITH updated AS (
      UPDATE app_document SET state=${json}::jsonb,version=version+1,updated_at=now()
      WHERE id='main' AND version=${doc.version} RETURNING version
    ), logged AS (
      INSERT INTO app_audit(user_id,username,action,changes)
      SELECT ${user.id},${user.username},'PLANILHA_IMPORTADA',${JSON.stringify([log])}::jsonb
      FROM updated RETURNING id
    ) SELECT version FROM updated`;
    if(!result.length)return response(res,409,{error:'Outro usuário editou os dados. Repita a conferência.'});
    return response(res,200,{version:result[0].version,summary,changed:edits.length});
  }catch(err){
    if(/planilha|Google|credencial|Aluno|Usuário|Matrícula|Mensalidade|Arquivo|Aba|Outro usuário/i.test(err?.message||''))return response(res,400,{error:err.message});
    return withError(res,err);
  }
}
