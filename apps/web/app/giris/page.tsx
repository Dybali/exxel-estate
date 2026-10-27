import { AuthForm } from "@/components/AuthForm";
import { Suspense } from "react";
export default function LoginPage(){return <Suspense fallback={<main className="container" style={{minHeight:"70vh",paddingTop:60}}>Giriş hazırlanıyor...</main>}><AuthForm/></Suspense>}
