/**
 * Discovery Journey Registry and bibliographic metadata for paper routes.
 * Specification: am-disc-journey-framework-umbg, AGENTS.md (§7.1)
 */

import type { Journey } from "../content/schemas/journey.ts";
import { FIXTURE_JOURNEY_BROWNIAN } from "./testing/fixtureJourney.ts";

export const DISCOVERY_PAPER_SLUGS = [
  "light-quanta",
  "brownian-motion",
  "special-relativity",
  "mass-energy",
] as const;

export type DiscoveryPaperSlug = (typeof DISCOVERY_PAPER_SLUGS)[number];

/**
 * THE SINGLE ANSWER TO "IS THIS ROUTE WRITTEN".
 *
 * Until now there were two, and they disagreed. A written route is a hand-authored page at
 * src/app/discover/<slug>/page.tsx, which shadows the [paper] segment; but [paper] decided what
 * to say about a slug from JOURNEY_MAP below, which knew nothing about those pages. So
 * mass-energy was readable as a finished route while the registry still reported it unwritten,
 * and /discover/ transcribed its own third answer by hand.
 *
 * The page stays the implementation and this list is the declaration. Everything that needs to
 * know - the index's Written/Not-written split, its counts, and which slugs [paper] generates -
 * reads this and nothing else. Adding a route means writing the page and adding its slug here;
 * there is no third place to forget.
 *
 * JOURNEY_MAP is a different question and is left alone: it holds Journey RECORDS, and its one
 * entry is a fixture whose shape does not describe the Brownian page (1 stage against 8
 * sections). It is not evidence about whether a route is written, which is precisely how these
 * two got confused.
 */
export const WRITTEN_DISCOVERY_ROUTES = [
  "brownian-motion",
  "mass-energy",
  "light-quanta",
  "special-relativity",
] as const;

export function isWrittenDiscoveryRoute(slug: string): boolean {
  return (WRITTEN_DISCOVERY_ROUTES as readonly string[]).includes(slug);
}

/** Slugs with no hand-authored page, which [paper] serves as a stub. */
export const UNWRITTEN_DISCOVERY_ROUTES: readonly DiscoveryPaperSlug[] =
  DISCOVERY_PAPER_SLUGS.filter((slug) => !isWrittenDiscoveryRoute(slug));

export interface DiscoveryPaperBibliographicInfo {
  readonly paperId: DiscoveryPaperSlug;
  readonly bibKey: string;
  readonly germanTitle: string;
  readonly englishTitle: string;
  readonly citation: string;
}

export const DISCOVERY_PAPERS: Readonly<
  Record<DiscoveryPaperSlug, DiscoveryPaperBibliographicInfo>
> = {
  "light-quanta": {
    paperId: "light-quanta",
    bibKey: "ap-17-132",
    germanTitle:
      "Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt",
    englishTitle:
      "On a Heuristic Point of View Concerning the Production and Transformation of Light",
    citation: "Ann. Phys. (4) 17, 132–148 (1905)",
  },
  "brownian-motion": {
    paperId: "brownian-motion",
    bibKey: "ap-17-549",
    germanTitle:
      "Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen",
    englishTitle:
      "On the Movement of Small Particles Suspended in Stationary Liquids Required by the Molecular-Kinetic Theory of Heat",
    citation: "Ann. Phys. (4) 17, 549–560 (1905)",
  },
  "special-relativity": {
    paperId: "special-relativity",
    bibKey: "ap-17-891",
    germanTitle: "Zur Elektrodynamik bewegter Körper",
    englishTitle: "On the Electrodynamics of Moving Bodies",
    citation: "Ann. Phys. (4) 17, 891–921 (1905)",
  },
  "mass-energy": {
    paperId: "mass-energy",
    bibKey: "ap-18-639",
    germanTitle: "Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?",
    englishTitle: "Does the Inertia of a Body Depend Upon Its Energy Content?",
    citation: "Ann. Phys. (4) 18, 639–641 (1905)",
  },
};

export function isDiscoveryPaperSlug(slug: string): slug is DiscoveryPaperSlug {
  return (DISCOVERY_PAPER_SLUGS as readonly string[]).includes(slug);
}

export function getBuildProfile(): "production" | "preview" | "draft" {
  const env = process.env.BUILD_PROFILE || process.env.NEXT_PUBLIC_BUILD_PROFILE;
  if (env === "production" || env === "preview" || env === "draft") {
    return env;
  }
  return process.env.NODE_ENV === "production" ? "production" : "draft";
}

/**
 * In-memory journey repository. Future journey-authoring beads register complete records here.
 */
const JOURNEY_MAP = new Map<string, Journey>([["brownian-motion", FIXTURE_JOURNEY_BROWNIAN]]);

export function getDiscoveryJourney(paperId: string): Journey | null {
  return JOURNEY_MAP.get(paperId) ?? null;
}
