"use client";
import {useEffect} from 'react';
import {useCookieConsent} from './CookieConsent';
export function ListingViewTracker({id}:{id:string}){const {consent}=useCookieConsent();useEffect(()=>{if(!consent?.analytics||document.visibilityState!=='visible')return;const controller=new AbortController();const timer=window.setTimeout(()=>{fetch(`/api/listings/${encodeURIComponent(id)}/view`,{method:'POST',credentials:'same-origin',signal:controller.signal}).catch(()=>{});},1200);return()=>{window.clearTimeout(timer);controller.abort();};},[id,consent?.analytics]);return null;}
