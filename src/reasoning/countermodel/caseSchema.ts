import type { CountermodelId } from "../../physics/reference/countermodels.ts";
import type { Event } from "../../physics/reference/kinematics.ts";

export const CASE_IDS = ["case-galilean-lorentz", "case-ether-einstein"] as const;
export type CaseId = (typeof CASE_IDS)[number];
export type TestKind =
  | "low-speed"
  | "light-speed"
  | "inverse"
  | "events"
  | "rod"
  | "clock"
  | "composition";
export type TestInputs = Readonly<{
  u?: number;
  v?: number;
  properLength?: number;
  worldlineBeta?: number;
  events?: readonly (Event & Readonly<{ id: string }>)[];
}>;
export type CountermodelTest = Readonly<{
  id: string;
  label: string;
  kind: "constraint" | "observation";
  test: TestKind;
  inputs: TestInputs;
  tolerance: Readonly<{ absolute: number; relative: number; reason: string }>;
  explanation: string;
}>;
export type CountermodelCase = Readonly<{
  schemaVersion: 1;
  id: CaseId;
  title: string;
  question: string;
  scope: string;
  review: "draft";
  defaultBeta: number;
  sources: readonly Readonly<{ id: string; label: string; url: string; parallelWork: boolean }>[];
  candidates: readonly Readonly<{
    id: CountermodelId;
    label: string;
    modelVersion: string;
    circumstances: string;
    historicalStatus: "available-before-cutoff" | "introduced-in-current-paper";
    sourceIds: readonly string[];
  }>[];
  tests: readonly CountermodelTest[];
}>;
export const CASE_DISCLAIMER =
  "These are the candidates considered here, not every conceivable alternative.";
