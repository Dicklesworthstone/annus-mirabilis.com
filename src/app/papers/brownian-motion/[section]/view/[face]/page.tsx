import { PaperPage } from "../../../../../../reader/PaperPage.tsx";
import {
  FACE_FALLBACK_IDS,
  paperMetadata,
  sectionStaticParams,
} from "../../../../../../reader/paperRoutes.ts";

export const dynamicParams = false;

export async function generateStaticParams() {
  const sections = (await sectionStaticParams()).filter((row) => row.paper === "brownian-motion");
  return sections.flatMap((row) =>
    FACE_FALLBACK_IDS.map((face) => ({ section: row.section, face })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string; face: string }>;
}) {
  const { section, face } = await params;
  return paperMetadata({ paperId: "brownian-motion", section, face });
}

export default async function Page({
  params,
}: {
  params: Promise<{ section: string; face: string }>;
}) {
  const { section, face } = await params;
  return <PaperPage paperId="brownian-motion" section={section} face={face} />;
}
