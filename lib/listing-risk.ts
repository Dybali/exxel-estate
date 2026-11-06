// Sahte ve tekrar ilan tespiti (fraud and duplicate detection). Pure module shared by the server
// (scoring, lib/listing-risk-server.ts) and the browser (photo fingerprint in lib/photo-optimize.ts).
// The result is advisory for administrators: it never deletes or rejects a listing. Only a "high"
// score sends a non-admin's new or edited listing to review instead of publishing it directly.
// Everything is stored in listings.presentation (no schema change) and stripped from public output
// (lib/listing-location.ts publicPresentation). docs/listing-risk.md explains the signals.

/** Score bands. Conservative: a single signal never reaches "high"; medium only flags for admins. */
export const RISK_THRESHOLDS = { medium: 35, high: 70 } as const;
/** dHash Hamming distance at or below which two photos count as the same picture. */
export const PHOTO_HAMMING_MAX = 8;
/** Word-shingle Jaccard similarity at or above which two texts count as copies. */
export const TEXT_SIMILARITY_MIN = 0.6;
/** Same-owner text-only duplicates need a near-identical text (agents reuse their own templates). */
export const OWN_TEXT_SIMILARITY_MIN = 0.8;
/** Candidate listings compared per check (same city or same owner, newest first). */
export const RISK_CANDIDATE_LIMIT = 500;
/** Price per m² is judged only against at least this many comparable listings. */
export const PRICE_MIN_COMPARABLES = 5;
/** Accounts younger than this many days posting at least BURST_LISTINGS listings in 24 hours. */
export const BURST_ACCOUNT_DAYS = 7;
export const BURST_LISTINGS = 10;
/** Photos fingerprinted per listing by the admin backfill. */
export const BACKFILL_PHOTOS = 12;
/** Owner-facing note on a listing sent to review by the check (ManagedListings translates it). */
export const RISK_REVIEW_NOTE = "İlanınız kontrol için incelemeye alındı.";
/** presentation keys that never leave the server. */
export const RISK_PRIVATE_KEYS = ["risk", "riskFlag", "photoHashes"] as const;

export type RiskLevel = "low" | "medium" | "high";
export type RiskCode = "photos_other_owner" | "text_other_owner" | "own_duplicate" | "price_low" | "price_high" | "scam_terms" | "payment_terms" | "external_contact" | "phone_reused" | "new_account_burst";
export type RiskReason = { code: RiskCode; weight: number; params?: Record<string, string | number> };
export type RiskMatch = { id: string; sameOwner: boolean; photos: number; exact: number; text: number; attributes: boolean };
export type RiskAssessment = { v: 1; score: number; level: RiskLevel; reasons: RiskReason[]; matches: RiskMatch[]; checkedAt: string; signature: string[] };
export type RiskReview = { state: "cleared"; at: string; by: string; byName: string; keys: string[] };
export type StoredRisk = RiskAssessment & { review?: RiskReview };

/** Turkish label templates (dictionary keys, lib/duplicate-translations.ts); {name} = params. */
export const RISK_REASON_LABELS: Record<RiskCode, string> = {
  photos_other_owner: "Başka hesapların {listings} ilanında aynı veya çok benzer fotoğraf ({photos} fotoğraf)",
  text_other_owner: "Başka bir hesabın ilanıyla metin benzerliği: %{similarity}",
  own_duplicate: "Aynı hesabın yayındaki {listings} ilanıyla neredeyse aynı",
  price_low: "m² fiyatı bölgedeki benzer ilanlara göre çok düşük ({perSqm} TL; medyan {median} TL, {comparables} ilan)",
  price_high: "m² fiyatı bölgedeki benzer ilanlara göre çok yüksek ({perSqm} TL; medyan {median} TL, {comparables} ilan)",
  scam_terms: "Dolandırıcılıkta sık geçen ifadeler: {terms}",
  payment_terms: "Ön ödeme veya kapora ifadeleri: {terms}",
  external_contact: "Açıklamada site dışı iletişim bilgisi: {kinds}",
  phone_reused: "Telefon numarası {accounts} başka hesapta da kullanılıyor",
  new_account_burst: "{days} günlük hesap 24 saatte {listings} ilan verdi",
};
export const CONTACT_KIND_LABELS: Record<string, string> = { url: "web bağlantısı", email: "e-posta", phone: "telefon", messenger: "mesajlaşma uygulaması" };

