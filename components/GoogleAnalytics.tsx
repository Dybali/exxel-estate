'use client';
import {Suspense,useEffect,useRef} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {useCookieConsent} from './CookieConsent';
import {gaConsentCurrent} from '@/lib/analytics-consent';

type GtagWindow=Window&{dataLayer?:unknown[];gtag?:(...args:unknown[])=>void}&Record<string,unknown>;
const w=()=>window as unknown as GtagWindow;
function gtag(...args:unknown[]){const win=w();win.dataLayer=win.dataLayer||[];if(!win.gtag)win.gtag=function(){
 // gtag.js reads the Arguments object, not an array.
 // eslint-disable-next-line prefer-rest-params
 win.dataLayer!.push(arguments);};win.gtag(...args);}
// Remove _ga and _ga_<container> on the current host and its parent domains.
function clearGaCookies(){const host=location.hostname.split('.');const domains=['',...host.map((_,i)=>host.slice(i).join('.')).filter(d=>d.includes('.'))];for(const name of document.cookie.split(';').map(c=>c.trim().split('=')[0]).filter(n=>n==='_ga'||n.startsWith('_ga_')))for(const domain of domains)document.cookie=`${name}=; Max-Age=0; Path=/${domain?'; Domain=.'+domain:''}`;}

function Tracker({id}:{id:string}){
 const {consent}=useCookieConsent(),granted=gaConsentCurrent(consent),pathname=usePathname(),search=useSearchParams().toString(),loaded=useRef(false);
 useEffect(()=>{
  const win=w();
  if(!granted){if(loaded.current){gtag('consent','update',{analytics_storage:'denied'});win['ga-disable-'+id]=true;clearGaCookies();}return;}
  win['ga-disable-'+id]=false;
  if(!loaded.current){
   loaded.current=true;
   // Consent Mode v2: everything denied by default; only analytics storage is granted after the visitor's choice. No advertising features.
   gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'denied',personalization_storage:'denied',security_storage:'granted'});
   gtag('set','ads_data_redaction',true);
   gtag('js',new Date());
   gtag('config',id,{send_page_view:false,anonymize_ip:true,allow_google_signals:false,allow_ad_personalization_signals:false});
   const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(id);document.head.appendChild(script);
  }
  gtag('consent','update',{analytics_storage:'granted'});
 },[granted,id]);
 // One page_view per client-side route (the title is read after the new page has rendered).
 useEffect(()=>{if(!granted)return;const timer=window.setTimeout(()=>gtag('event','page_view',{page_location:location.href,page_path:location.pathname+location.search,page_title:document.title,send_to:id}),300);return()=>clearTimeout(timer);},[granted,pathname,search,id]);
 return null;
}
// Rendered only when GA_MEASUREMENT_ID is set; loads nothing until statistics consent is given.
export function GoogleAnalytics({id}:{id:string}){return <Suspense fallback={null}><Tracker id={id}/></Suspense>;}
