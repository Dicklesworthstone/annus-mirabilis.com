import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  DISCOVERY_PAPER_SLUGS,
  DISCOVERY_PAPERS,
  getBuildProfile,
  getDiscoveryJourney,
  isDiscoveryPaperSlug,
} from "../../../discovery/journeyRegistry.ts";
import { JourneyInPreparation } from "../../../discovery/JourneyInPreparation.tsx";
import { JourneyPage } from "../../../discovery/JourneyPage.tsx";

export const dynamicParams = false;

export async function generateStaticParams() {
  return DISCOVERY_PAPER_SLUGS.map((paper) => ({ paper }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ paper: string }>;
}): Promise<Metadata> {
  const { paper } = await params;
  if (!isDiscoveryPaperSlug(paper)) {
    return { title: "Not in the edition" };
  }

  const bib = DISCOVERY_PAPERS[paper];
  const journey = getDiscoveryJourney(paper);
  const profile = getBuildProfile();

  const isPartialInProd =
    !journey || (journey.completeness === "partial" && (profile === "production" || profile === "preview"));

  return {
    title: `Discover · ${bib.englishTitle}`,
    description: `Interactive discovery journey for Einstein's 1905 paper: ${bib.englishTitle}`,
    ...(isPartialInProd ? { robots: { index: false } } : {}),
  };
}

export default async function DiscoverPaperPage({
  params,
}: {
  params: Promise<{ paper: string }>;
}) {
  const { paper } = await params;

  if (!isDiscoveryPaperSlug(paper)) {
    notFound();
  }

  const bib = DISCOVERY_PAPERS[paper];
  const journey = getDiscoveryJourney(paper);
  const profile = getBuildProfile();

  // In production/preview, unpublished or partial journeys render JourneyInPreparation
  if (
    !journey ||
    (journey.completeness === "partial" && (profile === "production" || profile === "preview"))
  ) {
    return (
      <JourneyInPreparation
        paperId={paper}
        germanTitle={bib.germanTitle}
        englishTitle={bib.englishTitle}
        citation={bib.citation}
      />
    );
  }

  return <JourneyPage journey={journey} />;
}
