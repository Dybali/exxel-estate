import type { Metadata } from "next";
import { ProjectDetail } from "@/components/ProjectDetail";
import { projectById } from "@/lib/projects";
import { projectsDB } from "@/lib/projects-server";
import { pageAlternates, requestLocale } from "@/lib/request-context";
import { coverShareImage } from "@/lib/share-image-policy";
import { shareMetadata } from "@/lib/share-metadata";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const project = await projectById(projectsDB(), id).catch(() => null);
  const path = `/projeler/${id}`;
  if (!project) return { robots: { index: false }, alternates: await pageAlternates(path) };
  const title = `${project.name} · ${project.district}, ${project.city}`, description = project.description.slice(0, 160);
  return {
    title: `${title} | estatemarket24`, description,
    alternates: await pageAlternates(path),
    // Cover photo (first project photo) as the link preview.
    ...shareMetadata({ title, description, path, locale: await requestLocale(), image: coverShareImage(project.images[0], project.name) }),
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectDetail id={id}/>;
}
