/** A dependency-checked reconstruction, not a symbolic algebra engine or a
 * numerical owner. Source: master plan §§8.4, 9.5; am-disc-journey-iv-chain-wwrz.
 * Keep the assumed-rest-energy route distinct from an independent derivation.
 */
export type ArgumentStep = Readonly<{
  id: string;
  title: string;
  kind:
    | "setup"
    | "premise"
    | "import"
    | "algebra"
    | "approximation"
    | "conclusion"
    | "assumes-target";
  requires: readonly string[];
  latex: string;
  explanation: string;
}>;

const steps = [
  {
    id: "opposite-pulses",
    title: "Choose an emission without recoil",
    kind: "setup",
    requires: [],
    latex: String.raw`L/2+L/2=L`,
    explanation:
      "Two equal pulses leave in opposite directions in the body's rest frame. Their momenta cancel. Compare the same body before and after; its speed in either inertial frame is unchanged. Asymmetric emission needs a recoil model and is outside this reconstruction.",
  },
  {
    id: "conservation",
    title: "Keep an energy account in each frame",
    kind: "premise",
    requires: [],
    latex: String.raw`\text{energy before}=\text{energy after}+\text{emitted light energy}`,
    explanation:
      "Assume energy conservation separately in each inertial frame. Do not equate the numerical energies assigned by different observers. No value for the body's absolute internal energy is assumed.",
  },
  {
    id: "light-transform",
    title: "Import the light-energy transformation",
    kind: "import",
    requires: [],
    latex: String.raw`l^*=l\gamma(1-\beta\cos\varphi),\quad\gamma=(1-\beta^2)^{-1/2},\quad\beta=v/c`,
    explanation:
      "This is an admitted result of the special-relativity paper, §8, not knowledge supplied by a 1904 shelf and not a consequence of the mass–energy relation being sought. Here c and gamma are modern notation; the September paper uses V and an explicit radical. The observer must satisfy |v| < c.",
  },
  {
    id: "rest-balance",
    title: "Write the rest-frame balance",
    kind: "algebra",
    requires: ["opposite-pulses", "conservation"],
    latex: String.raw`E_0-E_1=L`,
    explanation:
      "The body loses energy L in its rest frame. E₀ and E₁ remain unknown symbols. This balance by itself makes no statement about the body's mass.",
  },
  {
    id: "angle-cancellation",
    title: "Add the two transformed pulses",
    kind: "algebra",
    requires: ["opposite-pulses", "light-transform"],
    latex: String.raw`\frac{L\gamma}{2}(1-\beta\cos\varphi)+\frac{L\gamma}{2}(1+\beta\cos\varphi)=\gamma L`,
    explanation:
      "Opposite directions give opposite cosine terms. The individual pulse energies depend on angle, but their sum does not. This cancellation does not say that the two pulses have equal energies for a moving observer.",
  },
  {
    id: "moving-balance",
    title: "Write the moving-frame balance",
    kind: "algebra",
    requires: ["angle-cancellation", "conservation"],
    latex: String.raw`H_0-H_1=\gamma L`,
    explanation:
      "The moving observer's account loses gamma L in light. H₀ and H₁, like the rest-frame body energies, stay symbolic. A body-energy formula of the form gamma M c² has not entered the calculation.",
  },
  {
    id: "subtract-balances",
    title: "Subtract the two balances",
    kind: "algebra",
    requires: ["rest-balance", "moving-balance"],
    latex: String.raw`(H_0-E_0)-(H_1-E_1)=L(\gamma-1)`,
    explanation:
      "Subtract the rest-frame balance from the moving-frame balance. This determines a difference of energy differences without assigning either absolute internal energy. It has not yet identified that difference as a kinetic-energy loss.",
  },
  {
    id: "kinetic-offset",
    title: "State how frame-energy differences relate to motion",
    kind: "premise",
    requires: [],
    latex: String.raw`H_i-E_i=K_i+C_i\quad(i=0,1)`,
    explanation:
      "Admit the paper's premise relating frame-energy differences to kinetic energy, with a possible additive offset before and after emission. This is a physical identification, not a consequence of subtracting two equations.",
  },
  {
    id: "retain-offset",
    title: "Keep the possible offset change visible",
    kind: "algebra",
    requires: ["subtract-balances", "kinetic-offset"],
    latex: String.raw`K_0-K_1+(C_0-C_1)=L(\gamma-1)`,
    explanation:
      "A valid, weaker result. If C₀ − C₁ is unspecified, the ledgers determine this combination, not K₀ − K₁ on its own. More algebra cannot determine an unconstrained offset.",
  },
  {
    id: "unchanged-offset",
    title: "Admit the unchanged-offset premise",
    kind: "premise",
    requires: ["kinetic-offset"],
    latex: String.raw`C_0=C_1`,
    explanation:
      "Einstein states that the additive constant is unchanged by the emission. Make that premise explicit. Selecting it does not prove it, and a simulator programmed with it is not independent evidence for it.",
  },
  {
    id: "kinetic-drop",
    title: "Identify the kinetic-energy decrease",
    kind: "algebra",
    requires: ["retain-offset", "unchanged-offset"],
    latex: String.raw`K_0-K_1=L(\gamma-1)`,
    explanation:
      "With the offset change removed, the body has less kinetic energy at the same speed. This relation is exact within the admitted model, for |v| < c. At v = 0 both sides are zero; that single evaluation does not identify a mass.",
  },
  {
    id: "inertial-coefficient",
    title: "Define inertia by the small-speed coefficient",
    kind: "premise",
    requires: [],
    latex: String.raw`\lim_{v\to0}\frac{K_0-K_1}{v^2/2}=M_0-M_1`,
    explanation:
      "Use the Newtonian leading coefficient of kinetic energy to identify inertial mass. This is a limit across small nonzero speeds, not division by v² at exactly zero, and it does not assume a rest-energy formula.",
  },
  {
    id: "small-speed",
    title: "Take the limit, not a finite-speed shortcut",
    kind: "approximation",
    requires: ["kinetic-drop", "light-transform"],
    latex: String.raw`\gamma-1=\tfrac12(v/c)^2+O((v/c)^4)`,
    explanation:
      "Expand the imported Lorentz factor at small |v|/c. The leading term is an approximation at nonzero speed; the coefficient obtained as v tends to zero is a limit. At 0.6c the leading term must not be presented as the exact kinetic-energy difference.",
  },
  {
    id: "inertia-loss",
    title: "Read off the inertia lost",
    kind: "conclusion",
    requires: ["small-speed", "inertial-coefficient"],
    latex: String.raw`M_0-M_1=\frac{L}{c^2},\qquad\Delta M=-\frac{L}{c^2}`,
    explanation:
      "Comparing the limiting coefficients gives the positive mass lost and the signed mass change. The conclusion follows conditionally on the listed premises for symmetric emission. It does not assign a numerical value to either absolute body energy.",
  },
  {
    id: "assume-rest-energy",
    title: "Alternative: start by assuming rest energy equals M c²",
    kind: "assumes-target",
    requires: [],
    latex: String.raw`E_0=M_0c^2,\qquad E_1=M_1c^2`,
    explanation:
      "A useful modern starting point for checking consistency, but it already assumes the mass–energy relation this exercise asks you to establish. A conclusion depending on this card is labeled a consistency check, never an independent derivation.",
  },
  {
    id: "rest-energy-check",
    title: "Check the rest balance using that assumption",
    kind: "conclusion",
    requires: ["rest-balance", "assume-rest-energy"],
    latex: String.raw`(M_0-M_1)c^2=L`,
    explanation:
      "This is valid substitution under the declared rest-energy assumption. It agrees with the sought relation, but agreement after assuming that relation cannot establish it independently. This branch is not described as a physical contradiction.",
  },
] as const satisfies readonly ArgumentStep[];

