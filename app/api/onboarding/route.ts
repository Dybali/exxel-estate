import { currentUser, db, error, ok } from "@/lib/server";
import { accountKind, type KindDatabase } from "@/lib/account-kind";
import { onboardingFacts, type OnboardingDatabase } from "@/lib/onboarding";

// Facts behind the start checklist in Hesabım (lib/onboarding.ts): which first steps this account has done.
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return error("Giriş yapın.", 401);
  const kind = await accountKind(db() as unknown as KindDatabase, user);
  const facts = await onboardingFacts(db() as unknown as OnboardingDatabase, user as unknown as { id: string; avatar_url?: string | null; phone?: string | null });
  return ok({ kind, facts }, { headers: { "Cache-Control": "private, no-store" } });
}
