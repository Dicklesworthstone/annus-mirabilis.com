/**
 * Schema definitions and validators for Discovery Journeys.
 * Specification: am-disc-journey-framework-umbg, AGENTS.md (§7.1–7.4)
 */

import type { FourMeanings } from "./meanings.ts";

export const JOURNEY_SCHEMA_VERSION = 1;

export const FORK_VARIES_KINDS = [
  "observable-definition",
  "measurement-choice",
  "theoretical-postulate",
  "derivation-direction",
] as const;
export type ForkVariesKind = (typeof FORK_VARIES_KINDS)[number];

export const FORK_VARIES_EXPLANATIONS: Readonly<Record<ForkVariesKind, string>> = {
  "observable-definition": "The branches vary what quantity is defined as the primary observable.",
  "measurement-choice": "The branches vary what physical quantity is chosen for measurement.",
  "theoretical-postulate":
    "The branches vary which theoretical principle is taken as a starting postulate.",
  "derivation-direction":
    "The branches vary the direction of the derivation from premises to consequences.",
};

export const OUTCOME_TYPES = [
  "dead-end-on-constraint",
  "correct-but-weaker",
  "empirically-equivalent-not-refuted",
  "papers-route",
  "undecided-on-available-evidence",
] as const;
export type OutcomeType = (typeof OUTCOME_TYPES)[number];

export const OUTCOME_TYPE_LABELS: Readonly<Record<OutcomeType, string>> = {
  "dead-end-on-constraint": "Constrained by physical contradiction",
  "correct-but-weaker": "Valid consequence, but less general",
  "empirically-equivalent-not-refuted": "Empirically equivalent within stated scope",
  "papers-route": "The route taken in the 1905 paper",
  "undecided-on-available-evidence": "Undecided on 1904 evidence",
};

export type PendingElement = Readonly<{
  element: string;
  reason: string;
  ownerBead: string;
}>;

export type AdmittedImport = Readonly<{
  importId: string;
  provenance: string;
  sourceAnchor: string;
}>;

export type StagePremiseRef = Readonly<{
  cardId: string;
  parallelWorkAcknowledged?: boolean | undefined;
  importId?: string | undefined;
}>;

export type StageInstrument = Readonly<{
  instrumentId: string;
  mode?: string | undefined;
  presetOrTapeId?: string | undefined;
  presetId?: string | undefined;
  teachingTapeId?: string | undefined;
}>;

export type StageReasoning = Readonly<{
  chainId?: string | undefined;
  stepId?: string | undefined;
  foundationId?: string | undefined;
  missingStepId?: string | undefined;
  kind?: string | undefined;
  label?: string | undefined;
}>;

export type TransferCase = Readonly<{
  condition: string;
  explanation: string;
  whatChanges: string;
  whatStaysValid: string;
}>;

export type StageSupport = Readonly<{
  workedExample: Readonly<{
    prompt: string;
    steps: readonly string[];
    result: string;
  }>;
  partialComparison: Readonly<{
    given: string;
    toComplete: string;
    explanation: string;
  }>;
  prediction?:
    | Readonly<{
        prompt: string;
        choices?: readonly string[] | undefined;
        explanation: string;
      }>
    | undefined;
  explanation: string;
  transferCase?: TransferCase | undefined;
}>;

export type Stage = Readonly<{
  id: string; // arg-...
  title: string;
  question: string;
  computeFromShelf: string;
  premiseRefs: readonly StagePremiseRef[];
  instrument?: StageInstrument | undefined;
  reasoning: readonly StageReasoning[];
  prerequisites: readonly string[]; // foundation IDs
  support: StageSupport;
  meanings: FourMeanings | Readonly<Record<string, unknown>>;
}>;

export type BranchProponent = Readonly<{
  name: string;
  cardId: string;
}>;

export type BranchStep = Readonly<{
  text: string;
  presetId?: string | undefined;
  chainStepId?: string | undefined;
}>;

export type WhatWouldDecide = Readonly<{
  name: string;
  recordId: string;
  year?: number | undefined;
  status?: "later" | "available" | undefined;
}>;

export type BranchOutcome = Readonly<{
  type: OutcomeType;
  constraintRef?: string | undefined;
  scopeNote?: string | undefined;
  insufficiency?: string | undefined;
  whatWouldDecide?: WhatWouldDecide | undefined;
  plainLanguage: string;
}>;

