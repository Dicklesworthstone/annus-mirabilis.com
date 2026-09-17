import type { ReviewRecord } from "../../../content/schemas/review.ts";
import {
  type Alignment,
  type EditorialNote,
  type GlossUnit,
  type Paper,
  plainText,
  type SourceBlock,
  type TranslationUnit,
  validateAlignment,
  validateEditorialNote,
  validateGlossUnit,
  validatePaper,
  validateSourceBlock,
  validateTranslationUnit,
} from "../../../content/schemas/source.ts";
import { spanTextDigest } from "../../../content/schemas/spans.ts";

/**
 * Fixture Paper for Paper 4 (mass-energy / ap-18-639).
 */
export const FIXTURE_MASS_ENERGY_PAPER: Paper = validatePaper({
  slug: "mass-energy",
  bibKey: "ap-18-639",
  titleGerman: "Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?",
  titleEnglishWorking: "Does the Inertia of a Body Depend upon its Energy-Content?",
  editorialAdditions: [],
  dates: [
    {
      type: "received",
      earliest: "1905-09-27",
      latest: "1905-09-27",
      precision: "day",
      source: "Issue 13 masthead date-line.",
      verifiedAt: "2026-09-15",
    },
    {
      type: "issue-publication",
      earliest: "1905-11-21",
      latest: "1905-11-21",
      precision: "day",
      source: "Journal publication record.",
      verifiedAt: "2026-09-15",
    },
  ],
  journal: {
    name: "Annalen der Physik",
    series: 4,
    volume: 18,
    wholeSeriesVolume: 323,
    issue: 13,
    issueSource: "Masthead",
    pages: { first: 639, last: 641 },
    doi: "10.1002/andp.19053231314",
    doiVerifiedAt: "2026-09-15",
  },
  collectedPapers: { volume: 2, document: 24 },
  orderedBlockIds: ["me-title", "me-p1", "me-eq1", "me-p2", "me-fn1", "me-closing"],
  companion: false,
  status: "published",
  sourceStatus: "reviewed",
  sourceNotice: "Reviewed diplomatic transcript.",
  sections: [
    {
      id: "me-sec-01",
      title: "Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?",
      arguments: ["arg-mass-energy"],
    },
  ],
});

const TEXT_ME_P1_S1 =
  "Die Resultate einer jüngst in diesen Annalen erschienenen elektrodynamischen Untersuchung führen zu einem sehr interessanten Schlusse, der hier abgeleitet werden soll.";
const TEXT_ME_P1_S2 =
  "Es sei ein System von ebenen Lichtwellen gegeben, dessen Energie auf das Koordinatensystem (x, y, z) bezogen sei.";
const TEXT_ME_P1 = `${TEXT_ME_P1_S1} ${TEXT_ME_P1_S2}`;
const DIGEST_ME_P1 = spanTextDigest(TEXT_ME_P1);

const TEXT_ME_P2_S1 =
  "Gibt ein Körper die Energie L in Form von Strahlung ab, so verkleinert sich seine Masse um L/V².";
const TEXT_ME_P2_S2 =
  "Hierbei ist es offenbar unwesentlich, daß die dem Körper entzogene Energie gerade in Strahlung übergeht.";
const TEXT_ME_P2 = `${TEXT_ME_P2_S1} ${TEXT_ME_P2_S2}`;
const DIGEST_ME_P2 = spanTextDigest(TEXT_ME_P2);

/**
 * Fixture Source Blocks for Paper 4.
 */
