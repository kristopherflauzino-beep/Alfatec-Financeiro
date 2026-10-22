import {createHash, randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';
import {setup,sqlClient} from './db.js';
const COOKIE='alfatec_session';
const TTL=12*60*60;
function digest(s){return createHash('sha256').update(s).digest('hex')}
function parseCookies(raw='') {return Object.fromEntries(raw.split(';').map(p=>{let i=p.indexOf('=');return i<0?['','']:[p.slice(0,i).trim(),p.slice(i+1).trim()]}))}
export function noStore(res){res.setHeader('Cache-Control','no-store, private, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');}
export function response(res,code,obj){noStore(res);res.status(code).setHeader('Content-Type','application/json; charset=utf-8').end(JSON.stringify(obj));}
export function checkWrite(req){
  if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) return true;
  const origin=req.headers.origin,host=req.headers['x-forwarded-host']||req.headers.host;
  if (!origin || !host) return false;
  try {const o=new URL(origin);return o.host===host && (o.protocol==='https:' || (o.protocol==='http:' && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)));}catch{return false}
}
export function requireMethod(req,res,method){if(req.method!==method){response(res,405,{error:'Método não permitido'});return false}return true}
export async function bodyJSON(req,limit=2_500_000){
  if (!(req.headers['content-type']||'').includes('application/json'))throw new Error('Use application/json');
  const body=req.body;
  if(body && typeof body==='object'){
    if(JSON.stringify(body).length>limit)throw new Error('Requisição muito grande');
    return body;
  }
  let raw='';for await(const chunk of req){raw+=chunk.toString();if(raw.length>limit)throw new Error('Requisição muito grande')}
  return JSON.parse(raw||'{}');
}
export async function getUser(req){
  await setup();
  const token=parseCookies(req.headers.cookie||'')[COOKIE];
  if(!token || !/^[a-f0-9]{64}$/.test(token))return null;
  const sql=sqlClient();
  const found=await sql`SELECT u.id,u.username,u.display_name,u.role
    FROM app_sessions s JOIN app_users u ON s.user_id=u.id
    WHERE s.token_hash=${digest(token)} AND s.expires_at>now() AND u.is_active=true LIMIT 1`;
  return found[0]||null;
}
export async function requireUser(req,res,roles=[]){
  const user=await getUser(req);
  if(!user){response(res,401,{error:'Autenticação necessária'});return null}
  if(roles.length && !roles.includes(user.role)){response(res,403,{error:'Sem permissão'});return null}
  return user;
}
export function safeVerify(password,hash){
  const sample='scrypt:00000000000000000000000000000000:'+('a'.repeat(128));
  const parts=(hash||sample).split(':');
  if(parts.length!==3||parts[0]!=='scrypt')return false;
  const actual=Buffer.from(parts[2],'hex');if(actual.length!==64)return false;
  const computed=scryptSync(String(password).slice(0,256),parts[1],64);
  return timingSafeEqual(actual,computed);
}
export async function login(username,password,res){
  await setup();const sql=sqlClient(); const normalized=String(username||'').trim().toLowerCase();
  const locked=await sql`SELECT locked_until FROM app_auth_attempts WHERE username=${normalized}`;
  if(locked[0]?.locked_until && new Date(locked[0].locked_until)>new Date())return false;
  const rows=await sql`SELECT id,username,display_name,role,password_hash FROM app_users WHERE username=${normalized} AND is_active=true LIMIT 1`;
  const u=rows[0],valid=safeVerify(password,u?.password_hash);
  if(!u||!valid){
    await sql`INSERT INTO app_auth_attempts(username,failures,locked_until)
      VALUES (${normalized},1,NULL)
      ON CONFLICT(username) DO UPDATE SET failures=app_auth_attempts.failures+1,
        locked_until=CASE WHEN app_auth_attempts.failures+1>=6 THEN now()+INTERVAL '15 minutes' ELSE NULL END, modified_at=now()`;
    return false;
  }
  await sql`DELETE FROM app_auth_attempts WHERE username=${normalized}`;
  const token=randomBytes(32).toString('hex'), token_hash=digest(token);
  await sql`INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES (${token_hash},${u.id},now()+INTERVAL '12 hours')`;
  await sql`INSERT INTO app_audit(user_id,username,action,changes) VALUES (${u.id},${u.username},'LOGIN','[]'::jsonb)`;
  res.setHeader('Set-Cookie',`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL}`);
  return {id:u.id,username:u.username,display_name:u.display_name,role:u.role};
}
export async function logout(req,res,user){
  const token=parseCookies(req.headers.cookie||'')[COOKIE];const sql=sqlClient();
  if(token){await sql`DELETE FROM app_sessions WHERE token_hash=${digest(token)}`;}
  if(user){await sql`INSERT INTO app_audit(user_id,username,action,changes) VALUES (${user.id},${user.username},'LOGOUT','[]'::jsonb)`;}
  res.setHeader('Set-Cookie',`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}
export function withError(res,err){
  console.error('AlfaTec server error',err?.message);
  if (!process.env.DATABASE_URL) return response(res,503,{error:'Serviço ainda não configurado. Administrador: configure o banco PostgreSQL (DATABASE_URL) na Vercel.'});
  if (/ADMIN_PASSWORD obrigatória/.test(String(err?.message))) return response(res,503,{error:'Administrador ainda não configurado. Defina ADMIN_PASSWORD nas variáveis de ambiente da Vercel.'});
  return response(res,503,{error:'Serviço temporariamente indisponível. Contate o administrador.'});
}
