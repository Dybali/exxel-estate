import {EmailRecovery} from '@/components/EmailRecovery';
// Localized title and noindex come from the root layout (privatePageCopy in lib/seo-copy.ts).
export const metadata={robots:{index:false,follow:false}};
export default function ForgotPassword(){return <EmailRecovery/>;}
