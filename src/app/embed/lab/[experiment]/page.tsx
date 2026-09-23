import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmbedFrame } from "../../../../components/embed/EmbedFrame.tsx";
import { renderEmbeddedLaboratory } from "../../../../experiments/embed/adapters.tsx";
import {
  EMBED_INSTRUMENTS,
  embedInstrument,
  isEmbeddableId,
} from "../../../../experiments/embed/catalogue.ts";
import "../../../../components/lab/labShell.css";

export const dynamicParams = false;
export function generateStaticParams() {
  return EMBED_INSTRUMENTS.map((item) => ({ experiment: item.id }));
}
type Props = { params: Promise<{ experiment: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { experiment } = await params;
  const instrument = embedInstrument(experiment);
  if (!instrument) notFound();
  return {
    title: `${instrument.title} · Embedded laboratory`,
    description: instrument.overview,
    robots: { index: false, follow: true },
    alternates: { canonical: `/lab/${instrument.id}/` },
  };
}
export default async function EmbeddedLaboratoryPage({ params }: Props) {
  const { experiment } = await params;
  if (!isEmbeddableId(experiment)) notFound();
  const laboratory = await renderEmbeddedLaboratory(experiment);
  return (
    <EmbedFrame key={experiment} instrumentId={experiment}>
      {laboratory}
    </EmbedFrame>
  );
}