export function testUnit(test: TestKind): string {
  return test === "clock" ? "1" : ["inverse", "events", "rod"].includes(test) ? "m" : "m/s";
}
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    throw new TypeError("Expected a plain case record.");
  const actual = Reflect.ownKeys(value);
  if (
    actual.length !== keys.length ||
    actual.some((key) => typeof key !== "string" || !keys.includes(key))
  )
    throw new TypeError("Unknown or missing case fields; stored outcomes are not allowed.");
  for (const key of keys) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d?.enumerable || !("value" in d))
      throw new TypeError("Case records must contain data only.");
  }
  return value as Record<string, unknown>;
}
function text(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > 4000 || /[<>]/u.test(value))
    throw new TypeError("Use bounded, nonempty plain text.");
}
function id(value: unknown): asserts value is string {
  text(value);
  if (!/^[a-z][a-z0-9-]{0,90}$/u.test(value)) throw new TypeError("Invalid case identifier.");
}
function list(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || !value.length || value.length > maximum)
    throw new TypeError("Expected a nonempty bounded list.");
  return value;
}
function finite(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError("Expected a finite case input.");
}
function unique(values: readonly string[]): void {
  if (new Set(values).size !== values.length) throw new TypeError("Duplicate case identifier.");
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
/** A closed case contract: no formula strings, executable functions, or authored verdict fields. */
export function parseCountermodelCase(value: unknown): CountermodelCase {
  const o = record(value, [
    "schemaVersion",
    "id",
    "title",
    "question",
    "scope",
    "review",
    "defaultBeta",
    "sources",
    "candidates",
    "tests",
  ]);
  if (o.schemaVersion !== 1 || !CASE_IDS.includes(o.id as CaseId) || o.review !== "draft")
    throw new TypeError(
      "Unsupported case, version, or review state. Expansion needs a separate decision.",
    );
  for (const key of ["title", "question", "scope"]) text(o[key]);
  finite(o.defaultBeta);
  if (Math.abs(o.defaultBeta) > 0.95)
    throw new TypeError("The worked boost must lie between -0.95 and 0.95.");
  const sourceIds: string[] = [];
  for (const raw of list(o.sources, 8)) {
    const s = record(raw, ["id", "label", "url", "parallelWork"]);
    id(s.id);
    text(s.label);
    text(s.url);
    const url = new URL(s.url);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      typeof s.parallelWork !== "boolean"
    )
      throw new TypeError("Sources need an HTTPS citation and an explicit parallel-work flag.");
    sourceIds.push(s.id);
  }
  unique(sourceIds);
  const candidates = list(o.candidates, 2);
  if (candidates.length !== 2)
    throw new TypeError("This workbench compares exactly two candidates.");
  const candidateIds: string[] = [];
  for (const raw of candidates) {
    const c = record(raw, [
      "id",
      "label",
      "modelVersion",
      "circumstances",
      "historicalStatus",
      "sourceIds",
    ]);
    id(c.id);
    text(c.label);
    text(c.modelVersion);
    text(c.circumstances);
    if (
      !["galilean", "lorentz", "lorentz-ether"].includes(c.id) ||
      !["available-before-cutoff", "introduced-in-current-paper"].includes(
        String(c.historicalStatus),
      )
    )
      throw new TypeError("Unknown candidate owner or historical status.");
    for (const ref of list(c.sourceIds, 8))
      if (typeof ref !== "string" || !sourceIds.includes(ref))
        throw new TypeError("Unresolved candidate source.");
    candidateIds.push(c.id);
  }
  unique(candidateIds);
  const expected = o.id === CASE_IDS[0] ? ["galilean", "lorentz"] : ["lorentz-ether", "lorentz"];
  if (expected.some((name) => !candidateIds.includes(name)))
    throw new TypeError("The case names a different candidate pair.");
  const seenTests: string[] = [],
    seenIds: string[] = [];
  const allowed =
    o.id === CASE_IDS[0]
      ? ["low-speed", "light-speed", "inverse"]
      : ["events", "rod", "clock", "composition"];
  for (const raw of list(o.tests, 4)) {
    const t = record(raw, ["id", "label", "kind", "test", "inputs", "tolerance", "explanation"]);
    id(t.id);
    text(t.label);
    text(t.explanation);
    if (
      typeof t.test !== "string" ||
      !allowed.includes(t.test) ||
      t.kind !== (o.id === CASE_IDS[0] ? "constraint" : "observation")
    )
      throw new TypeError("Unknown test owner or wrong comparison kind.");
    const tol = record(t.tolerance, ["absolute", "relative", "reason"]);
    finite(tol.absolute);
    finite(tol.relative);
    text(tol.reason);
    if (tol.absolute <= 0 || tol.relative < 0 || tol.relative >= 1)
      throw new TypeError(
        "Each tolerance needs a positive absolute floor, a relative part below one, and a reason.",
      );
    const keys =
      t.test === "low-speed"
        ? ["u", "v"]
        : t.test === "rod"
          ? ["properLength"]
          : t.test === "composition"
            ? ["worldlineBeta"]
            : ["events", "inverse"].includes(t.test)
              ? ["events"]
              : [];
    const inputs = record(t.inputs, keys);
    for (const key of keys.filter((key) => key !== "events")) finite(inputs[key]);
    if (
      t.test === "low-speed" &&
      (Math.abs(inputs.u as number) > 1000 || Math.abs(inputs.v as number) > 1000)
    )
      throw new TypeError("The low-speed check is bounded to 1000 m/s inputs.");
    if (t.test === "composition" && Math.abs(inputs.worldlineBeta as number) > 0.95)
      throw new TypeError("The worldline speed must lie between -0.95 and 0.95.");
    if (
      t.test === "rod" &&
      ((inputs.properLength as number) <= 0 || (inputs.properLength as number) > 1e9)
    )
      throw new TypeError("Use a bounded positive rod length.");
    if (keys.includes("events")) {
      const eventIds: string[] = [];
      for (const rawEvent of list(inputs.events, 20)) {
        const e = record(rawEvent, ["id", "t", "x", "y", "z"]);
        id(e.id);
        eventIds.push(e.id);
        for (const key of ["t", "x", "y", "z"]) {
          finite(e[key]);
          if (Math.abs(e[key]) > 1e10) throw new TypeError("Event exceeds the case budget.");
        }
      }
      unique(eventIds);
    }
    seenTests.push(t.test);
    seenIds.push(t.id);
  }
  unique(seenTests);
  unique(seenIds);
  if (seenTests.length !== allowed.length)
    throw new TypeError("The case is missing a required test.");
  return deepFreeze(structuredClone(value)) as CountermodelCase;
}