export const FIXTURE_MASS_ENERGY_SOURCE_BLOCKS: readonly SourceBlock[] = [
  validateSourceBlock({
    id: "me-title",
    kind: "heading",
    paper: "mass-energy",
    section: "me-sec-01",
    order: 1,
    locators: [{ pdfPageIndex: 1, printedPage: 639 }],
    diplomaticText: "Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?",
    inlines: [
      {
        kind: "text",
        text: "Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?",
      },
    ],
    sentenceSpans: [],
    revision: 1,
    status: {
      transcription: "reviewed",
      mathTranscription: "not-applicable",
      translation: "reviewed",
      review: "accepted",
    },
    lang: "de",
  }),
  validateSourceBlock({
    id: "me-p1",
    kind: "paragraph",
    paper: "mass-energy",
    section: "me-sec-01",
    order: 2,
    locators: [{ pdfPageIndex: 1, printedPage: 639 }],
    diplomaticText: TEXT_ME_P1,
    inlines: [{ kind: "text", text: TEXT_ME_P1 }],
    sentenceSpans: [
      {
        id: "me-p1-s1",
        span: {
          start: 0,
          end: Array.from(TEXT_ME_P1_S1).length,
          textDigest: DIGEST_ME_P1,
          blockRevision: 1,
        },
      },
      {
        id: "me-p1-s2",
        span: {
          start: Array.from(TEXT_ME_P1_S1).length + 1,
          end: Array.from(TEXT_ME_P1).length,
          textDigest: DIGEST_ME_P1,
          blockRevision: 1,
        },
      },
    ],
    revision: 1,
    status: {
      transcription: "reviewed",
      mathTranscription: "not-applicable",
      translation: "reviewed",
      review: "accepted",
    },
    lang: "de",
  }),
  validateSourceBlock({
    id: "me-eq1",
    kind: "equation",
    paper: "mass-energy",
    section: "me-sec-01",
    order: 3,
    originalLabel: "1",
    locators: [{ pdfPageIndex: 2, printedPage: 640 }],
    diplomaticText: "H_0 - E_0 = 2 L",
    inlines: [
      {
        kind: "math",
        latex: "H_0 - E_0 = 2 L",
        equationId: "eq-mass-energy-radiation",
      },
    ],
    sentenceSpans: [],
    revision: 1,
    status: {
      transcription: "reviewed",
      mathTranscription: "reviewed",
      translation: "reviewed",
      review: "accepted",
    },
    lang: "de",
  }),
  validateSourceBlock({
    id: "me-p2",
    kind: "paragraph",
    paper: "mass-energy",
    section: "me-sec-01",
    order: 4,
    locators: [{ pdfPageIndex: 3, printedPage: 641 }],
    diplomaticText: TEXT_ME_P2,
    inlines: [{ kind: "text", text: TEXT_ME_P2 }],
    sentenceSpans: [
      {
        id: "me-p2-s1",
        span: {
          start: 0,
          end: Array.from(TEXT_ME_P2_S1).length,
          textDigest: DIGEST_ME_P2,
          blockRevision: 1,
        },
      },
      {
        id: "me-p2-s2",
        span: {
          start: Array.from(TEXT_ME_P2_S1).length + 1,
          end: Array.from(TEXT_ME_P2).length,
          textDigest: DIGEST_ME_P2,
          blockRevision: 1,
        },
      },
    ],
    revision: 1,
    status: {
      transcription: "reviewed",
      mathTranscription: "reviewed",
      translation: "reviewed",
      review: "accepted",
    },
    lang: "de",
  }),
  validateSourceBlock({
    id: "me-fn1",
    kind: "footnote",
    paper: "mass-energy",
    section: "me-sec-01",
    order: 5,
    originalLabel: "1",
    locators: [{ pdfPageIndex: 1, printedPage: 639 }],
    diplomaticText: "1) A. Einstein, Ann. d. Phys. 17. p. 891. 1905.",
    inlines: [
      {
        kind: "text",
        text: "A. Einstein, Ann. d. Phys. 17. p. 891. 1905.",
      },
    ],
    sentenceSpans: [],
    revision: 1,
    status: {
      transcription: "reviewed",
      mathTranscription: "not-applicable",
      translation: "reviewed",
      review: "accepted",
    },
    lang: "de",
  }),
];

/**
 * Fixture Gloss Units for Paper 4.
 * Covers me-p1-s1, me-p1-s2 (with konjunktiv-i), me-p2-s1 (with consequence and math token).
 * Deliberately leaves me-p2-s2 unglossed to test coverage notice.
 */
