import { notFound } from "next/navigation";
import { loadPaper } from "../../../../content/server";
import { OfflineChapterLinks } from "../../../../platform/offline/OfflineChapterLinks.tsx";
import { PaperReader } from "../../../../reader/PaperReader";
export const dynamicParams = false;
export async function generateStaticParams() {
  return (await loadPaper("brownian-motion")).paper.sections.map((s) => ({ section: s.id }));
}
export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return {
    title: `Brownian argument · ${section}`,
    alternates: { canonical: `https://annus-mirabilis.com/papers/brownian-motion/${section}/` },
  };
}
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!(await loadPaper("brownian-motion")).paper.sections.some((s) => s.id === section))
    notFound();
  return (
    <>
      <PaperReader section={section} />
      <OfflineChapterLinks paperId="brownian-motion" section={section} />
    </>
  );
}
