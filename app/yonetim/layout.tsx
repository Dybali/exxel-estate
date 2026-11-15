import {AdminShell} from '@/components/AdminShell';
// No administration page is ever indexed (the root layout adds the title, app/robots.ts disallows /yonetim).
export const metadata={robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <AdminShell>{children}</AdminShell>;}
