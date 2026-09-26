/**
 * The evidence that a shelf card's sources were checked (dispatches 251 and 252).
 *
 * The Discover shelves cite, for each card, a historical source that a 1904 reader could have
 * had. Until these dispatches none had been checked against the source itself, and a plausible
 * record can be untraceable (the Millikan case, dispatch 249). A check records the https URL that
 * was read (a scan's page image, or a catalog or DOI record), the day, and what matched. It is
 * evidence, not the `verification` record: isCardVerified does not read it, so the publication
 * gate's "verified" stays reserved, only an agent may record a check, and no page renders it.
 *
 * sourceCheckProblems says what is malformed; uncheckedSources says which sources have no check.
 * A shelf's test asserts both are empty for every card it serves.
 */
import { type KnowledgeCard, SOURCE_CHECK_READS } from "./types.ts";

const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Each malformed part of a card's source checks, as a sentence naming the card. */
export function sourceCheckProblems(card: KnowledgeCard): string[] {
  const checks: unknown = card.sourceChecks;
  if (checks === undefined) return [];
  if (!Array.isArray(checks)) return [`${card.id}: sourceChecks must be a list.`];
  const problems: string[] = [];
  checks.forEach((raw, i) => {
    const at = `${card.id} sourceChecks[${i}]`;
    const c = (raw ?? {}) as Record<string, unknown>;
    if (
      typeof c.source !== "number" ||
      !Number.isInteger(c.source) ||
      c.source < 0 ||
      c.source >= card.sources.length
    )
      problems.push(`${at}: source must index one of the card's ${card.sources.length} source(s).`);
    // Only an agent records a check. A person's reading of the volumes is the `verification`
    // record's job, so the two can never be confused (GreenBarn, mail 40654).
    if (typeof c.checkedBy !== "string" || !/^agent:\S+$/.test(c.checkedBy))
      problems.push(`${at}: checkedBy must be an agent id, such as agent:Name.`);
    if (typeof c.checkedOn !== "string" || !DAY.test(c.checkedOn))
      problems.push(`${at}: checkedOn must be a day, YYYY-MM-DD.`);
    if (typeof c.url !== "string" || !/^https:\/\/\S+$/.test(c.url))
      problems.push(`${at}: url must be the https address that was read.`);
    if (!(SOURCE_CHECK_READS as readonly unknown[]).includes(c.read))
      problems.push(`${at}: read must be one of ${SOURCE_CHECK_READS.join(", ")}.`);
    if (typeof c.matched !== "string" || c.matched.trim().length === 0)
      problems.push(`${at}: matched must say, in words, what matched.`);
    if (
      c.differs !== undefined &&
      (!Array.isArray(c.differs) ||
        c.differs.some((d) => typeof d !== "string" || d.trim().length === 0))
    )
      problems.push(`${at}: differs must be a list of sentences.`);
  });
  return problems;
}

/** The indexes of a card's sources that no check concerns. */
export function uncheckedSources(card: KnowledgeCard): number[] {
  const checked = new Set((card.sourceChecks ?? []).map((c) => c.source));
  return card.sources.map((_, i) => i).filter((i) => !checked.has(i));
}
