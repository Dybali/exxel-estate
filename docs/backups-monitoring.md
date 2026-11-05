# Yedekleme ve izleme

Site Mittwald'da konteyner olarak çalışır, veritabanı aynı projedeki `postgres` konteyneri (PostgreSQL 18, yalnızca iç ağ). Yedekler iki katmanlıdır:

| Katman | Nerede | Sıklık | Saklama |
|---|---|---|---|
| Mittwald yedeği | Mittwald'ın kendi `postgres` cronjob'u (mStudio) | Saatte bir | Mittwald ayarlarına göre |
| Şifreli dış kopya | Cloudflare R2, kova `estatemarket24-backups`, klasör `mittwald-db/` | Günde bir (günlük işle birlikte) | Son **30** yedek |

Dış kopya Mittwald'dan bağımsızdır: Mittwald projesi veya sunucusu kaybolsa da veritabanı R2'den geri yüklenebilir.

## Günlük şifreli dış kopya

Kod: `lib/db-backup-node.ts` (yalnızca Node/Mittwald derlemesi; Cloudflare derlemesi `lib/db-backup.ts` boş yuvasını görür ve yedek kodu Workers paketine girmez).

Günlük iş (`node /app/scripts/cron-call.mjs daily`, her gün 09:00 Europe/Istanbul) diğer günlük işlerle (öne çıkarma bitişi, e-posta özeti, video temizliği) **aynı anda ama bağımsız** çalışır: yedeğin hatası diğer işleri durdurmaz, diğerlerinin hatası yedeği durdurmaz. Ayrı bir mStudio cronjob'u gerekmez.

Adımlar:

1. **Atlama:** `DATABASE_URL` boşsa veya veritabanı konteynerin TCP PostgreSQL'i değilse (ör. Neon) sonuç `skipped` olur ve hiçbir şey yapılmaz.
2. **Dump:** `pg_dump --format=custom --no-owner --no-privileges` (PostgreSQL 18 istemcisi, Alpine paketi `postgresql18-client`, `/usr/libexec/postgresql18`). Bağlantı bilgileri ve şifre yalnızca alt sürecin ortam değişkenleriyle (`PGHOST`, `PGUSER`, `PGPASSWORD`, …) verilir; komut satırında ve loglarda şifre yoktur. Alt süreç konteynerin diğer gizli ayarlarını görmez.
3. **Doğrulama:** `pg_restore --list` başarılı olmalı ve en az **30** `TABLE DATA` girdisi içermelidir (veritabanında ~70 tablo var; `BACKUP_MIN_TABLES` ile değiştirilebilir). Tablo sayısı ve boyut rapora yazılır.
4. **Şifreleme:** AES-256-GCM, akış halinde (`BACKUP_ENCRYPTION_KEY`). Düz dump'ın SHA-256'sı aynı anda hesaplanır.
5. **Yükleme:** `mittwald-db/db-<UTC zaman>.dump.enc` (ör. `mittwald-db/db-2026-11-05T060012Z.dump.enc`); 16 MB üzeri dosyalar çok parçalı yüklemeyle. Yükleme sonrası boyut HEAD ile kontrol edilir. Ardından aynı adla `.json` manifest yazılır (manifest = yedek tamam).
6. **Saklama:** `mittwald-db/` altında manifesti olan en yeni 30 yedek kalır; daha eskiler (ve eski yarım kalmış dosyalar) silinir. Yalnızca `mittwald-db/db-…` adlı dosyalara dokunulur; `db/` gibi diğer klasörler hiç silinmez. **Yeni yedek başarısızsa hiçbir şey silinmez.**
7. **Özel dosya kontrolü (yalnızca uyarı):** Özel kovadaki (`exxel-estate-private`) dosyalara başvuran satırlar sayılır ve her dosya HEAD ile aranır: `office_verifications.object_key` (ofis belgeleri) ve `tour_capture_jobs` (hazır/kabul edilmiş sonuç, işlenmekte olan kaynak fotoğraflar). Eksikler raporda tablo, satır kimliği (`document_id` / iş kimliği), durum ve anahtarın SHA-256 özetinin ilk 16 karakteriyle listelenir (en fazla 20); anahtarın kendisi ve isimler loglanmaz. Bu kontrol yedeği engellemez.
8. Geçici dosyalar (`os.tmpdir()/em24-backup-*`) her durumda silinir.

