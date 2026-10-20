import {EmailRecovery} from '@/components/EmailRecovery';
export const metadata={title:'E-posta Doğrulama | estatemarket24',robots:{index:false,follow:false}};
export default async function VerifyEmail({searchParams}:{searchParams:Promise<{sent?:string}>}){const query=await searchParams;return <EmailRecovery verification initialCode={query.sent==='1'}/>;}