export const FIXTURE_MASS_ENERGY_GLOSS_UNITS: readonly GlossUnit[] = [
  validateGlossUnit({
    sentenceId: "me-p1-s1",
    revision: 1,
    sourceRevision: 1,
    sourceTextDigest: spanTextDigest(TEXT_ME_P1_S1),
    lang: "en",
    sourceLang: "de",
    attribution: {
      userId: "jemanuel",
      name: "Jeff Emanuel",
      role: "author",
    },
    editor: {
      userId: "jemanuel",
      name: "Jeff Emanuel",
      role: "editor",
      reviewedAt: "2026-09-15",
    },
    reviewState: "reviewed",
    tokens: [
      { german: "Die", english: "The" },
      { german: "Resultate", english: "results" },
      { german: "einer", english: "of a" },
      { german: "jüngst", english: "recently" },
      { german: "in", english: "in" },
      { german: "diesen", english: "these" },
      { german: "Annalen", english: "Annalen" },
      { german: "erschienenen", english: "published" },
      { german: "elektrodynamischen", english: "electrodynamic" },
      { german: "Untersuchung", english: "investigation" },
      { german: "führen", english: "lead" },
      { german: "zu", english: "to" },
      { german: "einem", english: "a" },
      { german: "sehr", english: "very" },
      { german: "interessanten", english: "interesting" },
      { german: "Schlusse,", english: "conclusion," },
      { german: "der", english: "which" },
      { german: "hier", english: "here" },
      {
        german: "abgeleitet",
        english: "derived",
        grammarNote: "Participle in passive periphrastic",
        noteClass: "formula-phrase",
      },
      { german: "werden", english: "be" },
      { german: "soll.", english: "shall." },
    ],
    multiwordUnits: [
      {
        tokenIndices: [18, 19, 20],
        english: "shall be derived",
        kind: "fixed-phrase",
        grammarNote: "Passive modal construction",
        noteClass: "formula-phrase",
      },
    ],
  }),
  validateGlossUnit({
    sentenceId: "me-p1-s2",
    revision: 1,
    sourceRevision: 1,
    sourceTextDigest: spanTextDigest(TEXT_ME_P1_S2),
    lang: "en",
    sourceLang: "de",
    attribution: {
      userId: "jemanuel",
      name: "Jeff Emanuel",
      role: "author",
    },
    editor: {
      userId: "jemanuel",
      name: "Jeff Emanuel",
      role: "editor",
      reviewedAt: "2026-09-15",
    },
    reviewState: "reviewed",
    tokens: [
      {
        german: "Es",
        english: "Let",
        grammarNote: "Expletive topic particle introducing supposition",
        noteClass: "konjunktiv-i",
      },
      {
        german: "sei",
        english: "be",
        lemma: "sein",
        grammarNote: "3rd person singular present subjunctive I (supposition)",
        noteClass: "konjunktiv-i",
      },
      { german: "ein", english: "a" },
      { german: "System", english: "system" },
      { german: "von", english: "of" },
      { german: "ebenen", english: "plane" },
      { german: "Lichtwellen", english: "light waves" },
      { german: "gegeben,", english: "given," },
      { german: "dessen", english: "whose" },
      { german: "Energie", english: "energy" },
      { german: "auf", english: "to" },
      { german: "das", english: "the" },
      { german: "Koordinatensystem", english: "coordinate system" },
      { german: "(x, y, z)", english: "(x, y, z)" },
      { german: "bezogen", english: "referred" },
      {
        german: "sei.",
        english: "be.",
        lemma: "sein",
        grammarNote: "Subjunctive I in relative clause supposition",
        noteClass: "konjunktiv-i",
      },
    ],
    multiwordUnits: [
      {
        tokenIndices: [0, 1],
        english: "Let there be",
        kind: "fixed-phrase",
        grammarNote: "Standard mathematical supposition formula",
        noteClass: "konjunktiv-i",
      },
    ],
  }),
  validateGlossUnit({
    sentenceId: "me-p2-s1",
    revision: 1,
    sourceRevision: 1,
    sourceTextDigest: spanTextDigest(TEXT_ME_P2_S1),
    lang: "en",
    sourceLang: "de",
    attribution: {
      agent: "agent:claude-3-5-sonnet",
      modelId: "claude-3-5-sonnet-20241022",
      draftedBy: "agent:claude-3-5-sonnet",
      role: "author",
    },
    reviewState: "draft",
    tokens: [
      {
        german: "Gibt",
        english: "Gives",
        grammarNote: "Inverted condition clause",
        noteClass: "condition",
      },
      { german: "ein", english: "a" },
      { german: "Körper", english: "body" },
      { german: "die", english: "the" },
      { german: "Energie", english: "energy" },
      { german: "L", english: "L" },
      { german: "in", english: "in" },
      { german: "Form", english: "form" },
      { german: "von", english: "of" },
      { german: "Strahlung", english: "radiation" },
      {
        german: "ab,",
        english: "off,",
        grammarNote: "Separable prefix verb abgeben",
        noteClass: "separable-verb",
      },
      {
        german: "so",
        english: "then",
        grammarNote: "Consequence marker introducing main conclusion",
        noteClass: "consequence",
      },
      {
        german: "verkleinert",
        english: "diminishes",
        grammarNote: "Consequence verb",
        noteClass: "consequence",
      },
      { german: "sich", english: "itself" },
      { german: "seine", english: "its" },
      { german: "Masse", english: "mass" },
      { german: "um", english: "by" },
      { german: "$L/V^2$.", english: "$L/V^2$." },
    ],
    multiwordUnits: [
      {
        tokenIndices: [0, 10],
        english: "emits",
        kind: "separable-verb",
        grammarNote: "Separated verb construction gibt...ab",
        noteClass: "separable-verb",
      },
      {
        tokenIndices: [11, 12, 13],
        english: "then its mass diminishes",
        kind: "fixed-phrase",
        grammarNote: "Logical consequence construction",
        noteClass: "consequence",
      },
    ],
  }),
];

