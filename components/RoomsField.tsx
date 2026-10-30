"use client";
import {useState} from "react";
import {useLocale} from "@/lib/i18n";
import {ROOM_OPTIONS} from "@/lib/search-categories";

const OTHER="__other";
// Room layout picker with a "Diğer" choice that lets the advertiser type their own (e.g. 7+2).
// The value is always submitted under `name`, so it works in controlled and FormData forms.
export function RoomsField({value,onChange,name="rooms"}:{value:string;onChange?:(value:string)=>void;name?:string}){
 const {t}=useLocale();
 const [current,setCurrent]=useState(value),[other,setOther]=useState(Boolean(value)&&!(ROOM_OPTIONS as readonly string[]).includes(value));
 const shown=onChange?value:current,update=(next:string)=>{setCurrent(next);onChange?.(next);};
 return <><label>{t("Oda sayısı")}<select value={other?OTHER:shown} onChange={e=>{const v=e.target.value;setOther(v===OTHER);update(v===OTHER?"":v);}}><option value="">{t("Seçin")}</option>{ROOM_OPTIONS.map(x=><option key={x} value={x}>{x==="1+0"?`${t("Stüdyo")} (1+0)`:t(x)}</option>)}<option value={OTHER}>{t("Diğer")}</option></select></label>
 {other&&<label>{t("Oda sayısını yazın")}<input value={shown} onChange={e=>update(e.target.value)} placeholder="7+2" maxLength={10} pattern="\d{1,2}(\.5)?\+\d{1,2}" required title={t("Oda sayısını 3+1 biçiminde yazın.")}/></label>}
 <input type="hidden" name={name} value={shown}/></>;
}
