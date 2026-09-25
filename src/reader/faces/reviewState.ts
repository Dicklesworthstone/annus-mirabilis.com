import type { ReviewRecord } from "../../content/schemas/review.ts";
import type { TranslationUnit } from "../../content/schemas/source.ts";

export interface ReviewBadgeInfo {
  readonly label: string;
  readonly reviewClass: "reviewed" | "in-progress" | "draft";
  readonly isReviewed: boolean;
  readonly isStale: boolean;
  readonly description: string;
  readonly reviewer?: string | undefined;
  readonly date?: string | undefined;
}

/**
 * Computes the review badge information for a translation unit.
 *
 * Strict Rule: "Reviewed" is only emitted when an accepted, non-stale review record covers
 * the unit's current revision. A stale review record (where unit.revision > record.translationRevision)
 * falls back to a draft state rather than keeping a reviewed badge.
 */
export function evaluateUnitReviewState(
  unit: TranslationUnit,
  reviewRecord?: ReviewRecord | undefined,
): ReviewBadgeInfo {
  // If a review record is supplied:
  if (reviewRecord) {
    const isAccepted = reviewRecord.result === "accepted";

    // Check if review record covers this unit and revision in scope or acceptedRevisions
    let recordCoveredRevision: number | undefined;
    if (reviewRecord.reviewType === "cross-projection") {
      const scopeEntry = reviewRecord.scope.find((s) => s.recordId === unit.id);
      recordCoveredRevision =
        typeof scopeEntry?.translationRevision === "number"
          ? scopeEntry.translationRevision
          : typeof reviewRecord.translationRevision === "number"
            ? reviewRecord.translationRevision
            : undefined;
    } else {
      const scopeEntry = reviewRecord.scope.find((s) => s.recordId === unit.id);
      recordCoveredRevision =
        typeof scopeEntry?.translationRevision === "number"
          ? scopeEntry.translationRevision
          : typeof reviewRecord.acceptedRevisions?.[unit.id] === "number"
            ? (reviewRecord.acceptedRevisions[unit.id] as number)
            : undefined;
    }

    if (isAccepted) {
      if (recordCoveredRevision !== undefined && recordCoveredRevision < unit.revision) {
        // Revision bump after review -> stale record!
        return {
          label: "Draft (stale review)",
          reviewClass: "draft",
          isReviewed: false,
          isStale: true,
          description: `Previous review (rev ${recordCoveredRevision}) invalidated by revision ${unit.revision}.`,
          reviewer: reviewRecord.reviewer,
          date: reviewRecord.date,
        };
      }

      return {
        label: "Reviewed",
        reviewClass: "reviewed",
        isReviewed: true,
        isStale: false,
        description: `Reviewed by ${reviewRecord.reviewer} on ${reviewRecord.date}.`,
        reviewer: reviewRecord.reviewer,
        date: reviewRecord.date,
      };
    }

    // Review record not accepted
    return {
      label: "Edited draft",
      reviewClass: "in-progress",
      isReviewed: false,
      isStale: false,
      description: `Review in progress by ${reviewRecord.reviewer}.`,
      reviewer: reviewRecord.reviewer,
      date: reviewRecord.date,
    };
  }

  // Checked by AI agents under D-2026-09-25: reviewed, and said to be by agents, never by a person.
  if (unit.reviewState === "reviewed" && unit.agentReview) {
    const names = unit.agentReview.rounds.map((r) => r.reviewer.name || r.reviewer.id);
    const rounds = unit.agentReview.rounds.length;
    return {
      label: "Checked by AI agents",
      reviewClass: "reviewed",
      isReviewed: true,
      isStale: false,
      description: `Checked against the German by ${listed(names)}, AI agents, in ${rounds} independent review rounds. No person has reviewed it.`,
      reviewer: listed(names),
      date: unit.agentReview.rounds[rounds - 1]?.date,
    };
  }

  // If no review record is provided, evaluate based on unit's own reviewState
  if (unit.reviewState === "reviewed") {
    // If unit has an editor attribution
    if (unit.editor) {
      const reviewer = unit.editor.name || unit.editor.id || "Reviewer";
      return {
        label: "Reviewed",
        reviewClass: "reviewed",
        isReviewed: true,
        isStale: false,
        description: `Reviewed by ${reviewer}.`,
        reviewer,
      };
    }

    // A unit marked "reviewed" without explicit reviewer attribution is treated as draft
    return {
      label: "Machine draft",
      reviewClass: "draft",
      isReviewed: false,
      isStale: false,
      description: "Draft translation pending formal review record.",
    };
  }

  if (unit.reviewState === "corrected" || unit.reviewState === "in-progress") {
    return {
      label: "Edited draft",
      reviewClass: "in-progress",
      isReviewed: false,
      isStale: false,
      description: "Edited draft translation.",
    };
  }

  // Default: draft / machine draft
  return {
    label: "Machine draft",
    reviewClass: "draft",
    isReviewed: false,
    isStale: false,
    description: "Machine draft translation.",
  };
}

