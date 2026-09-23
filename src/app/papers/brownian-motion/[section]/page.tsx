import { notFound } from "next/navigation";
import { loadPaper } from "../../../../content/server";
import { OfflineChapterLinks } from "../../../../platform/offline/OfflineChapterLinks.tsx";
import { PaperReader } from "../../../../reader/PaperReader";
import { paperMetadata } from "../../../../reader/paperRoutes.ts";
export const dynamicParams = false;
export async function generateStaticParams() {
  return (await loadPaper("brownian-motion")).paper.sections.map((s) => ({ section: s.id }));
}
// From paperMetadata, as on the other papers' sections: the section's own title ("§4 · From random
// displacement to diffusion") where this page put the section's id in the title ("Brownian
// argument · s4"), which is what a browser tab and a shared link showed.
export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return paperMetadata({ paperId: "brownian-motion", section });
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
