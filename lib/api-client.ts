/** Provider/framework outages must not surface JSON parsing errors to people. */
export async function apiJson<T>(response:Response):Promise<T>{
 let data:unknown;try{data=await response.json();}catch{throw Error('Sunucudan yanıt alınamadı. Tekrar göndermeden önce hesabınızdaki durumu kontrol edin.');}
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Sunucu yanıtı tamamlanamadı. Hesabınızdaki durumu kontrol edin.');
 return data as T;
}
