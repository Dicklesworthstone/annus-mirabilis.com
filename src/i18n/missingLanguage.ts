/**
 * Missing-language fallback and notice resolution.
 *
 * Rules:
 * - If a requested language lacks an edition or a specific unit, the engine falls back to "en" with a missing-language notice.
 * - Machine translation is never published or synthesized on the fly.
 * - The notice explicitly names the requested language, fallback language, and reason.
 *
 * Spec: AGENTS.md and am-cm-i18n-readiness-b2g
 */

import type { TranslationEdition, TranslationUnit } from "../content/schemas/source.ts";

export type MissingLanguageReason = "edition-missing" | "unit-missing";

export interface MissingLanguageNotice {
  requestedLanguage: string;
  fallbackLanguage: string;
  reason: MissingLanguageReason;
  sentenceId?: string | undefined;
  message: string;
}

export interface ResolvedTranslationPayload {
  unit: TranslationUnit;
  notice?: MissingLanguageNotice | undefined;
  fallbackApplied: boolean;
}

/**
 * Resolves a sentence translation unit for a requested language, applying fallback to English
 * and attaching an explicit missing-language notice if the translation is unavailable.
 */
export function resolveTranslationWithFallback(
  requestedLang: string,
  sentenceId: string,
  editionsByLang: Readonly<Record<string, TranslationEdition>>,
): ResolvedTranslationPayload {
  const normRequested = requestedLang.toLowerCase();

  // 1. Check if requested language edition exists
  const requestedEdition = editionsByLang[normRequested];
  if (!requestedEdition) {
    const enEdition = editionsByLang.en;
    if (!enEdition) {
      throw new Error(
        `Fatal content resolution error: default English edition is missing when resolving sentence "${sentenceId}".`,
      );
    }
    const unit = enEdition.units.find(
      (u) => u.id === sentenceId || u.sourceRefs.some((r) => r.id === sentenceId),
    );
    if (!unit) {
      throw new Error(`Sentence "${sentenceId}" not found in default English edition.`);
    }
    return {
      unit,
      fallbackApplied: true,
      notice: {
        requestedLanguage: requestedLang,
        fallbackLanguage: "en",
        reason: "edition-missing",
        sentenceId,
        message: `Translation in the requested language "${requestedLang}" is not yet available; falling back to English.`,
      },
    };
  }

  // 2. Edition exists; check if specific unit exists in edition
  const requestedUnit = requestedEdition.units.find(
    (u) => u.id === sentenceId || u.sourceRefs.some((r) => r.id === sentenceId),
  );

  if (requestedUnit) {
    return {
      unit: requestedUnit,
      fallbackApplied: false,
    };
  }

  // 3. Unit missing in requested edition -> fallback to English unit with notice
  const enEdition = editionsByLang.en;
  const enUnit = enEdition?.units.find(
    (u) => u.id === sentenceId || u.sourceRefs.some((r) => r.id === sentenceId),
  );
  if (!enUnit) {
    throw new Error(
      `Sentence "${sentenceId}" missing in both "${requestedLang}" and default English edition.`,
    );
  }

  return {
    unit: enUnit,
    fallbackApplied: true,
    notice: {
      requestedLanguage: requestedLang,
      fallbackLanguage: "en",
      reason: "unit-missing",
      sentenceId,
      message: `Translation of sentence "${sentenceId}" in "${requestedLang}" is not yet available; falling back to English.`,
    },
  };
}