/**
 * Fixture Translation Units for Paper 4.
 */
export const FIXTURE_MASS_ENERGY_TRANSLATION_UNITS: readonly TranslationUnit[] = [
  validateTranslationUnit({
    id: "tr-me-p1-u1",
    sourceRefs: [{ paper: "mass-energy", id: "me-p1-s1" }],
    inlines: [
      {
        kind: "text",
        text: "The results of an electrodynamic investigation recently published in these Annalen lead to a very interesting conclusion, which shall be derived here.",
      },
    ],
    translator: {
      userId: "ad-cowper",
      name: "A. D. Cowper",
      role: "translator",
    },
    editor: {
      userId: "jemanuel",
      name: "Jeff Emanuel",
      role: "editor",
      reviewedAt: "2026-09-15",
    },
    revision: 1,
    reviewState: "reviewed",
    lang: "en",
  }),
  validateTranslationUnit({
    id: "tr-me-p1-u2",
    sourceRefs: [{ paper: "mass-energy", id: "me-p1-s2" }],
    inlines: [
      {
        kind: "text",
        text: "Let there be a system of plane light waves, whose energy is referred to the coordinate system (x, y, z).",
      },
    ],
    translator: {
      userId: "ad-cowper",
      name: "A. D. Cowper",
      role: "translator",
    },
    editor: {
      userId: "jemanuel",
      name: "Jeff Emanuel",
      role: "editor",
      reviewedAt: "2026-09-15",
    },
    revision: 1,
    reviewState: "reviewed",
    lang: "en",
  }),
  validateTranslationUnit({
    id: "tr-me-p2-u1",
    sourceRefs: [{ paper: "mass-energy", id: "me-p2-s1" }],
    inlines: [
      {
        kind: "text",
        text: "If a body gives off the energy L in the form of radiation, its mass diminishes by L/V².",
      },
    ],
    translator: {
      userId: "ad-cowper",
      name: "A. D. Cowper",
      role: "translator",
    },
    revision: 1,
    reviewState: "draft",
    lang: "en",
  }),
  validateTranslationUnit({
    id: "tr-me-p2-u2",
    sourceRefs: [{ paper: "mass-energy", id: "me-p2-s2" }],
    inlines: [
      {
        kind: "text",
        text: "Here it is evidently of no consequence that the energy taken from the body happens to turn into radiation.",
      },
    ],
    translator: {
      userId: "ad-cowper",
      name: "A. D. Cowper",
      role: "translator",
    },
    revision: 1,
    reviewState: "draft",
    lang: "en",
  }),
];

/**
 * Fixture Alignment for Paper 4.
 */
export const FIXTURE_MASS_ENERGY_ALIGNMENT: Alignment = validateAlignment({
  id: "align-mass-energy",
  paper: "mass-energy",
  edges: [
    {
      source: { paper: "mass-energy", blockId: "me-p1", sentenceId: "me-p1-s1" },
      target: { translationUnitId: "tr-me-p1-u1" },
    },
    {
      source: { paper: "mass-energy", blockId: "me-p1", sentenceId: "me-p1-s2" },
      target: { translationUnitId: "tr-me-p1-u2" },
    },
    {
      source: { paper: "mass-energy", blockId: "me-p2", sentenceId: "me-p2-s1" },
      target: { translationUnitId: "tr-me-p2-u1" },
    },
    {
      source: { paper: "mass-energy", blockId: "me-p2", sentenceId: "me-p2-s2" },
      target: { translationUnitId: "tr-me-p2-u2" },
    },
  ],
});
