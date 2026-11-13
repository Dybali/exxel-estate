"use client";
import { useState } from "react";
import { apiJson } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n";
import type { AccountKind } from "@/lib/account-kind";

// Profilim › Hesap türü for non-agent accounts: Bireysel, Müteahhit or Hizmet firması (lib/account-kind.ts).
// Becoming an agent goes through the office application below it (SellerUpgrade), not here.
const OPTIONS: { kind: AccountKind; label: string; note: string }[] = [
  { kind: "individual", label: "Bireysel", note: "İlan arayın, kaydedin veya kendi mülkünüzün ilanını verin." },
  { kind: "contractor", label: "Müteahhit", note: "Firma profili, tamamlanan projeler ve arsa sahiplerinden kat karşılığı talepleri." },
  { kind: "service", label: "Hizmet firması", note: "Tadilat, nakliye, temizlik gibi hizmetler için firma profili ve teklif talepleri." },
];

export function AccountKindSwitch({ kind, onChanged }: { kind: AccountKind; onChanged: (kind: AccountKind) => void }) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function choose(next: AccountKind) {
    if (busy || next === kind) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set_account_kind", kind: next }) });
      const data = await apiJson<{ error?: string; accountKind?: AccountKind }>(response);
      if (!response.ok || !data.accountKind) throw new Error(data.error || "Hesap türü değiştirilemedi.");
      onChanged(data.accountKind);
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  return <section className="account-kind-switch">
    <h3>{t("Hesap türü")}</h3>
    <p>{t("Her hesap tek bir türdedir; panelinizdeki bölümler buna göre değişir.")}</p>
    <div role="radiogroup" aria-label={t("Hesap türü")}>
      {OPTIONS.map((option) => <button key={option.kind} type="button" role="radio" aria-checked={option.kind === kind} disabled={busy} onClick={() => void choose(option.kind)}>
        <strong>{t(option.label)}</strong><small>{t(option.note)}</small>
      </button>)}
    </div>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
  </section>;
}