/**
 * Returns true if the paper's translation contains any unreviewed or draft units,
 * which requires rendering the unreviewed translation banner.
 */
export function isPaperTranslationUnreviewed(
  units: readonly TranslationUnit[],
  reviewRecords?: readonly ReviewRecord[] | undefined,
): boolean {
  if (units.length === 0) return true;

  const recordsMap = new Map<string, ReviewRecord>();
  if (reviewRecords) {
    for (const r of reviewRecords) {
      for (const s of r.scope) {
        recordsMap.set(s.recordId, r);
      }
    }
  }

  return units.some((u) => {
    const record = recordsMap.get(u.id);
    const badge = evaluateUnitReviewState(u, record);
    return !badge.isReviewed;
  });
}

/**
 * WHAT THE DRAFT BANNER SAYS, COMPUTED FROM THE UNITS, NEVER TYPED.
 *
 * The banner read "This English translation is an in-progress draft and has not yet completed
 * full human review", which implies a review under way; none had happened. It now states what the
 * units record: who made the translation (their translator fields), how many of them a review has
 * accepted (evaluateUnitReviewState, the badge rule), and so how many are not. The same tally
 * names the state most units share, so a face can badge only the units that differ from it.
 */
export interface TranslationReviewSummary {
  readonly total: number;
  readonly reviewed: number;
  readonly unreviewed: number;
  /** The badge label most units carry; a unit shows its own badge only when its label differs. */
  readonly commonLabel: string | undefined;
  readonly translators: readonly string[];
  readonly reviewers: readonly string[];
  readonly title: string;
  readonly message: string;
  /** Every unit is reviewed, and every review was by AI agents (D-2026-09-25): the face says so. */
  readonly agentChecked: boolean;
}

const listed = (names: readonly string[]): string =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

