'use client';
import {usePathname} from 'next/navigation';
import {Header} from './Header';import {Footer} from './Footer';
import {WhatsAppPrompt} from './WhatsAppPrompt';import {CompareTray} from './Compare';import {AssistantLauncher} from './AssistantLauncher';
import {siteChrome} from '@/lib/site-chrome';
// Admin and service pages render their own frame from their layout (lib/site-chrome.ts).
export function SiteFrame({children}:{children:React.ReactNode}){const path=usePathname();if(siteChrome(path)!=='main')return <>{children}</>;return <><Header/><WhatsAppPrompt/>{children}<CompareTray/><AssistantLauncher/><Footer/></>;}
