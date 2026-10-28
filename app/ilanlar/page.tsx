import { Explorer } from "@/components/Explorer";
import { Suspense } from "react";
export default function ListingsPage(){return <Suspense fallback={<main className="container" style={{minHeight:"70vh",paddingTop:60}}>İlanlar yükleniyor...</main>}><Explorer/></Suspense>}
