import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ProjectDetail } from "@/components/ProjectDetail";
import { projectById } from "@/lib/projects";
import { projectActor, projectsDB } from "@/lib/projects-server";
import { currentUser } from "@/lib/server";
import { pageAlternates, requestLocale } from "@/lib/request-context";
import { coverShareImage } from "@/lib/share-image-policy";
import { shareMetadata } from "@/lib/share-metadata";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const project = await projectById(projectsDB(), id).catch(() => null);
  const path = `/projeler/${id}`;
  // Pending projects (visible to their owner and administrators only) and unknown ids are never indexed.
  if (!project) return { robots: { index: false, follow: false } };
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
  // Unknown ids, and projects the visitor may not see, answer 404 before anything streams (no soft 404).
  // Owners and administrators still open their pending projects; a database failure leaves it to the client.
  const user = await currentUser(new Request("https://projects.internal/", { headers: await headers() })).catch(() => null);
  if (await projectById(projectsDB(), id, user ? projectActor(user) : null).catch(() => undefined) === null) notFound();
  return <ProjectDetail id={id}/>;
}
