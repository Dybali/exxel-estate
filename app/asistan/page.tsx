import {EstateAssistant} from '@/components/EstateAssistant';
import {requestLocale} from '@/lib/request-context';
import {seoCopy} from '@/lib/seo-copy';
// The chat itself has no page heading; search engines and screen readers get the page name.
export default async function AssistantPage(){const locale=await requestLocale();return <><h1 className="sr-only">{seoCopy['/asistan'][locale][0].split(' | ')[0]}</h1><EstateAssistant/></>;}
