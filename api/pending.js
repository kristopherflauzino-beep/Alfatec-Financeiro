import {requireUser,response,withError} from '../lib/auth.js';
import {sqlClient} from '../lib/db.js';
export default async function handler(req,res){
  if(req.method!=='GET')return response(res,405,{error:'Método não permitido'});
  try{
    const admin=await requireUser(req,res,['main_admin']);if(!admin)return;
    const sql=sqlClient();
    const pending=await sql`SELECT id,username,display_name,created_at FROM app_users WHERE is_active=false AND approval_status='pending' ORDER BY created_at ASC LIMIT 100`;
    return response(res,200,{count:pending.length,pending});
  }catch(err){withError(res,err)}
}
