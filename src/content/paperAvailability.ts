import type { GermanTextState } from "./germanTextState.ts";
import type { PaperTranslation } from "./translationState.ts";

/** Shared navigation wording for the web and native libraries; it makes no review claim. */
export function missingReadingLayers(
  german: GermanTextState,
  translation: PaperTranslation | undefined,
): string | null {
  const missing = [
    ...(german === "not-started" ? ["the German text"] : []),
    ...(translation === undefined || translation.units === 0 ? ["the English translation"] : []),
  ];
  return missing.length === 0 ? null : `Not yet available: ${missing.join(" and ")}.`;
}
