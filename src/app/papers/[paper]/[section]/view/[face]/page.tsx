import { PaperPage } from "../../../../../../reader/PaperPage.tsx";
import {
  paperMetadata,
  sectionFaceFallbackStaticParams,
} from "../../../../../../reader/paperRoutes.ts";

export const dynamicParams = false;

export async function generateStaticParams() {
  return [...(await sectionFaceFallbackStaticParams())];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ paper: string; section: string; face: string }>;
}) {
  const { paper, section, face } = await params;
  return paperMetadata({ paperId: paper, section, face });
}

export default async function Page({
  params,
}: {
  params: Promise<{ paper: string; section: string; face: string }>;
}) {
  const { paper, section, face } = await params;
  return <PaperPage paperId={paper} section={section} face={face} />;
}
