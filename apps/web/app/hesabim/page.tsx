import { Dashboard } from "@/components/Dashboard";
import { Suspense } from "react";
export default function AccountPage(){return <Suspense fallback={<main className="container" style={{minHeight:"70vh",paddingTop:60}}>Hesabınız yükleniyor...</main>}><Dashboard/></Suspense>}
