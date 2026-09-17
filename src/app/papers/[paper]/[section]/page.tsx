import { OfflineChapterLinks } from "../../../../platform/offline/OfflineChapterLinks.tsx";
import { PaperPage } from "../../../../reader/PaperPage.tsx";
import { PaperReader } from "../../../../reader/PaperReader.tsx";
import { paperMetadata, sectionStaticParams } from "../../../../reader/paperRoutes.ts";

export const dynamicParams = false;

export async function generateStaticParams() {
  return [...(await sectionStaticParams())];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ paper: string; section: string }>;
}) {
  const { paper, section } = await params;
  return paperMetadata({ paperId: paper, section });
}

export default async function Page({
  params,
}: {
  params: Promise<{ paper: string; section: string }>;
}) {
  const { paper, section } = await params;
  if (paper === "brownian-motion") {
    return (
      <>
        <PaperReader section={section} />
        <OfflineChapterLinks paperId="brownian-motion" section={section} />
      </>
    );
  }
  return (
    <>
      <PaperPage paperId={paper} section={section} />
      <OfflineChapterLinks paperId={paper} section={section} />
    </>
  );
}
