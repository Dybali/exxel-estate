// Only public https hosts by name; IP literals, local names, credentials and odd ports are refused.
export function safeImageUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2000) return null;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return null;
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") || host === "localhost" || /^[\d.]+$/.test(host) || host.startsWith("[")) return null;
  return url;
}

// Loopback, private, link-local, carrier-grade NAT, multicast/reserved and their IPv6 forms.
export function privateAddress(ip: string) {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  const parts = v4.split(".").map(Number);
  if (parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [a, b] = parts;
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
  }
  const lower = ip.toLowerCase();
  return lower === "::" || lower === "::1" || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower) || lower.startsWith("ff");
}

// On the Node server (Mittwald) a public-looking name could resolve to an internal address; refuse
// it before connecting. Cloudflare Workers cannot reach private networks, so nothing to check there.
export async function resolvesToPublicAddress(host: string) {
  if ((globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent === "Cloudflare-Workers") return true;
  try {
    const dns = await import("node:dns");
    const addresses = await dns.promises.lookup(host, { all: true });
    return addresses.length > 0 && addresses.every((entry) => !privateAddress(entry.address));
  } catch { return false; }
}
