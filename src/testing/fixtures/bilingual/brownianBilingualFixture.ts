import { type Inline, plainText } from "../../../content/schemas/inlines.ts";
import type { ReviewRecord } from "../../../content/schemas/review.ts";
import {
  type Alignment,
  type EditorialNote,
  type Paper,
  type SourceBlock,
  type TranslationUnit,
  validateAlignment,
  validateEditorialNote,
  validatePaper,
  validateSourceBlock,
  validateTranslationUnit,
} from "../../../content/schemas/source.ts";
import { spanTextDigest } from "../../../content/schemas/spans.ts";

/**
 * Fixture Paper for Brownian motion (§§4–5 test slice).
 * Explicitly labeled as test fixture data.
 */
export const FIXTURE_BROWNIAN_PAPER: Paper = validatePaper({
  slug: "brownian-motion",
  bibKey: "ap-17-549",
  titleGerman:
    "Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen",
  titleEnglishWorking:
    "On the Movement of Small Particles Suspended in Stationary Liquids Required by the Molecular-Kinetic Theory of Heat",
  editorialAdditions: [
    {
      phrase: "Small",
      reason: "Clarifies microscopic scale.",
      germanBasis: "no-direct-basis",
    },
  ],
  authorLine: "A. Einstein",
  dates: [
    {
      type: "date-line",
      text: "Bern, Mai 1905.",
      earliest: "1905-05-01",
      latest: "1905-05-31",
      precision: "month",
      source: "Printed date-line, p. 560.",
      verifiedAt: "2026-09-15",
    },
    {
      type: "received",
      earliest: "1905-05-11",
      latest: "1905-05-11",
      precision: "day",
      source: "Issue 8 masthead.",
      verifiedAt: "2026-09-15",
    },
    {
      type: "issue-publication",
      earliest: "1905-07-18",
      latest: "1905-07-18",
      precision: "day",
      source: "Journal issue publication register.",
      verifiedAt: "2026-09-15",
    },
  ],
  journal: {
    name: "Annalen der Physik",
    series: 4,
    volume: 17,
    wholeSeriesVolume: 322,
    issue: 8,
    issueSource: "Masthead",
    pages: { first: 549, last: 560 },
    doi: "10.1002/andp.19053220806",
    doiVerifiedAt: "2026-09-15",
  },
  collectedPapers: { volume: 2, document: 16 },
  orderedBlockIds: [
    "bm-s4-h1",
    "bm-s4-p1",
    "bm-s4-eq1",
    "bm-s5-h1",
    "bm-s5-p1",
    "bm-s5-fn1",
    "bm-closing",
  ],
  companion: false,
  status: "published",
  sourceStatus: "reviewed",
  sourceNotice: "Reviewed diplomatic transcript.",
  sections: [
    {
      id: "bm-sec-04",
      title: "§ 4. Über die ungeordnete Bewegung von in einer Flüssigkeit suspendierten Teilchen und deren Beziehung zur Diffusion",
      arguments: ["arg-bm-diffusion"],
    },
    {
      id: "bm-sec-05",
      title: "§ 5. Formel für die mittlere Verschiebung suspendierter Teilchen",
      arguments: ["arg-bm-displacement"],
    },
  ],
});

const TEXT_BM_S4_P1_S1 = "Es sei ein Zeitintervall τ gegeben.";
const TEXT_BM_S4_P1_S2 =
  "Wir wollen annehmen, daß jedes einzelne Teilchen eine Verschiebung Δ erfahre.";
const TEXT_BM_S4_P1 = `${TEXT_BM_S4_P1_S1} ${TEXT_BM_S4_P1_S2}`;
const DIGEST_BM_S4_P1 = spanTextDigest(TEXT_BM_S4_P1);

const TEXT_BM_S5_P1_S1 =
  "Wir wollen nun untersuchen, wie weit ein Teilchen im Mittel wandert.";
const TEXT_BM_S5_P1_S2 =
  "Die mittlere Verschiebung ist proportional zur Wurzel aus der Zeit.";
const INLINES_BM_S5_P1: readonly Inline[] = [
  { kind: "text", text: TEXT_BM_S5_P1_S1 },
  { kind: "footnote-mark", mark: "1", footnoteId: "bm-s5-fn1" },
  { kind: "text", text: ` ${TEXT_BM_S5_P1_S2}` },
];
const TEXT_BM_S5_P1 = plainText(INLINES_BM_S5_P1);
const DIGEST_BM_S5_P1 = spanTextDigest(TEXT_BM_S5_P1);

