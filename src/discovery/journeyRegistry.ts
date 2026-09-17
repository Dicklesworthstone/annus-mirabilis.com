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

export interface DiscoveryPaperBibliographicInfo {
  readonly paperId: DiscoveryPaperSlug;
  readonly bibKey: string;
  readonly germanTitle: string;
  readonly englishTitle: string;
  readonly citation: string;
}

export const DISCOVERY_PAPERS: Readonly<Record<DiscoveryPaperSlug, DiscoveryPaperBibliographicInfo>> = {
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
const JOURNEY_MAP = new Map<string, Journey>([
  ["brownian-motion", FIXTURE_JOURNEY_BROWNIAN],
]);

export function getDiscoveryJourney(paperId: string): Journey | null {
  return JOURNEY_MAP.get(paperId) ?? null;
}
