"use client";
import { useState } from "react";
import Link from "@/components/SafeLink";
import { ArrowRight, BadgeCheck, Clock, EyeOff, FileCheck2, MessageSquareQuote, ShieldCheck, Sparkles, Users } from "lucide-react";
import { FIND_FOR_ME, type FindForMeId } from "@/components/FindForMeSwitch";
import { useLocale } from "@/lib/i18n";

type Panel = {
  title: string; text: string; steps: { title: string; text: string }[]; trust: { icon: typeof EyeOff; text: string }[];
  cta: { href: string; label: string }; more: { href: string; label: string };
  example: { chip: string; title: string; detail: string; offers: { firm: string; quote: string; value: string }[] };
};
// Home page: "Benim için bul" as the premium service, right under the quick links, with three tabs: a home (estate
// agents answer), a service firm and a contractor (owner's requests 2026-11-24). The preview on the right of each tab
// is an illustration and is labelled as an example.
const PANELS: Record<FindForMeId, Panel> = {
  ev: {
    title: "Aradığınız evi anlatın, uzmanlar size gelsin",
    text: "İlan ilan gezmek yerine ne istediğinizi bir kez yazın. Bölgesinde uzman danışmanlar size uygun evlerle teklif gönderir; aramayı onlar yapar, kararı siz verirsiniz.",
    steps: [
      { title: "Aradığınızı anlatın", text: "Şehir, bütçe, oda sayısı ve ne zaman taşınacağınız. 2 dakika sürer." },
      { title: "Danışmanlar teklif gönderir", text: "Bölgeyi bilen en fazla 4 danışman, size uyan ilanlarla döner." },
      { title: "Siz seçin", text: "Teklifleri Hesabım'da karşılaştırın; dilediğinizle görüşün." },
    ],
    trust: [{ icon: EyeOff, text: "Numaranız siz izin verene kadar gizli" }, { icon: Users, text: "En fazla 4 seçkin danışman" }, { icon: Clock, text: "Ücretsiz, 2 dakikada" }],
    cta: { href: "/benim-icin-bul", label: "Talebimi oluştur" }, more: { href: "/paketler", label: "Emlakçı mısınız? Talep bültenine katılın" },
    example: { chip: "Satın almak istiyor", title: "3+1 daire · Karşıyaka, İzmir", detail: "6–9 milyon TL · 3 ay içinde · denize yakın",
      offers: [{ firm: "Ege Emlak · Ayşe K.", quote: "“Sahile 5 dakika, tam bütçenizde 2 daire var.”", value: "2 ilan" }, { firm: "Körfez Gayrimenkul · Can D.", quote: "“Cumartesi gösterebilirim.”", value: "1 ilan" }] },
  },
  hizmet: {
    title: "Ustayı siz aramayın, teklifler size gelsin",
    text: "Boya, tesisat, nakliye, temizlik, avukat veya tercüman: işinizi bir kez yazın. Bölgenizdeki onaylı firmalar size TL fiyat teklifi gönderir, siz karşılaştırıp seçersiniz.",
    steps: [
      { title: "İşinizi anlatın", text: "Hizmet türü, yer ve ne zaman yapılacağı. 2 dakika sürer." },
      { title: "Firmalar fiyat verir", text: "Bölgenizde çalışan en fazla 12 onaylı firma teklif gönderir." },
      { title: "Siz seçin", text: "Teklifleri en uygundan başlayarak karşılaştırın, birini kabul edin." },
    ],
    trust: [{ icon: EyeOff, text: "Numaranız siz izin verene kadar gizli" }, { icon: FileCheck2, text: "Belgeli ve onaylı firmalar" }, { icon: Clock, text: "Ücretsiz, yükümlülük yok" }],
    cta: { href: "/hizmetler/teklif-iste", label: "Hizmet teklifi al" }, more: { href: "/hizmetler/paketler", label: "Firma mısınız? Teklif talepleri alın" },
    example: { chip: "Hizmet istiyor", title: "Daire boyası · Kadıköy, İstanbul", detail: "3+1, 120 m² · bu ay içinde",
      offers: [{ firm: "Renk Boya · Belgeli firma", quote: "“Malzeme dahil, 3 günde biter.”", value: "18.500 TL" }, { firm: "Usta Dekor", quote: "“Hafta sonu keşfe gelebilirim.”", value: "21.000 TL" }] },
  },
  muteahhit: {
    title: "Evinizi yapacak müteahhidi bulun",
    text: "Arsanıza ev veya villa, kentsel dönüşüm ya da büyük tadilat: işi bir kez anlatın. Bölgenizdeki onaylı müteahhitler fiyat ve teslim süresiyle teklif gönderir. Arsanızı kat karşılığı da değerlendirebilirsiniz.",
    steps: [
      { title: "İşi veya arsayı anlatın", text: "Yer, alan ve bütçe ya da imar durumu. Birkaç dakika sürer." },
      { title: "Müteahhitler teklif verir", text: "Fiyat veya kat karşılığı pay oranı, teslim süresiyle birlikte." },
      { title: "Projelere bakıp seçin", text: "Tamamlanan projeleri ve yetki belgelerini görün, birini kabul edin." },
    ],
    trust: [{ icon: ShieldCheck, text: "Yetki belgesi doğrulanan firmalar" }, { icon: Users, text: "En fazla 12 müteahhit" }, { icon: Clock, text: "Ücretsiz, 30 gün açık" }],
    cta: { href: "/muteahhitler/kat-karsiligi?tur=insaat", label: "İnşaat teklifi al" }, more: { href: "/muteahhitler/kat-karsiligi", label: "Arsanız mı var? Kat karşılığı teklif alın" },
    example: { chip: "İnşaat istiyor", title: "4+1 villa · Çeşme, İzmir", detail: "400 m² arsa · 12 ay içinde · anahtar teslim",
      offers: [{ firm: "Ege Yapı · Doğrulanmış müteahhit", quote: "“Proje ve ruhsat dahil, 11 ayda teslim.”", value: "9,4 milyon TL" }, { firm: "Liman İnşaat", quote: "“Benzer 6 villamızı gezebilirsiniz.”", value: "10,1 milyon TL" }] },
  },
};

