"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

type Account = {
  role: string;
  agent_status: string;
  company?: string | null;
  email_verified?: number;
};

export function SellerUpgrade({ user }: { user: Account }) {
  const [role, setRole] = useState<"individual" | "agent">(user.role === "buyer" ? "individual" : "agent");
  const [company, setCompany] = useState(user.company || "");
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
        body: JSON.stringify({ action: "request_seller_role", role, company }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error || "Başvuru gönderilemedi.");
      } else {
        window.location.assign("/hesabim?tab=profil");
      }
    } catch {
      setError("Bağlantı kurulamadı. Yeniden deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="seller-upgrade">
    {canApply && <>
      <h3>İlan vermeye başlayın</h3>
      <p>Bireysel mal sahibi olarak ilanınızı incelemeye gönderebilirsiniz. Emlakçı başvuruları yönetici onayı gerektirir.</p>
      <form onSubmit={submit}>
        <label>Hesap türü<select value={role} onChange={(event) => setRole(event.target.value as "individual" | "agent")}>
          {user.role === "buyer" && <option value="individual">Bireysel mal sahibiyim</option>}
          <option value="agent">Emlakçıyım</option>
        </select></label>
        {role === "agent" && <label>Ofis / şirket adı<input value={company} onChange={(event) => setCompany(event.target.value)} required minLength={2} maxLength={120} placeholder="Emlak ofisi adı" /></label>}
        <button className="primary-button" disabled={loading}>{loading ? "Gönderiliyor..." : "Başvuruyu gönder"}<ArrowRight size={16} /></button>
        {error && <div className="form-error" role="alert">{error}</div>}
      </form>
    </>}
    {googleEnabled && !user.email_verified && <a className="google-link-profile" href="/api/auth/google?link=1&next=%2Fhesabim%3Ftab%3Dprofil"><span className="google-symbol" aria-hidden="true">G</span> Google hesabını bağla <ArrowRight size={16} /></a>}
  </div>;
}
