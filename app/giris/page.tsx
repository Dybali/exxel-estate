import { AuthForm } from "@/components/AuthForm";
import { Suspense } from "react";
import { T } from "@/lib/i18n";
export default function LoginPage(){return <Suspense fallback={<main className="container" style={{minHeight:"70vh",paddingTop:60}}><T id="Giriş hazırlanıyor..."/></main>}><AuthForm/></Suspense>}
