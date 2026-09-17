/**
 * am-read-misconception-callouts-a3o. `Misconception.whatIsTrue` is `unknown` at the schema
 * layer (src/content/schemas/argument.ts) -- the ReadingSet shape it actually carries belongs
 * to am-cm-schemas-argument-llm's reading types, not this bead. This is the local, validated
 * shape this bead's renderer needs: R0-R2 text plus an optional R3 margin shown only under the
 * modern lens, matching "What is true at the reader's current Detail (R0, R1, or R2 text). Under
 * the modern lens, the R3 margin is shown as well."
 */
export type WhatIsTrueContent = Readonly<{
  r0: string;
  r1: string;
  r2: string;
  r3?: string | undefined;
}>;

export class MisconceptionShapeError extends Error {
  readonly rule: string;
  constructor(rule: string, message: string) {
    super(message);
    this.name = "MisconceptionShapeError";
    this.rule = rule;
  }
}

/** Validates the local shape out of the schema's deliberately-untyped `whatIsTrue` field, once,
 * at the render boundary -- never assumed further upstream. */
export function parseWhatIsTrue(raw: unknown, misconceptionId: string): WhatIsTrueContent {
  if (!raw || typeof raw !== "object") {
    throw new MisconceptionShapeError(
      "misconception-what-is-true-malformed",
      `Misconception "${misconceptionId}" has a whatIsTrue that is not an object.`,
    );
  }
  const o = raw as Record<string, unknown>;
  for (const key of ["r0", "r1", "r2"] as const) {
    if (typeof o[key] !== "string" || !(o[key] as string).trim()) {
      throw new MisconceptionShapeError(
        "misconception-what-is-true-malformed",
        `Misconception "${misconceptionId}" is missing whatIsTrue.${key}.`,
      );
    }
  }
  return Object.freeze({
    r0: o.r0 as string,
    r1: o.r1 as string,
    r2: o.r2 as string,
    ...(typeof o.r3 === "string" && o.r3.trim() ? { r3: o.r3 } : {}),
  });
}

/** Picks the reader's current-Detail text, plus the R3 margin under the modern lens. Detail
 * follows src/reader/navigation/state.ts's `0 | 1 | 2`; this module does not import that file
 * (a presentational helper reading a plain number is enough, and importing navigation state
 * into a content-shape module would invert the dependency). */
export function textForDetail(
  content: WhatIsTrueContent,
  detail: 0 | 1 | 2,
  modernLens: boolean,
): Readonly<{ text: string; margin?: string | undefined }> {
  const text = detail === 0 ? content.r0 : detail === 1 ? content.r1 : content.r2;
  return modernLens && content.r3 ? { text, margin: content.r3 } : { text };
}