// ---------------------------------------------------------------- photo fingerprints (dHash, 64 bit)

const popcount = (value: number) => {
  let x = value >>> 0;
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
};
const halves = (hash: string) => [parseInt(hash.slice(0, 8), 16), parseInt(hash.slice(8, 16), 16)];

/** dHash of a 9×8 grayscale grid (row-major, 72 values): bit = left pixel brighter than its right neighbour. */
export function dHashFromGray(gray: ArrayLike<number>): string {
  if (gray.length !== 72) throw new Error("dHash needs a 9×8 grayscale grid");
  const words = [0, 0];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const bit = y * 8 + x, on = gray[y * 9 + x] > gray[y * 9 + x + 1];
    if (on) words[bit >> 5] = (words[bit >> 5] | (1 << (31 - (bit & 31)))) >>> 0;
  }
  return words.map((word) => word.toString(16).padStart(8, "0")).join("");
}

/** 16 lowercase hex digits. Near-uniform pictures (almost all bits equal) are refused: they match anything. */
export function validPhotoHash(value: unknown): value is string {
  if (typeof value !== "string" || !/^[0-9a-f]{16}$/.test(value)) return false;
  const bits = halves(value).reduce((sum, half) => sum + popcount(half), 0);
  return bits >= 4 && bits <= 60;
}

export function hammingDistance(a: string, b: string) {
  const [a1, a2] = halves(a), [b1, b2] = halves(b);
  return popcount(a1 ^ b1) + popcount(a2 ^ b2);
}

/** Number of photos in `mine` that have a near-identical photo in `theirs`. */
export function matchingPhotos(mine: string[], theirs: string[], max = PHOTO_HAMMING_MAX) {
  const other = theirs.filter(validPhotoHash);
  if (!other.length) return 0;
  return mine.filter(validPhotoHash).filter((hash) => other.some((candidate) => hammingDistance(hash, candidate) <= max)).length;
}

/** presentation.photoHashes ({url: hash}) as a list of valid hashes for the listing's current photos. */
export function photoHashList(stored: unknown, images?: string[]): string[] {
  let map = stored;
  if (typeof map === "string") { try { map = JSON.parse(map); } catch { return []; } }
  if (!map || typeof map !== "object" || Array.isArray(map)) return [];
  const entries = Object.entries(map as Record<string, unknown>);
  return entries.filter(([url, hash]) => (!images || images.includes(url)) && validPhotoHash(hash)).map(([, hash]) => hash as string);
}

// ---------------------------------------------------------------- text

const FOLD: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u", ß: "ss", æ: "ae", œ: "oe", ø: "o",
  // Arabic and Persian spellings of the same letters, alef forms and taa marbuta.
  "ی": "ي", "ى": "ي", "ک": "ك", "أ": "ا", "إ": "ا", "آ": "ا", "ة": "ه", "ـ": "" };

/** Turkish-aware folding: İ/I lower-case correctly, diacritics dropped, punctuation to single spaces. */
export function foldText(value: string) {
  return value.toLocaleLowerCase("tr").replace(/[çğıöşüâîûßæœøیىکأإآةـ]/g, (char) => FOLD[char] ?? char)
    .normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

const fnv = (text: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  return hash >>> 0;
};

/** Hashed word 3-shingles of the folded text (first 900 words). Short texts use single words. */
export function textShingles(value: string, size = 3) {
  const words = foldText(value).split(" ").filter(Boolean).slice(0, 900), result = new Set<number>();
  if (words.length < size) { for (const word of words) result.add(fnv(word)); return result; }
  for (let i = 0; i + size <= words.length; i++) result.add(fnv(words.slice(i, i + size).join(" ")));
  return result;
}

export function jaccard(a: Set<number>, b: Set<number>) {
  if (!a.size || !b.size) return 0;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const item of small) if (large.has(item)) shared++;
  return shared / (a.size + b.size - shared);
}

