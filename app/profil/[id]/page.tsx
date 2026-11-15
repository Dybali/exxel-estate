import {SellerProfile} from '@/components/SellerProfile';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {db} from '@/lib/server';
import {publicProfileExists} from '@/lib/seller-profiles';
import {pageAlternates,requestLocale} from '@/lib/request-context';
import {shareMetadata} from '@/lib/share-metadata';
export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{const title='İlan Sahibi Profili',path='/profil/'+(await params).id;return {title:title+' | estatemarket24',alternates:await pageAlternates(path),...shareMetadata({title,path,locale:await requestLocale()})};}
// An unknown seller answers 404 before anything streams (no soft 404); a database failure leaves it to the client.
export default async function ProfilePage({params}:{params:Promise<{id:string}>}){const {id}=await params;if(await publicProfileExists(db(),id).catch(()=>true)===false)notFound();return <SellerProfile id={id}/>;}