/**
 * Fixture German Source Blocks for Brownian motion §§4–5.
 */
export const FIXTURE_BROWNIAN_SOURCE_BLOCKS: readonly SourceBlock[] = [
  validateSourceBlock({
    id: "bm-s4-h1",
    kind: "heading",
    paper: "brownian-motion",
    section: "bm-sec-04",
    order: 1,
    locators: [{ pdfPageIndex: 7, printedPage: 556 }],
    editorialLabel: "§ 4. Diffusion",
    diplomaticText:
      "§ 4. Über die ungeordnete Bewegung von in einer Flüssigkeit suspendierten Teilchen und deren Beziehung zur Diffusion",
    inlines: [
      {
        kind: "text",
        text: "§ 4. Über die ungeordnete Bewegung von in einer Flüssigkeit suspendierten Teilchen und deren Beziehung zur Diffusion",
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
    id: "bm-s4-p1",
    kind: "paragraph",
    paper: "brownian-motion",
    section: "bm-sec-04",
    order: 2,
    locators: [{ pdfPageIndex: 7, printedPage: 556 }],
    diplomaticText: TEXT_BM_S4_P1,
    inlines: [
      {
        kind: "text",
        text: TEXT_BM_S4_P1,
      },
    ],
    sentenceSpans: [
      {
        id: "bm-s4-p1-s1",
        span: {
          start: 0,
          end: 35,
          textDigest: DIGEST_BM_S4_P1,
          blockRevision: 1,
        },
      },
      {
        id: "bm-s4-p1-s2",
        span: {
          start: 36,
          end: 113,
          textDigest: DIGEST_BM_S4_P1,
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
    id: "bm-s4-eq1",
    kind: "equation",
    paper: "brownian-motion",
    section: "bm-sec-04",
    order: 3,
    originalLabel: "1",
    locators: [{ pdfPageIndex: 8, printedPage: 557 }],
    diplomaticText: "\\frac{\\partial \\nu}{\\partial t} = D \\frac{\\partial^2 \\nu}{\\partial x^2}",
    inlines: [
      {
        kind: "math",
        latex: "\\frac{\\partial \\nu}{\\partial t} = D \\frac{\\partial^2 \\nu}{\\partial x^2}",
        equationId: "eq-diffusion-1d",
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
    id: "bm-s5-h1",
    kind: "heading",
    paper: "brownian-motion",
    section: "bm-sec-05",
    order: 4,
    locators: [{ pdfPageIndex: 10, printedPage: 559 }],
    diplomaticText: "§ 5. Formel für die mittlere Verschiebung suspendierter Teilchen",
    inlines: [
      {
        kind: "text",
        text: "§ 5. Formel für die mittlere Verschiebung suspendierter Teilchen",
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
    id: "bm-s5-p1",
    kind: "paragraph",
    paper: "brownian-motion",
    section: "bm-sec-05",
    order: 5,
    locators: [{ pdfPageIndex: 10, printedPage: 559 }],
    diplomaticText: TEXT_BM_S5_P1,
    inlines: INLINES_BM_S5_P1,
    sentenceSpans: [
      {
        id: "bm-s5-p1-s1",
        span: {
          start: 0,
          end: 69,
          textDigest: DIGEST_BM_S5_P1,
          blockRevision: 1,
        },
      },
      {
        id: "bm-s5-p1-s2",
        span: {
          start: 69,
          end: 137,
          textDigest: DIGEST_BM_S5_P1,
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
    id: "bm-s5-fn1",
    kind: "footnote",
    paper: "brownian-motion",
    section: "bm-sec-05",
    order: 6,
    originalLabel: "1",
    locators: [{ pdfPageIndex: 10, printedPage: 559 }],
    diplomaticText: "1) M. Smoluchowski hat eine ähnliche Formel abgeleitet.",
    inlines: [
      {
        kind: "text",
        text: "M. Smoluchowski hat eine ähnliche Formel abgeleitet.",
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
    id: "bm-closing",
    kind: "closing",
    paper: "brownian-motion",
    order: 7,
    locators: [{ pdfPageIndex: 11, printedPage: 560 }],
    diplomaticText: "Bern, Mai 1905.",
    inlines: [
      {
        kind: "text",
        text: "Bern, Mai 1905.",
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
 * Fixture English Translation Units for Brownian motion §§4–5.
 */
export const FIXTURE_BROWNIAN_TRANSLATION_UNITS: readonly TranslationUnit[] = [
  validateTranslationUnit({
    id: "tr-bm-s4-h1",
    sourceRefs: [{ paper: "brownian-motion", id: "bm-s4-h1" }],
    inlines: [
      {
        kind: "text",
        text: "§ 4. On the Irregular Movement of Particles Suspended in a Liquid and Its Relation to Diffusion",
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
    unresolvedAlternatives: [],
    reviewState: "reviewed",
    lang: "en",
  }),
  validateTranslationUnit({
    id: "tr-bm-s4-p1-u1",
    sourceRefs: [{ paper: "brownian-motion", id: "bm-s4-p1-s1" }],
    inlines: [
      {
        kind: "text",
        text: "Let a time interval τ be given.",
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
    unresolvedAlternatives: [],
    reviewState: "reviewed",
    lang: "en",
  }),
  validateTranslationUnit({
    id: "tr-bm-s4-p1-u2",
    sourceRefs: [{ paper: "brownian-motion", id: "bm-s4-p1-s2" }],
    inlines: [
      {
        kind: "text",
        text: "We shall assume that each individual particle experiences a displacement Δ.",
      },
    ],
    translator: {
      agent: "agent:claude-3-5-sonnet",
      modelId: "claude-3-5-sonnet-20241022",
      draftedBy: "agent:claude-3-5-sonnet",
      role: "translator",
    },
    revision: 1,
    unresolvedAlternatives: [
      {
        text: "We assume that every single particle undergoes a shift Δ.",
        rationale: "More direct literal phrasing of 'erfahre'.",
      },
    ],
    reviewState: "draft",
    lang: "en",
  }),
  validateTranslationUnit({
    id: "tr-bm-s4-eq1",
    sourceRefs: [{ paper: "brownian-motion", id: "bm-s4-eq1" }],
    inlines: [
      {
        kind: "math",
        latex: "\\frac{\\partial \\nu}{\\partial t} = D \\frac{\\partial^2 \\nu}{\\partial x^2}",
        equationId: "eq-diffusion-1d",
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
    unresolvedAlternatives: [],
    reviewState: "reviewed",
    lang: "en",
  }),
  validateTranslationUnit({
    id: "tr-bm-s5-h1",
    sourceRefs: [{ paper: "brownian-motion", id: "bm-s5-h1" }],
    inlines: [
      {
        kind: "text",
        text: "§ 5. Formula for the Mean Displacement of Suspended Particles",
      },
    ],
    translator: {
      userId: "ad-cowper",
      name: "A. D. Cowper",
      role: "translator",
    },
    revision: 1,
    unresolvedAlternatives: [],
    reviewState: "in-progress",
    lang: "en",
  }),
  validateTranslationUnit({
    id: "tr-bm-s5-p1-u1",
    sourceRefs: [
      { paper: "brownian-motion", id: "bm-s5-p1-s1" },
      { paper: "brownian-motion", id: "bm-s5-p1-s2" },
    ],
    inlines: [
      {
        kind: "text",
        text: "We now examine the mean distance a particle wanders: the mean displacement is proportional to the square root of time.",
      },
    ],
    translator: {
      agent: "agent:claude-3-5-sonnet",
      modelId: "claude-3-5-sonnet-20241022",
      draftedBy: "agent:claude-3-5-sonnet",
      role: "translator",
    },
    revision: 1,
    unresolvedAlternatives: [],
    reviewState: "draft",
    lang: "en",
  }),
];

/**
 * Fixture Alignment with 1:1, 1:2, and 2:1 edges.
 */
export const FIXTURE_BROWNIAN_ALIGNMENT: Alignment = validateAlignment({
  id: "align-bm-s4-s5",
  paper: "brownian-motion",
  edges: [
    {
      source: {
        paper: "brownian-motion",
        blockId: "bm-s4-h1",
      },
      target: {
        translationUnitId: "tr-bm-s4-h1",
      },
    },
    {
      source: {
        paper: "brownian-motion",
        blockId: "bm-s4-p1",
        sentenceId: "bm-s4-p1-s1",
      },
      target: {
        translationUnitId: "tr-bm-s4-p1-u1",
      },
    },
    {
      source: {
        paper: "brownian-motion",
        blockId: "bm-s4-p1",
        sentenceId: "bm-s4-p1-s2",
      },
      target: {
        translationUnitId: "tr-bm-s4-p1-u2",
      },
    },
    {
      source: {
        paper: "brownian-motion",
        blockId: "bm-s4-eq1",
      },
      target: {
        translationUnitId: "tr-bm-s4-eq1",
      },
    },
    {
      source: {
        paper: "brownian-motion",
        blockId: "bm-s5-h1",
      },
      target: {
        translationUnitId: "tr-bm-s5-h1",
      },
    },
    // 2:1 alignment (two source sentences aligned to one merged English unit)
    {
      source: {
        paper: "brownian-motion",
        blockId: "bm-s5-p1",
        sentenceId: "bm-s5-p1-s1",
      },
      target: {
        translationUnitId: "tr-bm-s5-p1-u1",
      },
    },
    {
      source: {
        paper: "brownian-motion",
        blockId: "bm-s5-p1",
        sentenceId: "bm-s5-p1-s2",
      },
      target: {
        translationUnitId: "tr-bm-s5-p1-u1",
      },
    },
  ],
});

/**
 * Fixture Editorial Notes.
 */
export const FIXTURE_EDITORIAL_NOTES: readonly EditorialNote[] = [
  validateEditorialNote({
    id: "note-bm-historian-01",
    author: {
      userId: "jemanuel",
      name: "Jeff Emanuel",
      role: "historian",
    },
    claim: "Einstein submitted this paper without knowing whether Brownian motion had been experimentally verified with quantitative accuracy.",
    sourceSupport: [],
    kind: "historian-margin",
    affectedIds: ["bm-s4-p1"],
    reviewState: "reviewed",
    lang: "en",
  }),
  validateEditorialNote({
    id: "note-bm-typo-01",
    author: {
      userId: "jemanuel",
      name: "Jeff Emanuel",
      role: "editor",
    },
    claim: "Historical typographical correction in printed Annalen formula.",
    sourceSupport: [],
    kind: "typographical",
    affectedIds: ["bm-s4-eq1"],
    reviewState: "reviewed",
    originalReading: "\\frac{\\partial \\nu}{\\partial t} = D \\frac{\\partial \\nu}{\\partial x}",
    proposedReading: "\\frac{\\partial \\nu}{\\partial t} = D \\frac{\\partial^2 \\nu}{\\partial x^2}",
    reasoning: "Second spatial derivative required for parabolic diffusion.",
    evidence: "Einstein's manuscript and 1906 reprint.",
    layer: "source",
    lang: "en",
  }),
];

/**
 * Fixture Review Records for testing valid vs stale review states.
 */
export const FIXTURE_REVIEW_RECORDS: readonly ReviewRecord[] = [
  {
    id: "rev-bm-s4-h1",
    reviewType: "physics-math",
    reviewer: "jemanuel",
    scope: [
      {
        recordId: "tr-bm-s4-h1",
        translationRevision: 1,
      },
      {
        recordId: "tr-bm-s4-p1-u1",
        translationRevision: 1,
      },
      {
        recordId: "tr-bm-s4-eq1",
        translationRevision: 1,
      },
    ],
    date: "2026-09-15",
    result: "accepted",
    acceptedRevisions: {
      "tr-bm-s4-h1": 1,
      "tr-bm-s4-p1-u1": 1,
      "tr-bm-s4-eq1": 1,
    },
  },
  // A stale review record for tr-bm-s5-p1-u1 (reviewed at rev 0, but current unit is rev 1)
  {
    id: "rev-bm-s5-stale",
    reviewType: "physics-math",
    reviewer: "jemanuel",
    scope: [
      {
        recordId: "tr-bm-s5-p1-u1",
        translationRevision: 0,
      },
    ],
    date: "2026-09-01",
    result: "accepted",
    acceptedRevisions: {
      "tr-bm-s5-p1-u1": 0,
    },
  },
];
