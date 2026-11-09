"use client";
// Shared layout of the legal pages (/gizlilik-politikasi, /cerez-politikasi, /kullanim-kosullari, /ilan-kurallari,
// /impressum): hero with tabs to the other legal texts, "last updated" date, summary box, sticky table of contents
// (a collapsible list on phones), numbered sections with anchors, a privacy-request contact box and cross-links.
// Styles: app/legal.css. Translations of the strings below: lib/legal-translations.ts.
import {useEffect, useRef, useState, type ReactNode} from "react";
import {ArrowRight, ArrowUp, ChevronDown, Link2, Mail, Printer} from "lucide-react";
import Link from "@/components/SafeLink";
import {useLocale} from "@/lib/i18n";

export const PRIVACY_EMAIL = "info@estatemarket24.com";

export type LegalPath = "/gizlilik-politikasi" | "/cerez-politikasi" | "/kullanim-kosullari" | "/ilan-kurallari" | "/impressum";
export type LegalSection = {id: string; title: string; content: ReactNode};

const LEGAL_PAGES: {href: LegalPath; title: string; text: string}[] = [
  {href: "/gizlilik-politikasi", title: "Gizlilik politikası", text: "Hangi verileri neden işlediğimiz ve haklarınız"},
  {href: "/cerez-politikasi", title: "Çerez politikası", text: "Çerezler, yerel depolama ve tercihleriniz"},
  {href: "/kullanim-kosullari", title: "Kullanım koşulları", text: "Platformun kullanımına ilişkin kurallar"},
  {href: "/ilan-kurallari", title: "İlan kuralları", text: "İlan verirken uymanız gereken kurallar"},
  {href: "/impressum", title: "Yasal künye", text: "İşletmeci, sicil ve iletişim bilgileri"},
];

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0] || "");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting);
      const first = ids.find((id) => visible.get(id));
      if (first) setActive(first);
    }, {rootMargin: "-15% 0px -65% 0px"});
    for (const id of ids) {const element = document.getElementById(id); if (element) observer.observe(element);}
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

