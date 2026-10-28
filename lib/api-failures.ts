/** Never return an empty HTML/500 response to clients expecting JSON. */
export function apiFailureResponse(request:Request,response:Response,reference=crypto.randomUUID()){
 if(response.status<500||!new URL(request.url).pathname.startsWith('/api/'))return response;
 const headers=new Headers(response.headers);headers.set('X-Request-Id',reference);headers.set('Cache-Control','private, no-store');
 if(headers.get('Content-Type')?.includes('application/json'))return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 response.body?.cancel().catch(()=>{});headers.delete('Content-Length');headers.delete('Content-Encoding');headers.set('Content-Type','application/json; charset=utf-8');
 return new Response(JSON.stringify({error:'İşlem şu anda tamamlanamadı. Tekrar göndermeden önce hesabınızdaki durumu kontrol edin.',reference}),{status:response.status,headers});
}
export function failureLog(request:Request,status:number,reference:string){return {event:'request_failed',reference,status,method:request.method,route:new URL(request.url).pathname.replace(/[a-f0-9]{8}-[a-f0-9-]{27,}/gi,':id')};}
