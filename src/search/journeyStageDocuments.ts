/**
 * Find the public, authored questions and worked guidance at their discovery-stage anchors.
 * REAL_JOURNEYS shares these stages with AuthoredJourneyStage; an unrecorded stage contributes
 * no document. Only displayed prose is projected, never record metadata or a reader's notes.
 */
import type { Journey } from "../content/schemas/journey.ts";
import { type SearchDocument, validateSearchDocument } from "./core.ts";
import { type SearchDiscoveryRoute, type SearchProfile, searchProfile } from "./documents.ts";

export class JourneyStageSearchError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "JourneyStageSearchError";
    this.code = code;
  }
}

export function journeyStageDocuments(
  journeys: readonly Pick<Journey, "paper" | "stages">[],
  routes: readonly SearchDiscoveryRoute[],
  profile: SearchProfile,
): readonly SearchDocument[] {
  searchProfile(profile);
  // These authored reconstructions have no separate publication review. Keep the same
  // stricter-profile exclusion as their knowledge cards and the 1904 desk.
  if (profile !== "scaffold") return [];
  const routeByPaper = new Map(routes.map((route) => [route.slug, route]));
  return journeys
    .flatMap((journey) => {
      if (journey.stages.length === 0) return [];
      const route = routeByPaper.get(journey.paper);
      if (!route)
        throw new JourneyStageSearchError(
          "search-stage-route-missing",
          `No published discovery route names ${journey.paper}.`,
        );
      return journey.stages.map((stage) => {
        const { support } = stage;
        return validateSearchDocument({
          id: `discovery-stage:${journey.paper}:${stage.id}`,
          type: "discovery",
          paper: journey.paper,
          section: "",
          lang: "en",
          route: `/discover/${route.slug}/`,
          anchor: stage.id,
          face: "",
          // The question is the page's own heading, rather than the generic "Make a prediction".
          title: stage.question,
          text: [
            stage.title,
            support.explanation,
            stage.computeFromShelf,
            ...stage.reasoning.map((reason) => reason.label),
            support.workedExample.prompt,
            ...support.workedExample.steps,
            support.workedExample.result,
            support.partialComparison.given,
            support.partialComparison.toComplete,
            support.partialComparison.explanation,
            support.prediction?.prompt,
            ...(support.prediction?.choices ?? []),
            support.prediction?.explanation,
            support.transferCase?.condition,
            support.transferCase?.explanation,
            support.transferCase?.whatChanges,
            support.transferCase?.whatStaysValid,
          ]
            .filter(Boolean)
            .join(" "),
          // Do not boost the paper's slug or repeat its name in a higher-weighted field.
          terms: [],
          scopeLabel: `${route.name} · discovery step · ${stage.title}`,
        });
      });
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
