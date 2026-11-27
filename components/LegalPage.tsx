"use client";
// Shared layout of the legal pages (/gizlilik-politikasi, /cerez-politikasi, /kullanim-kosullari, /ilan-kurallari,
// /impressum): hero with tabs to the other legal texts, "last updated" date, summary box, sticky table of contents
// (a collapsible list on phones), numbered sections with anchors, a privacy-request contact box and cross-links.
// With `collapsible` (privacy, cookies, terms) the sections start closed, like a layered privacy notice: the
// summary and the headings fit on one screen and each section opens on demand. Closed bodies stay in the page
// (hidden="until-found"), so search engines and the browser's find-in-page still reach them; a #link, a table of
// contents click or printing opens them.
// Styles: app/legal.css. Translations of the strings below: lib/legal-translations.ts.
import {useEffect, useRef, useState, type ReactNode} from "react";
import {ArrowRight, ArrowUp, ChevronDown, ChevronsDownUp, ChevronsUpDown, Link2, Mail} from "lucide-react";
import Link from "@/components/SafeLink";
import {useLocale} from "@/lib/i18n";

export const PRIVACY_EMAIL = "info@estatemarket24.com";

export type LegalPath = "/gizlilik-politikasi" | "/cerez-politikasi" | "/kullanim-kosullari" | "/ilan-kurallari" | "/impressum" | "/mesafeli-satis-sozlesmesi" | "/iptal-ve-iade-kosullari" | "/kvkk-aydinlatma-metni";
export type LegalSection = {id: string; title: string; content: ReactNode};

