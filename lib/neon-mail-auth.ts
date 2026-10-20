import type {VerifiedNeonIdentity} from './neon-identities';
export type NeonMailConfig={baseUrl:string;cookieSecret:string;origin:string};
export async function neonMailAuth(config:NeonMailConfig){
 const {createAuthServer,resolveNeonAuthLogging}=await import("@neondatabase/auth/server");
 // Keep the provider session inside this request; never return tokens or cookies to the browser.
 const cookies=new Map<string,string>();
 const auth=createAuthServer({baseUrl:config.baseUrl,cookieSecret:config.cookieSecret,sessionDataTtl:1,log:resolveNeonAuthLogging({logLevel:'silent'}),context:()=>({getCookies:()=>[...cookies].map(([k,v])=>k+'='+v).join('; '),setCookie:(k,v)=>{if(v)cookies.set(k,v);else cookies.delete(k);},getHeader:()=>null,getOrigin:()=>config.origin,getFramework:()=>'vinext'})});
 return {
 async send(email:string){const result=await auth.emailOtp.sendVerificationOtp({email,type:'sign-in'});if(result.error)throw new Error('E-posta şu anda gönderilemiyor. Lütfen daha sonra tekrar deneyin.');},
 async verify(email:string,otp:string):Promise<VerifiedNeonIdentity>{
  const result=await auth.signIn.emailOtp({email,otp});
  if(result.error||!result.data?.user)throw new Error('Kod geçersiz veya süresi dolmuş. Yeni bir kod isteyin.');
  const user=result.data.user;
  try{await auth.signOut();}catch{/* No provider credential is exposed; upstream sessions expire independently. */}
  if(!user.emailVerified||user.email.toLowerCase()!==email.toLowerCase())throw new Error('E-posta doğrulanamadı.');
  return {id:user.id,email:user.email,emailVerified:true,name:user.name};
 }
 };
}