export type ArgumentStepId = (typeof steps)[number]["id"];
export const ARGUMENT_STEPS: readonly ArgumentStep[] = Object.freeze(
  steps.map((step) => Object.freeze({ ...step, requires: Object.freeze([...step.requires]) })),
);
const byId = new Map(ARGUMENT_STEPS.map((step) => [step.id, step]));
export function argumentStep(id: string): ArgumentStep {
  const step = byId.get(id);
  if (!step) throw new Error(`Unknown argument card: ${id}`);
  return step;
}

export const WORKED_ARGUMENT: readonly ArgumentStepId[] = Object.freeze([
  "opposite-pulses",
  "conservation",
  "light-transform",
  "rest-balance",
  "angle-cancellation",
  "moving-balance",
  "subtract-balances",
  "kinetic-offset",
  "retain-offset",
  "unchanged-offset",
  "kinetic-drop",
  "inertial-coefficient",
  "small-speed",
  "inertia-loss",
]);
export const CONSISTENCY_ARGUMENT: readonly ArgumentStepId[] = Object.freeze([
  "opposite-pulses",
  "conservation",
  "rest-balance",
  "assume-rest-energy",
  "rest-energy-check",
]);

/** Validate at the boundary: a saved URL is data, not a trusted proof. */
export function readArgumentOrder(raw: unknown): readonly ArgumentStepId[] {
  if (!Array.isArray(raw) || raw.length > ARGUMENT_STEPS.length)
    throw new Error("An argument must be a bounded list of known cards.");
  const seen = new Set<string>();
  return Object.freeze(
    raw.map((id: unknown) => {
      if (typeof id !== "string" || !byId.has(id))
        throw new Error("The argument contains an unknown card.");
      if (seen.has(id)) throw new Error("An argument cannot contain the same card twice.");
      seen.add(id);
      return id as ArgumentStepId;
    }),
  );
}

export type StepAssessment = Readonly<{
  id: ArgumentStepId;
  status: "supported" | "blocked" | "assumes-target" | "consistency-only";
  missing: readonly string[];
  assumedTarget: readonly string[];
}>;
export type ArgumentAssessment = Readonly<{
  steps: readonly StepAssessment[];
  outcome:
    | "incomplete"
    | "ledger-relation"
    | "offset-unresolved"
    | "kinetic-drop"
    | "inertia-derived"
    | "consistency-check";
  summary: string;
  available: readonly string[];
}>;

