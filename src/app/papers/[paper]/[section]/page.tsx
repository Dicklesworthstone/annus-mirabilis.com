import { PaperPage } from "../../../../reader/PaperPage.tsx";
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
  return <PaperPage paperId={paper} section={section} />;
}
