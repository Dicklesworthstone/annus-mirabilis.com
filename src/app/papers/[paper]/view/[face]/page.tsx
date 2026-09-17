import { PaperPage } from "../../../../../reader/PaperPage.tsx";
import { faceFallbackStaticParams, paperMetadata } from "../../../../../reader/paperRoutes.ts";

export const dynamicParams = false;

export async function generateStaticParams() {
  return [...(await faceFallbackStaticParams())];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ paper: string; face: string }>;
}) {
  const { paper, face } = await params;
  return paperMetadata({ paperId: paper, face });
}

export default async function Page({
  params,
}: {
  params: Promise<{ paper: string; face: string }>;
}) {
  const { paper, face } = await params;
  return <PaperPage paperId={paper} face={face} />;
}
