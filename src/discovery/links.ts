import type { DiscoveryJourney } from "../content/schemas/discovery.ts";

export type JourneyNavigation = Readonly<{
  paper: string;
  title: string;
  steps: readonly Readonly<{ id: string; title: string; labs: readonly string[] }>[];
}>;
export function journeyNavigation(journey: DiscoveryJourney): JourneyNavigation {
  return Object.freeze({
    paper: journey.paper,
    title: journey.title,
    steps: Object.freeze(
      journey.stages.map((s) =>
        Object.freeze({
          id: s.id,
          title: s.title,
          labs: Object.freeze(s.labs.map((l) => l.id)),
        }),
      ),
    ),
  });
}
export function stepHref(paper: string, step: string): string {
  if (
    !/^(?:light-quanta|brownian-motion|special-relativity|mass-energy)$/.test(paper) ||
    !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(step) ||
    step.length > 96
  )
    throw new TypeError("Invalid discovery address.");
  return `/discover/${paper}/#step-${step}`;
}
export function labHref(journey: DiscoveryJourney, stageId: string, labId: string): string {
  const stage = journey.stages.find((s) => s.id === stageId);
  if (!stage?.labs.some((lab) => lab.id === labId))
    throw new TypeError("That laboratory is not part of this discovery step.");
  const query = new URLSearchParams({ journey: journey.paper, step: stage.id });
  return `/lab/${labId}/?${query}`;
}
export type JourneyReturn = Readonly<{ href: string; title: string; stepTitle: string }>;
/** Never accept a caller-provided return URL. A known guide, step AND current lab must match. */
export function resolveJourneyReturn(
  search: string,
  pathname: string,
  navigation: readonly JourneyNavigation[],
): JourneyReturn | null {
  if (search.length > 2048) return null;
  const query = new URLSearchParams(search);
  if (query.getAll("journey").length !== 1 || query.getAll("step").length !== 1) return null;
  const currentLab = /^\/lab\/([a-z]{2}-\d{2})\/?$/.exec(pathname)?.[1];
  if (!currentLab) return null;
  const journey = navigation.find((j) => j.paper === query.get("journey"));
  const step = journey?.steps.find((s) => s.id === query.get("step"));
  if (!journey || !step || !step.labs.includes(currentLab)) return null;
  return Object.freeze({
    href: stepHref(journey.paper, step.id),
    title: journey.title,
    stepTitle: step.title,
  });
}

/** Retain an admitted handoff through a lab's own settings/permalink updates.
 * Scope is this exact pathname: visiting another lab must not inherit it.
 * An explicit invalid handoff clears it instead of reviving an older address.
 */
export type JourneyReturnState = Readonly<{ pathname: string; target: JourneyReturn | null }>;
export function advanceJourneyReturn(
  previous: JourneyReturnState | null,
  search: string,
  pathname: string,
  navigation: readonly JourneyNavigation[],
): JourneyReturnState {
  const requested = resolveJourneyReturn(search, pathname, navigation);
  const query = new URLSearchParams(search.length <= 2048 ? search : "");
  const explicit = query.has("journey") || query.has("step") || search.length > 2048;
  const target =
    requested ?? (!explicit && previous?.pathname === pathname ? previous.target : null);
  if (
    previous?.pathname === pathname &&
    previous.target?.href === target?.href &&
    previous.target?.title === target?.title &&
    previous.target?.stepTitle === target?.stepTitle
  )
    return previous;
  return Object.freeze({ pathname, target });
}
