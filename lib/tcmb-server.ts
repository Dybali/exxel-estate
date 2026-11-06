import { cache } from "react";
import { waitUntil } from "./runtime";
import { createBulletinCache, TCMB_TODAY_XML, type Bulletin, type BulletinStore, type RateSnapshot } from "./tcmb";

// Server side of the TCMB rates (lib/tcmb.ts). One cache per Worker isolate / Node process, re-checked
// at most every 15 minutes. Where the standard Cache API exists (Cloudflare Workers) the last good
// bulletin is also kept there, so a fresh isolate can still show it while TCMB is unreachable. On
// Node (Mittwald) the in-memory copy is the only one; without any usable bulletin prices stay in TL.

const STORE_KEY = "https://rates.estatemarket24.internal/tcmb-bulletin.json";
const cacheStore: BulletinStore | null = typeof caches === "undefined" ? null : {
  async read() {
    const response = await (await caches.open("em24-tcmb")).match(STORE_KEY);
    return response ? response.json() : null;
  },
  async write(bulletin: Bulletin) {
    // Kept for up to 21 days (TCMB_MAX_AGE_DAYS); bulletinUsable rejects older copies anyway.
    await (await caches.open("em24-tcmb")).put(STORE_KEY, new Response(JSON.stringify(bulletin), { headers: { "Content-Type": "application/json", "Cache-Control": "max-age=1814400" } }));
  },
};

const bulletins = createBulletinCache({
  store: cacheStore,
  async fetchXml() {
    const response = await fetch(TCMB_TODAY_XML, { headers: { Accept: "application/xml,text/xml" }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`TCMB ${response.status}`);
    return response.text();
  },
});

/** Longest a page waits for a TCMB check; a slower check finishes in the background for later requests. */
const WAIT_MS = 1500;
const SLOW = Symbol("slow");

/** Current snapshot (null: no usable bulletin, prices stay in TL). Never throws. */
export async function currentRates(): Promise<RateSnapshot | null> {
  const update = bulletins.get().catch(() => bulletins.peek());
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof SLOW>((resolve) => { timer = setTimeout(() => resolve(SLOW), WAIT_MS); });
  const result = await Promise.race([update, timeout]);
  clearTimeout(timer);
  if (result === SLOW) {
    try { waitUntil(update); } catch { /* outside a request */ }
    return bulletins.peek();
  }
  return result;
}

/** One snapshot per server request: every price on a page uses the same bulletin. */
export const requestRates = cache(currentRates);
