'use client';
// Shown only when the root layout itself fails, so nothing from the layout (styles, translation
// dictionary, header) is available: plain inline styles and a minimal Turkish/English text chosen
// from the browser language.
const COPY = {
  tr: { lang: 'tr', title: 'Sayfa şu anda açılamadı.', body: 'Birkaç saniye sonra yeniden deneyin.', retry: 'Yeniden dene', home: 'Ana sayfa' },
  en: { lang: 'en', title: 'This page could not be loaded.', body: 'Please try again in a few seconds.', retry: 'Try again', home: 'Home page' },
};
export default function GlobalError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 const copy = typeof navigator !== 'undefined' && !navigator.language.toLowerCase().startsWith('tr') ? COPY.en : COPY.tr;
 return <html lang={copy.lang}><body style={{margin:0,minHeight:'100vh',display:'grid',placeItems:'center',background:'#f6f8f7',color:'#15171c',fontFamily:'system-ui,-apple-system,"Segoe UI",sans-serif',padding:'24px'}}>
  <main style={{maxWidth:460,textAlign:'center'}}>
   <img src="/brand/logo-horizontal.svg" alt="EstateMarket24" width={220} height={43} style={{margin:'0 auto 28px',display:'block'}}/>
   <h1 style={{fontSize:24,margin:'0 0 10px'}}>{copy.title}</h1>
   <p style={{margin:'0 0 24px',lineHeight:1.6}}>{copy.body}</p>
   <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
    <button type="button" onClick={reset} style={{background:'#0b5f63',color:'#fff',border:0,borderRadius:8,padding:'12px 20px',fontSize:15,fontWeight:600,cursor:'pointer'}}>{copy.retry}</button>
    <a href="/" style={{border:'1px solid #0b5f63',color:'#0b5f63',borderRadius:8,padding:'11px 20px',fontSize:15,fontWeight:600,textDecoration:'none'}}>{copy.home}</a>
   </div>
   {error.digest&&<p style={{marginTop:24,fontSize:12,color:'#56635f'}}>Ref: {error.digest}</p>}
  </main>
 </body></html>;
}
