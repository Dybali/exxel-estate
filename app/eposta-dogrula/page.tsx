import {EmailRecovery} from '@/components/EmailRecovery';
// Localized title and noindex come from the root layout (privatePageCopy in lib/seo-copy.ts).
export const metadata={robots:{index:false,follow:false}};
export default async function VerifyEmail({searchParams}:{searchParams:Promise<{sent?:string}>}){const query=await searchParams;return <EmailRecovery verification initialCode={query.sent==='1'}/>;}
