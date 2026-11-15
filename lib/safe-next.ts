// Where to go after signing in: only a path on this site. Resolving it as a URL also catches tricks
// the browser would turn into another site ("//host", "/<tab>/host", backslashes).
// Shared by the server (Google sign-in) and the browser (sign-in forms).
export function safeNextPath(value: string | null, fallback = "/hesabim") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, "https://exxel.invalid");
    if (url.origin !== "https://exxel.invalid") return fallback;
    if (url.pathname.startsWith("/api/auth/")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
