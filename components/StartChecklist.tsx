"use client";
import { useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { CheckCircle2, Circle, ChevronRight, Sparkles, X } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { onboardingSteps, type OnboardingFacts } from "@/lib/onboarding";
import type { AccountKind } from "@/lib/account-kind";
import { tipSeen } from "@/components/FeatureTip";

// "Hesabınızı hazırlayın" at the top of Hesabım › Genel Bakış (lib/onboarding.ts): the first steps of this account
// type with a progress bar. Hidden once every step is done, or when the member closes it (remembered per account).
const hiddenKey = (userId: string) => `em24_checklist_hidden_${userId}`;
export function StartChecklist({ userId }: { userId: string }) {
  const { t } = useLocale();
  const [data, setData] = useState<{ kind: AccountKind; facts: OnboardingFacts } | null>(null);
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try { setHidden(localStorage.getItem(hiddenKey(userId)) === "1"); } catch { setHidden(false); }
    fetch("/api/onboarding", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<{ kind: AccountKind; facts: OnboardingFacts }> : null).then((value) => { if (value) setData(value); }).catch(() => {});
  }, [userId]);
  if (!data || hidden) return null;
  const steps = onboardingSteps(data.kind, data.facts, { leadBoard: tipSeen("talep-akisi") });
  const done = steps.filter((step) => step.done).length;
  if (done === steps.length) return null;
  const close = () => { setHidden(true); try { localStorage.setItem(hiddenKey(userId), "1"); } catch { /* not remembered */ } };
  const next = steps.find((step) => !step.done);
  return <section className="start-checklist" aria-labelledby="start-checklist-title">
    <header>
      <div><span className="start-checklist-icon"><Sparkles size={18} aria-hidden="true"/></span><div><h2 id="start-checklist-title">{t("Hesabınızı hazırlayın")}</h2><p>{t("{done}/{all} adım tamamlandı").replace("{done}", String(done)).replace("{all}", String(steps.length))}</p></div></div>
      <button type="button" className="start-checklist-close" onClick={close} aria-label={t("Bu listeyi gizle")} title={t("Bu listeyi gizle")}><X size={18}/></button>
    </header>
    <div className="start-checklist-bar" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done}><span style={{ width: `${(done / steps.length) * 100}%` }}/></div>
    <ol>{steps.map((step) => <li key={step.id} className={`${step.done ? "done" : ""}${step === next ? " next" : ""}`}>
      <Link href={step.href}>
        {step.done ? <CheckCircle2 size={20} aria-hidden="true"/> : <Circle size={20} aria-hidden="true"/>}
        <span><strong>{t(step.title)}</strong><small>{t(step.text)}</small></span>
        {!step.done && <ChevronRight size={18} aria-hidden="true"/>}
      </Link>
    </li>)}</ol>
  </section>;
}
