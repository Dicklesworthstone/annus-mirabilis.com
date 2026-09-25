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
