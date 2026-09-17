/** Route-local discovery records. These are authored reconstructions, never source editions.
 * The same validator runs in the content compiler and the server route. No physics lives here.
 */
import { ALLOWED_FUNCTIONS, parse } from "../../discovery/exercises/grammar.ts";
import { evaluate } from "../../discovery/exercises/evaluate.ts";

export const DISCOVERY_PAPERS = [
  "light-quanta",
  "brownian-motion",
  "special-relativity",
  "mass-energy",
] as const;
export type DiscoveryPaper = (typeof DISCOVERY_PAPERS)[number];
export type DiscoveryCitation = Readonly<{ label: string; url: string; locator: string }>;
export type ShelfCard = Readonly<{
  id: string;
  title: string;
  latestYear: number;
  availability: "available-by-1904" | "admitted-1905";
  admission: string;
  proposition: string;
  limitation: string;
  citation: DiscoveryCitation;
}>;
export type DiscoveryLab = Readonly<{
  id: string;
  title: string;
  task: string;
  observe: string;
}>;
export type DiscoveryAlternative = Readonly<{
  id: string;
  title: string;
  retains: string;
  consequence: string;
  limitation: string;
}>;
export type DiscoveryStage = Readonly<{
  id: string;
  title: string;
  role: "question" | "fork" | "move" | "consequence";
  dependsOn: readonly string[];
  premises: readonly string[];
  question: string;
  overview: readonly string[];
  qualifications: readonly string[];
  reasoning: readonly string[];
  alternatives: readonly DiscoveryAlternative[];
  labs: readonly DiscoveryLab[];
  paperLocator: string;
  /** No broken lab links: a missing instrument is an explicit, visible content state. */
  unavailable: string | null;
}>;
export type DiscoveryEvidence = Readonly<{
  id: string;
  year: number;
  title: string;
  supports: string;
  limitation: string;
  citation: DiscoveryCitation;
}>;
/** Validated content projected into the existing ExpressionExercisePart component. */
export type DiscoveryExercise = Readonly<{
  id: string;
  stageId: string;
  prompt: string;
  declaredNames: readonly string[];
  domains: Readonly<
    Record<string, Readonly<{ min: number; max: number; scale: "linear" | "log" }>>
  >;
  referenceSource: string;
  tolerance: Readonly<{ absolute: number; relative: number }>;
  workedExplanation: string;
}>;
export type DiscoveryJourney = Readonly<{
  kind: "discovery-journey";
  schemaVersion: 1;
  id: string;
  paper: DiscoveryPaper;
  revision: string;
  reviewState: "machine-draft";
  title: string;
  question: string;
  introduction: readonly string[];
  scope: readonly string[];
  source: DiscoveryCitation;
  shelf: readonly ShelfCard[];
  stages: readonly DiscoveryStage[];
  evidence: readonly DiscoveryEvidence[];
  conclusion: readonly string[];
  exercises?: readonly DiscoveryExercise[];
}>;

