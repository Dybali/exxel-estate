import { Explorer } from "@/components/Explorer";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Suspense } from "react";
export default function ListingsPage(){return <Suspense fallback={<PageSkeleton variant="listings"/>}><Explorer/></Suspense>}
