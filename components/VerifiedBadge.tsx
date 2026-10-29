"use client";
import {ShieldCheck} from "lucide-react";
import {useLocale} from "@/lib/i18n";

// Yellow badge for agents whose Taşınmaz Ticareti Yetki Belgesi an administrator approved.
export function VerifiedBadge({compact=false}:{compact?:boolean}){
 const {t}=useLocale();
 return <span className={`verified-agent-badge${compact?" compact":""}`} title={t("Taşınmaz Ticareti Yetki Belgesi yönetici tarafından incelendi.")}><ShieldCheck size={compact?13:16}/>{t("Doğrulanmış Emlakçı")}</span>;
}