export type Branch = Readonly<{
  id: string; // arg-...
  label: string;
  proponent?: BranchProponent | undefined;
  hypothesis: string;
  worksWhen: string;
  steps: readonly BranchStep[];
  outcome: BranchOutcome;
}>;

export type Fork = Readonly<{
  id: string; // arg-...
  afterStageId: string;
  question: string;
  varies: ForkVariesKind;
  branches: readonly Branch[];
}>;

export type MoveSummary = Readonly<{
  text: string;
  reviewState: "draft" | "reviewed";
}>;

export type JourneyMove = Readonly<{
  label: string;
  chainId: string;
  stepId: string;
  r0Summary: MoveSummary;
}>;

export type WorldCheckLaterEvidence = Readonly<{
  year: number;
  description: string;
  recordId?: string | undefined;
}>;

export type StaticWorkedExample = Readonly<{
  label: string;
  value: string | number;
  unit: string;
  constantSetId: string;
}>;

export type WorldCheck = Readonly<{
  id: string;
  claim: string;
  instrumentId: string;
  quantityId: string;
  expected: number | string;
  tolerance?:
    | Readonly<{ absolute?: number | undefined; relative?: number | undefined }>
    | undefined;
  laterEvidence?: WorldCheckLaterEvidence | undefined;
  staticWorkedExample: StaticWorkedExample;
  comparisonKind: "measured-fact" | "printed-prediction" | "theoretical-bound";
}>;

export type SourceJump = Readonly<{
  id: string;
  label: string;
  paperId: string;
  section: string;
  targetAnchor: string;
  weavePredicateId?: string | undefined;
  pointer: string;
}>;

export type ExerciseRef = Readonly<{
  id: string;
  role: "instrumented" | "explanation";
  prompt?: string | undefined;
}>;

export type PpeTask = Readonly<{
  promptId: string;
  task: string;
  perturbPrompt: string;
  explainPrompt: string;
}>;

export type Door = Readonly<{
  id: string;
  title: string;
  arrivesAtEquationId: string;
  entryRecordId?: string | undefined;
  /** Where the door opens: a page or an instrument. A door a reader cannot open is only a label. */
  href?: string | undefined;
  /** What the reader already owns that the door starts from, in a sentence. */
  summary?: string | undefined;
  /** The equation it arrives at, as a reader names it; the id is for the build. */
  arrivesAtLabel?: string | undefined;
}>;

export type Doors = Readonly<{
  frontDoor: Door;
  sideDoors: readonly Door[];
}>;

export type Journey = Readonly<{
  id: string; // paper slug (e.g. brownian-motion, light-quanta, special-relativity, mass-energy)
  paper: string;
  revision: string | number;
  completeness: "complete" | "partial";
  pendingElements?: readonly PendingElement[] | undefined;
  admittedImports?: readonly AdmittedImport[] | undefined;
  shelf: readonly string[]; // premise / card IDs
  naggingFact: string;
  firstHonestQuestion: string;
  stages: readonly Stage[];
  forks: readonly Fork[];
  move: JourneyMove;
  worldChecks: readonly WorldCheck[];
  sourceJumps: readonly SourceJump[];
  exercises: readonly ExerciseRef[];
  ppeTask: PpeTask;
  doors: Doors;
}>;

export class JourneySchemaError extends Error {
  readonly code: string;
  readonly path: string;

  constructor(code: string, message: string, path = "journey") {
    super(`[Journey] ${path}: ${message} (${code})`);
    this.name = "JourneySchemaError";
    this.code = code;
    this.path = path;
  }
}

/**
 * Validates a Journey object shape.
 */
