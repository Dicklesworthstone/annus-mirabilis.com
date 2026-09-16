/**
 * Content Compiler Plugin for I18n & Language Metadata.
 *
 * Requirements:
 * - Family: "i18n", Rule: "lang-required", Severity: "error".
 * - Bead: "am-cm-i18n-readiness-b2g".
 * - Rejects text records without `lang` or with an invalid BCP 47 tag.
 * - Rejects inline overrides with an invalid BCP 47 tag.
 * - Rejects term annotations of German words inside English prose without `lang="de"`.
 *
 * Spec: AGENTS.md and am-cm-i18n-readiness-b2g
 */

import { isValidLanguageTag } from "../../../i18n/language.ts";
import { type CheckContext, registerCheck } from "../../compiler/checks/registry.ts";

export const I18N_LANG_REQUIRED_CHECK_ID = "i18n.lang-required";

// Known German terms commonly used in the Annus Mirabilis edition
const KNOWN_GERMAN_WORDS = new Set([
  "wärme",
  "zustand",
  "gedankenexperiment",
  "äther",
  "molekular-kinetischen",
  "molekularkinetischen",
  "bewegung",
  "flüssigkeiten",
  "flüssigkeit",
  "ruhenden",
  "geschwindigkeit",
  "zeitdilatation",
  "längenkontraktion",
  "annalen",
  "physik",
]);

function isGermanTerm(text: string): boolean {
  const norm = text.trim().toLowerCase();
  return KNOWN_GERMAN_WORDS.has(norm);
}

function checkInlinesForI18n(
  inlines: unknown[],
  context: CheckContext,
  recordId: string,
  parentLang: string,
  basePath: string,
): void {
  for (let i = 0; i < inlines.length; i++) {
    const inl = inlines[i] as Record<string, unknown>;
    if (!inl || typeof inl !== "object") continue;
    const currentPath = `${basePath}[${i}]`;

    // Check inline language override
    if (inl.lang !== undefined) {
      if (!isValidLanguageTag(inl.lang)) {
        context.report({
          recordId,
          rule: "lang-required",
          path: `${currentPath}.lang`,
          message: `Invalid BCP 47 language tag "${String(inl.lang)}" on inline element.`,
          repair: `Use a valid BCP 47 language tag (e.g. "de", "en", "fr").`,
        });
      }
    }

    // Check term annotations in English text
    if (inl.kind === "term" && parentLang === "en") {
      const termText = typeof inl.text === "string" ? inl.text : "";
      if (isGermanTerm(termText) && inl.lang !== "de") {
        context.report({
          recordId,
          rule: "lang-required",
          path: `${currentPath}.lang`,
          message: `Term annotation of German word "${termText}" inside English text requires lang="de".`,
          repair: `Add lang="de" to the term annotation.`,
        });
      }
    }

    // Recurse on emphasis inlines
    if (inl.kind === "emphasis" && Array.isArray(inl.inlines)) {
      const effectiveLang = (inl.lang as string) || parentLang;
      checkInlinesForI18n(inl.inlines, context, recordId, effectiveLang, `${currentPath}.inlines`);
    }
  }
}

/**
 * Validates i18n language tags and term annotations across content records.
 */
export function validateI18nRecords(context: CheckContext): void {
  for (const [key, value] of context.records.entries()) {
    if (!value || typeof value !== "object") continue;
    const rec = value as Record<string, unknown>;
    const kind = typeof rec.kind === "string" ? rec.kind : undefined;

    // 1. TranslationUnit
    if (kind === "translation-unit" || ("sourceRefs" in rec && "translator" in rec)) {
      if (rec.lang === undefined) {
        context.report({
          recordId: key,
          rule: "lang-required",
          path: "lang",
          message: `TranslationUnit "${key}" is missing required "lang" field.`,
          repair: `Specify a valid BCP 47 language tag on the TranslationUnit (e.g. lang: "en").`,
        });
      } else if (!isValidLanguageTag(rec.lang)) {
        context.report({
          recordId: key,
          rule: "lang-required",
          path: "lang",
          message: `TranslationUnit "${key}" has invalid BCP 47 language tag "${String(rec.lang)}".`,
          repair: `Use a valid BCP 47 tag (e.g. "en", "de", "fr").`,
        });
      }

      if (Array.isArray(rec.inlines)) {
        const lang = typeof rec.lang === "string" ? rec.lang : "en";
        checkInlinesForI18n(rec.inlines, context, key, lang, "inlines");
      }
    } else if (
      kind === "gloss-unit" ||
      ("sentenceId" in rec && "tokens" in rec && "sourceRevision" in rec)
    ) {
      // 2. GlossUnit
      if (rec.lang !== undefined && !isValidLanguageTag(rec.lang)) {
        context.report({
          recordId: key,
          rule: "lang-required",
          path: "lang",
          message: `GlossUnit "${key}" has invalid BCP 47 language tag "${String(rec.lang)}".`,
          repair: `Use a valid BCP 47 tag (e.g. "en").`,
        });
      }
      if (rec.sourceLang !== undefined && !isValidLanguageTag(rec.sourceLang)) {
        context.report({
          recordId: key,
          rule: "lang-required",
          path: "sourceLang",
          message: `GlossUnit "${key}" has invalid BCP 47 sourceLang "${String(rec.sourceLang)}".`,
          repair: `Use a valid BCP 47 tag (e.g. "de").`,
        });
      }
    } else if (
      kind === "paragraph" ||
      kind === "heading" ||
      kind === "footnote" ||
      ("locators" in rec && "diplomaticText" in rec)
    ) {
      // 3. SourceBlock
      if (rec.lang !== undefined && !isValidLanguageTag(rec.lang)) {
        context.report({
          recordId: key,
          rule: "lang-required",
          path: "lang",
          message: `SourceBlock "${key}" has invalid BCP 47 language tag "${String(rec.lang)}".`,
          repair: `Use a valid BCP 47 tag (e.g. "de").`,
        });
      }
      if (Array.isArray(rec.inlines)) {
        const lang = typeof rec.lang === "string" ? rec.lang : "de";
        checkInlinesForI18n(rec.inlines, context, key, lang, "inlines");
      }
    } else if (rec.lang !== undefined && !isValidLanguageTag(rec.lang)) {
      // 4. General text records with lang
      context.report({
        recordId: key,
        rule: "lang-required",
        path: "lang",
        message: `Record "${key}" has invalid BCP 47 language tag "${String(rec.lang)}".`,
        repair: `Use a valid BCP 47 tag (e.g. "de", "en", "fr").`,
      });
    }
  }
}

/**
 * Registers the i18n check with the compiler plugin registry.
 */
export function registerI18nCheck(): void {
  registerCheck({
    id: I18N_LANG_REQUIRED_CHECK_ID,
    family: "i18n",
    severity: "error",
    beadId: "am-cm-i18n-readiness-b2g",
    description:
      "Validates BCP 47 language tags on text-bearing records, inline language overrides, and German term annotations inside English prose.",
    run: (context) => {
      validateI18nRecords(context);
    },
  });
}
