export const PROPERTY_CATEGORIES = [
 {value:"konut",label:"Konut",types:["daire","rezidans","mustakil","villa","ciftlik-evi","kosk-konak","yali","yali-dairesi","yazlik","kooperatif"]},
 {value:"isyeri",label:"İş yeri",types:["ticari"]},{value:"arsa",label:"Arsa",types:["arsa"]},
 {value:"bina",label:"Bina",types:["bina"]},{value:"devremulk",label:"Devre mülk",types:["devremulk"]},{value:"turistik",label:"Turistik tesis",types:["turistik"]}
] as const;
export const PURPOSES=[{value:"satilik",label:"Satılık"},{value:"kiralik",label:"Kiralık"},{value:"gunluk",label:"Turistik günlük kiralık"},{value:"devren",label:"Devren satılık"}] as const;
export const purposeLabel=(value:string)=>PURPOSES.find(item=>item.value===value)?.label||value;
export const pricePeriod=(value:string)=>value==="gunluk"?"/ gün":value==="kiralik"?"/ ay":"";
export function categoryFilter(value:string){if(value==='devren')return {where:'l.purpose=?',values:['devren']};if(value==='devremulk')return {where:'l.property_type=?',values:['devremulk']};const category=PROPERTY_CATEGORIES.find(item=>item.value===value);return category?{where:`l.property_type IN (${category.types.map(()=>"?").join(",")})`,values:[...category.types] as string[]}:value?{where:"1=0",values:[] as string[]}:null;}
export function categoryMatches(value:string,listing:{purpose:string;propertyType:string}){if(!value)return true;if(value==='devren')return listing.purpose==='devren';if(value==='devremulk')return listing.propertyType==='devremulk';const category=PROPERTY_CATEGORIES.find(item=>item.value===value);return Boolean(category&&(category.types as readonly string[]).includes(listing.propertyType));}
