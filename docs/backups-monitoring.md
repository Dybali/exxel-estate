# Yedekleme ve izleme

## Veritabanı yedeği (`.github/workflows/db-backup.yml`)

Her gün 02:17 UTC'de GitHub Actions Neon veritabanının tam `pg_dump` yedeğini alır (PostgreSQL 18 istemcisi), `pg_restore --list` ile okunabildiğini ve en az 10 tablo verisi içerdiğini kontrol eder, AES-256 ile şifreler ve `estatemarket24-backups` R2 bucket'ının `db/` klasörüne yükler. Bucket'ta `db/` için **90 gün** saklama kuralı vardır (`db-backups-90-days`).

Etkinleştirme (GitHub → repo → Settings → Secrets and variables → Actions):

| Tür | Ad | Değer |
| --- | --- | --- |
| Variable | `DB_BACKUP_ENABLED` | `true` |
| Secret | `NEON_DIRECT_URL` | Neon → Connect → **Connection pooling kapalı** adres (içinde `-pooler` olmamalı) |
| Secret | `BACKUP_PASSPHRASE` | Uzun rastgele parola. **Ayrıca güvenli bir yerde saklayın**; kaybolursa yedekler açılamaz |
| Secret | `R2_BACKUP_ACCESS_KEY_ID`, `R2_BACKUP_SECRET_ACCESS_KEY` | Yalnızca `estatemarket24-backups` için Object Read & Write R2 token'ı |
| Secret | `R2_BACKUP_ENDPOINT` | `https://3df99ce483c1e55817e51df63c034615.eu.r2.cloudflarestorage.com` |

İlk çalıştırma: Actions → Daily database backup → Run workflow.

Geri yükleme (boş bir test veritabanına):

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in db-<tarih>.dump.enc -out db.dump -pass pass:<BACKUP_PASSPHRASE>
pg_restore --no-owner --no-privileges --dbname "<test veritabanı adresi>" db.dump
```

Üretim veritabanına doğrudan geri yükleme yapmayın; önce Neon'da yeni bir branch açıp oraya yükleyin. Neon ücretsiz planı ayrıca son 6 saati anlık geri döndürme (PITR) ile korur.

Sınırlar: Yedek aynı Cloudflare hesabındadır; hesabın kaybına karşı bağımsız değildir. İlan fotoğrafları R2'de kalıcı depolanır ama ayrıca kopyalanmaz. Tam bağımsızlık için ikinci bir sağlayıcıya kopya önerilir.

Eski `.github/workflows/operations.yml` ChatGPT Sites dönemine aittir, eski adresi kullanır ve `EM24_OPERATIONS_ENABLED` değişkeni olmadan çalışmaz; etkinleştirmeyin.

## Dış izleme (`.github/workflows/uptime.yml`)

3 saatte bir ana sayfa, ilanlar, site haritası, robots, ilan API'si, bir ilan fotoğrafı, güvenlik başlıkları ve yetkisiz erişimlerin reddedildiği kontrol edilir. Başarısız çalıştırmada GitHub depo sahibine e-posta gönderir (GitHub → Settings → Notifications → Actions açık olmalı). Özel depoda ayda yaklaşık 240 dakika kullanır; daha sık kontrol ücretsiz kotayı tüketir. Farklı bir adres için `SITE_URL` repository variable'ı tanımlanabilir.

## İç sağlık kontrolü (Worker cron, her saat :07)

`lib/health.ts` veritabanını, ilan fotoğraf deposunu (R2 EU) ve özel depoyu kontrol eder. Sorun olursa Cloudflare loglarına `health_check_failed` yazılır ve Resend etkinse `ALERT_EMAIL` (yoksa `EXXEL_ADMIN_EMAIL`) adresine uyarı gönderilir. Loglar: Cloudflare → Workers & Pages → exxel-estate → Observability.
