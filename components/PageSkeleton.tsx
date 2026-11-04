import { T } from "@/lib/i18n";

// Placeholder layouts shown while a slow page loads (app/**/loading.tsx and Suspense fallbacks).
// Styles: .page-skeleton in app/pages.css (subtle shimmer, still with prefers-reduced-motion).
type Variant = "listings" | "listing" | "account";
const LABELS: Record<Variant, string> = { listings: "İlanlar yükleniyor...", listing: "İlan yükleniyor...", account: "Hesabınız yükleniyor..." };

const Bone = ({ className = "" }: { className?: string }) => <div className={`skeleton-bone ${className}`}/>;

export function PageSkeleton({ variant }: { variant: Variant }) {
  return <main className={`container page-skeleton page-skeleton-${variant}`} aria-busy="true">
    <p className="sr-only" role="status"><T id={LABELS[variant]}/></p>
    <div aria-hidden="true">
      {variant === "listings" && <>
        <Bone className="skeleton-title"/>
        <div className="skeleton-filters">{Array.from({ length: 4 }, (_, i) => <Bone key={i} className="skeleton-field"/>)}</div>
        <div className="skeleton-cards">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton-card"><Bone className="skeleton-photo"/><Bone className="skeleton-line"/><Bone className="skeleton-line short"/></div>)}</div>
      </>}
      {variant === "listing" && <>
        <Bone className="skeleton-crumb"/>
        <div className="skeleton-gallery"><Bone/><div><Bone/><Bone/></div></div>
        <div className="skeleton-detail"><div><Bone className="skeleton-title"/><Bone className="skeleton-line"/><Bone className="skeleton-price"/>{Array.from({ length: 4 }, (_, i) => <Bone key={i} className="skeleton-line"/>)}</div><Bone className="skeleton-aside"/></div>
      </>}
      {variant === "account" && <div className="skeleton-account"><div className="skeleton-menu">{Array.from({ length: 6 }, (_, i) => <Bone key={i} className="skeleton-line"/>)}</div><div><Bone className="skeleton-title"/><div className="skeleton-stats">{Array.from({ length: 3 }, (_, i) => <Bone key={i}/>)}</div><Bone className="skeleton-panel"/></div></div>}
    </div>
  </main>;
}
