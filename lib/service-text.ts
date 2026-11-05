// Text keys for the service directory search (/hizmetler/ara). Pure and dependency free: used by
// lib/services.ts when a firm is saved and when a visitor searches, so both sides fold text the same
// way. SQL LOWER() cannot be trusted for Turkish (SQLite only folds ASCII, PostgreSQL depends on the
// database locale), so the folded text is stored in service_firm_search and matched with plain LIKE.

/** Lower case, Turkish-aware, accents removed: "İSTANBUL Işık Çatı" → "istanbul isik cati". I/ı/İ/i all become "i". */
export function serviceSearchKey(value: string) {
  return value.toLocaleLowerCase("tr").replace(/ı/g, "i").normalize("NFKD").replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Search words of a visitor's query (at most 8, 100 characters in all). Wildcards cannot survive the folding. */
export function serviceSearchTokens(value: unknown) {
  return typeof value === "string" ? serviceSearchKey(value.slice(0, 100)).split(" ").filter(Boolean).slice(0, 8) : [];
}

// Turkish alphabet order (a b c ç d … g ğ h ı i … o ö … s ş … u ü …) as plain lower-case letters and
// digits, which every collation sorts the same way: each letter becomes two characters, a Turkish
// letter sorts right after its base letter ("c1" after "c0…"), dotless ı after h ("h1" before "i0"),
// a space ("00") before any digit ("0a"–"0j") or letter.
const TURKISH: Record<string, string> = { ç: "c1", ğ: "g1", ı: "h1", ö: "o1", ş: "s1", ü: "u1" };
const DIGITS = "abcdefghij";

/** Sort key for "A–Z" that gives Turkish alphabetical order on PostgreSQL and SQLite alike. */
export function serviceNameSortKey(name: string) {
  let key = "", space = false;
  for (const char of name.toLocaleLowerCase("tr")) {
    let part = TURKISH[char];
    if (!part) {
      const base = char.normalize("NFKD").replace(/\p{M}/gu, "");
      if (/^[a-z]$/.test(base)) part = `${base}0`;
      else if (/^[0-9]$/.test(base)) part = `0${DIGITS[Number(base)]}`;
      else if (/^\p{L}$/u.test(base)) part = `${base}0`;
    }
    if (!part) { space = key.length > 0; continue; }
    if (space) { key += "00"; space = false; }
    key += part;
    if (key.length >= 160) break;
  }
  return key.slice(0, 160);
}
