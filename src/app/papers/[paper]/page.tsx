import { OfflineChapterLinks } from "../../../platform/offline/OfflineChapterLinks.tsx";
import { PaperPage } from "../../../reader/PaperPage.tsx";
import { PaperReader } from "../../../reader/PaperReader.tsx";
import { paperMetadata, paperStaticParams } from "../../../reader/paperRoutes.ts";

export const dynamicParams = false;

export async function generateStaticParams() {
  return [...(await paperStaticParams())];
}

export async function generateMetadata({ params }: { params: Promise<{ paper: string }> }) {
  const { paper } = await params;
  return paperMetadata({ paperId: paper });
}

export default async function Page({ params }: { params: Promise<{ paper: string }> }) {
  const { paper } = await params;
  if (paper === "brownian-motion") {
    return (
      <>
        <PaperReader />
        <OfflineChapterLinks paperId="brownian-motion" />
      </>
    );
  }
  return (
    <>
      <PaperPage paperId={paper} />
      <OfflineChapterLinks paperId={paper} />
    </>
  );
}
