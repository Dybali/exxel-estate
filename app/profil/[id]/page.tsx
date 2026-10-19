import {SellerProfile} from '@/components/SellerProfile';
export const metadata={title:'İlan Sahibi Profili | estatemarket24'};
export default async function ProfilePage({params}:{params:Promise<{id:string}>}){return <SellerProfile id={(await params).id}/>;}
