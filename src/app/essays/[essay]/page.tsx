import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EssayReading } from "../../../components/essays/EssayReading.tsx";
import { loadEssay, loadEssays } from "../../../content/essays/load.ts";
import "../essays.css";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return loadEssays().map((essay) => ({ essay: essay.slug }));
}

type EssayPageProps = { params: Promise<{ essay: string }> };

export async function generateMetadata({ params }: EssayPageProps): Promise<Metadata> {
  const { essay: slug } = await params;
  const essay = loadEssay(slug);
  if (!essay) notFound();
  return {
    title: essay.title,
    description: essay.r0Summary,
    alternates: { canonical: "/essays/" + essay.slug + "/" },
  };
}

export default async function EssayPage({ params }: EssayPageProps) {
  const { essay: slug } = await params;
  const essay = loadEssay(slug);
  if (!essay) notFound();
  return <EssayReading essay={essay} />;
}
