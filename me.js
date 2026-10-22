import {requireMethod,requireUser,response,withError} from '../lib/auth.js';
export default async function handler(req,res){
 if(!requireMethod(req,res,'GET'))return;
 try{const user=await requireUser(req,res);if(user)response(res,200,{user});}catch(err){withError(res,err)}
}
