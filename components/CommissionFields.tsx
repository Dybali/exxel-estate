"use client";
import { useLocale } from "@/lib/i18n";
import { COMMISSION_DEFAULT, COMMISSION_MAX, commissionPurpose } from "@/lib/listing-commission";

// "Hizmet bedeli (komisyon)" in the listing forms (lib/listing-commission.ts): not stated, commission-free, or
// the buyer's percentage / the tenant's months of rent, within the legal limits. Only for sale and rent listings.
export function CommissionFields({ purpose, type, value, onChange }: { purpose: string; type: string; value: string; onChange: (key: "commissionType" | "commissionValue", value: string) => void }) {
  const { t } = useLocale();
  const kind = commissionPurpose(purpose);
  if (!kind) return null;
  const choose = (next: string) => {
    onChange("commissionType", next);
    if (next === "share" && !value) onChange("commissionValue", String(COMMISSION_DEFAULT[kind]));
  };
  return <section className="presentation-fields commission-fields">
    <h2>{t("Hizmet bedeli (komisyon)")}</h2>
    <p>{t(kind === "sale"
      ? "İsteğe bağlı. Yasal üst sınır satış bedelinin %4'ü + KDV'dir; aksi kararlaştırılmadıkça alıcı ve satıcı yarı yarıya öder (genelde her biri %2 + KDV)."
      : "İsteğe bağlı. Yasal üst sınır bir aylık kira + KDV'dir; aksi kararlaştırılmadıkça kiracı ve ev sahibi yarı yarıya öder.")}</p>
    <div className="commission-options" role="radiogroup" aria-label={t("Hizmet bedeli (komisyon)")}>
      {[["", "Belirtmek istemiyorum"], ["none", "Komisyonsuz"], ["share", kind === "sale" ? "Alıcıdan hizmet bedeli alınır" : "Kiracıdan hizmet bedeli alınır"]].map(([key, label]) =>
        <label key={key || "unset"} className={`check-row${type === key ? " active" : ""}`}><input type="radio" name="commissionType" checked={(type || "") === key} onChange={() => choose(key)}/>{t(label)}</label>)}
    </div>
    {type === "share" && <label className="commission-value">{t(kind === "sale" ? "Alıcının ödeyeceği oran (%)" : "Kiracının ödeyeceği (ay)")}
      <input type="number" inputMode="decimal" min={0.25} max={COMMISSION_MAX[kind]} step={0.25} required value={value} onChange={(event) => onChange("commissionValue", event.target.value)}/>
      <small>{t(kind === "sale" ? "En fazla %4. KDV ayrıca eklenir." : "En fazla 1 aylık kira. KDV ayrıca eklenir.")}</small>
    </label>}
  </section>;
}
