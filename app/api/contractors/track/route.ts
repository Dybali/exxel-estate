import { handleFirmTrack } from "@/lib/firm-track";
import { ensureContractors, trackContractor } from "@/lib/contractors";
import { contractorsDB } from "@/lib/contractors-server";

// Profile views, contact clicks and search appearances of approved contractor firms (lib/firm-track.ts).
export async function POST(request: Request) {
  return handleFirmTrack(request, "contractor", async (firmId, kind) => { await ensureContractors(contractorsDB()); return trackContractor(contractorsDB(), firmId, kind); });
}