export class DiscoveryContentError extends Error {
  readonly code = "discovery-invalid";
  readonly path: string;
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "DiscoveryContentError";
    this.path = path;
  }
}
function fail(path: string, message: string): never {
  throw new DiscoveryContentError(path, message);
}
function record(
  input: unknown,
  path: string,
  keys: readonly string[],
  optional: readonly string[] = [],
): Record<string, unknown> {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    ![null, Object.prototype].includes(Object.getPrototypeOf(input))
  )
    return fail(path, "Expected a plain record.");
  const fields = Object.getOwnPropertyDescriptors(input);
  if (
    Reflect.ownKeys(input).some(
      (key) => typeof key !== "string" || ![...keys, ...optional].includes(key),
    )
  )
    fail(path, "Unexpected fields.");
  for (const key of [...keys, ...optional.filter((key) => Object.hasOwn(input, key))]) {
    const field = fields[key];
    if (!field?.enumerable || !Object.hasOwn(field, "value"))
      fail(`${path}.${key}`, "A required data field is missing; accessors are not admitted.");
  }
  return input as Record<string, unknown>;
}
function text(input: unknown, path: string, limit = 2400): string {
  if (
    typeof input !== "string" ||
    !input.trim() ||
    input.length > limit ||
    input !== input.normalize("NFC") ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(input)
  )
    return fail(path, `Expected nonempty NFC text, at most ${limit} characters.`);
  return input;
}
function id(input: unknown, path: string): string {
  const value = text(input, path, 96);
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value))
    fail(path, "Expected a stable lowercase, hyphenated id.");
  return value;
}
function choice<T extends string>(input: unknown, path: string, options: readonly T[]): T {
  if (typeof input !== "string" || !options.includes(input as T))
    return fail(path, `Expected one of: ${options.join(", ")}.`);
  return input as T;
}
function list<T>(
  input: unknown,
  path: string,
  min: number,
  max: number,
  parse: (item: unknown, path: string) => T,
): readonly T[] {
  if (!Array.isArray(input) || input.length < min || input.length > max)
    return fail(path, `Expected ${min}–${max} entries.`);
  const result: T[] = [];
  // Do not let sparse arrays or array accessors bypass validation.
  for (let i = 0; i < input.length; i++) {
    const field = Object.getOwnPropertyDescriptor(input, i);
    if (!field || !Object.hasOwn(field, "value")) fail(`${path}[${i}]`, "Expected a data entry.");
    result.push(parse(field.value, `${path}[${i}]`));
  }
  return Object.freeze(result);
}
function unique(values: readonly string[], path: string): void {
  if (new Set(values).size !== values.length) fail(path, "Duplicate identity or reference.");
}
function paragraphs(input: unknown, path: string, min = 1): readonly string[] {
  return list(input, path, min, 12, text);
}
function refs(input: unknown, path: string): readonly string[] {
  const values = list(input, path, 0, 24, id);
  unique(values, path);
  return values;
}
function citation(input: unknown, path: string): DiscoveryCitation {
  const r = record(input, path, ["label", "url", "locator"]);
  const url = text(r.url, `${path}.url`, 1200);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return fail(`${path}.url`, "Expected an absolute URL.");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.href !== url ||
    /\s/u.test(url)
  )
    fail(`${path}.url`, "Use a canonical HTTPS source URL without credentials or whitespace.");
  return Object.freeze({
    label: text(r.label, `${path}.label`),
    url,
    locator: text(r.locator, `${path}.locator`),
  });
}
function year(input: unknown, path: string): number {
  if (!Number.isSafeInteger(input) || Number(input) < 1600 || Number(input) > 2100)
    return fail(path, "Expected an explicit year between 1600 and 2100.");
  return input as number;
}
function lab(input: unknown, path: string): DiscoveryLab {
  const r = record(input, path, ["id", "title", "task", "observe"]);
  const labId = text(r.id, `${path}.id`, 16);
  // Syntax only. The integration test checks the referenced route actually exists.
  if (!/^(?:lq|bm|sr|me)-\d{2}$/.test(labId)) fail(`${path}.id`, "Expected a laboratory id.");
  return Object.freeze({
    id: labId,
    title: text(r.title, `${path}.title`),
    task: text(r.task, `${path}.task`),
    observe: text(r.observe, `${path}.observe`),
  });
}
function alternative(input: unknown, path: string): DiscoveryAlternative {
  const r = record(input, path, ["id", "title", "retains", "consequence", "limitation"]);
  return Object.freeze({
    id: id(r.id, `${path}.id`),
    title: text(r.title, `${path}.title`),
    retains: text(r.retains, `${path}.retains`),
    consequence: text(r.consequence, `${path}.consequence`),
    limitation: text(r.limitation, `${path}.limitation`),
  });
}
function stage(input: unknown, path: string): DiscoveryStage {
  const r = record(input, path, [
    "id",
    "title",
    "role",
    "dependsOn",
    "premises",
    "question",
    "overview",
    "qualifications",
    "reasoning",
    "alternatives",
    "labs",
    "paperLocator",
    "unavailable",
  ]);
  const role = choice(r.role, `${path}.role`, ["question", "fork", "move", "consequence"] as const);
  const alternatives = list(
    r.alternatives,
    `${path}.alternatives`,
    role === "fork" ? 2 : 0,
    4,
    alternative,
  );
  unique(
    alternatives.map((a) => a.id),
    `${path}.alternatives`,
  );
  const unavailable = r.unavailable === null ? null : text(r.unavailable, `${path}.unavailable`);
  const labs = list(r.labs, `${path}.labs`, unavailable === null ? 1 : 0, 4, lab);
  if (unavailable !== null && labs.length !== 0)
    fail(path, "A stage with an unavailable instrument must not advertise a working laboratory.");
  unique(
    labs.map((l) => l.id),
    `${path}.labs`,
  );
  return Object.freeze({
    id: id(r.id, `${path}.id`),
    title: text(r.title, `${path}.title`),
    role,
    dependsOn: refs(r.dependsOn, `${path}.dependsOn`),
    premises: refs(r.premises, `${path}.premises`),
    question: text(r.question, `${path}.question`),
    overview: paragraphs(r.overview, `${path}.overview`),
    qualifications: paragraphs(r.qualifications, `${path}.qualifications`),
    reasoning: paragraphs(r.reasoning, `${path}.reasoning`),
    alternatives,
    labs,
    paperLocator: text(r.paperLocator, `${path}.paperLocator`),
    unavailable,
  });
}

