import {getUser,logout,checkWrite,requireMethod,response,withError} from '../lib/auth.js';
export default async function handler(req,res){
 if(!requireMethod(req,res,'POST'))return;
 if(!checkWrite(req))return response(res,403,{error:'Origem não autorizada'});
 try{const user=await getUser(req);await logout(req,res,user);response(res,200,{ok:true})}catch(err){withError(res,err)}
}
