export const CONSENT_COOKIE = 'em24_consent';
export const CONSENT_DAYS = 180;
export type CookieConsent = {version:1;analytics:boolean;externalMedia:boolean;updatedAt:number};
export function parseConsent(header:string,at=Date.now()):CookieConsent|null {
  try {
    const raw=header.split(';').map(part=>part.trim()).find(part=>part.startsWith(CONSENT_COOKIE+'='))?.slice(CONSENT_COOKIE.length+1);
    if(!raw)return null;
    const value=JSON.parse(decodeURIComponent(raw));
    if(value?.version!==1||typeof value.analytics!=='boolean'||typeof value.externalMedia!=='boolean'||!Number.isSafeInteger(value.updatedAt)||value.updatedAt>at+60_000||at-value.updatedAt>CONSENT_DAYS*864e5)return null;
    return {version:1,analytics:value.analytics,externalMedia:value.externalMedia,updatedAt:value.updatedAt};
  }catch{return null;}
}
export function consentCookie(value:CookieConsent){return `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Path=/; Secure; SameSite=Lax; Max-Age=${CONSENT_DAYS*86400}`;}
export const clearViewerCookie='em24_viewer=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