function exercise(input: unknown, path: string): DiscoveryExercise {
  const r = record(input, path, [
    "id",
    "stageId",
    "prompt",
    "declaredNames",
    "domains",
    "referenceSource",
    "tolerance",
    "workedExplanation",
  ]);
  const declaredNames = list(r.declaredNames, `${path}.declaredNames`, 1, 8, (value, p) => {
    const name = text(value, p, 32);
    if (
      !/^[A-Za-z][A-Za-z0-9_]*$/.test(name) ||
      [...ALLOWED_FUNCTIONS, "pi", "constructor", "prototype", "__proto__"].includes(name)
    )
      fail(p, "Declare a variable name, not a function, built-in constant or reserved property.");
    return name;
  });
  unique(declaredNames, `${path}.declaredNames`);
  const rawDomains = record(r.domains, `${path}.domains`, declaredNames);
  const domains: Record<string, { min: number; max: number; scale: "linear" | "log" }> = {};
  for (const name of declaredNames) {
    const d = record(rawDomains[name], `${path}.domains.${name}`, ["min", "max", "scale"]);
    if (
      typeof d.min !== "number" ||
      typeof d.max !== "number" ||
      !Number.isFinite(d.min) ||
      !Number.isFinite(d.max) ||
      d.min >= d.max ||
      !Number.isFinite(d.max - d.min)
    )
      fail(`${path}.domains.${name}`, "Use a finite increasing range with a representable width.");
    const scale = choice(d.scale, `${path}.domains.${name}.scale`, ["linear", "log"] as const);
    if (scale === "log" && d.min <= 0) fail(path, "A log range must be strictly positive.");
    domains[name] = Object.freeze({ min: d.min, max: d.max, scale });
  }
  const rawTolerance = record(r.tolerance, `${path}.tolerance`, ["absolute", "relative"]);
  const absolute = rawTolerance.absolute,
    relative = rawTolerance.relative;
  if (
    typeof absolute !== "number" ||
    typeof relative !== "number" ||
    !Number.isFinite(absolute) ||
    !Number.isFinite(relative) ||
    absolute <= 0 ||
    relative <= 0 ||
    relative >= 1
  )
    fail(
      `${path}.tolerance`,
      "Declare positive finite absolute and relative tolerances; relative must be below one.",
    );
  const referenceSource = text(r.referenceSource, `${path}.referenceSource`, 200);
  const parsed = parse(referenceSource, new Set(declaredNames));
  if (!parsed.ok) fail(`${path}.referenceSource`, parsed.message);
  // Publication checks use the SAME parser/evaluator as the existing exercise owner.
  // Corners and the midpoint catch invalid authored ranges; this is not a proof
  // of finiteness throughout the domain or an independent physics validation.
  const points = Array.from({ length: 2 ** declaredNames.length }, (_, mask) =>
    Object.fromEntries(
      declaredNames.map((name, i) => [
        name,
        mask & (1 << i) ? domains[name]!.max : domains[name]!.min,
      ]),
    ),
  );
  points.push(
    Object.fromEntries(
      declaredNames.map((name) => {
        const d = domains[name]!;
        return [
          name,
          d.scale === "log"
            ? Math.exp((Math.log(d.min) + Math.log(d.max)) / 2)
            : d.min / 2 + d.max / 2,
        ];
      }),
    ),
  );
  if (points.some((point) => evaluate(parsed.expr, point).status !== "value"))
    fail(
      `${path}.referenceSource`,
      "The reference is undefined at a checked domain boundary or midpoint.",
    );
  return Object.freeze({
    id: id(r.id, `${path}.id`),
    stageId: id(r.stageId, `${path}.stageId`),
    prompt: text(r.prompt, `${path}.prompt`),
    declaredNames,
    domains: Object.freeze(domains),
    referenceSource,
    tolerance: Object.freeze({ absolute, relative }),
    workedExplanation: text(r.workedExplanation, `${path}.workedExplanation`),
  });
}

