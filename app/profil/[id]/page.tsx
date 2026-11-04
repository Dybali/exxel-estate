import {SellerProfile} from '@/components/SellerProfile';
import type {Metadata} from 'next';
import {requestLocale} from '@/lib/request-context';
import {shareMetadata} from '@/lib/share-metadata';
export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{const title='İlan Sahibi Profili';return {title:title+' | estatemarket24',...shareMetadata({title,path:'/profil/'+(await params).id,locale:await requestLocale()})};}
export default async function ProfilePage({params}:{params:Promise<{id:string}>}){return <SellerProfile id={(await params).id}/>;}
