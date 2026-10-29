import { Explorer } from "@/components/Explorer";
import { Suspense } from "react";
import { T } from "@/lib/i18n";
export default function ListingsPage(){return <Suspense fallback={<main className="container" style={{minHeight:"70vh",paddingTop:60}}><T id="İlanlar yükleniyor..."/></main>}><Explorer/></Suspense>}
