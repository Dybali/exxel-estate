import type { Metadata } from "next";
import { Explorer } from "@/components/Explorer";
import { Suspense } from "react";
export const metadata:Metadata={title:"Satılık ve Kiralık İlanlar | Exxel Estate",description:"Türkiye'deki daire, villa, müstakil ev, arsa ve ticari gayrimenkulleri ayrıntılı filtrelerle keşfedin."};
export default function ListingsPage(){return <Suspense fallback={<main className="container" style={{minHeight:"70vh",paddingTop:60}}>İlanlar yükleniyor...</main>}><Explorer/></Suspense>}
