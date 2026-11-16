// Which calls to action a visitor sees, by account type (owner's request 2026-11-16: "everyone sees what they
// need"). One place for every header, footer and landing page, matching the Hesabım menus of
// lib/account-panel.ts: firm accounts have no listing manager, so they are not offered "İlan Ver"; only
// visitors without an account are invited to add a firm (a firm account reaches its panel from the account
// button); a firm is not asked to request quotes from its own competitors.
import type { AccountKind } from "./account-kind";

export type Viewer = "guest" | AccountKind;
export type ViewerAction = "postListing" | "addServiceFirm" | "addContractorFirm" | "serviceQuote" | "landQuote" | "servicePlans" | "contractorPlans";

export function viewerActions(viewer: Viewer): Record<ViewerAction, boolean> {
  const firm = viewer === "service" || viewer === "contractor";
  return {
    postListing: !firm,
    addServiceFirm: viewer === "guest",
    addContractorFirm: viewer === "guest",
    serviceQuote: viewer !== "service",
    landQuote: viewer !== "contractor",
    // Packages (docs/firm-plans.md): for visitors weighing a sign-up and for firms of that kind.
    servicePlans: viewer === "guest" || viewer === "service",
    contractorPlans: viewer === "guest" || viewer === "contractor",
  };
}

/** The viewer from an /api/account answer: no user is a guest; an older account without a type is individual. */
export const viewerOf = (user: { accountKind?: string | null } | null | undefined): Viewer =>
  !user ? "guest" : (["individual", "agent", "contractor", "service"].includes(String(user.accountKind)) ? user.accountKind as AccountKind : "individual");
