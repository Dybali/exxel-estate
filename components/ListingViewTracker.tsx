"use client";
import {useEffect} from 'react';
import {useCookieConsent} from './CookieConsent';
import {useLocale} from '@/lib/i18n';
export function ListingViewTracker({id}:{id:string}){const {consent}=useCookieConsent();const {locale}=useLocale();useEffect(()=>{if(!consent?.analytics||document.visibilityState!=='visible')return;const controller=new AbortController();const timer=window.setTimeout(()=>{fetch(`/api/listings/${encodeURIComponent(id)}/view`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({locale}),signal:controller.signal}).catch(()=>{});},1200);return()=>{window.clearTimeout(timer);controller.abort();};},[id,consent?.analytics,locale]);return null;}
