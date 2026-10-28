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
