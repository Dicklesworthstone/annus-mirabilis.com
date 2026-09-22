import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JourneyInPreparation } from "../../../discovery/JourneyInPreparation.tsx";
import { JourneyPage } from "../../../discovery/JourneyPage.tsx";
import {
  DISCOVERY_PAPERS,
  getBuildProfile,
  getDiscoveryJourney,
  isDiscoveryPaperSlug,
  UNWRITTEN_DISCOVERY_ROUTES,
} from "../../../discovery/journeyRegistry.ts";

export const dynamicParams = false;

/**
 * Only the slugs WITHOUT a hand-authored page. A written route lives at
 * src/app/discover/<slug>/page.tsx and that static segment wins over this dynamic one, so
 * generating a param here for a slug that has its own page produced two route files claiming
 * one URL and left this module deciding, from JOURNEY_MAP, what to say about a route it never
 * served. Excluding them means nothing shadows anything: each slug has exactly one producer.
 */
export async function generateStaticParams() {
  return UNWRITTEN_DISCOVERY_ROUTES.map((paper) => ({ paper }));
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
    !journey ||
    (journey.completeness === "partial" && (profile === "production" || profile === "preview"));

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