/** Copies, checks and freezes a complete journey; never publishes half a valid record. */
export function validateDiscoveryJourney(input: unknown, path = "journey"): DiscoveryJourney {
  const r = record(
    input,
    path,
    [
      "kind",
      "schemaVersion",
      "id",
      "paper",
      "revision",
      "reviewState",
      "title",
      "question",
      "introduction",
      "scope",
      "source",
      "shelf",
      "stages",
      "evidence",
      "conclusion",
    ],
    ["exercises"],
  );
  if (r.kind !== "discovery-journey" || r.schemaVersion !== 1)
    fail(path, "Unsupported discovery record kind or schema version.");
  const paper = choice(r.paper, `${path}.paper`, DISCOVERY_PAPERS);
  const journeyId = id(r.id, `${path}.id`);
  if (journeyId !== `journey-${paper}`) fail(`${path}.id`, "Identity must match the paper.");
  // Review is a separate human-gated workflow, not an author-editable approval switch.
  if (r.reviewState !== "machine-draft")
    fail(`${path}.reviewState`, "This schema admits machine drafts only.");
  const revision = id(r.revision, `${path}.revision`);
  const shelf = list(r.shelf, `${path}.shelf`, 1, 24, (input, p): ShelfCard => {
    const c = record(input, p, [
      "id",
      "title",
      "latestYear",
      "availability",
      "admission",
      "proposition",
      "limitation",
      "citation",
    ]);
    const latestYear = year(c.latestYear, `${p}.latestYear`);
    const availability = choice(c.availability, `${p}.availability`, [
      "available-by-1904",
      "admitted-1905",
    ] as const);
    const cardId = id(c.id, `${p}.id`);
    if (availability === "available-by-1904" && latestYear > 1904)
      fail(p, "Later evidence cannot enter the 1904 shelf.");
    if (
      availability === "admitted-1905" &&
      (paper !== "mass-energy" || latestYear !== 1905 || cardId !== "sr-light-energy")
    )
      fail(p, "The sole 1905 shelf import is the relativity light-energy result for mass–energy.");
    return Object.freeze({
      id: cardId,
      title: text(c.title, `${p}.title`),
      latestYear,
      availability,
      admission: text(c.admission, `${p}.admission`),
      proposition: text(c.proposition, `${p}.proposition`),
      limitation: text(c.limitation, `${p}.limitation`),
      citation: citation(c.citation, `${p}.citation`),
    });
  });
  unique(
    shelf.map((c) => c.id),
    `${path}.shelf`,
  );
  const stages = list(r.stages, `${path}.stages`, 3, 16, stage);
  unique(
    stages.map((s) => s.id),
    `${path}.stages`,
  );
  if (stages.filter((s) => s.role === "move").length !== 1)
    fail(`${path}.stages`, "Name exactly one conceptual move.");
  if (!stages.some((s) => s.role === "fork"))
    fail(`${path}.stages`, "A journey needs a worked fork.");
  const prior = new Set<string>();
  const premiseIds = new Set(shelf.map((c) => c.id));
  for (const s of stages) {
    for (const dep of s.dependsOn)
      if (!prior.has(dep))
        fail(
          `${path}.${s.id}`,
          `Dependency ${dep} has not been established; no forward or circular premises.`,
        );
    if (prior.size > 0 && s.dependsOn.length === 0)
      fail(`${path}.${s.id}`, "Connect each later stage to an earlier argument.");
    for (const premise of s.premises)
      if (!premiseIds.has(premise)) fail(`${path}.${s.id}`, `Unknown shelf premise: ${premise}.`);
    prior.add(s.id);
  }
  const exercises = Object.hasOwn(r, "exercises")
    ? list(r.exercises, `${path}.exercises`, 2, 5, exercise)
    : undefined;
  if (exercises) {
    unique(
      exercises.map((e) => e.id),
      `${path}.exercises`,
    );
    for (const e of exercises)
      if (!prior.has(e.stageId))
        fail(`${path}.${e.id}`, "Exercise references a missing guide stage.");
  }
  const evidence = list(r.evidence, `${path}.evidence`, 0, 8, (input, p): DiscoveryEvidence => {
    const e = record(input, p, ["id", "year", "title", "supports", "limitation", "citation"]);
    const evidenceYear = year(e.year, `${p}.year`);
    if (evidenceYear < 1905) fail(p, "Pre-1905 material belongs on the shelf with its limits.");
    return Object.freeze({
      id: id(e.id, `${p}.id`),
      year: evidenceYear,
      title: text(e.title, `${p}.title`),
      supports: text(e.supports, `${p}.supports`),
      limitation: text(e.limitation, `${p}.limitation`),
      citation: citation(e.citation, `${p}.citation`),
    });
  });
  unique([...shelf.map((c) => c.id), ...evidence.map((e) => e.id)], `${path}.source-identities`);
  return Object.freeze({
    kind: "discovery-journey",
    schemaVersion: 1,
    id: journeyId,
    paper,
    revision,
    reviewState: "machine-draft",
    title: text(r.title, `${path}.title`),
    question: text(r.question, `${path}.question`),
    introduction: paragraphs(r.introduction, `${path}.introduction`),
    scope: paragraphs(r.scope, `${path}.scope`),
    source: citation(r.source, `${path}.source`),
    shelf,
    stages,
    evidence,
    conclusion: paragraphs(r.conclusion, `${path}.conclusion`),
    ...(exercises ? { exercises } : {}),
  });
}