export const textSimilarity = (a: string, b: string) => jaccard(textShingles(a), textShingles(b));

// ---------------------------------------------------------------- scam phrases (8 languages)

// Strong: payment routes and stories typical of rental and sale fraud. Weak: advance payment or
// deposit wording, which honest advertisers also use. Matched at word starts on folded text, so
// suffixes ("kaporayı", "предоплату") match too. Plain "depozito"/"deposit"/"Kaution" are left out:
// a rental deposit is normal.
const STRONG_TERMS = [
  "western union", "westernunion", "moneygram", "money gram", "bitcoin", "kripto para ile", "usdt",
  // tr
  "yurt disindayim", "yurtdisindayim", "anahtari kargo", "anahtarlari kargo", "gormeden kapora", "gormeden odeme", "hediye karti",
  // en
  "gift card", "i am abroad", "i am currently abroad", "i m abroad", "keys by post", "keys by courier", "send you the keys", "pay before viewing", "deposit before viewing", "deposit before the viewing",
  // de
  "ich bin im ausland", "schlussel per post", "schlussel per kurier", "vorkasse", "zahlung vor besichtigung",
  // fr
  "mandat cash", "je suis a l etranger", "cles par la poste", "cle par la poste", "paiement avant visite", "carte cadeau",
  // ar
  "ويسترن يونيون", "موني جرام", "انا خارج البلد", "انا مسافر", "بطاقه هدايا", "المفاتيح بالبريد",
  // fa
  "وسترن یونیون", "مانی گرام", "خارج از کشور هستم", "کارت هدیه", "کلید را پست",
  // ru
  "вестерн юнион", "я за границей", "я нахожусь за границей", "ключи почтой", "ключи курьером", "подарочн",
  // nl
  "ik zit in het buitenland", "ik woon in het buitenland", "sleutels per post", "sleutel per post", "betalen voor bezichtiging",
];
const WEAK_TERMS = [
  // tr
  "kapora", "on odeme", "onceden odeme", "odemeyi once", "havale ile rezervasyon",
  // en
  "advance payment", "upfront payment", "pay upfront", "payment in advance", "wire transfer",
  // de
  "vorauszahlung", "anzahlung", "uberweisung vorab", "vorab uberweisen",
  // fr
  "acompte", "paiement d avance", "paiement anticipe", "virement avant",
  // ar
  "دفعه مقدمه", "عربون", "تحويل مسبق",
  // fa
  "پیش پرداخت", "بیعانه",
  // ru
  "предоплат", "задаток", "аванс",
  // nl
  "vooruitbetaling", "aanbetaling", "vooraf betalen", "vooraf overmaken",
];
const fold = (terms: string[]) => [...new Set(terms.map(foldText).filter(Boolean))];
const STRONG = fold(STRONG_TERMS), WEAK = fold(WEAK_TERMS);

export function scamTerms(text: string) {
  const folded = " " + foldText(text) + " ";
  const find = (terms: string[]) => terms.filter((term) => folded.includes(" " + term));
  return { strong: find(STRONG), weak: find(WEAK) };
}

// ---------------------------------------------------------------- contact details in the text

/** Turkish and international phone numbers as +E.164, the form users.phone is stored in (lib/phone.ts). */
export function phonesIn(text: string) {
  const found = new Set<string>();
  for (const match of text.matchAll(/(?:\+|00)?\d[\d\s().-]{8,18}\d/g)) {
    const compact = match[0].replace(/[\s().-]/g, "").replace(/^00/, "+");
    const normalized = /^0[5-9]\d{9}$/.test(compact) ? `+9${compact}` : /^[5-9]\d{9}$/.test(compact) ? `+90${compact}` : compact;
    if (/^\+[1-9]\d{9,14}$/.test(normalized)) found.add(normalized);
  }
  return [...found];
}

