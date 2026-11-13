'use client';
export function CompanyIdentity(){return <address style={{fontStyle:'normal',lineHeight:1.8}}><strong>eXXelmedia GmbH &amp; Co. KG</strong><br/>Dornacherstraße 3<br/>D-85622 Feldkirchen<br/><a href="mailto:info@exxelmedia.de">info@exxelmedia.de</a></address>;}
// Proper names and an address: shown as written in every language.
const LICENSEE={name:'İlan Limited Şirketi',street:'Hükümet Caddesi No: 11',city:'Torbalı / İzmir, Türkiye'};
/** Licensee in Türkiye (German: Lizenznehmer; owner's request 2026-11-13), shown next to the service provider in Yasal künye. */
export function LicenseeIdentity(){return <address style={{fontStyle:'normal',lineHeight:1.8}}><strong>{LICENSEE.name}</strong><br/>{LICENSEE.street}<br/>{LICENSEE.city}<br/><a href="mailto:info@estatemarket24.com">info@estatemarket24.com</a></address>;}
