export type CompanyCategory='agency'|'developer';
export function companyCategory(value:unknown):CompanyCategory{
  if(value===undefined||value===null||value==='')return 'agency';
  if(value==='agency'||value==='developer')return value;
  throw Error('Geçerli bir şirket türü seçin.');
}
export function companyWebsite(value:unknown){
  if(!value)return '';
  if(typeof value!=='string'||value.length>300)throw Error('Geçerli bir HTTPS site adresi girin.');
  try{const url=new URL(value.trim());if(url.protocol!=='https:'||url.username||url.password)throw Error();return url.href;}catch{throw Error('Geçerli bir HTTPS site adresi girin.');}
}
export const COMPANY_PROFILE_SCHEMA=`CREATE TABLE IF NOT EXISTS company_profiles(user_id TEXT PRIMARY KEY,city TEXT NOT NULL,website TEXT NOT NULL DEFAULT '',address TEXT NOT NULL DEFAULT '',description TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL)`;
