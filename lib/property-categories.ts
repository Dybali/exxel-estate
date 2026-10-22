export const PROPERTY_CATEGORIES = [
 {value:"konut",label:"Konut",types:["daire","villa","mustakil","rezidans"]},
 {value:"isyeri",label:"İş yeri",types:["ticari"]},{value:"arsa",label:"Arsa",types:["arsa"]},
 {value:"bina",label:"Bina",types:["bina"]},{value:"devremulk",label:"Devremülk",types:["devremulk"]},{value:"turistik",label:"Turistik tesis",types:["turistik"]}
] as const;
export const PURPOSES=[{value:"satilik",label:"Satılık"},{value:"kiralik",label:"Kiralık"},{value:"gunluk",label:"Turistik günlük kiralık"},{value:"devren",label:"Devren satılık"}] as const;
export const purposeLabel=(value:string)=>PURPOSES.find(item=>item.value===value)?.label||value;
export const pricePeriod=(value:string)=>value==="gunluk"?"/ gün":value==="kiralik"?"/ ay":"";
export function categoryFilter(value:string){const category=PROPERTY_CATEGORIES.find(item=>item.value===value);return category?{where:`l.property_type IN (${category.types.map(()=>"?").join(",")})`,values:[...category.types] as string[]}:value?{where:"1=0",values:[] as string[]}:null;}
