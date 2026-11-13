import { handleFirmTrack } from "@/lib/firm-track";
import { trackFirm } from "@/lib/service-extras";
import { ensureServices } from "@/lib/services";
import { servicesDB } from "@/lib/services-server";

// Profile views, contact clicks and search appearances of approved service firms (lib/firm-track.ts).
export async function POST(request: Request) {
  return handleFirmTrack(request, "service", async (firmId, kind) => { await ensureServices(servicesDB()); return trackFirm(servicesDB(), firmId, kind); });
}
