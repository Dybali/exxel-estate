'use client';
import {usePathname} from 'next/navigation';
import {Header} from './Header';import {Footer} from './Footer';
import {WhatsAppPrompt} from './WhatsAppPrompt';import {CompareTray} from './Compare';import {AssistantLauncher} from './AssistantLauncher';
export function SiteFrame({children}:{children:React.ReactNode}){const path=usePathname();if(path==='/yonetim'||path.startsWith('/yonetim/'))return <>{children}</>;return <><Header/><WhatsAppPrompt/>{children}<CompareTray/><AssistantLauncher/><Footer/></>;}