export function LegalPage({current, title, lede, updated, summary, sections, children}: {
  current: LegalPath; title: string; lede?: string; updated?: string; summary?: string[]; sections: LegalSection[]; children?: ReactNode;
}) {
  const {t, locale} = useLocale();
  const ids = useRef(sections.map((section) => section.id)).current;
  const active = useActiveSection(ids);
  const mobileToc = useRef<HTMLDetailsElement>(null);
  const date = updated ? new Intl.DateTimeFormat(locale, {day: "numeric", month: "long", year: "numeric", timeZone: "UTC"}).format(new Date(`${updated}T12:00:00Z`)) : "";
  const toc = (onPick?: () => void) => <ol>{sections.map((section, index) => <li key={section.id}>
    <a href={`#${section.id}`} className={active === section.id ? "active" : undefined} aria-current={active === section.id ? "location" : undefined} onClick={onPick}>
      <span className="legal-toc-number">{index + 1}</span><span>{section.title}</span>
    </a>
  </li>)}</ol>;
  return <main className="legal-page">
    <header className="legal-hero">
      <div className="container">
        <span className="legal-kicker">{t("Yasal bilgiler")}</span>
        <h1>{title}</h1>
        {lede && <p className="legal-lede">{lede}</p>}
        <div className="legal-meta">
          {date && <span>{t("Son güncelleme")}: <time dateTime={updated}>{date}</time></span>}
          <button type="button" className="legal-print" onClick={() => window.print()}><Printer size={15} aria-hidden="true"/>{t("Yazdır")}</button>
        </div>
        <nav className="legal-tabs" aria-label={t("Yasal metinler")}>
          {LEGAL_PAGES.map((page) => <Link key={page.href} href={page.href} aria-current={page.href === current ? "page" : undefined}>{t(page.title)}</Link>)}
        </nav>
      </div>
    </header>
    <div className="container legal-layout">
      <aside className="legal-aside">
        <nav className="legal-toc" aria-label={t("Bu sayfada")}>
          <strong>{t("Bu sayfada")}</strong>
          {toc()}
        </nav>
      </aside>
      <article className="legal-content">
        <details className="legal-toc-mobile" ref={mobileToc}>
          <summary>{t("İçindekiler")}<ChevronDown size={18} aria-hidden="true"/></summary>
          <nav aria-label={t("İçindekiler")}>{toc(() => {if (mobileToc.current) mobileToc.current.open = false;})}</nav>
        </details>
        {summary && summary.length > 0 && <section className="legal-summary" aria-label={t("Kısaca")}>
          <h2>{t("Kısaca")}</h2>
          <ul>{summary.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>}
        {sections.map((section, index) => <section key={section.id} id={section.id} className="legal-section" aria-labelledby={`${section.id}-title`}>
          <h2 id={`${section.id}-title`}>
            <span className="legal-number">{index + 1}</span>
            <span>{section.title}</span>
            <a href={`#${section.id}`} className="legal-anchor" aria-label={t("Bu bölümün bağlantısı")}><Link2 size={16} aria-hidden="true"/></a>
          </h2>
          <div className="legal-body">{section.content}</div>
        </section>)}
        {children}
        <a href="#top" className="legal-top" onClick={(event) => {event.preventDefault(); window.scrollTo({top: 0, behavior: "smooth"});}}><ArrowUp size={15} aria-hidden="true"/>{t("Başa dön")}</a>
        <nav className="legal-related" aria-label={t("Diğer yasal metinler")}>
          <h2>{t("Diğer yasal metinler")}</h2>
          <div>{LEGAL_PAGES.filter((page) => page.href !== current).map((page) => <Link key={page.href} href={page.href}>
            <span><strong>{t(page.title)}</strong><small>{t(page.text)}</small></span><ArrowRight size={17} aria-hidden="true" className="legal-arrow"/>
          </Link>)}</div>
        </nav>
      </article>
    </div>
  </main>;
}

/** Contact box for privacy requests (used in the privacy and cookie policies). */
export function LegalContactBox() {
  const {t} = useLocale();
  return <aside className="legal-contact">
    <Mail size={22} aria-hidden="true"/>
    <div>
      <h3>{t("Gizlilik talepleri")}</h3>
      <p>{t("Haklarınızı kullanmak veya kişisel verilerinizle ilgili bir soru sormak için bize yazın. Talebinizi mümkünse hesabınızda kayıtlı e-posta adresinden gönderin; şifre, doğrulama kodu veya kimlik belgesi göndermeyin.")}</p>
      <div className="legal-contact-actions">
        <a href={`mailto:${PRIVACY_EMAIL}`} className="legal-button"><bdi dir="ltr">{PRIVACY_EMAIL}</bdi></a>
        <Link href="/iletisim" className="legal-button secondary">{t("İletişim formu")}</Link>
      </div>
    </div>
  </aside>;
}

const RIGHTS: {title: string; text: string; refs: string}[] = [
  {title: "Bilgi ve erişim", text: "Verilerinizin işlenip işlenmediğini öğrenebilir, işleniyorsa bilgi ve bir kopyasını isteyebilirsiniz.", refs: "KVKK 11(1)(a)–(ç) · GDPR Art. 15"},
  {title: "Düzeltme", text: "Eksik veya yanlış verilerinizin düzeltilmesini ve bunun verilerin aktarıldığı üçüncü kişilere bildirilmesini isteyebilirsiniz.", refs: "KVKK 11(1)(d), (f) · GDPR Art. 16, 19"},
  {title: "Silme", text: "Artık gerekli olmayan veya hukuka aykırı işlenen verilerinizin silinmesini ve bunun üçüncü kişilere bildirilmesini isteyebilirsiniz.", refs: "KVKK 11(1)(e), (f) · GDPR Art. 17, 19"},
  {title: "İşlemenin kısıtlanması", text: "Örneğin bir verinin doğruluğu tartışmalıyken işlemenin sınırlandırılmasını isteyebilirsiniz.", refs: "GDPR Art. 18"},
  {title: "Veri taşınabilirliği", text: "Bize sağladığınız verileri yaygın, makine tarafından okunabilir bir biçimde alabilirsiniz.", refs: "GDPR Art. 20"},
  {title: "İtiraz", text: "Meşru menfaate dayanan işlemeye ve yalnızca otomatik sistemlerle analiz edilerek aleyhinize çıkan bir sonuca itiraz edebilirsiniz.", refs: "KVKK 11(1)(g) · GDPR Art. 21–22"},
  {title: "Rızanın geri alınması", text: "Verdiğiniz izinleri (ör. istatistik çerezleri, e-posta özeti) dilediğiniz zaman geleceğe yönelik geri alabilirsiniz.", refs: "GDPR Art. 7(3)"},
  {title: "Şikâyet", text: "Kişisel Verileri Koruma Kurulu’na veya AB’de yaşadığınız ya da çalıştığınız yerdeki denetim makamına şikâyette bulunabilirsiniz.", refs: "KVKK 14 · GDPR Art. 77"},
];

/** "Your rights" as cards: KVKK md. 11 and GDPR Art. 15–22, 77. */
export function LegalRights() {
  const {t} = useLocale();
  return <ul className="legal-rights">{RIGHTS.map((right) => <li key={right.title}>
    <h3>{t(right.title)}</h3>
    <p>{t(right.text)}</p>
    <small><bdi dir="ltr">{right.refs}</bdi></small>
  </li>)}</ul>;
}
