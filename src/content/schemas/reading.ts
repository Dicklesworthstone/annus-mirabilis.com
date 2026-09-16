import { ContentError } from "../compiler/json.ts";

/** Explanatory preview records, not diplomatic source blocks or reviewed translations. */
export type Block = Readonly<
  { kind: "paragraph"; text: string } |
  { kind: "formula"; latex: string; spoken: string } |
  { kind: "steps"; items: readonly string[] } |
  { kind: "foundation"; id: string; returnCaption: string }
>;
export const READING_IDS = ["overview", "full", "steps", "margin"] as const;
export type ReadingId = typeof READING_IDS[number];
type Header = Readonly<{ schemaVersion: 1; id: string }>;
export type Citation = Header & Readonly<{ kind: "citation"; title: string; locator: string; url: string }>;
export type Foundation = Header & Readonly<{
  kind: "foundation"; title: string; question: string; summary: string; review: "draft";
  explanation: readonly Block[]; example: readonly Block[]; prerequisites: readonly string[];
  stoppingPoint: string; citations: readonly string[];
}>;
export type Argument = Header & Readonly<{
  kind: "argument"; paper: string; section: string; title: string; question: string; recap: string; review: "draft";
  premises: readonly string[]; limitations: readonly string[]; citations: readonly string[];
  readings: Readonly<Record<ReadingId, readonly Block[]>>;
  prerequisites: readonly Readonly<{ id: string; edge: "premise" | "cross-reference" | "verification" }>[];
  help: Readonly<{ why: string; missingStep: string; example: string }>;
  experiments: readonly string[];
  meaning: Readonly<{ logicalRole: "definition" | "assumption" | "derivation" | "qualification";
    historicalStatus: "pedagogical-reconstruction"; modelStatus: "exact-within-model" | "approximation";
    executionStatus: "static-illustration" }>;
}>;
export type Paper = Header & Readonly<{
  kind: "paper"; title: string; germanTitle: string; description: string; citation: string;
  status: "explanation-preview"; sourceStatus: "in-preparation"; sourceNotice: string;
  sections: readonly Readonly<{ id: string; title: string; arguments: readonly string[] }>[];
}>;
export type ReadingRecord = Paper | Argument | Foundation | Citation;

