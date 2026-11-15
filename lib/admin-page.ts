import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {currentUser,isAdmin} from './server';
import {adminTotpKey,totpDB} from './admin-2fa-server';
import {twoFactorStatus} from './admin-totp';
export const ADMIN_SECURITY_PATH='/yonetim/guvenlik';
// 2FA is mandatory once ADMIN_TOTP_KEY is set: an administrator who has not enrolled yet is sent to
// the enrolment page, which is the only admin page it can open until enrolment is confirmed.
export async function adminPageUser(next='/yonetim'){
 const user=await currentUser(new Request('https://admin.internal/',{headers:await headers()}));
 if(user?.email_verified&&isAdmin(user))return user;
 if(user?.email_verified&&user.admin_2fa_pending&&isAdmin({...user,admin_2fa_pending:false})&&adminTotpKey()){
  const enrolled=await twoFactorStatus(totpDB(),String(user.id)).then(status=>status.enabled,()=>true);
  if(!enrolled){if(next===ADMIN_SECURITY_PATH)return user;redirect(ADMIN_SECURITY_PATH);}
 }
 redirect('/yonetim/giris?next='+encodeURIComponent(next));
}
