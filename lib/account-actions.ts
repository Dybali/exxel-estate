// Which calls to action a visitor sees, by account type (owner's request 2026-11-16: "everyone sees what they
// need"). One place for every header, footer and landing page, matching the Hesabım menus of
// lib/account-panel.ts: firm accounts have no listing manager, so they are not offered "İlan Ver"; only
// visitors without an account are invited to add a firm (a firm account reaches its panel from the account
// button); a firm is not asked to request quotes from its own competitors.
import type { AccountKind } from "./account-kind";

export type Viewer = "guest" | AccountKind;
export type ViewerAction = "postListing" | "addServiceFirm" | "addContractorFirm" | "serviceQuote" | "landQuote" | "servicePlans" | "contractorPlans" | "signUp" | "bulkUpload" | "projectSales" | "abroadListing";

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
    // Real-estate side: sign-up invitations only for visitors; XML bulk upload and project sales are estate-agent
    // tools (Hesabım › Projelerim is an agent tab); "advertise from abroad" speaks to private owners.
    signUp: viewer === "guest",
    bulkUpload: viewer === "guest" || viewer === "agent",
    projectSales: viewer === "guest" || viewer === "agent",
    abroadListing: viewer === "guest" || viewer === "individual",
  };
}

/** The viewer from an /api/account answer: no user is a guest; an older account without a type is individual. */
export const viewerOf = (user: { accountKind?: string | null } | null | undefined): Viewer =>
  !user ? "guest" : (["individual", "agent", "contractor", "service"].includes(String(user.accountKind)) ? user.accountKind as AccountKind : "individual");
