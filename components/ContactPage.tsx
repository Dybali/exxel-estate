"use client";
import {useState, type FormEvent} from "react";
import Link from "@/components/SafeLink";
import {ArrowRight, CircleHelp, FileUp, Mail, MapPin, ScrollText, Send} from "lucide-react";
import {useLocale} from "@/lib/i18n";
import {apiJson} from "@/lib/api-client";
import {CONTACT_LIMITS, CONTACT_SUBJECTS, type ContactSubject} from "@/lib/contact";

// Contact page (/iletisim): company details from the legal notice and the contact form.
export function ContactPage() {
  const {t, locale} = useLocale();
  const [form, setForm] = useState({name: "", email: "", subject: "" as ContactSubject | "", message: "", website: "", consent: false});
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [sent, setSent] = useState(false);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((old) => ({...old, [key]: value}));
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/contact", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({...form, locale})});
      const data = await apiJson<{error?: string}>(response);
      if (!response.ok) throw new Error(data.error || "Mesajınız gönderilemedi. Lütfen tekrar deneyin.");
      setSent(true);
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  return <main className="info-page contact-page">
    <section className="info-hero"><div className="container">
      <span>{t("İLETİŞİM")}</span>
      <h1>{t("Size nasıl yardımcı olabiliriz?")}</h1>
      <p>{t("Sorularınızı, önerilerinizi ve kurumsal üyelik taleplerinizi bize iletin. Mesajınızı en kısa sürede yanıtlamaya çalışıyoruz.")}</p>
    </div></section>
    <div className="container info-body contact-layout">
      <aside className="contact-side">
        <section className="info-card">
          <h2><MapPin size={19}/>{t("Platform işletmecisi")}</h2>
          <address><strong>eXXelmedia GmbH &amp; Co. KG</strong><br/>Dornacherstraße 3<br/>D-85622 Feldkirchen</address>
          <dl className="contact-facts"><dt>{t("Ticaret sicili")}</dt><dd>Amtsgericht München HRA 105867</dd><dt>{t("Yönetici")}</dt><dd>Eyup Aydin</dd></dl>
          <p className="contact-mail"><Mail size={17}/><a href="mailto:info@estatemarket24.com">info@estatemarket24.com</a></p>
          <Link href="/impressum" className="info-text-link">{t("Yasal künye")}<ArrowRight size={15}/></Link>
        </section>
        <section className="info-card contact-shortcuts">
          <h2>{t("Hızlı yanıtlar")}</h2>
          <Link href="/sss"><CircleHelp size={18}/><span><strong>{t("Sık sorulan sorular")}</strong><small>{t("Arama, ilan verme, üyelik ve hesap hakkında yanıtlar")}</small></span></Link>
          <Link href="/ilan-kurallari"><ScrollText size={18}/><span><strong>{t("İlan kuralları")}</strong><small>{t("İlan verirken uymanız gereken kurallar")}</small></span></Link>
          <Link href="/toplu-ilan"><FileUp size={18}/><span><strong>{t("Toplu ilan yükleme")}</strong><small>{t("Emlak ofisleri için XML ile ilan aktarma")}</small></span></Link>
        </section>
        <p className="contact-note">{t("Bir ilanla ilgili sorularınızı ilan sayfasındaki mesaj alanından doğrudan ilan sahibine iletebilirsiniz. estatemarket24 ilan sahibi adına bilgi veremez.")}</p>
      </aside>
      <section className="info-card contact-form-card">
        <h2>{t("Bize yazın")}</h2>
        {sent ? <div className="contact-success" role="status"><Send size={26}/><strong>{t("Mesajınız alındı.")}</strong><p>{t("Teşekkür ederiz. Size verdiğiniz e-posta adresinden yanıt vereceğiz.")}</p><button type="button" className="info-button secondary" onClick={() => { setSent(false); setForm((old) => ({...old, subject: "", message: ""})); }}>{t("Yeni mesaj yaz")}</button></div>
        : <form className="contact-form" onSubmit={submit} noValidate={false}>
          <div className="contact-row">
            <label>{t("Ad Soyad")}<input required autoComplete="name" minLength={2} maxLength={CONTACT_LIMITS.nameMax} value={form.name} onChange={(e) => set("name", e.target.value)}/></label>
            <label>{t("E-posta")}<input required type="email" autoComplete="email" maxLength={CONTACT_LIMITS.emailMax} value={form.email} onChange={(e) => set("email", e.target.value)}/></label>
          </div>
          <label>{t("Konu")}<select required value={form.subject} onChange={(e) => set("subject", e.target.value as ContactSubject)}><option value="">{t("Konu seçin")}</option>{(Object.keys(CONTACT_SUBJECTS) as ContactSubject[]).map((key) => <option key={key} value={key}>{t(CONTACT_SUBJECTS[key])}</option>)}</select></label>
          <label>{t("Mesajınız")}<textarea required rows={7} minLength={CONTACT_LIMITS.messageMin} maxLength={CONTACT_LIMITS.messageMax} value={form.message} onChange={(e) => set("message", e.target.value)}/><small className="contact-count">{form.message.length} / {CONTACT_LIMITS.messageMax}</small></label>
          {/* Hidden from people; automated form fillers that complete it are ignored by the server. */}
          <div className="contact-trap" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set("website", e.target.value)}/></label></div>
          <label className="contact-consent"><input type="checkbox" required checked={form.consent} onChange={(e) => set("consent", e.target.checked)}/><span>{t("Mesajımın yanıtlanması için adımın, e-posta adresimin ve mesajımın işlenmesini kabul ediyorum.")} <Link href="/gizlilik-politikasi" target="_blank">{t("Gizlilik politikası")}</Link></span></label>
          <p className="contact-hint">{t("Şifre, doğrulama kodu veya kimlik belgesi göndermeyin.")}</p>
          {error && <p className="form-error" role="alert">{t(error)}</p>}
          <button type="submit" className="info-button" disabled={busy}><Send size={17}/>{t(busy ? "Gönderiliyor…" : "Mesajı gönder")}</button>
        </form>}
      </section>
    </div>
  </main>;
}
