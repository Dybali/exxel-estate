"use client";
import Link from "@/components/SafeLink";
import {ArrowRight} from "lucide-react";
import {useLocale} from "@/lib/i18n";
import {LegalPage} from "./LegalPage";

type Rule = {title: string; text: string; points?: string[]};

const RULES: Rule[] = [
  {title: "Doğru ve güncel bilgi", text: "İlan başlığı, açıklama, konum, metrekare, oda sayısı, bina yaşı ve diğer bilgiler taşınmazın gerçek durumunu yansıtmalıdır. Satılan, kiralanan veya artık sunulmayan taşınmazların ilanını gecikmeden güncelleyin ya da yayından kaldırın."},
  {title: "Doğru fiyat ve para birimi", text: "Fiyatı ilanın amacına uygun olarak (satış, kira veya devir bedeli) ve doğru para birimiyle girin. Sembolik, yanıltıcı veya aramalarda öne çıkmak için girilmiş fiyatlar kabul edilmez. Fiyata dahil olmayan önemli masrafları açıklamada belirtin."},
  {title: "Kendi fotoğraflarınız", text: "Yalnızca ilandaki taşınmaza ait ve kullanma hakkına sahip olduğunuz fotoğraf, video ve sanal turları kullanın.", points: [
    "Başka ilanlardan, web sitelerinden veya kataloglardan alınmış görseller kullanılmaz.",
    "Başka bir taşınmazı veya yalnızca çevreyi gösteren görseller ana fotoğraf olarak kullanılmaz.",
    "Görsellere telefon numarası, web adresi veya reklam metni eklenmez.",
    "Kişiler, araç plakaları ve belgeler tanınabilir şekilde gösterilmez.",
  ]},
  {title: "Mükerrer ilan yasağı", text: "Her taşınmaz için yalnızca bir ilan yayımlayın. Aynı taşınmazı farklı başlık, fiyat veya fotoğraflarla yeniden yayımlamak mükerrer ilan sayılır ve yayından kaldırılır. Bilgileri değiştirmek için mevcut ilanınızı düzenleyin."},
  {title: "Emlak ofisleri: yetki belgesi", text: "Emlak ofisi hesapları, Taşınmaz Ticareti Yetki Belgesini Hesabım üzerinden yükler. Belge ve hesap yönetici tarafından onaylanmadan ilanlar yayımlanmaz. Ofis adınız değişirse belgenin yeniden onaylanması gerekir. Yalnızca satış veya kiralama yetkisine sahip olduğunuz taşınmazların ilanını verin."},
  {title: "EİDS numarası", text: "İlanınız Elektronik İlan Doğrulama Sistemi (EİDS) kapsamındaysa ilan formundaki EİDS numarası alanını doldurun. Bu yükümlülüğün ilanınız için geçerli olup olmadığını güncel mevzuattan kontrol etmek ilan verenin sorumluluğundadır."},
  {title: "Yasak içerik", text: "Aşağıdaki içerikler yayımlanmaz:", points: [
    "Hukuka aykırı, aldatıcı veya dolandırıcılık amaçlı ilanlar ve gerçekte sunulmayan taşınmazlar",
    "Ayrımcı, hakaret içeren, müstehcen veya şiddet içeren ifadeler",
    "Başkalarına ait kişisel veriler, kimlik veya tapu belgelerinin görüntüleri",
    "İlanla ilgisiz reklam, başka sitelere yönlendirme veya anahtar kelime doldurma",
    "Telif hakkını veya başka kişilerin haklarını ihlal eden metin ve görseller",
  ]},
  {title: "İnceleme ve yayından kaldırma", text: "Yöneticiler ilanları yayından önce veya sonra inceleyebilir. Bu kurallara aykırı ilanlar düzeltme istenerek reddedilebilir veya önceden bildirim yapılmadan yayından kaldırılabilir. Tekrarlanan ya da ağır ihlallerde hesap durdurulabilir. Bir kararla ilgili sorularınızı İletişim sayfasından iletebilirsiniz."},
  {title: "Bildirim", text: "Kurallara aykırı bir ilan gördüğünüzde ilan sayfasındaki “İlanı bildir” düğmesini kullanın. Bildirimler yetkili yöneticiler tarafından incelenir; bildirimde bulunan kişinin kimliği ilan sahibine gösterilmez."},
];

// Section anchors, in the order of RULES.
const IDS = ["dogru-bilgi", "fiyat", "fotograflar", "mukerrer", "yetki-belgesi", "eids", "yasak-icerik", "inceleme", "bildirim"];

export function ListingRules() {
  const {t} = useLocale();
  const sections = RULES.map((rule, index) => ({id: IDS[index] || `kural-${index + 1}`, title: t(rule.title), content: <>
    <p>{t(rule.text)}</p>
    {rule.points && <ul>{rule.points.map((point) => <li key={point}>{t(point)}</li>)}</ul>}
    {IDS[index] === "inceleme" && <p>{t("İlanlar kaydedilirken sahte veya mükerrer ilan belirtileri bakımından otomatik olarak da kontrol edilir; şüpheli bulunanlar yöneticilere bildirilir ve kararı her zaman bir yönetici verir.")}</p>}
  </>}));
  return <LegalPage current="/ilan-kurallari" title={t("İlan kuralları")} updated="2026-11-09"
    lede={t("Ziyaretçilerin doğru ve güvenilir ilanlarla karşılaşması için tüm ilan verenlerden bu kurallara uymalarını bekliyoruz.")}
    summary={[t("Bu kurallar bireysel üyeler, emlak ofisleri ve inşaat firmaları dahil estatemarket24'te ilan veren herkes için geçerlidir. Bu sayfa hukuki danışmanlık değildir; mevzuattan doğan yükümlülükleriniz ayrıca geçerlidir."), t("estatemarket24 taşınmaz alım-satımı veya kiralamasında taraf değildir ve ödemelere aracılık etmez. Ödeme veya sözleşme öncesinde tapu kaydını ve belgeleri kendiniz kontrol edin.")]}
    sections={sections}>
    <aside className="legal-contact">
      <ArrowRight size={22} aria-hidden="true" className="legal-arrow"/>
      <div>
        <h3>{t("İlanınızı hazırlamaya hazır mısınız?")}</h3>
        <p>{t("Sorularınız için sık sorulan sorulara göz atın veya bize yazın.")}</p>
        <div className="legal-contact-actions"><Link href="/ilan-ver" className="legal-button">{t("İlan Ver")}</Link><Link href="/sss" className="legal-button secondary">{t("Sık sorulan sorular")}</Link></div>
      </div>
    </aside>
  </LegalPage>;
}
