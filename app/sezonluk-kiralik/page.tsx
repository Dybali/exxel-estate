import { permanentRedirect } from "next/navigation";

// Seasonal rentals open as a list of results (like the big portals, owner's request 2026-11-17): the listing
// search with purpose "gunluk", one listing per line and the holiday destinations as chips (components/Explorer.tsx).
export default function Page() { permanentRedirect("/ilanlar?purpose=gunluk"); }
