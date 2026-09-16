/**
 * Language tag and text direction primitives for BCP 47 compliance and bidirectional text.
 * Spec: AGENTS.md and am-cm-i18n-readiness-b2g
 */

/** BCP 47 language tag regex: 2-3 letter primary subtag followed by optional alphanumeric subtags */
export const BCP47_LANGUAGE_TAG_REGEX = /^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/;

export type Bcp47LanguageTag = string;
export type TextDirection = "ltr" | "rtl";

/** RTL language primary subtag prefixes */
const RTL_PRIMARY_SUBTAGS = new Set(["ar", "he", "fa", "ur", "yi"]);

/**
 * Returns true if the given tag matches the BCP 47 language tag grammar.
 */
export function isValidLanguageTag(tag: unknown): tag is string {
  return typeof tag === "string" && BCP47_LANGUAGE_TAG_REGEX.test(tag);
}

/**
 * Validates a language tag against BCP 47 grammar, throwing a readable error if invalid.
 */
export function validateLanguageTag(tag: unknown, path = "lang"): string {
  if (typeof tag !== "string" || !tag.trim()) {
    throw new Error(`[${path}] Language tag is required and must be a non-empty string.`);
  }
  if (!BCP47_LANGUAGE_TAG_REGEX.test(tag)) {
    throw new Error(
      `[${path}] Invalid BCP 47 language tag "${tag}". Must match pattern /^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/ (e.g. "de", "en", "fr", "en-US", "de-CH").`,
    );
  }
  return tag;
}

/**
 * Returns true if the language is typically written in right-to-left direction.
 */
export function isRtlLanguage(lang: string): boolean {
  if (!lang || typeof lang !== "string") return false;
  const primary = lang.split("-")[0].toLowerCase();
  return RTL_PRIMARY_SUBTAGS.has(primary);
}

/**
 * InfeDefault text direction ("ltr" | "rtl") based on language tag.
 */
export function getDefaultDirection(lang: string): TextDirection {
  return isRtlLanguage(lang) ? "rtl" : "ltr";
}

/**
 * Validates text direction ("ltr" | "rtl").
 */
export function validateDirection(dir: unknown, path = "dir"): TextDirection {
  if (dir !== "ltr" && dir !== "rtl") {
    throw new Error(`[${path}] Invalid direction "${String(dir)}": must be "ltr" or "rtl".`);
  }
  return dir;
}
