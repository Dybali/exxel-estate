import type { Metadata } from "next";
import { ProjectDetail } from "@/components/ProjectDetail";
import { projectById } from "@/lib/projects";
import { projectsDB } from "@/lib/projects-server";
import { pageAlternates } from "@/lib/request-context";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const project = await projectById(projectsDB(), id).catch(() => null);
  return {
    ...(project ? { title: `${project.name} · ${project.district}, ${project.city} | estatemarket24`, description: project.description.slice(0, 160) } : { robots: { index: false } }),
    alternates: await pageAlternates(`/projeler/${id}`),
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectDetail id={id}/>;
}
