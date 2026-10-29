import { Dashboard } from "@/components/Dashboard";
import { Suspense } from "react";
import { T } from "@/lib/i18n";
export default function AccountPage(){return <Suspense fallback={<main className="container" style={{minHeight:"70vh",paddingTop:60}}><T id="Hesabınız yükleniyor..."/></main>}><Dashboard/></Suspense>}