export function externalContacts(text: string) {
  const kinds: string[] = [], folded = " " + foldText(text) + " ";
  if (/\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]{2,}\.(?:com|net|org|info|biz|io|co|tr|de|fr|nl|ru|uk|me)\b(?!\s*m²)/i.test(text)) kinds.push("url");
  if (/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(text)) kinds.push("email");
  const phones = phonesIn(text);
  if (phones.length) kinds.push("phone");
  if ([" whatsapp", " whats app", " telegram", " viber", " wechat", " signal app", " wa me ", " t me "].some((term) => folded.includes(term))) kinds.push("messenger");
  return { kinds, phones };
}

// ---------------------------------------------------------------- price per m²

export function quartiles(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b), at = (p: number) => {
    const index = (sorted.length - 1) * p, low = Math.floor(index), high = Math.ceil(index);
    return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
  };
  return { q1: at(0.25), median: at(0.5), q3: at(0.75) };
}

/**
 * Price per m² far outside comparable listings (same district, purpose and type, TL prices).
 * Low: below Q1 − 1.5·IQR and below half the median (bait prices). High: above Q3 + 3·IQR and
 * above three times the median (usually a typo, rarely fraud). Fewer than PRICE_MIN_COMPARABLES: null.
 */
export function priceAnomaly(perSqm: number, comparables: number[]) {
  const values = comparables.filter((value) => Number.isFinite(value) && value > 0);
  if (!(perSqm > 0) || values.length < PRICE_MIN_COMPARABLES) return null;
  const { q1, median, q3 } = quartiles(values), iqr = q3 - q1;
  const params = { perSqm: Math.round(perSqm), median: Math.round(median), comparables: values.length };
  if (perSqm < q1 - 1.5 * iqr && perSqm < median * 0.5) return { direction: "low" as const, ...params };
  if (perSqm > q3 + 3 * iqr && perSqm > median * 3) return { direction: "high" as const, ...params };
  return null;
}

// ---------------------------------------------------------------- scoring

export type RiskSubject = { id: string; ownerId: string; title: string; description: string; purpose: string; propertyType: string; city: string; district: string; price: number; currency: string; grossArea: number; photoHashes: string[] };
export type RiskCandidate = Omit<RiskSubject, "photoHashes"> & { photoHashes: string[]; status: string; expiresAt?: string | null; exact?: number };
export type RiskContext = {
  candidates: RiskCandidate[];
  /** Price per m² of comparable published listings. */
  comparables: number[];
  owner: { createdAt?: string | null; recentListings: number };
  /** Other accounts using the owner's phone or a phone written in the description. */
  phoneAccounts: number;
  now: Date;
};

export function riskLevel(score: number): RiskLevel {
  return score >= RISK_THRESHOLDS.high ? "high" : score >= RISK_THRESHOLDS.medium ? "medium" : "low";
}
export function scoreRisk(reasons: RiskReason[]) {
  const score = Math.min(100, reasons.reduce((sum, reason) => sum + reason.weight, 0));
  return { score, level: riskLevel(score) };
}

const isDemoId = (id: string) => /^(ex-|sample-)/.test(id);
const live = (candidate: RiskCandidate, now: Date) =>
  candidate.status === "pending" || candidate.status === "published" && !(candidate.expiresAt && Date.parse(candidate.expiresAt) <= now.getTime());
const close = (a: number, b: number, share = 0.1) => a > 0 && b > 0 && Math.abs(a - b) <= share * Math.max(a, b);

