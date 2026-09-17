/**
 * Card Backlinks Computation.
 *
 * Computes build-time backlinks from journey stages, desk objects, timeline entries,
 * and world checks that cite each knowledge card.
 *
 * Specification: am-disc-knowledge-cards-iw8j, am-ep-discovery-33u
 */

import type { CardBacklinks } from "./types.ts";

export type JourneyCitationSource = Readonly<{
  journeyId: string;
  stages: readonly {
    stageId: string;
    premiseIds: readonly string[];
  }[];
}>;

export type DeskCitationSource = Readonly<{
  objectId: string;
  premiseIds: readonly string[];
}>;

export type TimelineCitationSource = Readonly<{
  entryId: string;
  premiseIds: readonly string[];
}>;

export type WorldCheckCitationSource = Readonly<{
  checkId: string;
  premiseIds: readonly string[];
}>;

export type BacklinksInput = Readonly<{
  journeys?: readonly JourneyCitationSource[] | undefined;
  deskObjects?: readonly DeskCitationSource[] | undefined;
  timelineEntries?: readonly TimelineCitationSource[] | undefined;
  worldChecks?: readonly WorldCheckCitationSource[] | undefined;
}>;

/**
 * Computes a map of cardId -> CardBacklinks from all citation sources.
 */
export function buildCardBacklinks(input: BacklinksInput): ReadonlyMap<string, CardBacklinks> {
  const stageMap = new Map<string, Set<string>>();
  const deskMap = new Map<string, Set<string>>();
  const timelineMap = new Map<string, Set<string>>();
  const worldCheckMap = new Map<string, Set<string>>();

  // Helper to ensure set exists
  function add(map: Map<string, Set<string>>, cardId: string, refId: string) {
    let set = map.get(cardId);
    if (!set) {
      set = new Set();
      map.set(cardId, set);
    }
    set.add(refId);
  }

  // 1. Journeys & Stages
  if (input.journeys) {
    for (const journey of input.journeys) {
      for (const stage of journey.stages) {
        for (const cardId of stage.premiseIds) {
          add(stageMap, cardId, stage.stageId);
        }
      }
    }
  }

  // 2. Desk Objects
  if (input.deskObjects) {
    for (const desk of input.deskObjects) {
      for (const cardId of desk.premiseIds) {
        add(deskMap, cardId, desk.objectId);
      }
    }
  }

  // 3. Timeline Entries
  if (input.timelineEntries) {
    for (const tl of input.timelineEntries) {
      for (const cardId of tl.premiseIds) {
        add(timelineMap, cardId, tl.entryId);
      }
    }
  }

  // 4. World Checks
  if (input.worldChecks) {
    for (const wc of input.worldChecks) {
      for (const cardId of wc.premiseIds) {
        add(worldCheckMap, cardId, wc.checkId);
      }
    }
  }

  // Collect all referenced card IDs
  const allCardIds = new Set<string>([
    ...stageMap.keys(),
    ...deskMap.keys(),
    ...timelineMap.keys(),
    ...worldCheckMap.keys(),
  ]);

  const result = new Map<string, CardBacklinks>();
  for (const cardId of allCardIds) {
    result.set(cardId, {
      stageIds: Array.from(stageMap.get(cardId) ?? []).sort(),
      deskObjectIds: Array.from(deskMap.get(cardId) ?? []).sort(),
      timelineEntryIds: Array.from(timelineMap.get(cardId) ?? []).sort(),
      worldCheckIds: Array.from(worldCheckMap.get(cardId) ?? []).sort(),
    });
  }

  return result;
}

/**
 * Returns the backlinks for a specific card id, or empty backlinks if none exist.
 */
export function getCardBacklinks(
  cardId: string,
  backlinksMap?: ReadonlyMap<string, CardBacklinks> | undefined,
): CardBacklinks {
  if (!backlinksMap) {
    return {
      stageIds: [],
      deskObjectIds: [],
      timelineEntryIds: [],
      worldCheckIds: [],
    };
  }
  return (
    backlinksMap.get(cardId) ?? {
      stageIds: [],
      deskObjectIds: [],
      timelineEntryIds: [],
      worldCheckIds: [],
    }
  );
}
