/**
 * WHERE A SOURCE BLOCK'S TEXT CROSSES ONTO ITS NEXT PRINTED PAGE (dispatch 247).
 *
 * A block's locators list every page it was printed on, so a paragraph that runs from p. 905 onto
 * p. 906 carries both, but nothing said where in its text the page turned. Every reader of those
 * pages therefore gave each sentence the block's first page: the results card quoted s5-p2's eighth
 * sentence as "page 905", though it is printed on p. 906.
 *
 * A turn names the page the text continues on and the first words printed there, as the block's
 * plain text has them: the text its sentence spans are measured against, where inline mathematics
 * is its LaTeX. The validator finds the words and returns their code-point offset, the coordinate
 * the spans use, so a turn is exact to the character and still holds after an edit elsewhere in
 * the block, which a stored offset would not.
 *
 * Words, not the id of the first sentence on the new page, because a page nearly always turns
 * inside a sentence. A sentence id cannot say that a sentence runs across the turn, and it cannot
 * record a turn inside a paragraph's last sentence at all, since no sentence begins after it.
 *
 * A word the print divides across the page is written whole on the page where it begins, as the
 * ledgers write it, so a turn always falls between words: the character before it is white space.
 */
export type PageTurn = Readonly<{
  /** The page the text continues on. */
  printedPage: number;
  /** The first words printed on that page, as the block's plain text has them. */
  startsWith: string;
  /** Where those words begin, in code points of the block's plain text. */
  at: number;
}>;

export class PageTurnValidationError extends Error {
  readonly code: string;
  readonly path: string;

  constructor(code: string, message: string, path = "pageTurns") {
    super(`${path}: ${message} (${code})`);
    this.name = "PageTurnValidationError";
    this.code = code;
    this.path = path;
  }
}

type PagedLocator = Readonly<{ printedPage: number }>;

/**
 * Validate a block's page turns against its locators and plain text. Absent turns are allowed (the
 * block's pages are then known only as a set); present turns must be complete: one for every page
 * after the first, each on the next locator's page, the pages consecutive, the words found exactly
 * once and between words, and the turns in text order.
 */
export function validatePageTurns(
  raw: unknown,
  locators: readonly PagedLocator[],
  text: string,
  path = "pageTurns",
): PageTurn[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw))
    throw new PageTurnValidationError("invalid-page-turns", "pageTurns must be a list.", path);
  if (raw.length !== locators.length - 1)
    throw new PageTurnValidationError(
      "page-turns-mismatch-locators",
      `A block printed on ${locators.length} page(s) has ${locators.length - 1} page turn(s), not ${raw.length}.`,
      path,
    );

  const turns: PageTurn[] = [];
  let previous = 0;
  for (let i = 0; i < raw.length; i++) {
    const p = `${path}[${i}]`;
    const turn = raw[i] as Record<string, unknown> | null;
    const before = locators[i]?.printedPage as number;
    const after = locators[i + 1]?.printedPage as number;
    if (!turn || typeof turn !== "object")
      throw new PageTurnValidationError("invalid-page-turn", "A page turn must be an object.", p);
    if (turn.printedPage !== after)
      throw new PageTurnValidationError(
        "page-turn-page-mismatch",
        `Turn ${i + 1} must name p. ${after}, the block's next locator, not ${String(turn.printedPage)}.`,
        `${p}.printedPage`,
      );
    if (after !== before + 1)
      throw new PageTurnValidationError(
        "page-turn-not-consecutive",
        `The text cannot turn from p. ${before} to p. ${after}: the pages are not consecutive.`,
        `${p}.printedPage`,
      );
    const words = turn.startsWith;
    if (typeof words !== "string" || !words.trim() || words !== words.trim())
      throw new PageTurnValidationError(
        "invalid-page-turn-words",
        "startsWith must be the first words on the page, without surrounding space.",
        `${p}.startsWith`,
      );
    const index = text.indexOf(words);
    if (index === -1)
      throw new PageTurnValidationError(
        "page-turn-words-not-found",
        `"${words}" is not in the block's text.`,
        `${p}.startsWith`,
      );
    if (text.indexOf(words, index + 1) !== -1)
      throw new PageTurnValidationError(
        "page-turn-words-ambiguous",
        `"${words}" occurs more than once in the block's text; quote more of the page's first line.`,
        `${p}.startsWith`,
      );
    if (index === 0)
      throw new PageTurnValidationError(
        "page-turn-at-start",
        `"${words}" opens the block, which begins on p. ${locators[0]?.printedPage}, not on a later page.`,
        `${p}.startsWith`,
      );
    if (!/\s/.test(text[index - 1] ?? ""))
      throw new PageTurnValidationError(
        "page-turn-mid-word",
        `"${words}" does not begin a word, and a turn falls between words.`,
        `${p}.startsWith`,
      );
    const at = Array.from(text.slice(0, index)).length;
    if (at <= previous)
      throw new PageTurnValidationError(
        "page-turns-not-ordered",
        `Turn ${i + 1} comes before the turn above it in the text.`,
        `${p}.startsWith`,
      );
    previous = at;
    turns.push({ printedPage: after, startsWith: words, at });
  }
  return turns;
}

/** The printed page at a code-point offset of the block's text. */
export function pageAtOffset(
  locators: readonly PagedLocator[],
  turns: readonly PageTurn[],
  offset: number,
): number | undefined {
  let page = locators[0]?.printedPage;
  for (const turn of turns) if (turn.at <= offset) page = turn.printedPage;
  return page;
}

/**
 * The first and last printed pages of a span of the block's text, [start, end) in code points. A
 * span that runs across a turn has two; without turns, a multi-page block cannot place a span, and
 * both are its first page, as every reader of the pages did before turns existed.
 */
export function spanPages(
  locators: readonly PagedLocator[],
  turns: readonly PageTurn[],
  span: Readonly<{ start: number; end: number }>,
): Readonly<{ first: number; last: number }> | undefined {
  const first = pageAtOffset(locators, turns, span.start);
  const last = pageAtOffset(locators, turns, Math.max(span.start, span.end - 1));
  if (first === undefined || last === undefined) return undefined;
  return { first, last };
}
