/**
 * THE TRANSLATED MASTHEAD IS THE ENGLISH FACE'S TITLE.
 *
 * The English face's h1 was the paper record's `title`, which is the explanation's title ("Mass
 * and energy: two accounts, one subtraction"), while the translation of Einstein's title sat
 * beneath it as the first unit of the body. The printed title is the masthead-title unit, the
 * byline the masthead-author unit, under the frozen ids of docs/CONTENT_IDS.md 3.2; a face finds
 * the units that translate them through their own sourceRefs.
 */
import type { TranslationUnit } from "../../content/schemas/source.ts";

/** The masthead's frozen source ids (docs/CONTENT_IDS.md 3.2, "Masthead Units"). */
export const MASTHEAD_TITLE_ID = "masthead-title";
export const MASTHEAD_AUTHOR_ID = "masthead-author";

/** The first unit whose sourceRefs name `sourceId`, or undefined when none translates it. */
export function unitTranslating(
  units: readonly TranslationUnit[],
  sourceId: string,
): TranslationUnit | undefined {
  return units.find((u) => u.sourceRefs.some((r) => r.id === sourceId));
}
