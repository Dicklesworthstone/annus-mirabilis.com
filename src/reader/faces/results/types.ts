/**
 * The results face's data contract (am-read-results-face-uzh). A `ResultCard` is projected at
 * build time from real registries -- authored per-paper content (am-bm-results-cards-ft8k and
 * its siblings), the derivation-chain graph (am-eq-derivation-chains-r4c), the argument node's
 * `limitations` (am-cm-schemas-argument-llm), and dataset `addressesResults[]`
 * (am-cm-schemas-experiment-fuu) -- never authored a second time on the card itself.
 *
 * Shape agreed by mail with the Brownian results-cards lane (am-bm-results-cards-ft8k) before
 * being locked: `probes` is a list (a card can cite several instrument presets and/or teaching
 * tapes in sequence, never just one), `decoder` is a required layer as load-bearing as
 * `oneSentence`, and `usedBy` entries are prose-first because a "used later" note frequently
 * points at a dated citation with no internal result id to reference, not only at another card.
 */

export type SourceRef = Readonly<{
  paper: string;
  anchor: string;
  note?: string | undefined;
}>;

/** A card cites either a registered instrument preset/mode or a teaching tape, never both in one
 * entry -- a sequence of several `ProbeRef`s is how a card asks a reader to run more than one.
 * `presetLabel` is the label the laboratory's manifest gives the preset, the name a reader finds
 * among the laboratory's presets; no laboratory opens a preset from its URL. */
export type ProbeRef =
  | Readonly<{
      kind: "instrument";
      instrumentId: string;
      presetOrModeId: string;
      question: string;
      presetLabel?: string | undefined;
    }>
  | Readonly<{ kind: "tape"; tapeId: string; question: string }>;

/** Einstein's text for a result, read from the German face at its anchor, never retyped. */
export type PrintedLayerEntry = Readonly<{
  anchor: string;
  kind: "display" | "sentences";
  /** Ledger markup: LaTeX for a display, marked text for sentences. */
  text: string;
  /** The page the excerpt starts on. */
  page: number | undefined;
  /** The page it ends on, when its sentences run across a page turn. */
  lastPage?: number | undefined;
  /** The anchor on the German face, where the text stands in its paragraph. */
  germanHref: string;
}>;

/** A statement on the card that is not the result itself, labelled for what it is. */
export type Qualification = Readonly<{
  kind: "premise" | "comparison" | "approximation" | "inference" | "conditional";
  text: string;
}>;

export type DecoderEntry = Readonly<{
  symbol: string;
  meaning: string;
}>;

/** A forward citation to where this result gets used. `relatedResultId` is set only when the use
 * is by another card in this system; many are dated prose citing external work (Perrin 1908-09,
 * Sutherland 1905, Smoluchowski 1906) with nothing internal to point at. */
export type UsedByEntry = Readonly<{
  text: string;
  date?: string | undefined;
  citation?: SourceRef | undefined;
  relatedResultId?: string | undefined;
}>;

/**
 * A printed numerical check. `label` is the exact authored wording a paper's own results-cards
 * bead supplies ("as printed", "historical fixture", "modern constants, printed viscosity",
 * "modern comparison", and others as authored) -- this face never closes that vocabulary to one
 * fixed string; the voice lint (am-edit-voice-lint-trmf) is what enforces it, not this type.
 */
export type PrintedCheck = Readonly<{
  printedValue: string;
  statedInputs: Readonly<Record<string, string>>;
  constantSetId: string;
  scenarioId: string;
  reproducedValue: number;
  tolerance: number;
  comparisonKind: string;
  label: string;
  /** True when the historical fixture's own transcription is not yet reviewed
   * (content/scenarios/*.yaml `transcription.status: "pending"`) -- the check still renders,
   * but never as a fully verified transcription. */
  transcriptionPending: boolean;
  /** The reproduced value as the card shows it, with its unit, formatted by the projection. */
  reproducedText?: string | undefined;
}>;

export type EmpiricalInput = Readonly<{
  kind: "premise" | "dataset";
  id: string;
  citation: string;
}>;

export type AlternativeRoute = Readonly<{
  proofRouteId: string;
  routeKind: string;
  title: string;
}>;

export type VerificationState =
  | Readonly<{ status: "verified" }>
  | Readonly<{ status: "authored-unverified"; reviewRecordId?: string | undefined }>;

export type SupportLayer = Readonly<{
  proofRouteId: string;
  chainId: string;
  routeKind: string;
  entryAssumptions: readonly Readonly<{ premiseId: string; edgeType: string }>[];
  alternativeRoutes: readonly AlternativeRoute[];
  empiricalInputs: readonly EmpiricalInput[];
  /** Route-level summary: `authored-unverified` when ANY step on the selected route is not
   * `verified`, naming the first such step's `reviewRecordId` if it has one. The real
   * step-by-step verdict, and whether the route may publish at all, is `isPublicationReady`
   * below -- taken directly from am-eq-derivation-chains-r4c's verifyChain(), never re-derived
   * here (its gate rule is not restated in different words). */
  verificationState: VerificationState;
  isPublicationReady: boolean;
}>;

/** `text` is always `ArgumentNode.limitations.join(" ")` -- never a card-owned copy, so a
 * correction to the argument node updates every card referencing it in one compile. */
export type LimitationLayer = Readonly<{
  argumentId: string;
  text: string;
  /** Set when the limit is itself a later finding rather than the paper's own qualification. */
  historiansMarginRecordId?: string | undefined;
}>;

export type ReceptionEntry = Readonly<{
  datasetId: string;
  relation: string;
  statement: string;
  date: string;
  precision: "year" | "month" | "day" | "range";
}>;

export type FourKindsOfMeaning = Readonly<{
  argumentStatus: string;
  modelStatus: string;
  evidentialRole: string;
  historicalStatus: string;
}>;

export type ResultCard = Readonly<{
  resultId: string;
  paper: string;
  sectionAnchors: readonly string[];
  /** A short heading. Without one the card is headed by its one sentence. */
  title?: string | undefined;
  /** The result as printed, from the German face. */
  printed?: readonly PrintedLayerEntry[] | undefined;
  qualifications?: readonly Qualification[] | undefined;

  /** `[0]` is primary and renders in the card's headline; the rest render beneath it in printed
   * order. Rendering both as colorized equations is am-eq-colorized-component-1z8's job -- until
   * that lands, ResultCard renders a labeled plain-text placeholder, never a recomputed value. */
  printedEquationIds: readonly string[];
  oneSentence: string;
  decoder: readonly DecoderEntry[];

  printedChecks: readonly PrintedCheck[];
  /** The owner's sentence comparing the checks' constant sets, shown with them, never derived. */
  printedCheckComparison?: string | undefined;
  probes: readonly ProbeRef[];

  misconceptionIds: readonly string[];
  /**
   * The same misconceptions with the tempting claim each names, linked to where the explanation
   * page sets it out. Absent where only the ids are known.
   */
  misconceptions?: readonly Readonly<{ id: string; claim: string; href: string }>[] | undefined;
  usedBy: readonly UsedByEntry[];

  meanings: FourKindsOfMeaning;
  sources: readonly SourceRef[];
  selectionReason: string;

  /** Absent when no derivation-chain registry covers the result; the card then shows no route. */
  support?: SupportLayer | undefined;
  /** One per argument passage the result rests on, each that passage's own limitations. */
  limitations: readonly LimitationLayer[];
  /** Empty means "nothing later addressed this result directly" -- a card renders no reception
   * section at all rather than a placeholder, per the bead's own explicit rule. */
  reception: readonly ReceptionEntry[];
}>;
