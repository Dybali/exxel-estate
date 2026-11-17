// One /api/account request shared by the site-wide components that mount together on a page (headers, the
// feedback widget, ViewerGate). A page used to ask three to five times on every load.
type AccountAnswer = { user?: (Record<string, unknown> & { id?: string; name?: string; email?: string; email_verified?: number; accountKind?: string }) | null };
let shared: { at: number; answer: Promise<AccountAnswer> } | null = null;
/** The current account; `fresh` skips the shared answer (after a profile change). */
export function loadAccount(fresh = false): Promise<AccountAnswer> {
  if (fresh || !shared || Date.now() - shared.at > 5000)
    shared = { at: Date.now(), answer: fetch("/api/account", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<AccountAnswer> : {}).catch(() => ({})) };
  return shared.answer;
}