export function HomeFindForMe() {
  const { t } = useLocale();
  const [active, setActive] = useState<FindForMeId>("ev");
  const panel = PANELS[active];
  // Arrow keys move between the tabs (WAI-ARIA tabs pattern).
  function keys(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const rtl = document.documentElement.dir === "rtl" ? -1 : 1, index = FIND_FOR_ME.findIndex((item) => item.id === active);
    const next = FIND_FOR_ME[(index + step * rtl + FIND_FOR_ME.length) % FIND_FOR_ME.length].id;
    setActive(next);
    document.getElementById(`ffm-tab-${next}`)?.focus();
  }
  return <section className="ffm container" aria-labelledby="ffm-title">
    <div className="ffm-copy">
      <span className="ffm-kicker"><Sparkles size={14} aria-hidden="true"/>{t("PREMIUM HİZMET · BENİM İÇİN BUL")}</span>
      <div className="ffm-tabs" role="tablist" aria-label={t("Benim için bul")} onKeyDown={keys}>
        {FIND_FOR_ME.map(({ id, label, icon: Icon }) => <button key={id} id={`ffm-tab-${id}`} type="button" role="tab" aria-selected={id === active} aria-controls="ffm-panel" tabIndex={id === active ? 0 : -1} onClick={() => setActive(id)}>
          <Icon size={16} aria-hidden="true"/>{t(label)}</button>)}
      </div>
      <div id="ffm-panel" role="tabpanel" aria-labelledby={`ffm-tab-${active}`}>
        <h2 id="ffm-title">{t(panel.title)}</h2>
        <p>{t(panel.text)}</p>
        <ol className="ffm-steps">{panel.steps.map((step, index) => <li key={step.title}><span>{index + 1}</span><div><strong>{t(step.title)}</strong><small>{t(step.text)}</small></div></li>)}</ol>
        <ul className="ffm-trust">{panel.trust.map(({ icon: Icon, text }) => <li key={text}><Icon size={15} aria-hidden="true"/>{t(text)}</li>)}</ul>
        <div className="ffm-cta">
          <Link href={panel.cta.href} className="ffm-primary">{t(panel.cta.label)}<ArrowRight size={18} aria-hidden="true"/></Link>
          <Link href={panel.more.href} className="ffm-secondary">{t(panel.more.label)}</Link>
        </div>
      </div>
    </div>
    <div className="ffm-visual" aria-hidden="true" key={active}>
      <span className="ffm-example">{t("Örnek görünüm")}</span>
      <div className="ffm-request">
        <span className="ffm-chip">{t(panel.example.chip)}</span>
        <strong>{t(panel.example.title)}</strong>
        <small>{t(panel.example.detail)}</small>
      </div>
      {panel.example.offers.map((offer, index) => <div key={offer.firm} className={`ffm-offer ${index ? "two" : "one"}`}><BadgeCheck size={18}/><div><strong>{t(offer.firm)}</strong><small><MessageSquareQuote size={13}/>{t(offer.quote)}</small></div><b>{t(offer.value)}</b></div>)}
    </div>
  </section>;
}