export function translationReviewSummary(
  units: readonly TranslationUnit[],
  reviewRecords: readonly ReviewRecord[] = [],
): TranslationReviewSummary {
  const recordsMap = new Map<string, ReviewRecord>();
  for (const r of reviewRecords) for (const s of r.scope) recordsMap.set(s.recordId, r);
  const badges = units.map((u) => evaluateUnitReviewState(u, recordsMap.get(u.id)));
  const total = units.length;
  const reviewed = badges.filter((b) => b.isReviewed).length;
  const unreviewed = total - reviewed;
  const tally = new Map<string, number>();
  for (const b of badges) tally.set(b.label, (tally.get(b.label) ?? 0) + 1);
  let commonLabel: string | undefined;
  for (const [label, n] of tally)
    if (commonLabel === undefined || n > (tally.get(commonLabel) ?? 0)) commonLabel = label;
  const unique = (xs: readonly (string | undefined)[]) => [
    ...new Set(xs.filter((x): x is string => typeof x === "string" && x.trim() !== "")),
  ];
  const translators = unique(units.map((u) => u.translator?.name || u.translator?.id));
  const reviewers = unique(badges.filter((b) => b.isReviewed).map((b) => b.reviewer));
  const by = translators.length > 0 ? listed(translators) : "a translator the records do not name";
  const counted = `${total === 1 ? "sentence or display" : "sentences and displays"}`;
  const allMachine = badges.every((b) => b.label === "Machine draft");

  let title: string;
  let message: string;
  if (reviewed === 0) {
    title = "Draft translation, not yet reviewed";
    message = allMachine
      ? `A draft made from the German by ${by}. No one has reviewed it against the German yet: ${unreviewed} of its ${total} ${counted} are an unreviewed machine draft. It can be read beside the German source and the scan of the printed pages.`
      : `A draft made from the German by ${by}. No review has accepted any of its ${total} ${counted} yet. It can be read beside the German source and the scan of the printed pages.`;
  } else if (unreviewed > 0) {
    // Units checked by AI agents are said to be, never folded into "reviewed" with the agents'
    // names standing where a person's would (D-2026-09-25).
    const byAgents = badges.filter((b) => b.label === "Checked by AI agents").length;
    const agents = unique(
      units.flatMap(
        (u) => u.agentReview?.rounds.map((r) => r.reviewer.name || r.reviewer.id) ?? [],
      ),
    );
    const byPerson = reviewed - byAgents;
    const personReviewers = unique(
      badges
        .filter((b) => b.isReviewed && b.label !== "Checked by AI agents")
        .map((b) => b.reviewer),
    );
    const parts = [
      ...(byAgents > 0
        ? [
            `${byAgents} of its ${total} ${counted} ${byAgents === 1 ? "has" : "have"} been checked against the German by AI agents, ${listed(agents)}, and by no person`,
          ]
        : []),
      ...(byPerson > 0
        ? [
            `${byPerson} of its ${total} ${counted} ${byPerson === 1 ? "has" : "have"} been reviewed against the German${personReviewers.length > 0 ? ` by ${listed(personReviewers)}` : ""}`,
          ]
        : []),
    ];
    title =
      byPerson === 0 ? "Translation partly checked by AI agents" : "Translation partly reviewed";
    message = `A translation made from the German by ${by}. ${parts.join("; ")}; the other ${unreviewed} ${unreviewed === 1 ? "is an unreviewed draft" : "are unreviewed drafts"}, and each unit whose state differs from the rest is marked where it stands.`;
  } else if (total > 0 && badges.every((b) => b.label === "Checked by AI agents")) {
    // Each claim follows the records: "translated by AI" only when every translator is a model,
    // and "the same AI model" only when every reviewer shares its unit's translating model.
    // "Fresh eyes" then means a separate session, not a different model, and the reader is told.
    const translatedByAgents = units.every((u) => u.translator?.kind === "model");
    const agents = unique(
      units.flatMap(
        (u) => u.agentReview?.rounds.map((r) => r.reviewer.name || r.reviewer.id) ?? [],
      ),
    );
    const sameModel =
      translatedByAgents &&
      units.every(
        (u) =>
          typeof u.translator?.modelId === "string" &&
          (u.agentReview?.rounds ?? []).every((r) => r.reviewer.modelId === u.translator.modelId),
      );
    const one = agents.length === 1;
    const who = sameModel
      ? `${one ? "a further session" : "further sessions"} of the same AI model`
      : translatedByAgents
        ? `${one ? "another AI agent" : "other AI agents"}`
        : `${one ? "an AI agent" : "AI agents"}`;
    title = translatedByAgents ? "Translated and checked by AI agents" : "Checked by AI agents";
    const made = translatedByAgents
      ? `${by} translated this from the German.`
      : `A translation made from the German by ${by}.`;
    message = `${made} Then ${listed(agents)}, ${who}, checked all ${total} ${counted} against the German and the printed pages, one review round each. No person has reviewed it.`;
  } else {
    title = "Reviewed translation";
    message = `A translation made from the German by ${by}, all ${total} ${counted} reviewed against the German${reviewers.length > 0 ? ` by ${listed(reviewers)}` : ""}.`;
  }
  const agentChecked =
    total > 0 && unreviewed === 0 && badges.every((b) => b.label === "Checked by AI agents");
  return {
    total,
    reviewed,
    unreviewed,
    commonLabel,
    translators,
    reviewers,
    title,
    message,
    agentChecked,
  };
}
