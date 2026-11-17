"use client";
import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n";
import { AGENT_LANGUAGES, type AgentLanguage } from "@/lib/agent-directory";
import { useLanguageName } from "@/components/AgentDirectory";

// Hesabım › Profilim (estate agents and office consultants): languages shown on /danismanlar and used by its language filter.
export function AgentLanguagesSetting() {
  const { t } = useLocale(), language = useLanguageName();
  const [eligible, setEligible] = useState(false), [chosen, setChosen] = useState<AgentLanguage[] | null>(null), [saved, setSaved] = useState(""), [error, setError] = useState("");
  useEffect(() => { fetch("/api/agents?languages=1", { cache: "no-store" }).then((response) => apiJson<{ languages?: AgentLanguage[]; eligible?: boolean }>(response)).then((data) => { setChosen(data.languages || []); setEligible(Boolean(data.eligible)); }).catch(() => setChosen([])); }, []);
  async function save(next: AgentLanguage[]) {
    setChosen(next); setSaved(""); setError("");
    const response = await fetch("/api/agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ languages: next }) });
    if (response.ok) setSaved("Kaydedildi."); else setError((await apiJson<{ error?: string }>(response)).error || "Kaydedilemedi.");
  }
  if (!chosen || !eligible) return null;
  return <section className="svc-tool-card">
    <div className="svc-tool-head"><Languages size={20} aria-hidden="true"/><div><h3>{t("Konuştuğum diller")}</h3><p>{t("Danışmanlar sayfasında profilinizde görünür; yabancı alıcılar dile göre danışman arayabilir.")}</p></div></div>
    <div className="service-category-picker" style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>{AGENT_LANGUAGES.map((code) => <label key={code} style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input type="checkbox" checked={chosen.includes(code)} onChange={(event) => void save(event.target.checked ? [...chosen, code] : chosen.filter((item) => item !== code))}/>{language(code)}</label>)}</div>
    {saved && <p className="profile-save-success" role="status">{t(saved)}</p>}
    {error && <p className="form-error" role="alert">{t(error)}</p>}
  </section>;
}
