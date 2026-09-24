/**
 * WHAT THE GLOSS FACE'S BANNER SAYS, FROM THE GLOSS UNITS THEMSELVES (dispatch 152).
 *
 * The gloss face's banner stated the English translation's draft state
 * (translationReviewSummary over its translation units), so it described a layer the face shows
 * only in its secondary line. The gloss is its own layer: its own units, its own attribution and
 * its own review state. The banner now says who made the gloss and how many of its sentences are
 * in each state, computed as fad71ddf computes the English face's.
 *
 * Nothing here reads a translation review record. Those name translation units by id, and a unit's
 * id is often its sentence's id, which is also the gloss unit's sentenceId; a review of the English
 * of s0-p3-s1 would otherwise be counted as a review of its gloss.
 */
import type { GlossUnit } from "../../content/schemas/source.ts";

export type GlossUnitState = "reviewed" | "corrected" | "machine" | "draft";

/**
 * A gloss unit counts as reviewed only when it is marked reviewed and names who reviewed it (its
 * editor), as a translation unit does (reviewState.ts); marked reviewed with nobody named, it is an
 * unreviewed draft.
 */
export function glossUnitState(unit: GlossUnit): GlossUnitState {
  if (unit.reviewState === "reviewed" && unit.editor !== undefined) return "reviewed";
  if (unit.reviewState === "corrected" || unit.reviewState === "in-progress") return "corrected";
  if (unit.reviewState === "machine-draft") return "machine";
  return "draft";
}

export interface GlossReviewSummary {
  readonly total: number;
  readonly counts: Readonly<Record<GlossUnitState, number>>;
  readonly makers: readonly string[];
  readonly title: string;
  readonly message: string;
}

const listed = (names: readonly string[]): string =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

const nameOf = (entry: GlossUnit["attribution"] | undefined): string | undefined => {
  const name = entry?.name?.trim() || entry?.id?.trim();
  return name ? name : undefined;
};

const unique = (names: readonly (string | undefined)[]): string[] => [
  ...new Set(names.filter((name): name is string => name !== undefined)),
];

export function glossReviewSummary(units: readonly GlossUnit[]): GlossReviewSummary {
  const states = units.map(glossUnitState);
  const counts: Record<GlossUnitState, number> = {
    reviewed: 0,
    corrected: 0,
    machine: 0,
    draft: 0,
  };
  for (const state of states) counts[state] += 1;
  const total = units.length;
  const makers = unique(units.map((unit) => nameOf(unit.attribution)));
  const editorsOf = (state: GlossUnitState) =>
    unique(units.filter((_, i) => states[i] === state).map((unit) => nameOf(unit.editor)));

  const one = (n: number) => n === 1;
  const clauses: string[] = [];
  if (counts.machine > 0)
    clauses.push(
      `${counts.machine} ${one(counts.machine) ? "is" : "are"} an unreviewed machine draft`,
    );
  if (counts.draft > 0)
    clauses.push(`${counts.draft} ${one(counts.draft) ? "is" : "are"} an unreviewed draft`);
  if (counts.corrected > 0) {
    const by = editorsOf("corrected");
    clauses.push(
      `${counts.corrected} ${one(counts.corrected) ? "has" : "have"} been corrected${by.length > 0 ? ` by ${listed(by)}` : ""} but not reviewed`,
    );
  }
  if (counts.reviewed > 0)
    clauses.push(
      `${counts.reviewed} ${one(counts.reviewed) ? "has" : "have"} been reviewed against the German by ${listed(editorsOf("reviewed"))}`,
    );

  // The first clause carries the denominator: "34 of its 34 glossed sentences are ...".
  const sentences = `glossed ${total === 1 ? "sentence" : "sentences"}`;
  const [first, ...rest] = clauses;
  const firstClause =
    first === undefined ? "" : first.replace(/^(\d+) /, `$1 of its ${total} ${sentences} `);
  const all = [firstClause, ...rest];
  // Independent clauses, so a comma before the last "and" even when there are only two.
  const tally =
    all.length === 1 ? firstClause : `${all.slice(0, -1).join(", ")}, and ${all[all.length - 1]}`;
  const by = makers.length > 0 ? listed(makers) : "a contributor the records do not name";

  let title: string;
  if (counts.reviewed === total) title = "Reviewed gloss";
  else if (counts.reviewed > 0) title = "Gloss partly reviewed";
  else if (counts.corrected > 0) title = "Draft gloss, partly corrected, not yet reviewed";
  else if (counts.machine === total) title = "Machine-drafted gloss, not yet reviewed";
  else title = "Draft gloss, not yet reviewed";

  const message =
    total === 0
      ? "No sentence of this paper has a gloss yet."
      : `A word-by-word English gloss of the German, drafted by ${by}. ${tally.charAt(0).toUpperCase()}${tally.slice(1)}.`;
  return { total, counts, makers, title, message };
}