export function assessArgument(raw: unknown): ArgumentAssessment {
  const order = readArgumentOrder(raw);
  const accepted = new Map<string, readonly string[]>();
  const assessed: StepAssessment[] = [];
  for (const id of order) {
    const step = argumentStep(id);
    const missing = step.requires.filter((dependency) => !accepted.has(dependency));
    const assumedTarget = [
      ...new Set([
        ...(step.kind === "assumes-target" ? [id] : []),
        ...step.requires.flatMap((dependency) => accepted.get(dependency) ?? []),
      ]),
    ];
    const status = missing.length
      ? "blocked"
      : step.kind === "assumes-target"
        ? "assumes-target"
        : assumedTarget.length
          ? "consistency-only"
          : "supported";
    if (status !== "blocked") accepted.set(id, Object.freeze(assumedTarget));
    assessed.push(
      Object.freeze({
        id,
        status,
        missing: Object.freeze(missing),
        assumedTarget: Object.freeze(assumedTarget),
      }),
    );
  }
  let outcome: ArgumentAssessment["outcome"] = "incomplete";
  let summary =
    "The selected order does not yet reach a two-ledger conclusion. A blocked step cannot supply a premise to later steps. You may reorder cards or read the worked route; there is no score or locked content.";
  if (accepted.has("inertia-loss")) {
    outcome = "inertia-derived";
    summary =
      "The two-ledger route reaches M₀ − M₁ = L/c² without using an assumed rest-energy formula. This is a conditional derivation within the stated symmetric-emission model, not an experimental verification or a proof that the premises describe nature.";
  } else if (accepted.has("rest-energy-check")) {
    outcome = "consistency-check";
    summary =
      "The selected branch is a valid consistency check, but it assumes the mass–energy relation in its premises. It is not an independent derivation of that relation. The separate two-ledger route remains available.";
  } else if (accepted.has("kinetic-drop")) {
    outcome = "kinetic-drop";
    summary =
      "The kinetic-energy decrease follows under the unchanged-offset premise. Identifying an inertia change still requires the small-speed limit and the definition of inertial mass by its kinetic-energy coefficient.";
  } else if (accepted.has("retain-offset")) {
    outcome = "offset-unresolved";
    summary =
      "The energy accounts constrain K₀ − K₁ + (C₀ − C₁). With the offset change left free, the kinetic-energy decrease is underdetermined. This is a valid weaker conclusion, not a failed energy balance.";
  } else if (accepted.has("subtract-balances")) {
    outcome = "ledger-relation";
    summary =
      "Subtracting the balances has eliminated the need to know the absolute internal energies. Identifying the remaining expression as a kinetic-energy decrease needs an additional stated premise.";
  }
  return Object.freeze({
    steps: Object.freeze(assessed),
    outcome,
    summary,
    available: Object.freeze(
      ARGUMENT_STEPS.filter(
        (step) =>
          !order.includes(step.id as ArgumentStepId) &&
          step.requires.every((dependency) => accepted.has(dependency)),
      ).map((step) => step.id),
    ),
  });
}

export type SharedArgument =
  | Readonly<{ kind: "empty" }>
  | Readonly<{ kind: "argument"; order: readonly ArgumentStepId[] }>
  | Readonly<{ kind: "invalid"; message: string }>;
export function encodeArgument(raw: unknown): string {
  const order = readArgumentOrder(raw);
  return `?${new URLSearchParams({ proof: "1", steps: order.join(",") })}`;
}
export function decodeArgument(search: string): SharedArgument {
  try {
    if (new TextEncoder().encode(search).length > 4096)
      throw new Error("This argument link exceeds the supported size.");
    const params = new URLSearchParams(search);
    if (!params.has("proof") && !params.has("steps")) return { kind: "empty" };
    if (
      params.getAll("proof").length !== 1 ||
      params.get("proof") !== "1" ||
      params.getAll("steps").length !== 1
    )
      throw new Error("This argument link has an unsupported version or ambiguous fields.");
    const text = params.get("steps")!;
    return Object.freeze({
      kind: "argument",
      order: readArgumentOrder(text ? text.split(",") : []),
    });
  } catch (error) {
    return Object.freeze({
      kind: "invalid",
      message: error instanceof Error ? error.message : "This argument link could not be read.",
    });
  }
}

/** Notes are never placed in the share URL, localStorage or a network request. */
export function argumentExport(raw: unknown, note: string): string {
  if (typeof note !== "string" || note.length > 20_000)
    throw new Error("Keep the note within 20000 characters.");
  const order = readArgumentOrder(raw);
  return JSON.stringify(
    {
      schema: "annus-mirabilis/mass-energy-argument",
      version: 1,
      interpretation:
        "A reader-assembled conditional argument; not a numerical run or empirical evidence.",
      order,
      assessment: assessArgument(order),
      note,
      cards: order.map((id) => argumentStep(id)),
    },
    null,
    2,
  );
}
