// Keeps bots from running up the translation bill (app/api/translations). Cached translations are free and
// are served to everyone, crawlers included; only a NEW translation (a paid Gemini call) has to pass:
//   1. not a known bot, crawler, preview fetcher or script (User-Agent);
//   2. a real browser request: same-origin fetch metadata (Sec-Fetch-*) and an Accept-Language header,
//      which every browser sends with fetch() and plain scripts usually do not;
//   3. at most TRANSLATION_IP_LIMIT new translations per visitor (hashed IP) per TRANSLATION_IP_WINDOW.
// The daily and monthly character caps (lib/translation.ts translationCaps) stay the last line of defence.
export const TRANSLATION_IP_LIMIT = 20;
export const TRANSLATION_IP_WINDOW = 60 * 60_000;

// Search engines, SEO tools, link previews, monitoring, HTTP libraries and headless browsers. In-app browsers of
// social apps (Instagram, LinkedIn, Twitter, DuckDuckGo…) are real people and are deliberately not listed; their
// link-preview fetchers either say "bot" or lack "Mozilla/5.0" and are caught below.
const BOT = /bot\b|bot\/|crawl|spider|slurp|scrap|fetcher|preview|monitor|uptime|lighthouse|pagespeed|headless|phantom|puppeteer|playwright|selenium|webdriver|curl\/|wget\/|python|httpx|aiohttp|requests\/|go-http|java\/|okhttp|axios\/|node-fetch|undici|libwww|scrapy|facebookexternalhit|embedly|google-|googleother|apis-google|mediapartners|ahrefs|semrush|mj12|petal|yandex|baidu|bytespider|gptbot|claudebot|anthropic-ai|perplexity|ccbot/i;

export type GuardResult = { allowed: true } | { allowed: false; reason: "bot" | "not_browser" };

/** Whether a request may start a paid translation. */
export function translationRequestAllowed(headers: Headers): GuardResult {
  const agent = headers.get("user-agent") || "";
  if (!agent || agent.length < 20 || BOT.test(agent) || !/mozilla\/5\.0/i.test(agent)) return { allowed: false, reason: "bot" };
  // fetch() from our own page: Sec-Fetch-Site same-origin, Sec-Fetch-Mode cors (all current browsers send these).
  const site = headers.get("sec-fetch-site"), mode = headers.get("sec-fetch-mode");
  if (site !== "same-origin" || (mode !== "cors" && mode !== "same-origin")) return { allowed: false, reason: "not_browser" };
  if (!headers.get("accept-language")) return { allowed: false, reason: "not_browser" };
  return { allowed: true };
}