Yedek başarısızsa sonuç `failed` olur, günlük iş HTTP 500 döner (mStudio cronjob kaydında görünür) ve sağlık uyarısıyla aynı yoldan `ALERT_EMAIL` (yoksa `EXXEL_ADMIN_EMAIL`) adresine e-posta gider (`offsite-backup`). Özel dosya uyarıları e-posta göndermez, yalnızca sonuçta ve loglarda (`[backup] private media missing`) görünür.

### Dosya biçimi (`.dump.enc`, sürüm 1)

| Bayt | İçerik |
|---|---|
| 0–7 | ASCII `EM24DUMP` |
| 8 | Biçim sürümü (`1`) |
| 9–20 | Rastgele 12 baytlık IV |
| 21 … son 16 hariç | `pg_dump` custom-format dosyasının AES-256-GCM şifreli hali; ilk 21 bayt (başlık) ek doğrulanmış veri (AAD) olarak kullanılır |
| Son 16 | GCM doğrulama etiketi |

Manifest (`.json`): `stamp`, `key`, `createdAt`, `bytes` (düz dump), `sha256` (düz dump), `encryptedBytes`, `encryptedSha256`, `tables`, `appCommit` (imajın commit'i), `encryption: "AES-256-GCM"`. Şifreli nesnenin `x-amz-meta-sha256` meta verisi de düz dump'ın SHA-256'sıdır.

### Ayarlar (mStudio → konteyner `site` → ortam değişkenleri)

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `BACKUP_ENCRYPTION_KEY` | Evet | 32 rastgele bayt, base64 (44 karakter). Üretmek için: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` veya `openssl rand -base64 32`. **Konteyner dışında da güvenli bir yerde saklayın (parola yöneticisi); kaybolursa yedekler açılamaz.** Yoksa veya geçersizse yedek her gün `failed` olur ve uyarı gönderilir. |
| `R2_BACKUP_BUCKET` | Hayır | Varsayılan `estatemarket24-backups` |
| `BACKUP_MIN_TABLES` | Hayır | Varsayılan 30 |
| `PG_BIN_DIR` | Hayır | `pg_dump`/`pg_restore` klasörü; varsayılan `/usr/libexec/postgresql18`, yoksa `PATH` |

R2 kimlik bilgileri sitenin mevcut `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` ayarlarıdır (`mittwald-site` token'ı `estatemarket24-backups` kovasına da okuma/yazma yetkili). `APP_COMMIT` imaja GitHub Actions tarafından yazılır.

### Elle yedek almak

Konteynerin içinde (mStudio → konteyner `site` → konsol/terminal veya tek seferlik cronjob):

```bash
node /app/scripts/cron-call.mjs backup
```

Yalnızca yedeği çalıştırır; çıktı `cron backup: 200 {"job":"backup","ok":true,"backup":{"status":"ok","key":"mittwald-db/…","tables":70,…}}` biçimindedir. Başarısızsa çıkış kodu 1 ve HTTP 500.

### Geri yükleme

Bir yönetici bilgisayarında (sunucuda değil), bu reponun güncel bir kopyasında (`npm run install:ci` yapılmış, PostgreSQL 18 istemcisi kurulu). Anahtar ve R2 bilgileri ortam değişkeniyle verilir, komut satırına yazılmaz:

```bash
export BACKUP_ENCRYPTION_KEY='…'  R2_ENDPOINT='https://<hesap>.eu.r2.cloudflarestorage.com'
export R2_ACCESS_KEY_ID='…'  R2_SECRET_ACCESS_KEY='…'
node scripts/backup-restore.mjs list
node scripts/backup-restore.mjs download mittwald-db/db-2026-11-05T060012Z.dump.enc --out db.dump
# veya elde indirilmiş dosya:
node scripts/backup-restore.mjs file ./db-2026-11-05T060012Z.dump.enc --manifest ./db-2026-11-05T060012Z.json --out db.dump
```

Betik GCM etiketini ve manifestteki SHA-256 ile boyutu kontrol eder; uyuşmazsa çıktı dosyasını siler ve hata verir. Sonra **yeni, boş** bir veritabanına:

```bash
createdb --host <sunucu> --username <kullanıcı> estatemarket24_restore
pg_restore --no-owner --no-privileges --exit-on-error \
  --host <sunucu> --username <kullanıcı> --dbname estatemarket24_restore db.dump
```

(Şifreyi `PGPASSWORD` ortam değişkeniyle veya `~/.pgpass` ile verin.) Tablo ve satır sayılarını kontrol edin; ancak ondan sonra `DATABASE_URL` yeni veritabanına çevrilir. Çalışan üretim veritabanının üzerine doğrudan geri yükleme yapılmaz; veritabanını değiştiren her adım önce sahibine sorulur. `db.dump` şifresizdir: iş bitince silin.

### İzlenecekler

- mStudio cronjob kaydı: günlük işte `"backup":{"status":"ok"…}`; `failed` ise `stage` ve `error` alanları nedeni söyler (`configuration`, `dump`, `verify`, `encrypt`, `upload`).
- E-posta: konu `estatemarket24 sağlık uyarısı / health alert: offsite-backup`.
- `warnings`: saklama (silme) hatası veya eksik özel dosyalar. Eksik ofis belgeleri raporda `office_verifications` + `document_id` ile görünür; yönetim panelinden ilgili başvuru bulunup belge yeniden istenebilir.
- R2 → `estatemarket24-backups` → `mittwald-db/`: her gün bir `.dump.enc` + `.json` çifti, toplam 30 civarı.
- Ayda bir geri yükleme denemesi önerilir (yukarıdaki adımlar, deneme veritabanına).

### Eski yedekler

Neon dönemine ait `db/` klasöründeki yedekler (eski `db-backup.yml`, OpenSSL AES-256-CBC, `BACKUP_PASSPHRASE`) kovada 90 günlük kuralla (`db-backups-90-days`) kendiliğinden silinir; bu iş onlara dokunmaz. Açmak için: `openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in db-<tarih>.dump.enc -out db.dump -pass env:BACKUP_PASSPHRASE`. Eski `.github/workflows/operations.yml` (ChatGPT Sites dönemi) ve `.github/workflows/db-backup.yml` (yalnızca Neon) kaldırıldı; git geçmişinde duruyorlar. GitHub'daki `DB_BACKUP_ENABLED`, `NEON_DIRECT_URL`, `BACKUP_PASSPHRASE`, `R2_BACKUP_*`, `EM24_OPERATIONS_ENABLED` ve `BACKUP_*`/`SMTP_*` ayarları artık kullanılmıyor; `BACKUP_PASSPHRASE`'i eski `db/` yedekleri silinene kadar güvenli yerde tutun.

Sınırlar: Dış kopya aynı Cloudflare hesabındadır; hesabın kaybına karşı bağımsız değildir. İlan fotoğrafları ve özel belgeler R2'de kalıcıdır ama ayrıca kopyalanmaz.

## Dış izleme (`.github/workflows/uptime.yml`)

3 saatte bir `https://p-r9al26.project.space` (veya repository variable `SITE_URL`) üzerinde ana sayfa, ilanlar, site haritası, robots, canlılık (`/api/health/live`), ilan API'si, bir ilan fotoğrafı, güvenlik başlıkları ve yetkisiz erişimlerin reddedildiği (`/api/admin` 403, `/api/messages` 401, `/api/agent-verification?download=1` 401, `/api/export` 403, `/api/backup-storage` 401, demo ilan 404) kontrol edilir. Başarısız çalıştırmada GitHub depo sahibine e-posta gönderir (GitHub → Settings → Notifications → Actions açık olmalı). Özel depoda ayda yaklaşık 240 dakika kullanır. Alan adı bağlanınca `SITE_URL` variable'ı `https://estatemarket24.com` yapılır.

## İç sağlık kontrolü (saatte bir)

`node /app/scripts/cron-call.mjs health` (Mittwald konteyner cronjob'u; Cloudflare yayınında Worker cron'u, her saat :07). `lib/health.ts` veritabanını, ilan fotoğraf deposunu (R2 EU) ve özel depoyu kontrol eder. Sorun olursa loglara `health_check_failed` yazılır ve Resend etkinse `ALERT_EMAIL` (yoksa `EXXEL_ADMIN_EMAIL`) adresine uyarı gönderilir. Loglar: mStudio → konteyner `site` → loglar.
