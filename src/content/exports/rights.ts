/**
 * Rights layer resolution and filtering for machine-readable exports.
 *
 * Implements rights statements specified in NOTICE.md, docs/rights-vocabulary.yaml,
 * and am-gov-decision-license-rights-tps.
 */

import type { LayerRights, RightsStatement } from "./types.ts";

export const GERMAN_TEXT_RIGHTS: RightsStatement = {
  layer: "german-text",
  status: "public-domain-text",
  statement:
    "The historical German texts of Albert Einstein's 1905–1906 papers in Annalen der Physik are in the public domain worldwide.",
  basis:
    "Published over 70 years after the death of the author (1879–1955) and past all statutory copyright terms in Germany, Switzerland, the United States, and internationally.",
  recordedAt: "2026-09-14",
};

export const TRANSLATION_RIGHTS: RightsStatement = {
  layer: "translation",
  status: "site-original-prose",
  statement:
    "English translation created directly from the historical German text. Governed by MIT License with OpenAI/Anthropic Rider.",
  copyright: "Copyright (c) 2026 Jeffrey Emanuel and contributors",
  license: "MIT License with OpenAI/Anthropic Rider (see NOTICE.md and LICENSE)",
  recordedAt: "2026-09-16",
};

export const EXPLANATORY_PROSE_RIGHTS: RightsStatement = {
  layer: "explanatory-prose",
  status: "site-original-prose",
  statement:
    "Authored explanations, reading levels (R0–R3), questions, and commentary. Governed by MIT License with OpenAI/Anthropic Rider.",
  copyright: "Copyright (c) 2026 Jeffrey Emanuel and contributors",
  license: "MIT License with OpenAI/Anthropic Rider (see NOTICE.md and LICENSE)",
  recordedAt: "2026-09-16",
};

export const CODE_RIGHTS: RightsStatement = {
  layer: "code",
  status: "site-original-code",
  statement:
    "Application source code, schemas, and derivation definitions. Governed by MIT License with OpenAI/Anthropic Rider.",
  copyright: "Copyright (c) 2026 Jeffrey Emanuel and contributors",
  license: "MIT License with OpenAI/Anthropic Rider (see NOTICE.md and LICENSE)",
  recordedAt: "2026-09-16",
};

export const DATASET_RIGHTS: RightsStatement = {
  layer: "dataset",
  status: "curated-scientific-dataset",
  statement:
    "Historical raw empirical data is in the public domain. Curated schema and digital representations governed by MIT License with OpenAI/Anthropic Rider.",
  copyright: "Copyright (c) 2026 Jeffrey Emanuel and contributors",
  license: "MIT License with OpenAI/Anthropic Rider",
  recordedAt: "2026-09-16",
};

/**
 * Checks whether an asset is permitted for public publication and export.
 * Assets marked 'pin-local-only' or 'reference-only' are NEVER exported or published.
 */
export function isAssetPublishable(publicationDecision: string | undefined): boolean {
  if (!publicationDecision) return false;
  return publicationDecision === "publish";
}

/**
 * Constructs layer rights according to the content layers present in an export.
 */
export function resolveLayerRights(layers: {
  germanText?: boolean;
  translation?: boolean;
  explanatoryProse?: boolean;
  code?: boolean;
  dataset?: boolean;
}): LayerRights {
  return {
    ...(layers.germanText ? { germanText: GERMAN_TEXT_RIGHTS } : {}),
    ...(layers.translation ? { translation: TRANSLATION_RIGHTS } : {}),
    ...(layers.explanatoryProse ? { explanatoryProse: EXPLANATORY_PROSE_RIGHTS } : {}),
    ...(layers.code ? { code: CODE_RIGHTS } : {}),
    ...(layers.dataset ? { dataset: DATASET_RIGHTS } : {}),
  };
}
