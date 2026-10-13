import type { Metadata } from "next";
import { Explorer } from "@/components/Explorer";
export const metadata:Metadata={title:"Satılık ve Kiralık İlanlar | Excell Estate",description:"Türkiye'deki daire, villa, müstakil ev, arsa ve ticari gayrimenkulleri ayrıntılı filtrelerle keşfedin."};
export default function ListingsPage(){return <Explorer/>}
