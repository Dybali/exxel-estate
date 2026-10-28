import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {currentUser,isAdmin} from './server';
export async function adminPageUser(next='/yonetim'){
 const user=await currentUser(new Request('https://admin.internal/',{headers:await headers()}));
 if(!user?.email_verified||!isAdmin(user))redirect('/yonetim/giris?next='+encodeURIComponent(next));
 return user;
}