const error = (p: string, m: string): never => { throw new ContentError("invalid-record", p, m); };
function object(x: unknown, p: string): Record<string, unknown> {
  if (!x || typeof x !== "object" || Array.isArray(x) || ![null, Object.prototype].includes(Object.getPrototypeOf(x))) return error(p, "Expected a plain record.");
  return x as Record<string, unknown>;
}
function keys(x: unknown, p: string, fields: readonly string[]): Record<string, unknown> {
  const o = object(x, p);
  for (const k of Object.keys(o)) if (!fields.includes(k)) error(`${p}.${k}`, "Unknown field.");
  for (const k of fields) if (!Object.hasOwn(o, k)) error(`${p}.${k}`, "Missing field.");
  return o;
}
function text(x: unknown, p: string): asserts x is string {
  if (typeof x !== "string" || !x.trim() || x.length > 16000 || /<[!\/?a-z]/i.test(x)) error(p, "Expected bounded plain text, not HTML or executable markup.");
}
function id(x: unknown, p: string): void { text(x, p); if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(x) || x.length > 100) error(p, "Invalid stable id."); }
function choice(x: unknown, p: string, values: readonly unknown[]): void { if (!values.includes(x)) error(p, "Unsupported value."); }
function list(x: unknown, p: string, check: (x: unknown, p: string) => void, min = 0): void {
  if (!Array.isArray(x) || x.length < min || x.length > 256) return error(p, "Expected a bounded list.");
  x.forEach((v, i) => check(v, `${p}[${i}]`));
}
const mathCommands = new Set(["langle", "rangle", "sum", "frac", "sqrt", "partial", "int", "infty", "pi", "exp", "eta", "tau", "Delta", "varphi", "lambda", "sigma", "mu", "cdot", "times", "left", "right", "quad", "qquad", "text", "mathrm", "underbrace", "overbrace", "begin", "end", "le", "ge", "ne", "approx", "to", "pm", "ldots", "operatorname"]);
export function validateMath(x: unknown, p = "formula"): void {
  text(x, p); if (x.length > 4096) error(p, "Formula exceeds its budget.");
  for (const match of x.matchAll(/\\([a-zA-Z]+|.)/g)) {
    const command = match[1]!;
    if (!mathCommands.has(command) && ![",", ";", "!", " ", "{", "}", "\\"].includes(command)) error(p, `Unsupported math command: ${command}.`);
  }
  for (const match of x.matchAll(/\\(?:begin|end)\{([^}]+)\}/g)) if (!["aligned", "gathered", "cases"].includes(match[1]!)) error(p, "Unsupported math environment.");
}
function block(x: unknown, p: string): void {
  const o = object(x, p);
  if (o.kind === "paragraph") { keys(o, p, ["kind", "text"]); text(o.text, `${p}.text`); }
  else if (o.kind === "formula") { keys(o, p, ["kind", "latex", "spoken"]); validateMath(o.latex, `${p}.latex`); text(o.spoken, `${p}.spoken`); }
  else if (o.kind === "steps") { keys(o, p, ["kind", "items"]); list(o.items, `${p}.items`, text, 1); }
  else if (o.kind === "foundation") { keys(o, p, ["kind", "id", "returnCaption"]); id(o.id, `${p}.id`); text(o.returnCaption, `${p}.returnCaption`); }
  else error(p, "Unknown content block.");
}
export function validateReadingRecord(input: unknown, path: string): ReadingRecord {
  const o = object(input, path); choice(o.schemaVersion, `${path}.schemaVersion`, [1]); id(o.id, `${path}.id`);
  const common = ["schemaVersion", "id", "kind", "title"];
  text(o.title, `${path}.title`);
  if (o.kind === "citation") {
    keys(o, path, [...common, "locator", "url"]); text(o.locator, path); text(o.url, path);
    let url: URL; try { url = new URL(o.url); } catch { return error(path, "Invalid citation URL."); }
    if (url.protocol !== "https:" || url.username || url.password) error(path, "Citations require HTTPS without credentials.");
  } else if (o.kind === "paper") {
    keys(o, path, [...common, "germanTitle", "description", "citation", "status", "sourceStatus", "sourceNotice", "sections"]);
    for (const k of ["germanTitle", "description", "sourceNotice"]) text(o[k], `${path}.${k}`);
    id(o.citation, path); choice(o.status, path, ["explanation-preview"]); choice(o.sourceStatus, path, ["in-preparation"]);
    list(o.sections, `${path}.sections`, (s, p) => { const v = keys(s, p, ["id", "title", "arguments"]); id(v.id, p); text(v.title, p); list(v.arguments, p, id, 1); }, 1);
  } else if (o.kind === "foundation") {
    keys(o, path, [...common, "question", "summary", "review", "explanation", "example", "prerequisites", "stoppingPoint", "citations"]);
    for (const k of ["question", "summary", "stoppingPoint"]) text(o[k], `${path}.${k}`);
    choice(o.review, path, ["draft"]); list(o.explanation, path, block, 1); list(o.example, path, block, 1);
    list(o.prerequisites, path, id); list(o.citations, path, id);
  } else if (o.kind === "argument") {
    keys(o, path, [...common, "paper", "section", "question", "recap", "review", "premises", "limitations", "citations", "readings", "prerequisites", "help", "experiments", "meaning"]);
    id(o.paper, path); id(o.section, path); text(o.question, path); text(o.recap, path); choice(o.review, path, ["draft"]);
    list(o.premises, path, text, 1); list(o.limitations, path, text, 1); list(o.citations, path, id, 1); list(o.experiments, path, id);
    const readings = keys(o.readings, `${path}.readings`, READING_IDS);
    for (const k of READING_IDS) list(readings[k], `${path}.readings.${k}`, block, 1);
    list(o.prerequisites, path, (v, p) => { const e = keys(v, p, ["id", "edge"]); id(e.id, p); choice(e.edge, p, ["premise", "cross-reference", "verification"]); });
    const help = keys(o.help, `${path}.help`, ["why", "missingStep", "example"]); Object.values(help).forEach(v => id(v, path));
    const m = keys(o.meaning, path, ["logicalRole", "historicalStatus", "modelStatus", "executionStatus"]);
    choice(m.logicalRole, path, ["definition", "assumption", "derivation", "qualification"]);
    choice(m.historicalStatus, path, ["pedagogical-reconstruction"]); choice(m.modelStatus, path, ["exact-within-model", "approximation"]); choice(m.executionStatus, path, ["static-illustration"]);
  } else error(path, "Unknown record kind.");
  return input as ReadingRecord;
}