export function validateJourney(raw: unknown, path = "journey"): Journey {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new JourneySchemaError("invalid-journey-record", "Journey must be an object.", path);
  }
  const o = raw as Record<string, unknown>;

  if (typeof o.id !== "string" || !o.id.trim()) {
    throw new JourneySchemaError("missing-id", "Journey id is required.", `${path}.id`);
  }
  if (typeof o.paper !== "string" || !o.paper.trim()) {
    throw new JourneySchemaError("missing-paper", "Journey paper is required.", `${path}.paper`);
  }
  if (o.completeness !== "complete" && o.completeness !== "partial") {
    throw new JourneySchemaError(
      "invalid-completeness",
      `completeness must be "complete" or "partial" (got "${String(o.completeness)}").`,
      `${path}.completeness`,
    );
  }

  // Pending elements validation for partial journeys
  let pendingElements: PendingElement[] | undefined;
  if (o.completeness === "partial") {
    if (!Array.isArray(o.pendingElements) || o.pendingElements.length === 0) {
      throw new JourneySchemaError(
        "missing-pending-elements",
        "Partial journey must declare a non-empty pendingElements array.",
        `${path}.pendingElements`,
      );
    }
    pendingElements = o.pendingElements.map((p, i) => {
      const pPath = `${path}.pendingElements[${i}]`;
      if (!p || typeof p !== "object") {
        throw new JourneySchemaError(
          "invalid-pending-element",
          "Pending element must be an object.",
          pPath,
        );
      }
      const pe = p as Record<string, unknown>;
      if (typeof pe.element !== "string" || !pe.element.trim()) {
        throw new JourneySchemaError(
          "missing-pending-element-name",
          "element name is required.",
          `${pPath}.element`,
        );
      }
      if (typeof pe.reason !== "string" || !pe.reason.trim()) {
        throw new JourneySchemaError(
          "missing-pending-element-reason",
          "reason is required.",
          `${pPath}.reason`,
        );
      }
      if (typeof pe.ownerBead !== "string" || !pe.ownerBead.trim()) {
        throw new JourneySchemaError(
          "missing-pending-element-owner",
          "ownerBead is required.",
          `${pPath}.ownerBead`,
        );
      }
      return {
        element: pe.element,
        reason: pe.reason,
        ownerBead: pe.ownerBead,
      };
    });
  }

  // Admitted imports
  let admittedImports: AdmittedImport[] | undefined;
  if (Array.isArray(o.admittedImports)) {
    admittedImports = o.admittedImports.map((imp, i) => {
      const impPath = `${path}.admittedImports[${i}]`;
      if (!imp || typeof imp !== "object") {
        throw new JourneySchemaError(
          "invalid-admitted-import",
          "Admitted import must be an object.",
          impPath,
        );
      }
      const impObj = imp as Record<string, unknown>;
      if (typeof impObj.importId !== "string" || !impObj.importId.trim()) {
        throw new JourneySchemaError(
          "missing-import-id",
          "importId is required.",
          `${impPath}.importId`,
        );
      }
      if (typeof impObj.provenance !== "string" || !impObj.provenance.trim()) {
        throw new JourneySchemaError(
          "missing-import-provenance",
          "provenance is required.",
          `${impPath}.provenance`,
        );
      }
      if (typeof impObj.sourceAnchor !== "string" || !impObj.sourceAnchor.trim()) {
        throw new JourneySchemaError(
          "missing-import-anchor",
          "sourceAnchor is required.",
          `${impPath}.sourceAnchor`,
        );
      }
      return {
        importId: impObj.importId,
        provenance: impObj.provenance,
        sourceAnchor: impObj.sourceAnchor,
      };
    });
  }

  // Shelf
  if (!Array.isArray(o.shelf)) {
    throw new JourneySchemaError(
      "missing-shelf",
      "shelf must be an array of card IDs.",
      `${path}.shelf`,
    );
  }
  const shelf = o.shelf.map((s, i) => {
    if (typeof s !== "string" || !s.trim()) {
      throw new JourneySchemaError(
        "invalid-shelf-card-id",
        "shelf entry must be a non-empty card ID string.",
        `${path}.shelf[${i}]`,
      );
    }
    return s;
  });

  // Nagging Fact
  if (typeof o.naggingFact !== "string" || !o.naggingFact.trim()) {
    throw new JourneySchemaError(
      "missing-nagging-fact",
      "naggingFact is required.",
      `${path}.naggingFact`,
    );
  }

  // First Honest Question
  if (typeof o.firstHonestQuestion !== "string" || !o.firstHonestQuestion.trim()) {
    throw new JourneySchemaError(
      "missing-first-honest-question",
      "firstHonestQuestion is required.",
      `${path}.firstHonestQuestion`,
    );
  }
  if (!o.firstHonestQuestion.trim().endsWith("?")) {
    throw new JourneySchemaError(
      "first-honest-question-must-be-question",
      "firstHonestQuestion must end with a question mark.",
      `${path}.firstHonestQuestion`,
    );
  }

  // Stages
  if (!Array.isArray(o.stages)) {
    throw new JourneySchemaError("missing-stages", "stages must be an array.", `${path}.stages`);
  }
  const stages: Stage[] = o.stages.map((st, i) => {
    const sPath = `${path}.stages[${i}]`;
    if (!st || typeof st !== "object") {
      throw new JourneySchemaError("invalid-stage", "stage must be an object.", sPath);
    }
    const s = st as Record<string, unknown>;
    if (typeof s.id !== "string" || !s.id.trim()) {
      throw new JourneySchemaError("missing-stage-id", "stage id is required.", `${sPath}.id`);
    }
    if (typeof s.title !== "string" || !s.title.trim()) {
      throw new JourneySchemaError(
        "missing-stage-title",
        "stage title is required.",
        `${sPath}.title`,
      );
    }
    if (typeof s.question !== "string" || !s.question.trim()) {
      throw new JourneySchemaError(
        "missing-stage-question",
        "stage question is required.",
        `${sPath}.question`,
      );
    }
    if (typeof s.computeFromShelf !== "string" || !s.computeFromShelf.trim()) {
      throw new JourneySchemaError(
        "missing-compute-from-shelf",
        "computeFromShelf is required.",
        `${sPath}.computeFromShelf`,
      );
    }

    const premiseRefs: StagePremiseRef[] = Array.isArray(s.premiseRefs)
      ? s.premiseRefs.map((pr, j) => {
          if (typeof pr === "string") {
            return { cardId: pr };
          }
          if (pr && typeof pr === "object") {
            const prObj = pr as Record<string, unknown>;
            return {
              cardId: String(prObj.cardId ?? prObj.id ?? ""),
              parallelWorkAcknowledged: Boolean(prObj.parallelWorkAcknowledged),
              importId: typeof prObj.importId === "string" ? prObj.importId : undefined,
            };
          }
          throw new JourneySchemaError(
            "invalid-premise-ref",
            "Invalid stage premiseRef entry.",
            `${sPath}.premiseRefs[${j}]`,
          );
        })
      : [];

    let instrument: StageInstrument | undefined;
    if (s.instrument && typeof s.instrument === "object") {
      const inst = s.instrument as Record<string, unknown>;
      instrument = {
        instrumentId: String(inst.instrumentId ?? ""),
        mode: typeof inst.mode === "string" ? inst.mode : undefined,
        presetOrTapeId: typeof inst.presetOrTapeId === "string" ? inst.presetOrTapeId : undefined,
        presetId: typeof inst.presetId === "string" ? inst.presetId : undefined,
        teachingTapeId: typeof inst.teachingTapeId === "string" ? inst.teachingTapeId : undefined,
      };
    }

    const reasoning: StageReasoning[] = Array.isArray(s.reasoning)
      ? s.reasoning.map((r) => {
          if (typeof r === "string") return { foundationId: r };
          const rObj = r as Record<string, unknown>;
          return {
            chainId: typeof rObj.chainId === "string" ? rObj.chainId : undefined,
            stepId: typeof rObj.stepId === "string" ? rObj.stepId : undefined,
            foundationId: typeof rObj.foundationId === "string" ? rObj.foundationId : undefined,
            missingStepId: typeof rObj.missingStepId === "string" ? rObj.missingStepId : undefined,
            kind: typeof rObj.kind === "string" ? rObj.kind : undefined,
            label: typeof rObj.label === "string" ? rObj.label : undefined,
          };
        })
      : [];

    const prerequisites: string[] = Array.isArray(s.prerequisites)
      ? s.prerequisites.map((p) => String(p))
      : [];

    // Support ladder
    const sup = (s.support ?? {}) as Record<string, unknown>;
    const we = (sup.workedExample ?? {}) as Record<string, unknown>;
    const pc = (sup.partialComparison ?? {}) as Record<string, unknown>;

    let transferCase: TransferCase | undefined;
    if (sup.transferCase && typeof sup.transferCase === "object") {
      const tc = sup.transferCase as Record<string, unknown>;
      transferCase = {
        condition: String(tc.condition ?? ""),
        explanation: String(tc.explanation ?? ""),
        whatChanges: String(tc.whatChanges ?? ""),
        whatStaysValid: String(tc.whatStaysValid ?? ""),
      };
    }

    let prediction:
      | { prompt: string; choices?: readonly string[]; explanation: string }
      | undefined;
    if (sup.prediction && typeof sup.prediction === "object") {
      const pred = sup.prediction as Record<string, unknown>;
      prediction = {
        prompt: String(pred.prompt ?? ""),
        ...(Array.isArray(pred.choices) ? { choices: pred.choices.map((c) => String(c)) } : {}),
        explanation: String(pred.explanation ?? ""),
      };
    }

    const support: StageSupport = {
      workedExample: {
        prompt: String(we.prompt ?? ""),
        steps: Array.isArray(we.steps) ? we.steps.map((st) => String(st)) : [],
        result: String(we.result ?? ""),
      },
      partialComparison: {
        given: String(pc.given ?? ""),
        toComplete: String(pc.toComplete ?? ""),
        explanation: String(pc.explanation ?? ""),
      },
      prediction,
      explanation: String(sup.explanation ?? ""),
      transferCase,
    };

    return {
      id: s.id,
      title: s.title,
      question: s.question,
      computeFromShelf: s.computeFromShelf,
      premiseRefs,
      instrument,
      reasoning,
      prerequisites,
      support,
      meanings: (s.meanings ?? {}) as FourMeanings,
    };
  });

  // Forks
  if (!Array.isArray(o.forks)) {
    throw new JourneySchemaError("missing-forks", "forks must be an array.", `${path}.forks`);
  }
  const forks: Fork[] = o.forks.map((fk, i) => {
    const fPath = `${path}.forks[${i}]`;
    if (!fk || typeof fk !== "object") {
      throw new JourneySchemaError("invalid-fork", "fork must be an object.", fPath);
    }
    const f = fk as Record<string, unknown>;
    if (typeof f.id !== "string" || !f.id.trim()) {
      throw new JourneySchemaError("missing-fork-id", "fork id is required.", `${fPath}.id`);
    }
    if (typeof f.afterStageId !== "string" || !f.afterStageId.trim()) {
      throw new JourneySchemaError(
        "missing-after-stage-id",
        "afterStageId is required.",
        `${fPath}.afterStageId`,
      );
    }
    if (typeof f.question !== "string" || !f.question.trim()) {
      throw new JourneySchemaError(
        "missing-fork-question",
        "fork question is required.",
        `${fPath}.question`,
      );
    }

    // varies check
    if (
      !f.varies ||
      typeof f.varies !== "string" ||
      !FORK_VARIES_KINDS.includes(f.varies as ForkVariesKind)
    ) {
      throw new JourneySchemaError(
        "fork-varies-missing",
        `fork requires "varies" to be one of ${FORK_VARIES_KINDS.join(", ")} (got "${String(f.varies)}").`,
        `${fPath}.varies`,
      );
    }
    const varies = f.varies as ForkVariesKind;

    if (!Array.isArray(f.branches) || f.branches.length < 2) {
      throw new JourneySchemaError(
        "fork-too-few-branches",
        "fork must have at least 2 branches.",
        `${fPath}.branches`,
      );
    }

    const branches: Branch[] = f.branches.map((br, j) => {
      const bPath = `${fPath}.branches[${j}]`;
      if (!br || typeof br !== "object") {
        throw new JourneySchemaError("invalid-branch", "branch must be an object.", bPath);
      }
      const b = br as Record<string, unknown>;
      if (typeof b.id !== "string" || !b.id.trim()) {
        throw new JourneySchemaError("missing-branch-id", "branch id is required.", `${bPath}.id`);
      }
      if (typeof b.label !== "string" || !b.label.trim()) {
        throw new JourneySchemaError(
          "missing-branch-label",
          "branch label is required.",
          `${bPath}.label`,
        );
      }
      if (typeof b.hypothesis !== "string" || !b.hypothesis.trim()) {
        throw new JourneySchemaError(
          "missing-branch-hypothesis",
          "branch hypothesis is required.",
          `${bPath}.hypothesis`,
        );
      }
      if (typeof b.worksWhen !== "string" || !b.worksWhen.trim()) {
        throw new JourneySchemaError(
          "missing-branch-works-when",
          "branch worksWhen is required.",
          `${bPath}.worksWhen`,
        );
      }

      let proponent: BranchProponent | undefined;
      if (b.proponent && typeof b.proponent === "object") {
        const prop = b.proponent as Record<string, unknown>;
        if (typeof prop.name !== "string" || !prop.name.trim()) {
          throw new JourneySchemaError(
            "missing-proponent-name",
            "proponent requires name.",
            `${bPath}.proponent.name`,
          );
        }
        if (typeof prop.cardId !== "string" || !prop.cardId.trim()) {
          throw new JourneySchemaError(
            "missing-proponent-card-id",
            "proponent requires cardId.",
            `${bPath}.proponent.cardId`,
          );
        }
        proponent = { name: prop.name, cardId: prop.cardId };
      }

      const steps: BranchStep[] = Array.isArray(b.steps)
        ? b.steps.map((st) => {
            if (typeof st === "string") return { text: st };
            const sObj = st as Record<string, unknown>;
            return {
              text: String(sObj.text ?? ""),
              presetId: typeof sObj.presetId === "string" ? sObj.presetId : undefined,
              chainStepId: typeof sObj.chainStepId === "string" ? sObj.chainStepId : undefined,
            };
          })
        : [];

      // Outcome validation
      const out = (b.outcome ?? {}) as Record<string, unknown>;
      if (
        !out.type ||
        typeof out.type !== "string" ||
        !OUTCOME_TYPES.includes(out.type as OutcomeType)
      ) {
        throw new JourneySchemaError(
          "invalid-outcome-type",
          `outcome type must be one of: ${OUTCOME_TYPES.join(", ")} (got "${String(out.type)}").`,
          `${bPath}.outcome.type`,
        );
      }
      const outcomeType = out.type as OutcomeType;

      // Type-specific rules
      if (outcomeType === "dead-end-on-constraint") {
        if (typeof out.constraintRef !== "string" || !out.constraintRef.trim()) {
          throw new JourneySchemaError(
            "missing-constraint-ref",
            "dead-end-on-constraint outcome requires constraintRef.",
            `${bPath}.outcome.constraintRef`,
          );
        }
        if (varies === "measurement-choice") {
          throw new JourneySchemaError(
            "fork-measurement-choice-cannot-dead-end",
            "A measurement-choice fork cannot use dead-end-on-constraint outcome.",
            `${bPath}.outcome.type`,
          );
        }
      }

      if (outcomeType === "empirically-equivalent-not-refuted") {
        if (typeof out.scopeNote !== "string" || !out.scopeNote.trim()) {
          throw new JourneySchemaError(
            "missing-scope-note",
            "empirically-equivalent-not-refuted outcome requires scopeNote naming the observable class.",
            `${bPath}.outcome.scopeNote`,
          );
        }
      }

      let whatWouldDecide: WhatWouldDecide | undefined;
      if (outcomeType === "undecided-on-available-evidence") {
        if (typeof out.insufficiency !== "string" || !out.insufficiency.trim()) {
          throw new JourneySchemaError(
            "missing-insufficiency",
            "undecided-on-available-evidence outcome requires insufficiency statement.",
            `${bPath}.outcome.insufficiency`,
          );
        }
        if (!out.whatWouldDecide || typeof out.whatWouldDecide !== "object") {
          throw new JourneySchemaError(
            "missing-what-would-decide",
            "undecided-on-available-evidence outcome requires whatWouldDecide.",
            `${bPath}.outcome.whatWouldDecide`,
          );
        }
        const wwd = out.whatWouldDecide as Record<string, unknown>;
        if (typeof wwd.name !== "string" || !wwd.name.trim()) {
          throw new JourneySchemaError(
            "missing-what-would-decide-name",
            "whatWouldDecide requires name.",
            `${bPath}.outcome.whatWouldDecide.name`,
          );
        }
        if (typeof wwd.recordId !== "string" || !wwd.recordId.trim()) {
          throw new JourneySchemaError(
            "missing-what-would-decide-record",
            "whatWouldDecide requires recordId.",
            `${bPath}.outcome.whatWouldDecide.recordId`,
          );
        }
        whatWouldDecide = {
          name: wwd.name,
          recordId: wwd.recordId,
          year: typeof wwd.year === "number" ? wwd.year : undefined,
          status: wwd.status === "later" || wwd.status === "available" ? wwd.status : undefined,
        };
      }

      const plainLanguage = typeof out.plainLanguage === "string" ? out.plainLanguage : "";

      const outcome: BranchOutcome = {
        type: outcomeType,
        constraintRef: typeof out.constraintRef === "string" ? out.constraintRef : undefined,
        scopeNote: typeof out.scopeNote === "string" ? out.scopeNote : undefined,
        insufficiency: typeof out.insufficiency === "string" ? out.insufficiency : undefined,
        whatWouldDecide,
        plainLanguage,
      };

      return {
        id: b.id,
        label: b.label,
        proponent,
        hypothesis: b.hypothesis,
        worksWhen: b.worksWhen,
        steps,
        outcome,
      };
    });

    const papersRouteCount = branches.filter((br) => br.outcome.type === "papers-route").length;
    if (papersRouteCount !== 1) {
      throw new JourneySchemaError(
        "fork-papers-route-count",
        `Each fork must have exactly one "papers-route" branch (found ${papersRouteCount}).`,
        `${fPath}.branches`,
      );
    }

    return {
      id: f.id,
      afterStageId: f.afterStageId,
      question: f.question,
      varies,
      branches,
    };
  });

  // Move
  if (!o.move || typeof o.move !== "object") {
    throw new JourneySchemaError("missing-move", "move object is required.", `${path}.move`);
  }
  const m = o.move as Record<string, unknown>;
  if (typeof m.label !== "string" || !m.label.trim()) {
    throw new JourneySchemaError(
      "missing-move-label",
      "move label is required.",
      `${path}.move.label`,
    );
  }
  if (typeof m.chainId !== "string" || !m.chainId.trim()) {
    throw new JourneySchemaError(
      "missing-move-chain-id",
      "move chainId is required.",
      `${path}.move.chainId`,
    );
  }
  if (typeof m.stepId !== "string" || !m.stepId.trim()) {
    throw new JourneySchemaError(
      "missing-move-step-id",
      "move stepId is required.",
      `${path}.move.stepId`,
    );
  }
  if (!m.r0Summary || typeof m.r0Summary !== "object") {
    throw new JourneySchemaError(
      "missing-r0-summary",
      "move r0Summary is required.",
      `${path}.move.r0Summary`,
    );
  }
  const r0 = m.r0Summary as Record<string, unknown>;
  if (typeof r0.text !== "string") {
    throw new JourneySchemaError(
      "missing-r0-summary-text",
      "move.r0Summary.text is required.",
      `${path}.move.r0Summary.text`,
    );
  }
  if (r0.reviewState !== "draft" && r0.reviewState !== "reviewed") {
    throw new JourneySchemaError(
      "invalid-review-state",
      `reviewState must be "draft" or "reviewed" (got "${String(r0.reviewState)}").`,
      `${path}.move.r0Summary.reviewState`,
    );
  }
  const move: JourneyMove = {
    label: m.label,
    chainId: m.chainId,
    stepId: m.stepId,
    r0Summary: {
      text: r0.text,
      reviewState: r0.reviewState,
    },
  };

  // World Checks
  const worldChecks: WorldCheck[] = Array.isArray(o.worldChecks)
    ? o.worldChecks.map((wc, i) => {
        const wcPath = `${path}.worldChecks[${i}]`;
        if (!wc || typeof wc !== "object") {
          throw new JourneySchemaError(
            "invalid-world-check",
            "worldCheck must be an object.",
            wcPath,
          );
        }
        const w = wc as Record<string, unknown>;
        let laterEvidence: WorldCheckLaterEvidence | undefined;
        if (w.laterEvidence && typeof w.laterEvidence === "object") {
          const le = w.laterEvidence as Record<string, unknown>;
          laterEvidence = {
            year: Number(le.year ?? 0),
            description: String(le.description ?? ""),
            recordId: typeof le.recordId === "string" ? le.recordId : undefined,
          };
        }
        const swe = (w.staticWorkedExample ?? {}) as Record<string, unknown>;
        let tolerance:
          | Readonly<{ absolute?: number | undefined; relative?: number | undefined }>
          | undefined;
        if (w.tolerance && typeof w.tolerance === "object") {
          const tol = w.tolerance as Record<string, unknown>;
          tolerance = {
            absolute: typeof tol.absolute === "number" ? tol.absolute : undefined,
            relative: typeof tol.relative === "number" ? tol.relative : undefined,
          };
        }
        const comparisonKind: WorldCheck["comparisonKind"] =
          w.comparisonKind === "printed-prediction" || w.comparisonKind === "theoretical-bound"
            ? w.comparisonKind
            : "measured-fact";
        return {
          id: String(w.id ?? ""),
          claim: String(w.claim ?? ""),
          instrumentId: String(w.instrumentId ?? ""),
          quantityId: String(w.quantityId ?? ""),
          expected: (w.expected as number | string) ?? 0,
          tolerance,
          laterEvidence,
          staticWorkedExample: {
            label: String(swe.label ?? ""),
            value: (swe.value as number | string) ?? "",
            unit: String(swe.unit ?? ""),
            constantSetId: String(swe.constantSetId ?? ""),
          },
          comparisonKind,
        };
      })
    : [];

  // Source Jumps
  const sourceJumps: SourceJump[] = Array.isArray(o.sourceJumps)
    ? o.sourceJumps.map((sj, i) => {
        const sjPath = `${path}.sourceJumps[${i}]`;
        if (!sj || typeof sj !== "object") {
          throw new JourneySchemaError(
            "invalid-source-jump",
            "sourceJump must be an object.",
            sjPath,
          );
        }
        const j = sj as Record<string, unknown>;
        return {
          id: String(j.id ?? ""),
          label: String(j.label ?? ""),
          paperId: String(j.paperId ?? ""),
          section: String(j.section ?? ""),
          targetAnchor: String(j.targetAnchor ?? ""),
          weavePredicateId: typeof j.weavePredicateId === "string" ? j.weavePredicateId : undefined,
          pointer: String(j.pointer ?? "This is where the paper makes the move you just made"),
        };
      })
    : [];

  // Exercises
  const exercises: ExerciseRef[] = Array.isArray(o.exercises)
    ? o.exercises.map((ex, i) => {
        const exPath = `${path}.exercises[${i}]`;
        if (!ex || typeof ex !== "object") {
          throw new JourneySchemaError("invalid-exercise", "exercise must be an object.", exPath);
        }
        const e = ex as Record<string, unknown>;
        return {
          id: String(e.id ?? ""),
          role: e.role === "explanation" ? "explanation" : "instrumented",
          prompt: typeof e.prompt === "string" ? e.prompt : undefined,
        };
      })
    : [];

  // PPE Task
  const ppeRaw = (o.ppeTask ?? {}) as Record<string, unknown>;
  const ppeTask: PpeTask = {
    promptId: String(ppeRaw.promptId ?? ""),
    task: String(ppeRaw.task ?? ""),
    perturbPrompt: String(ppeRaw.perturbPrompt ?? ""),
    explainPrompt: String(ppeRaw.explainPrompt ?? ""),
  };

  // Doors
  const doorsRaw = (o.doors ?? {}) as Record<string, unknown>;
  const fdRaw = (doorsRaw.frontDoor ?? {}) as Record<string, unknown>;
  const frontDoor: Door = {
    id: String(fdRaw.id ?? ""),
    title: String(fdRaw.title ?? ""),
    arrivesAtEquationId: String(fdRaw.arrivesAtEquationId ?? ""),
    entryRecordId: typeof fdRaw.entryRecordId === "string" ? fdRaw.entryRecordId : undefined,
    href: typeof fdRaw.href === "string" ? fdRaw.href : undefined,
    summary: typeof fdRaw.summary === "string" ? fdRaw.summary : undefined,
    arrivesAtLabel: typeof fdRaw.arrivesAtLabel === "string" ? fdRaw.arrivesAtLabel : undefined,
  };
  const sideDoors: Door[] = Array.isArray(doorsRaw.sideDoors)
    ? doorsRaw.sideDoors.map((sd) => {
        const s = sd as Record<string, unknown>;
        return {
          id: String(s.id ?? ""),
          title: String(s.title ?? ""),
          arrivesAtEquationId: String(s.arrivesAtEquationId ?? ""),
          entryRecordId: typeof s.entryRecordId === "string" ? s.entryRecordId : undefined,
          href: typeof s.href === "string" ? s.href : undefined,
          summary: typeof s.summary === "string" ? s.summary : undefined,
          arrivesAtLabel: typeof s.arrivesAtLabel === "string" ? s.arrivesAtLabel : undefined,
        };
      })
    : [];

  const doors: Doors = {
    frontDoor,
    sideDoors,
  };

  return {
    id: o.id,
    paper: o.paper,
    revision: typeof o.revision === "string" || typeof o.revision === "number" ? o.revision : 1,
    completeness: o.completeness,
    pendingElements,
    admittedImports,
    shelf,
    naggingFact: o.naggingFact,
    firstHonestQuestion: o.firstHonestQuestion,
    stages,
    forks,
    move,
    worldChecks,
    sourceJumps,
    exercises,
    ppeTask,
    doors,
  };
}
