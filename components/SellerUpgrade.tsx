"use client";

import { useEffect, useState } from "react";
import {useSearchParams} from "next/navigation";
import { useLocale } from "@/lib/i18n";

import { ArrowRight } from "lucide-react";

type Account = {
  role: string;
  agent_status: string;
  company?: string | null;
  email_verified?: number;
};

export function SellerUpgrade({ user }: { user: Account }) {
  const {t}=useLocale();const params=useSearchParams();
  const [role, setRole] = useState<"individual" | "agent">(user.role === "buyer" ? "individual" : "agent");
  const [company, setCompany] = useState(user.company || "");
  const [companyCategory, setCompanyCategory] = useState<"agency" | "developer">(params.get("companyCategory")==="developer"?"developer":"agency");
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/auth/google?status=1", { cache: "no-store" })
      .then((response) => response.json())
      .then((value) => setGoogleEnabled(Boolean((value as { enabled?: boolean }).enabled)))
      .catch(() => setGoogleEnabled(false));
  }, []);

  const canApply = user.role === "buyer" || user.role === "individual" ||
    (user.role === "agent" && user.agent_status !== "approved" && (user.agent_status === "rejected" || !user.company));
  if (!canApply && !googleEnabled) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_seller_role", role, company, companyCategory }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error || "Başvuru gönderilemedi.");
      } else {
        window.location.assign(role==="agent"?"/hesabim?tab=firma":"/hesabim?tab=profil");
      }
    } catch {
      setError("Bağlantı kurulamadı. Yeniden deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="seller-upgrade">
    {canApply && <>
      <h3>{t("İlan vermeye başlayın")}</h3>
      <p>{t("Bireysel mal sahibi olarak ilanınızı incelemeye gönderebilirsiniz. Emlak ofisi ve inşaat firması başvuruları yönetici onayı gerektirir.")}</p>
      <form onSubmit={submit}>
        <label>{t("Hesap türü")}<select value={role} onChange={(event) => setRole(event.target.value as "individual" | "agent")}>
          {user.role === "buyer" && <option value="individual">{t("Bireysel mal sahibiyim")}</option>}
          <option value="agent">{t("Emlakçıyım")}</option>
        </select></label>
        {role === "agent" && <><label>{t("Şirket türü")}<select value={companyCategory} onChange={(event) => setCompanyCategory(event.target.value as "agency" | "developer")}><option value="agency">{t("Emlak ofisi")}</option><option value="developer">{t("İnşaat firması")}</option></select></label><label>{t("Ofis / şirket adı")}<input value={company} onChange={(event) => setCompany(event.target.value)} required minLength={2} maxLength={120} placeholder={t(companyCategory==="developer"?"İnşaat firması adı":"Emlak ofisi adı")} /></label></>}
        <button className="primary-button" disabled={loading}>{t(loading ? "Gönderiliyor..." : "Başvuruyu gönder")}<ArrowRight size={16} /></button>
        {error && <div className="form-error" role="alert">{t(error)}</div>}
      </form>
    </>}
    {googleEnabled && !user.email_verified && <a className="google-link-profile" href="/api/auth/google?link=1&next=%2Fhesabim%3Ftab%3Dprofil"><span className="google-symbol" aria-hidden="true">G</span> Google hesabını bağla <ArrowRight size={16} /></a>}
  </div>;
}
