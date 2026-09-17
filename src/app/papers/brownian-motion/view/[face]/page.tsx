import { PaperPage } from "../../../../../reader/PaperPage.tsx";
import { FACE_FALLBACK_IDS, paperMetadata } from "../../../../../reader/paperRoutes.ts";

export const dynamicParams = false;

export function generateStaticParams() {
  return FACE_FALLBACK_IDS.map((face) => ({ face }));
}

export async function generateMetadata({ params }: { params: Promise<{ face: string }> }) {
  const { face } = await params;
  return paperMetadata({ paperId: "brownian-motion", face });
}

export default async function Page({ params }: { params: Promise<{ face: string }> }) {
  const { face } = await params;
  return <PaperPage paperId="brownian-motion" face={face} />;
}