const LEGAL_PAGES: {href: LegalPath; title: string; text: string}[] = [
  {href: "/gizlilik-politikasi", title: "Gizlilik politikası", text: "Hangi verileri neden işlediğimiz ve haklarınız"},
  {href: "/cerez-politikasi", title: "Çerez politikası", text: "Çerezler, yerel depolama ve tercihleriniz"},
  {href: "/kullanim-kosullari", title: "Kullanım koşulları", text: "Platformun kullanımına ilişkin kurallar"},
  {href: "/ilan-kurallari", title: "İlan kuralları", text: "İlan verirken uymanız gereken kurallar"},
  {href: "/mesafeli-satis-sozlesmesi", title: "Mesafeli satış sözleşmesi", text: "Ücretli hizmetlerin satışı ve ön bilgilendirme"},
  {href: "/iptal-ve-iade-kosullari", title: "İptal ve iade koşulları", text: "Sipariş iptali, cayma hakkı ve iadeler"},
  {href: "/kvkk-aydinlatma-metni", title: "KVKK aydınlatma metni", text: "Kişisel verilerinizin işlenmesi hakkında bilgilendirme"},
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

export function LegalPage({current, title, lede, updated, summary, sections, children, collapsible = false}: {
  current: LegalPath; title: string; lede?: string; updated?: string; summary?: string[]; sections: LegalSection[]; children?: ReactNode; collapsible?: boolean;
}) {
  const {t, locale} = useLocale();
  const ids = useRef(sections.map((section) => section.id)).current;
  const active = useActiveSection(ids);
  const [open, setOpen] = useState<Set<string>>(() => new Set(collapsible ? [] : ids));
  const isOpen = (id: string) => !collapsible || open.has(id);
  const openSection = (id: string) => setOpen((old) => old.has(id) ? old : new Set(old).add(id));
  const toggle = (id: string) => setOpen((old) => {const next = new Set(old); if (next.has(id)) next.delete(id); else next.add(id); return next;});
  const allOpen = open.size === ids.length;
  useEffect(() => {
    if (!collapsible) return;
    // A link to #section (shared, or from another page) opens it; printing opens everything.
    const fromHash = () => {const id = decodeURIComponent(location.hash.slice(1)); if (ids.includes(id)) {openSection(id); requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());}};
    const print = () => setOpen(new Set(ids));
    // Find-in-page reveals a closed body (hidden="until-found"); keep the state in step.
    const found = (event: Event) => {const section = (event.target as HTMLElement).closest(".legal-section"); if (section?.id) openSection(section.id);};
    fromHash();
    window.addEventListener("hashchange", fromHash);
    window.addEventListener("beforeprint", print);
    document.addEventListener("beforematch", found, true);
    return () => {window.removeEventListener("hashchange", fromHash); window.removeEventListener("beforeprint", print); document.removeEventListener("beforematch", found, true);};
  }, [collapsible, ids]);
  const mobileToc = useRef<HTMLDetailsElement>(null);
  const date = updated ? new Intl.DateTimeFormat(locale, {day: "numeric", month: "long", year: "numeric", timeZone: "UTC"}).format(new Date(`${updated}T12:00:00Z`)) : "";
  const toc = (onPick?: () => void) => <ol>{sections.map((section, index) => <li key={section.id}>
    <a href={`#${section.id}`} className={active === section.id ? "active" : undefined} aria-current={active === section.id ? "location" : undefined} onClick={() => {openSection(section.id); onPick?.();}}>
      <span className="legal-toc-number">{index + 1}</span><span>{section.title}</span>
    </a>
  </li>)}</ol>;
  // Owner's request 2026-11-13: the legal texts cannot be selected or copied on the site (links still work).
  const block = (event: React.SyntheticEvent) => event.preventDefault();
  return <main className="legal-page legal-nocopy" onCopy={block} onCut={block} onDragStart={block}>
    <header className="legal-hero">
      <div className="container">
        <span className="legal-kicker">{t("Yasal bilgiler")}</span>
        <h1>{title}</h1>
        {lede && <p className="legal-lede">{lede}</p>}
        <div className="legal-meta">
          {date && <span>{t("Son güncelleme")}: <time dateTime={updated}>{date}</time></span>}
          {collapsible && <button type="button" className="legal-print" aria-pressed={allOpen} onClick={() => setOpen(allOpen ? new Set() : new Set(ids))}>{allOpen ? <ChevronsDownUp size={15} aria-hidden="true"/> : <ChevronsUpDown size={15} aria-hidden="true"/>}{t(allOpen ? "Tümünü kapat" : "Tümünü aç")}</button>}
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
        {sections.map((section, index) => {
          const shown = isOpen(section.id);
          return <section key={section.id} id={section.id} className={collapsible ? `legal-section is-collapsible${shown ? " is-open" : ""}` : "legal-section"} aria-labelledby={`${section.id}-title`}>
            <h2 id={`${section.id}-title`}>
              {collapsible ? <button type="button" className="legal-toggle" aria-expanded={shown} aria-controls={`${section.id}-body`} onClick={() => toggle(section.id)}>
                <span className="legal-number">{index + 1}</span>
                <span className="legal-toggle-title">{section.title}</span>
                <ChevronDown size={20} aria-hidden="true" className="legal-chevron"/>
              </button> : <>
                <span className="legal-number">{index + 1}</span>
                <span>{section.title}</span>
              </>}
              <a href={`#${section.id}`} className="legal-anchor" aria-label={t("Bu bölümün bağlantısı")} onClick={() => openSection(section.id)}><Link2 size={16} aria-hidden="true"/></a>
            </h2>
            {/* React renders hidden as a boolean; after commit a closed body is switched to "until-found" so find-in-page still reaches it. */}
            <div className="legal-body" id={`${section.id}-body`} hidden={!shown} ref={(element) => {if (element && !shown) element.setAttribute("hidden", "until-found");}}>{section.content}</div>
          </section>;
        })}
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

/**
 * Numbered clauses inside a section ("3.1", "3.2"…), the formal style of the privacy policy.
 * `section` is the section number shown in the heading.
 */
export function LegalClauses({section, items}: {section: number; items: ReactNode[]}) {
  return <ol className="legal-clauses">{items.map((item, index) => <li key={index}>
    <span className="legal-clause-number" aria-hidden="true">{section}.{index + 1}.</span>
    <div className="legal-clause-body">{item}</div>
  </li>)}</ol>;
}

/** "(i) … (ii) …" list inside a clause. */
export function LegalRomanList({items}: {items: ReactNode[]}) {
  return <ol className="legal-roman">{items.map((item, index) => <li key={index}>{item}</li>)}</ol>;
}
