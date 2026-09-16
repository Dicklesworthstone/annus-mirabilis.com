/** Scientific output contracts. Bead: am-rt-typed-results-mqb.
 * Software failures and refused requests are deliberately NOT output statuses.
 */
export type DomainKind = "physical" | "model" | "numerical" | "input";
export type ParameterAction = Readonly<{
  parameterId: string;
  value: number | string | boolean;
}>;
export type ResultIdentity = Readonly<{
  quantityId: string;
  unit: string;
  semanticKind: string;
  ownerId: string;
}>;
export type Uncertainty =
  | Readonly<{
      kind: "statistical-interval";
      lower: number;
      upper: number;
      coverage: number;
      sampleSize: number;
      method: string;
    }>
  | Readonly<{ kind: "enclosure"; lower: number; upper: number; method: string }>
  | Readonly<{
      kind: "numerical-error-estimate";
      magnitude: number;
      method: string;
      guarantee: "bound" | "estimate";
    }>
  | Readonly<{ kind: "input-precision"; significantFigures: number; source: string }>
  | Readonly<{
      kind: "measurement-uncertainty";
      magnitude: number;
      datasetId: string;
      uncertaintyType: string;
    }>;

export type LimitRepresentation =
  | Readonly<{ kind: "point-mass"; location: number; mass: number }>
  | Readonly<{ kind: "coefficient"; value: number }>;

export type ResultPayload =
  | Readonly<{ status: "value"; value: number | Float64Array; uncertainty?: Uncertainty }>
  | Readonly<{ status: "symbolic"; expressionRef: string; unspecifiedSymbols: readonly string[] }>
  | Readonly<{ status: "analytic-limit"; description: string; representation: LimitRepresentation }>
  | Readonly<{
      status: "underdetermined";
      compatibleFamily: string;
      neededInformation: readonly string[];
    }>
  | Readonly<{ status: "not-applicable"; reason: string }>
  | Readonly<{
      status: "outside-domain";
      condition: string;
      domainKind: DomainKind;
      reason: string;
      boundary: ParameterAction | Readonly<{ alternativeModel: string }>;
    }>
  | Readonly<{
      status: "divergent";
      expressionRef: string;
      divergenceKind: "integral" | "series" | "limit";
      variable: string;
      range: Readonly<{ lower: number | "unbounded"; upper: number | "unbounded" }>;
      rate: Readonly<{ statement: string; expressionRef?: string }>;
      modelId: string;
      finiteUnder: ParameterAction;
    }>;
export type ScientificResult = ResultIdentity & ResultPayload;
export type OutputStatus = ResultPayload["status"];

export type StatusDefinition = Readonly<{
  message: string;
  nextAction: string;
}>;

/** Registry, not a second hand-maintained status enumeration. */
export const outputStatusRegistry = Object.freeze({
  value: Object.freeze({
    message: "A finite result for these settings.",
    nextAction: "Inspect the computed value and its uncertainty.",
  }),
  symbolic: Object.freeze({
    message: "This relation still contains unspecified quantities.",
    nextAction: "Supply the unspecified symbols to evaluate a numerical value.",
  }),
  "analytic-limit": Object.freeze({
    message: "This limiting case has its own representation.",
    nextAction: "Inspect the limiting distribution or coefficient.",
  }),
  underdetermined: Object.freeze({
    message: "These observations do not select a unique value.",
    nextAction: "Choose a radius or supply additional observations to narrow the family.",
  }),
  "not-applicable": Object.freeze({
    message: "This quantity is not defined for this question.",
    nextAction: "Change the question or adjust settings so the quantity applies.",
  }),
  "outside-domain": Object.freeze({
    message: "This model does not describe the requested conditions.",
    nextAction: "Move toward the admitted domain or select an alternative model.",
  }),
  divergent: Object.freeze({
    message: "The model predicts no finite total over this range.",
    nextAction: "Set a finite cutoff or compare with a different admitted model.",
  }),
} satisfies Record<OutputStatus, StatusDefinition>);
