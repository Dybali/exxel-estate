// Bounded literal keyword search, shared by listing results and saved searches.
export function searchText(value:string){return value.trim().replace(/\s+/g,' ').slice(0,160);}
const fold=(value:string)=>value.replace(/İ/g,'I').toLowerCase().replace(/ı/g,'i');
export function textTokens(value:string){return fold(searchText(value)).split(' ').filter(Boolean).slice(0,12);}
export function textSearchSql(value:string){
 const tokens=textTokens(value),columns=['title','description','city','district','neighborhood'];
 return {where:tokens.map(()=>`(${columns.map(column=>`REPLACE(LOWER(REPLACE(COALESCE(l.${column},''),'İ','I')),'ı','i') LIKE ? ESCAPE '!'`).join(' OR ')})`).join(' AND '),values:tokens.flatMap(token=>columns.map(()=>'%'+token.replace(/[!%_]/g,char=>'!'+char)+'%'))};
}
export function matchesSearchText(value:string,listing:{title:string;description:string;city:string;district:string;neighborhood?:string}){const content=fold([listing.title,listing.description,listing.city,listing.district,listing.neighborhood||''].join(' '));return textTokens(value).every(token=>content.includes(token));}
