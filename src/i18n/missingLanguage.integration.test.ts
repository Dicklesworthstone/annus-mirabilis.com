import assert from "node:assert/strict";
import test from "node:test";
import type { TranslationEdition } from "../content/schemas/source.ts";
import { resolveTranslationWithFallback } from "./missingLanguage.ts";

test("missingLanguage: requesting missing 'fr' edition falls back to 'en' with explicit notice", () => {
  const enEdition: TranslationEdition = {
    editionId: "edition-en-standard",
    paperId: "ap-17-549",
    language: "en",
    title: "On the Motion of Small Particles Suspended in Liquids at Rest",
    translator: { id: "agent:BoldHarbor", kind: "model", modelId: "gpt-5.6-luna" },
    license: "CC-BY-4.0",
    reviewState: "reviewed",
    units: [
      {
        id: "s1-p1-s1a",
        sourceRefs: [{ paper: "brownian-motion", id: "s1-p1-s1" }],
        inlines: [{ kind: "text", text: "In this paper it will be shown..." }],
        translator: { id: "agent:BoldHarbor", kind: "model", modelId: "gpt-5.6-luna" },
        editor: { id: "jemanuel", kind: "human", name: "Jeffrey Emanuel" },
        revision: 1,
        unresolvedAlternatives: [],
        reviewState: "reviewed",
        lang: "en",
      },
    ],
  };

  const editionsByLang: Record<string, TranslationEdition> = {
    en: enEdition,
  };

  const res = resolveTranslationWithFallback("fr", "s1-p1-s1", editionsByLang);

  assert.equal(res.fallbackApplied, true);
  assert.equal(res.unit.lang, "en");
  assert.equal(res.unit.id, "s1-p1-s1a");
  assert.notEqual(res.notice, undefined);
  assert.equal(res.notice?.requestedLanguage, "fr");
  assert.equal(res.notice?.fallbackLanguage, "en");
  assert.equal(res.notice?.reason, "edition-missing");
});

test("missingLanguage: requesting unit missing in 'fr' edition falls back to 'en' unit with 'unit-missing' notice", () => {
  const enEdition: TranslationEdition = {
    editionId: "edition-en-standard",
    paperId: "ap-17-549",
    language: "en",
    title: "On the Motion of Small Particles Suspended in Liquids at Rest",
    translator: { id: "agent:BoldHarbor", kind: "model", modelId: "gpt-5.6-luna" },
    license: "CC-BY-4.0",
    reviewState: "reviewed",
    units: [
      {
        id: "s1-p1-s1a",
        sourceRefs: [{ paper: "brownian-motion", id: "s1-p1-s1" }],
        inlines: [{ kind: "text", text: "Sentence 1 in English" }],
        translator: { id: "agent:BoldHarbor", kind: "model", modelId: "gpt-5.6-luna" },
        editor: { id: "jemanuel", kind: "human", name: "Jeffrey Emanuel" },
        revision: 1,
        unresolvedAlternatives: [],
        reviewState: "reviewed",
        lang: "en",
      },
      {
        id: "s1-p1-s2a",
        sourceRefs: [{ paper: "brownian-motion", id: "s1-p1-s2" }],
        inlines: [{ kind: "text", text: "Sentence 2 in English" }],
        translator: { id: "agent:BoldHarbor", kind: "model", modelId: "gpt-5.6-luna" },
        editor: { id: "jemanuel", kind: "human", name: "Jeffrey Emanuel" },
        revision: 1,
        unresolvedAlternatives: [],
        reviewState: "reviewed",
        lang: "en",
      },
    ],
  };

  const frEdition: TranslationEdition = {
    editionId: "edition-fr-standard",
    paperId: "ap-17-549",
    language: "fr",
    title: "Sur le mouvement de petites particules...",
    translator: { id: "agent:BoldHarbor", kind: "model", modelId: "gpt-5.6-luna" },
    license: "CC-BY-4.0",
    reviewState: "in-progress",
    units: [
      {
        id: "s1-p1-s1a-fr",
        sourceRefs: [{ paper: "brownian-motion", id: "s1-p1-s1" }],
        inlines: [{ kind: "text", text: "Phrase 1 en français" }],
        translator: { id: "agent:BoldHarbor", kind: "model", modelId: "gpt-5.6-luna" },
        revision: 1,
        unresolvedAlternatives: [],
        reviewState: "in-progress",
        lang: "fr",
      },
      // Sentence 2 is not yet translated in French
    ],
  };

  const editionsByLang = { en: enEdition, fr: frEdition };

  // Sentence 1 has French unit -> returns French unit without fallback
  const res1 = resolveTranslationWithFallback("fr", "s1-p1-s1", editionsByLang);
  assert.equal(res1.fallbackApplied, false);
  assert.equal(res1.unit.lang, "fr");
  assert.equal(res1.notice, undefined);

  // Sentence 2 is missing in French -> returns English unit with unit-missing notice
  const res2 = resolveTranslationWithFallback("fr", "s1-p1-s2", editionsByLang);
  assert.equal(res2.fallbackApplied, true);
  assert.equal(res2.unit.lang, "en");
  assert.equal(res2.notice?.reason, "unit-missing");
});
