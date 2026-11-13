'use client';
export function CompanyIdentity(){return <address style={{fontStyle:'normal',lineHeight:1.8}}><strong>eXXelmedia GmbH &amp; Co. KG</strong><br/>Dornacherstraße 3<br/>D-85622 Feldkirchen<br/><a href="mailto:info@exxelmedia.de">info@exxelmedia.de</a></address>;}
// Proper names and an address: shown as written in every language.
const DISTRIBUTOR={name:'İlan Limited Şirketi',street:'Hükümet Caddesi No: 11',city:'Torbalı / İzmir, Türkiye'};
/** Distributor in Türkiye (owner's request 2026-11-13), shown next to the service provider in Yasal künye. */
export function DistributorIdentity(){return <address style={{fontStyle:'normal',lineHeight:1.8}}><strong>{DISTRIBUTOR.name}</strong><br/>{DISTRIBUTOR.street}<br/>{DISTRIBUTOR.city}<br/><a href="mailto:info@estatemarket24.com">info@estatemarket24.com</a></address>;}