export function evaluateRisk(subject: RiskSubject, context: RiskContext): RiskAssessment {
  const reasons: RiskReason[] = [], matches: (RiskMatch & { live: boolean; sameKind: boolean })[] = [];
  const mine = textShingles(`${subject.title} ${subject.description}`);
  const ownPhones = new Set(phonesIn(subject.description));
  const seen = new Set<string>();
  let phoneListings = 0;
  for (const candidate of context.candidates) {
    if (candidate.id === subject.id || isDemoId(candidate.id) || seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    const sameOwner = candidate.ownerId === subject.ownerId;
    const photos = matchingPhotos(subject.photoHashes, candidate.photoHashes), exact = candidate.exact || 0;
    const text = jaccard(mine, textShingles(`${candidate.title} ${candidate.description}`));
    const attributes = candidate.city === subject.city && candidate.district === subject.district && candidate.purpose === subject.purpose
      && candidate.propertyType === subject.propertyType && candidate.currency === subject.currency && close(candidate.price, subject.price)
      && (!candidate.grossArea || !subject.grossArea || close(candidate.grossArea, subject.grossArea));
    if (!sameOwner && ownPhones.size && phonesIn(candidate.description).some((phone) => ownPhones.has(phone))) phoneListings++;
    if (exact > 0 || photos > 0 || text >= TEXT_SIMILARITY_MIN || attributes && text >= 0.35)
      matches.push({ id: candidate.id, sameOwner, photos, exact, text: Math.round(text * 100), attributes, live: live(candidate, context.now),
        sameKind: candidate.purpose === subject.purpose && candidate.propertyType === subject.propertyType && candidate.city === subject.city });
  }

  // Photos or text copied from another account's listing.
  const others = matches.filter((match) => !match.sameOwner);
  const photoOthers = others.filter((match) => match.photos > 0 || match.exact > 0);
  if (photoOthers.length) {
    const photos = Math.max(...photoOthers.map((match) => Math.max(match.photos, match.exact))), exact = photoOthers.some((match) => match.exact > 0);
    reasons.push({ code: "photos_other_owner", weight: exact || photos >= 4 ? 40 : photos >= 2 ? 35 : 20, params: { listings: photoOthers.length, photos } });
  }
  const textOthers = others.filter((match) => match.text >= TEXT_SIMILARITY_MIN * 100);
  if (textOthers.length) {
    const similarity = Math.max(...textOthers.map((match) => match.text));
    reasons.push({ code: "text_other_owner", weight: similarity >= 85 ? 20 : 15, params: { listings: textOthers.length, similarity } });
  }
  // The same account repeating a live listing (duplicate spam). Sale and rent of one home are allowed.
  const own = matches.filter((match) => match.sameOwner && match.live && match.sameKind
    && (match.exact > 0 || match.photos >= 2 || match.text >= OWN_TEXT_SIMILARITY_MIN * 100 && match.attributes));
  if (own.length) reasons.push({ code: "own_duplicate", weight: own.length >= 2 ? 35 : 25, params: { listings: own.length } });

  if (subject.currency === "TRY" && subject.grossArea > 0) {
    const anomaly = priceAnomaly(subject.price / subject.grossArea, context.comparables);
    if (anomaly) reasons.push({ code: anomaly.direction === "low" ? "price_low" : "price_high", weight: anomaly.direction === "low" ? 25 : 5, params: { perSqm: anomaly.perSqm, median: anomaly.median, comparables: anomaly.comparables } });
  }

  const text = `${subject.title}\n${subject.description}`, terms = scamTerms(text);
  if (terms.strong.length) reasons.push({ code: "scam_terms", weight: 30, params: { terms: terms.strong.slice(0, 5).join(", ") } });
  else if (terms.weak.length) reasons.push({ code: "payment_terms", weight: 12, params: { terms: terms.weak.slice(0, 5).join(", ") } });
  const contacts = externalContacts(text);
  if (contacts.kinds.length) reasons.push({ code: "external_contact", weight: 8, params: { kinds: contacts.kinds.join(",") } });

  const accounts = context.phoneAccounts + phoneListings;
  if (accounts > 0) reasons.push({ code: "phone_reused", weight: 20, params: { accounts } });

  const created = context.owner.createdAt ? Date.parse(context.owner.createdAt) : NaN;
  if (Number.isFinite(created)) {
    const days = (context.now.getTime() - created) / 86400000;
    if (days < BURST_ACCOUNT_DAYS && context.owner.recentListings >= BURST_LISTINGS)
      reasons.push({ code: "new_account_burst", weight: 15, params: { days: Math.max(0, Math.floor(days)), listings: context.owner.recentListings } });
  }

  const { score, level } = scoreRisk(reasons);
  const kept = matches.map(({ id, sameOwner, photos, exact, text, attributes }) => ({ id, sameOwner, photos, exact, text, attributes }))
    .sort((a, b) => b.exact - a.exact || b.photos - a.photos || b.text - a.text).slice(0, 10);
  // The signature decides whether an administrator's "Sorun yok" still covers a later check.
  const signature = [...new Set([...reasons.map((reason) => reason.code), ...photoOthers.map((match) => "listing:" + match.id), ...textOthers.map((match) => "listing:" + match.id), ...own.map((match) => "listing:" + match.id)])].sort();
  return { v: 1, score, level, reasons, matches: kept, checkedAt: context.now.toISOString(), signature };
}

// ---------------------------------------------------------------- presentation lifecycle

export function riskOf(presentation: unknown): StoredRisk | null {
  let value = presentation;
  if (typeof value === "string") { try { value = JSON.parse(value); } catch { return null; } }
  const risk = value && typeof value === "object" ? (value as Record<string, unknown>).risk : null;
  if (!risk || typeof risk !== "object" || typeof (risk as StoredRisk).score !== "number" || !Array.isArray((risk as StoredRisk).reasons)) return null;
  return risk as StoredRisk;
}

/** Whether an administrator's earlier "Sorun yok" covers every reason and listing of this check. */
export function reviewCovers(review: RiskReview | undefined, assessment: RiskAssessment) {
  return Boolean(review && assessment.signature.every((key) => review.keys.includes(key)));
}

/**
 * Writes the assessment into `target` (the presentation being saved), keeping an earlier admin
 * review from `previous`. Returns the open flag and whether a non-admin's save goes to review.
 */
export function applyRisk(target: Record<string, unknown>, previous: unknown, assessment: RiskAssessment, actorIsAdmin: boolean) {
  const review = riskOf(previous)?.review;
  target.risk = { ...assessment, ...(review ? { review } : {}) };
  const flag: RiskLevel | null = assessment.level !== "low" && !reviewCovers(review, assessment) ? assessment.level : null;
  if (flag) target.riskFlag = flag; else delete target.riskFlag;
  return { flag, route: routeToReview(flag, actorIsAdmin) };
}

/** Only a high, unreviewed score holds back publication, and never for an administrator's save. */
export function routeToReview(flag: RiskLevel | null, actorIsAdmin: boolean) {
  return flag === "high" && !actorIsAdmin;
}

/** "Sorun yok": the open flag is closed; the same reasons and listings will not flag it again. */
export function clearRisk(presentation: Record<string, unknown>, admin: { id: string; name: string }, at: string) {
  const risk = riskOf(presentation);
  if (!risk) return null;
  const { riskFlag: _closed, ...rest } = presentation;
  return { ...rest, risk: { ...risk, review: { state: "cleared", at, by: admin.id, byName: admin.name, keys: risk.signature } satisfies RiskReview } };
}

/** presentation without the detection data (risk, open flag, photo fingerprints). */
export function withoutRiskData<T>(presentation: T): T {
  if (!presentation || typeof presentation !== "object" || Array.isArray(presentation)) return presentation;
  if (!RISK_PRIVATE_KEYS.some((key) => key in (presentation as Record<string, unknown>))) return presentation;
  const copy = { ...(presentation as Record<string, unknown>) };
  for (const key of RISK_PRIVATE_KEYS) delete copy[key];
  return copy as T;
}

/** What an administrator sees of a stored check (admin APIs only): the open flag and the latest result. */
export function adminRiskView(presentation: unknown) {
  let value = presentation;
  if (typeof value === "string") { try { value = JSON.parse(value); } catch { return null; } }
  const risk = riskOf(value);
  if (!risk) return null;
  const flag = (value as Record<string, unknown>).riskFlag;
  const { signature: _signature, ...visible } = risk;
  return { ...visible, flag: flag === "high" || flag === "medium" ? flag as RiskLevel : null };
}
export type AdminRiskView = NonNullable<ReturnType<typeof adminRiskView>>;
