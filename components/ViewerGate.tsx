"use client";
import { loadAccount } from "@/lib/account-client";
import { useEffect, useState, type ReactNode } from "react";
import { viewerActions, viewerOf, type Viewer, type ViewerAction } from "@/lib/account-actions";

// Shares one /api/account request between the gates that mount together on a page.
let pending: { at: number; viewer: Promise<Viewer> } | null = null;
function loadViewer() {
  if (!pending || Date.now() - pending.at > 3000) pending = { at: Date.now(), viewer: loadAccount().then((data) => viewerOf(data.user)).catch(() => "guest" as const) };
  return pending.viewer;
}
/** The visitor's account type, or null while it loads. */
export function useViewer() {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  useEffect(() => { let live = true; void loadViewer().then((value) => { if (live) setViewer(value); }); return () => { live = false; }; }, []);
  return viewer;
}
/** Shows its children only to account types that need them (lib/account-actions.ts); nothing while loading. */
export function ViewerGate({ action, children }: { action: ViewerAction; children: ReactNode }) {
  const viewer = useViewer();
  return viewer && viewerActions(viewer)[action] ? <>{children}</> : null;
}
