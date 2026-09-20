import type { EquationRecord } from "../record.ts";
import { checkLinearCertificate, type LinearCertificate } from "./linearCertificate.ts";

const eq = (name: string) => `eq-model-me-${name}`;
const use = (name: string, num = 1) => ({ equation: eq(name), coefficient: { num, den: 1 } });
/** References into the canonical equation catalog, not copies of its expressions.
 * Changing any cited equation invalidates this certificate unless the exact
 * algebra still checks. The transformed light energy and unchanged C are inputs.
 */
export const MASS_ENERGY_ELIMINATION: LinearCertificate = {
  id: "me-ledger-elimination",
  paper: "mass-energy",
  premises: [
    { id: "rest", kind: "assumption", equations: [eq("rest-ledger")] },
    { id: "moving", kind: "assumption", equations: [eq("moving-ledger")] },
    { id: "offset", kind: "assumption", equations: [eq("offset-before"), eq("offset-after")] },
    { id: "notation", kind: "definition", equations: [eq("kinetic-drop-definition")] },
  ],
  steps: [
    {
      id: "subtract",
      equation: eq("raw-subtraction"),
      combination: [use("moving-ledger"), use("rest-ledger", -1)],
    },
    { id: "regroup", equation: eq("ledger-subtraction"), combination: [use("raw-subtraction")] },
    {
      id: "substitute-offset",
      equation: eq("offset-substitution"),
      combination: [use("ledger-subtraction"), use("offset-before", -1), use("offset-after")],
    },
    {
      id: "cancel-offset",
      equation: eq("kinetic-drop-difference"),
      combination: [use("offset-substitution")],
    },
    {
      id: "name-difference",
      equation: eq("exact-drop"),
      combination: [use("kinetic-drop-difference"), use("kinetic-drop-definition")],
    },
  ],
};

export const ELIMINATION_PREMISES = [
  {
    id: "rest",
    label: "Conservation in the body's rest description",
    explanation:
      "The energy removed from this body is the total energy L in the two equal, opposite light pulses.",
  },
  {
    id: "moving",
    label: "Conservation with the imported light-energy transformation",
    explanation:
      "The same emission removes gamma L in the moving description. The radiation transformation comes from relativity; this subtraction does not derive it.",
  },
  {
    id: "offset",
    label: "The same offset C before and after emission",
    explanation:
      "Both frame differences equal energy of motion plus one unchanged additive offset. This is an additional physical premise, not something proved by conservation.",
  },
  {
    id: "notation",
    label: "Delta K means before minus after",
    explanation:
      "This is only a definition of notation. It does not assume a value for the kinetic-energy difference.",
  },
] as const;
export const ELIMINATION_STEPS = [
  {
    id: "subtract",
    title: "Subtract the complete accounts",
    reason:
      "Subtract the rest-frame equality from the moving-frame equality, including both right-hand sides.",
    detail:
      "The outer minus sign applies to E before minus E after as a whole. Its expansion is minus E before plus E after. No absolute body energy is assigned.",
    foundation: "work-energy",
    move: false,
  },
  {
    id: "regroup",
    title: "Put the two descriptions beside each other",
    reason:
      "Reorder the left-hand terms into before and after frame differences. Factor gamma L minus L on the right.",
    detail:
      "This is still only a comparison between frame accounts. Nothing in these two algebraic steps identifies either difference as energy of motion.",
    foundation: "bridge-negative-numbers-direction",
    move: false,
  },
  {
    id: "substitute-offset",
    title: "Use the additional offset premise",
    reason:
      "Replace each H minus E with its corresponding K plus C. Keep the same C in both places.",
    detail:
      "This is the consequential move. If the offset can change with emission, the two frame differences cannot be replaced by kinetic energies plus a shared constant. The earlier conservation comparison remains valid without it.",
    foundation: "work-energy",
    move: true,
  },
  {
    id: "cancel-offset",
    title: "Now cancel the shared unknown",
    reason:
      "Expand the brackets. The first C is added and the same C is subtracted, so they cancel exactly.",
    detail:
      "The checker matches canonical quantity identities, not similar-looking letters. Different before and after offsets would remain in the equation rather than disappear.",
    foundation: "work-energy",
    move: false,
  },
  {
    id: "name-difference",
    title: "Give the result a short name",
    reason: "Use the declared definition Delta K = K before minus K after.",
    detail:
      "The exact kinetic-energy drop is established under the stated premises. Identifying the mass decrease still requires the separate low-speed coefficient argument; a finite-speed ratio is not that limit.",
    foundation: "taylor-expansion",
    move: false,
  },
] as const;

export function buildMassEnergyElimination(equations: readonly EquationRecord[]) {
  const certificate = checkLinearCertificate(MASS_ENERGY_ELIMINATION, equations);
  if (
    ELIMINATION_STEPS.some((s, i) => certificate.steps[i]?.id !== s.id) ||
    ELIMINATION_PREMISES.some((p, i) => certificate.premises[i]?.id !== p.id)
  )
    throw new Error("Derivation explanations and checked identities disagree.");
  return { certificate, premises: ELIMINATION_PREMISES, steps: ELIMINATION_STEPS };
}
