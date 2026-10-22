"use client";
import {useEffect} from 'react';
export function ListingViewTracker({id}:{id:string}){useEffect(()=>{if(document.visibilityState!=='visible')return;const timer=window.setTimeout(()=>{fetch(`/api/listings/${encodeURIComponent(id)}/view`,{method:'POST',credentials:'same-origin',keepalive:true}).catch(()=>{});},1200);return()=>window.clearTimeout(timer);},[id]);return null;}
