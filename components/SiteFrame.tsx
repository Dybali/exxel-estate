'use client';
import {usePathname} from 'next/navigation';
import {Header} from './Header';import {Footer} from './Footer';
import {WhatsAppPrompt} from './WhatsAppPrompt';import {CompareTray} from './Compare';import {AssistantLauncher} from './AssistantLauncher';import {FeedbackWidget} from './FeedbackWidget';
import {BackButton} from './BackButton';
import {siteChrome} from '@/lib/site-chrome';
// Admin and service pages render their own frame from their layout (lib/site-chrome.ts).
export function SiteFrame({children,bare=false}:{children:React.ReactNode;bare?:boolean}){const path=usePathname();if(bare||siteChrome(path)!=='main')return <>{children}</>;return <><Header/><BackButton/><WhatsAppPrompt/>{children}<CompareTray/><AssistantLauncher/><FeedbackWidget/><Footer/></>;}
