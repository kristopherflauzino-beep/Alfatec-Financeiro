import { neon } from '@neondatabase/serverless';
import { randomBytes, scryptSync } from 'node:crypto';

let client;
export function sqlClient(){
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada');
  return client ||= neon(process.env.DATABASE_URL);
}
export function hashPassword(plain, salt=randomBytes(16).toString('hex'), minLength=12){
  if (typeof plain !== 'string' || plain.length < minLength || plain.length > 256) throw new Error('Senha fora do tamanho permitido');
  return 'scrypt:'+salt+':'+scryptSync(plain,salt,64).toString('hex');
}
let readyPromise;
export async function setup(){
  if (readyPromise) return readyPromise;
  readyPromise = (async()=>{
    const sql=sqlClient();
    await sql`CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('main_admin','editor','viewer')),
      is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS app_sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES app_users(id),
      expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS app_document (
      id TEXT PRIMARY KEY, state JSONB NOT NULL, version INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS app_audit (
      id BIGSERIAL PRIMARY KEY, user_id TEXT, username TEXT NOT NULL,
      action TEXT NOT NULL, changes JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS app_auth_attempts (
      username TEXT PRIMARY KEY, failures INTEGER NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ, modified_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    const present=await sql`SELECT id FROM app_users WHERE role='main_admin' LIMIT 1`;
    if (!present.length){
      const secret=process.env.ADMIN_PASSWORD;
      if (!secret) throw new Error('ADMIN_PASSWORD obrigatória para criar o primeiro usuário');
      const hash=hashPassword(secret,undefined,8);
      await sql`INSERT INTO app_users(id,username,display_name,password_hash,role)
        VALUES ('admin-kristopher','kristopher','Kristopher',${hash},'main_admin')
        ON CONFLICT (id) DO NOTHING`;
      await sql`INSERT INTO app_audit(user_id,username,action,changes)
        VALUES ('admin-kristopher','kristopher','ADMIN_CRIADO','[]'::jsonb)`;
    }
    return true;
  })().catch(err=>{readyPromise=undefined;throw err});
  return readyPromise;
}
export function initialState(){return {schema:2,settings:{monthlyFee:135,repassePercent:50},months:[
  {id:'2026-05',label:'Maio',year:2026},{id:'2026-06',label:'Junho',year:2026},
  {id:'2026-07',label:'Julho',year:2026},{id:'2026-08',label:'Agosto',year:2026},
  {id:'2026-09',label:'Setembro',year:2026},{id:'2026-10',label:'Outubro',year:2026}
],students:[],payers:[],payTransactions:[],bankAllocations:[]};}
export async function getDocument(){
  await setup();
  const sql=sqlClient();
  await sql`INSERT INTO app_document(id,state,version) VALUES ('main',${JSON.stringify(initialState())}::jsonb,0) ON CONFLICT DO NOTHING`;
  const rows=await sql`SELECT state,version FROM app_document WHERE id='main'`;
  return rows[0];
}
