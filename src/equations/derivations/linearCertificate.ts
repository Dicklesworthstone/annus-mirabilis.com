import { rational, sameDimension } from "../../content/dimensions/rational.ts";
import { exactScale, record, type ExactScale } from "../ast.ts";
import { checkDimensions } from "../dimensions.ts";
import { parseEquationRecord, type EquationRecord } from "../record.ts";
import { teachingProfile, type TeachingPaper } from "../teachingProfiles.ts";
import { equalPolynomials, equalityResidual, sumPolynomials } from "./exactPolynomial.ts";

/** Certificates for elimination between already named semantic equations.
 * This narrow checker proves linear combinations of polynomial residuals. It
 * neither verifies the physical premises nor upgrades editorial/source review.
 */
export type LinearCertificate = Readonly<{
  id: string;
  paper: TeachingPaper;
  premises: readonly Readonly<{ id: string; kind: "assumption" | "definition"; equations: readonly string[] }>[];
  steps: readonly Readonly<{
    id: string; equation: string;
    combination: readonly Readonly<{ equation: string; coefficient: ExactScale }>[];
  }>[];
}>;
export type CheckedLinearCertificate = LinearCertificate & Readonly<{
  check: "exact-polynomial-elimination";
  requirements: readonly Readonly<{ step: string; premises: readonly string[] }>[];
}>;
function fail(message: string): never { throw new Error(`Equality certificate: ${message}`); }
function id(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[a-z][a-z0-9-]{0,99}$/.test(value)) fail("Invalid stable identity.");
}
function list(value: unknown, max: number): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > max) fail("Expected a bounded nonempty list.");
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}
/** Admission is independent of the reader's selected premises. A malformed
 * certificate fails the build even when its incorrect step would be disabled.
 */
export function checkLinearCertificate(input: unknown, source: readonly EquationRecord[]): CheckedLinearCertificate {
  const raw = record(input, "certificate", ["id", "paper", "premises", "steps"]);
  id(raw.id);
  const profile = teachingProfile(raw.paper);
  if (!profile) fail("Unregistered teaching paper.");
  list(raw.premises, 16); list(raw.steps, 32);
  const catalog = new Map<string, EquationRecord>();
  if (source.length > 128) fail("Equation catalog exceeds the budget.");
  for (const candidate of source) {
    const eq = parseEquationRecord(candidate, "certificate equation");
    if (eq.paper !== raw.paper || catalog.has(eq.id)) fail("Duplicate or cross-paper equation.");
    catalog.set(eq.id, eq);
  }
  function equation(key: string): EquationRecord {
    const eq = catalog.get(key);
    if (!eq) fail(`Unknown equation ${key}.`);
    return eq;
  }
  const premises: LinearCertificate["premises"][number][] = [];
  const available = new Map<string, readonly string[]>();
  const premiseIds = new Set<string>();
  for (const candidate of raw.premises) {
    const p = record(candidate, "certificate.premise", ["id", "kind", "equations"]);
    id(p.id); list(p.equations, 8);
    if (premiseIds.has(p.id) || !["assumption", "definition"].includes(String(p.kind))) fail("Invalid or duplicate premise.");
    premiseIds.add(p.id);
    const names = p.equations.map(key => {
      id(key);
      const eq = equation(key);
      if (available.has(key)) fail("An equation cannot be admitted twice.");
      if (eq.tree.kind !== "relation" || eq.tree.operator !== (p.kind === "definition" ? "define" : "="))
        fail("Premise kind must match the equation's exact or definition sign.");
      equalityResidual(eq.tree); // Refuse unsupported assumptions before checking any conclusion.
      available.set(key, [p.id as string]);
      return key;
    });
    premises.push({ id: p.id, kind: p.kind as "assumption" | "definition", equations: names });
  }
  const requirements: CheckedLinearCertificate["requirements"][number][] = [];
  const steps: LinearCertificate["steps"][number][] = [];
  const stepIds = new Set<string>();
  for (const candidate of raw.steps) {
    const step = record(candidate, "certificate.step", ["id", "equation", "combination"]);
    id(step.id); id(step.equation); list(step.combination, 16);
    if (stepIds.has(step.id) || premiseIds.has(step.id)) fail("Duplicate step identity.");
    stepIds.add(step.id);
    if (available.has(step.equation)) fail("A conclusion cannot already be an assumed or derived equation.");
    const target = equation(step.equation);
    if (target.tree.kind !== "relation" || target.tree.operator !== "=") fail("Conclusions must be exact equalities.");
    const targetDimension = checkDimensions(target.tree, profile.quantities);
    if (targetDimension.status !== "consistent") fail("Target dimensions are not established.");
    const needed = new Set<string>(), used = new Set<string>();
    const combination = step.combination.map(term => {
      const item = record(term, "certificate.combination", ["equation", "coefficient"]);
      id(item.equation);
      const requirements = available.get(item.equation);
      if (!requirements || used.has(item.equation)) fail("Unknown, future, self-referential, or repeated justification.");
      used.add(item.equation);
      const eq = equation(item.equation);
      const dimension = checkDimensions(eq.tree, profile.quantities);
      if (dimension.status !== "consistent" || !sameDimension(dimension.dimension, targetDimension.dimension))
        fail("A scalar linear combination cannot mix dimensional quantities.");
      const coefficient = exactScale(item.coefficient, "certificate.coefficient", true);
      for (const premise of requirements) needed.add(premise);
      return { equation: item.equation, coefficient };
    });
    const derived = sumPolynomials(combination.map(term => ({
      polynomial: equalityResidual(equation(term.equation).tree),
      coefficient: rational(BigInt(term.coefficient.num), BigInt(term.coefficient.den)),
    })));
    if (!equalPolynomials(derived, equalityResidual(target.tree))) fail(`The combination does not establish ${target.id}.`);
    const ordered = premises.map(p => p.id).filter(key => needed.has(key));
    available.set(target.id, ordered);
    requirements.push({ step: step.id, premises: ordered });
    steps.push({ id: step.id, equation: step.equation, combination });
  }
  // No authored proof/review labels survive: only computed algebra and dependencies.
  return freeze({ id: raw.id, paper: raw.paper as TeachingPaper, premises, steps,
    check: "exact-polynomial-elimination" as const, requirements });
}

export { assessLinearCertificate } from "./linearProofState.ts";
