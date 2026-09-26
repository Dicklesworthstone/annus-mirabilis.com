/**
 * The faces' view of src/generated/printed-displays.json (scripts/build-equations.ts): a printed
 * display's coloured render, found by its display id AND its exact LaTeX. A transcription changed
 * after the payload was built finds nothing and is drawn plain, as before, rather than drawn with
 * bindings written for other letters. Imported only by server components, so the payload never
 * reaches the reader's JavaScript. No "use client".
 */
import payload from "../../generated/printed-displays.json";
import type { PrintedDisplayPayload } from "./paperDisplays.ts";

const DISPLAYS = (payload as unknown as { displays: readonly PrintedDisplayPayload[] }).displays;

const BY_KEY = new Map(DISPLAYS.map((d) => [`${d.display}\u0000${d.latex}`, d]));

/** The coloured render of this display as printed, or undefined where it has no bindings. */
export function printedDisplay(
  display: string | undefined,
  latex: string,
): PrintedDisplayPayload | undefined {
  return display === undefined ? undefined : BY_KEY.get(`${display}\u0000${latex}`);
}

const BY_PAPER_LATEX = new Map<string, PrintedDisplayPayload[]>();
for (const d of DISPLAYS) {
  const key = `${d.paper}\u0000${d.latex}`;
  BY_PAPER_LATEX.set(key, [...(BY_PAPER_LATEX.get(key) ?? []), d]);
}

/**
 * The coloured render of a display quoted without its id: a result card quotes the German face's
 * text, and a quotation carries the LaTeX but not which display it is (dispatch 244). Found by the
 * paper and the exact LaTeX. Where the paper prints the same LaTeX twice (Brownian's D = RT/N
 * 1/(6πkP) in § 3 and § 5, light quanta's entropy difference in § 4 and § 6), `near` settles it:
 * a quoted display's own anchor is its id, and a quoted paragraph's section (s3-p7 is in § 3) names
 * the display of that section. Anything still unsettled is drawn plain rather than with another
 * display's term keys.
 */
export function printedDisplayInPaper(
  paper: string,
  latex: string,
  near?: string | undefined,
): PrintedDisplayPayload | undefined {
  const found = BY_PAPER_LATEX.get(`${paper}\u0000${latex}`) ?? [];
  const exact = found.find((d) => d.display === near);
  if (exact || found.length <= 1) return exact ?? found[0];
  const section = near?.match(/^(?:eq-)?(s\d+)-/)?.[1];
  const inSection = section ? found.filter((d) => d.display.startsWith(`eq-${section}-`)) : [];
  return inSection.length === 1 ? inSection[0] : undefined;
}
