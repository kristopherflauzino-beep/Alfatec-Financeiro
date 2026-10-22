import {createSign} from 'node:crypto';
import {SHEET_ID,fromSheetRows} from './sheet-import.js';
const base64url=(obj)=>Buffer.from(JSON.stringify(obj)).toString('base64url');
let cachedToken='',validUntil=0;
async function accessToken(){
  if(cachedToken&&Date.now()<validUntil-120000)return cachedToken;
  if(!process.env.GOOGLE_SERVICE_ACCOUNT_JSON)throw Error('Google Sheets automático não configurado. Importe o arquivo JSON privado ou cadastre GOOGLE_SERVICE_ACCOUNT_JSON na Vercel.');
  let account;
  try {account=JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)}catch{throw Error('Credencial Google inválida')}
  if(!account.client_email||!account.private_key)throw Error('Credencial Google incompleta');
  const now=Math.floor(Date.now()/1000),header=base64url({alg:'RS256',typ:'JWT'}),payload=base64url({iss:account.client_email,scope:'https://www.googleapis.com/auth/spreadsheets.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  const unsigned=header+'.'+payload;
  const sign=createSign('RSA-SHA256');sign.update(unsigned);sign.end();
  const jwt=unsigned+'.'+sign.sign(account.private_key,'base64url');
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Não foi possível autenticar na API Google Sheets');
  const data=await response.json();cachedToken=data.access_token;validUntil=Date.now()+data.expires_in*1000;return cachedToken;
}
async function getRows(sheet){
  const query=encodeURIComponent(`'${sheet}'!A3:K150`);
  const url=`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(process.env.ALFATEC_SHEET_ID||SHEET_ID)}/values/${query}?valueRenderOption=UNFORMATTED_VALUE`;
  const r=await fetch(url,{headers:{Authorization:'Bearer '+await accessToken()},signal:AbortSignal.timeout(16000)});
  if(r.status===403||r.status===404)throw Error('Compartilhe a planilha com o e-mail da conta de serviço Google configurada para leitura');
  if(!r.ok)throw Error('Erro ao consultar a planilha Google');
  return (await r.json()).values||[];
}
export async function loadOnlineSheet(){
  const rows=await Promise.all([getRows('1º ao 5º'),getRows('6º ao 9º')]);
  return fromSheetRows(...rows);
}
