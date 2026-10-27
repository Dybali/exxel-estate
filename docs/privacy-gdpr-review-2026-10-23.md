# Gizlilik ve çerez kontrolü — 23 Ekim 2026

Bu not, yayındaki Sites/Cloudflare Worker uygulamasının kaynak koduyla karşılaştırılmış teknik envanterdir. Hukuki görüş veya GDPR uyum sertifikası değildir. İşletmeci: eXXelmedia GmbH & Co. KG; ilgili kişi başvuruları: info@exxelmedia.de.

| İşleme | Bugünkü durum | Kamuya açıklama / sonraki karar |
| --- | --- | --- |
| Hesaplar, Google girişi, ilanlar, şirket belgeleri, mesajlar, favoriler | Ana uygulama verisi Neon PostgreSQL'de; özel dosyalar Cloudflare R2'de. Giriş akışı Google'a istek yapar. | Gizlilik politikasında kategoriler ve sağlayıcılar açıklanır. Belge erişimi ve silme takvimi işletmeci tarafından onaylanmalı. |
| Barındırma, teknik istekler ve yardımcı sayaçlar | Cloudflare Worker/D1 kullanılır; IP ve istek metaverileri altyapı tarafından işlenebilir. | Teknik kayıtların gerçek saklama süresi sağlayıcı yapılandırmasıyla doğrulanmalı. |
| Çeviri ve yapay zekâ asistanı | Etkinleştirilen özelliklerde metinler DeepL ve Google Gemini'ye gönderilir. | İlgili veri türleri, alt işleyenler, konumlar ve sözleşmeler kontrol edilmeli. |
| Çerez tercihleri | İsteğe bağlı istatistik ve video varsayılan olarak kapalıdır. Tercih 180 günlük `em24_consent` tarayıcı çerezinde tutulur. İlan görüntüleme API'si izinsiz kayıt yapmaz; video iframe'i izin ve oynatma isteği olmadan açılmaz. | Tercih yalnızca tarayıcıda tutuluyor; sunucu tarafında kimliklenebilir bir onay kanıtı/audit kaydı yok. İşletmeci kanıt gereksinimini ve asgari veriyle kayıt süresini belirlemeli. |
| Harita | Ana sayfa şehir haritası yerel görseldir. Arama haritası kullanıcı harita görünümünü seçince OpenStreetMap parçalarını yükler. İlan detayındaki gömülü harita artık ayrıca düğmeye basılınca yüklenir. | Üçüncü tarafa IP/teknik istek bilgisi gidebileceği politikada açıklanır; nihai hukuki sınıflandırma gözden geçirilmeli. |
| Türkiye'den canlı verilere erişim | İşletmecinin teyidine göre yetkili geliştirme/destek ekibinin erişimi var. | Erişenin işletmeci çalışanı mı ayrı hizmet sağlayıcı mı olduğu, hangi veri kategorilerine eriştiği, sözleşmeler, erişim kayıtları, aktarım aracı ve gerekiyorsa etki değerlendirmesi belgelenmeli. Her uzak erişim otomatik olarak GDPR Bölüm V aktarımı sayılmaz; statü ve veri akışı belirleyicidir. Türkiye için doğrulanmamış bir yeterlilik kararı veya imzalanmamış SCC varmış gibi yazılmadı. |
| Ücretli paket / ödeme | Arayüzde örnek paketler var; ödeme altyapısı aktif değil. | Sağlayıcı seçilmeden kart, fatura veya işlem verisinin işlendiği iddia edilmedi. Ödeme açılmadan önce sağlayıcı, veri akışı, hukuki dayanak, saklama, sözleşmeler ve varsa uluslararası aktarım açıklanmalı. |

## İşletmecinin kesinleştirmesi gerekenler

1. Hesap, mesaj, ilan, özel doğrulama belgesi, log ve yedekler için ayrı saklama/silme takvimi; yalnızca Neon'un ücretsiz planda olması bu takvimi tanımlamaz.
2. Türkiye erişimi için kişi/şirket statüsü, en az yetki, işleyen sözleşmeleri, erişim kayıtları, AB/AEA dışı aktarım mekanizması ve gerekirse tamamlayıcı teknik önlemler.
3. Neon, Cloudflare, Google, DeepL ve ilerideki ödeme sağlayıcısının sözleşmeleri, veri bölgeleri ve alt işleyenleri.
4. Onay kanıtının nasıl tutulacağı, versiyonlanacağı ve geri çekilmesinin nasıl belgeleneceği. Mevcut tarayıcı çerezi tek başına merkezi audit kaydı değildir.
5. Nihai gizlilik/çerez metinlerinin altı dilde hukukçu veya yetkili işletmeci tarafından onaylanması; yeni hizmet eklendiğinde metin ve engelleme davranışının birlikte güncellenmesi.

Dayanaklar: [AB Komisyonu bilgilendirme yükümlülükleri](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/obligations_en), [AB çerez açıklaması](https://europa.eu/youreurope/business/growing/digitalising/online-privacy/index_en.htm), [uluslararası aktarımlar](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/rules-international-data-transfers_en), [standart sözleşme maddeleri](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en), [EDPB aktarım ölçütleri](https://www.edpb.europa.eu/sme/be-compliant/international-data-transfers_en).
