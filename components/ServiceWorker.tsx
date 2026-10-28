'use client';
import {useEffect} from 'react';
// Registers public/sw.js so the site can be installed and shows an offline page.
export function ServiceWorker(){useEffect(()=>{if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('/sw.js').catch(()=>{});},[]);return null;}
