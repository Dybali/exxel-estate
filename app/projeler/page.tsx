import { Suspense } from "react";
import { ProjectsExplorer } from "@/components/ProjectsExplorer";
import { T } from "@/lib/i18n";

export default function ProjectsPage() {
  return <Suspense fallback={<main className="container" style={{ minHeight: "70vh", paddingTop: 60 }}><T id="Projeler yükleniyor..."/></main>}><ProjectsExplorer/></Suspense>;
}
