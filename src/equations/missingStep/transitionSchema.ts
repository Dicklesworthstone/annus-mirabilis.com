/** Structural contract over the existing derivation chains; never a second rule catalogue. */
import { nodeId, children, type Expression } from "../ast.ts";
import { parseDerivationChain } from "../derivations/schema.ts";
import { getRule } from "../derivations/rules/index.ts";
import { REGISTERED_IDENTITY_IDS } from "../derivations/rules/registeredIdentity.ts";
import type { DerivationChain, RuleKind } from "../derivations/types.ts";

export const INITIAL_MISSING_STEP_CHAIN = "chain-bm-variance-of-sum";
// DerivationStep already owns both expression trees, so fromStepId and toStepId identify
// the same atomic step, not two independent graph nodes with invented meanings.
export type MissingStepTransition = Readonly<{
  id: string; chainId: string; fromStepId: string; toStepId: string; title: string;
  changedSubexpressionIds: readonly string[]; ruleIds: readonly RuleKind[];
  premiseIds: readonly string[]; workedCaseId: "two-signed-steps";
}>;
export type MissingStepLesson = Readonly<{
  schemaVersion: 1; kind: "missing-step-chain"; review: "draft"; paper: "brownian-motion";
  argument: string; title: string; routeLabel: string; sourceLink: string; sourceLabel: string;
  sourceNotice: string; premiseNotice: string; generalization: string; absoluteNote: string; modernNote: string;
  premises: readonly Readonly<{id: string; argument: string; text: string}>[];
  chain: DerivationChain; transitions: readonly MissingStepTransition[];
}>;
export class MissingStepError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(`[${code}] ${message}`); this.code = code; this.name = "MissingStepError"; }
}
function fail(code: string, message: string): never { throw new MissingStepError(code, message); }
function record(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v)))
    fail("missing-step-schema", "Expected a plain record.");
  for (const d of Object.values(Object.getOwnPropertyDescriptors(v)))
    if (!Object.hasOwn(d, "value")) fail("missing-step-schema", "Accessors are not content.");
  return v as Record<string, unknown>;
}
function text(v: unknown, field: string): string {
  if (typeof v !== "string" || !v.trim() || v.length > 5000) fail("missing-step-schema", `Invalid ${field}.`);
  return v;
}
function id(v: unknown): string {
  const s = text(v, "id");
  if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(s)) fail("missing-step-schema", `Invalid id ${s}.`);
  return s;
}
function list(v: unknown): unknown[] {
  if (!Array.isArray(v) || v.length > 64) fail("missing-step-schema", "Expected a bounded list.");
  return v;
}
function ids(v: unknown): string[] {
  const values = list(v).map(id);
  if (new Set(values).size !== values.length) fail("missing-step-schema", "Duplicate id in list.");
  return values;
}
/** Expansion beyond the first case needs recorded evidence, never a runtime flag. */
export function parseMissingStepAllowlist(input: unknown): readonly string[] {
  const value = record(input);
  if (value.schemaVersion !== 1) fail("missing-step-schema", "Unknown allow-list version.");
  const allowed = list(value.chains).map((entry) => {
    const row = record(entry), chainId = id(row.chainId), evidence = ids(row.evidenceIds);
    if (chainId !== INITIAL_MISSING_STEP_CHAIN && (!evidence.length || row.initialCase === true))
      fail("missing-step-expansion-evidence", `Expansion of ${chainId} needs reader/review evidence ids.`);
    return chainId;
  });
  if (new Set(allowed).size !== allowed.length) fail("missing-step-schema", "Repeated chain in allow-list.");
  return Object.freeze(allowed);
}
function expressionIds(input: unknown): ReadonlySet<string> {
  let count = 0;
  const found = new Set<string>();
  function visit(v: unknown, depth: number): void {
    if (++count > 256 || depth > 20) fail("missing-step-expression", "Expression budget exceeded.");
    const n = record(v);
    if (!["number", "symbol", "power", "sum", "product", "average", "group"].includes(String(n.kind)))
      fail("missing-step-expression", `Unsupported worked-bridge expression ${String(n.kind)}.`);
    if (n.kind === "number" && (typeof n.value !== "string" || !/^-?\d+(?:\.\d+)?$/.test(n.value) || !Number.isFinite(Number(n.value))))
      fail("missing-step-expression", "Invalid numeric literal.");
    if (n.kind === "symbol") {
      id(n.termId); id(n.quantityId);
      if (!/^[ABl]$/.test(String(n.termId)) || n.quantityId !== ({A: "stepA", B: "stepB", l: "stepRms"} as Record<string,string>)[String(n.termId)] || n.scale !== undefined)
        fail("missing-step-expression", "This bridge admits only A, B and l without scale aliases.");
    }
    if (n.kind === "power") {
      const e = record(n.exponent);
      if (e.num !== 2 || e.den !== 1) fail("missing-step-expression", "The worked bridge uses squares.");
    }
    if (n.kind === "sum" || n.kind === "product") {
      if (list(n.args).length < 2) fail("missing-step-expression", "A sum/product needs two terms.");
    }
    if (n.opId !== undefined) id(n.opId);
    const expr = n as unknown as Expression, identity = nodeId(expr);
    if (identity) found.add(identity);
    for (const child of children(expr)) visit(child, depth + 1);
  }
  visit(input, 0); return found;
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([key,child]) => `${JSON.stringify(key)}:${stable(child)}`).join(",")}}`;
  return JSON.stringify(value) ?? "undefined";
}
function selectedSubtrees(tree: Expression, selected: string): string[] {
  return [...(nodeId(tree) === selected ? [stable(tree)] : []), ...children(tree).flatMap(child => selectedSubtrees(child, selected))];
}
/** Validate links against the actual compiled argument catalogue, not guessed anchors. */
export function parseMissingStepLesson(input: unknown, allowed: readonly string[], argumentIds: readonly string[]): MissingStepLesson {
  const value = record(input);
  if (value.schemaVersion !== 1 || value.kind !== "missing-step-chain" || value.review !== "draft" || value.paper !== "brownian-motion")
    fail("missing-step-schema", "Only the draft Brownian worked bridge is admitted.");
  const rawChain = record(value.chain);
  if (!allowed.includes(id(rawChain.id))) fail("missing-step-not-allowlisted", `Chain ${String(rawChain.id)} is not admitted for an explorer.`);
  const pairs = new Map<string, readonly [ReadonlySet<string>, ReadonlySet<string>]>();
  for (const entry of list(rawChain.steps)) {
    const step = record(entry); pairs.set(id(step.id), [expressionIds(step.from), expressionIds(step.to)]);
  }
  const chain = parseDerivationChain(rawChain);
  if (chain.routeKind !== "pedagogical-reconstruction") fail("missing-step-route", "Do not present this bridge as the printed calculation.");
  for (let i = 1; i < chain.steps.length; i++)
    if (stable(chain.steps[i - 1]!.to) !== stable(chain.steps[i]!.from))
      fail("missing-step-continuity", "The next step must begin with the previous step’s exact expression.");
  const argument = id(value.argument);
  if (!argumentIds.includes(argument)) fail("missing-step-premise", `Missing argument ${argument}.`);
  const premises = list(value.premises).map((entry) => {
    const p = record(entry), argument = id(p.argument);
    if (!argumentIds.includes(argument)) fail("missing-step-premise", `Missing premise source ${argument}.`);
    return Object.freeze({id: id(p.id), argument, text: text(p.text, "premise")});
  });
  const knownPremises = new Set(premises.map((p) => p.id));
  if (knownPremises.size !== premises.length) fail("missing-step-premise", "Repeated premise definition.");
  for (const p of [...chain.entryAssumptions, ...chain.steps.flatMap((s) => s.premiseRefs)])
    if (!knownPremises.has(p.ref) || p.edgeType !== "pedagogical-reconstruction") fail("missing-step-premise", `Unknown or misclassified premise ${p.ref}.`);
  const transitions = list(value.transitions).map((entry) => {
    const t = record(entry), fromStepId = id(t.fromStepId), toStepId = id(t.toStepId);
    const step = chain.steps.find((s) => s.id === fromStepId), pair = pairs.get(fromStepId);
    if (!step || !pair || toStepId !== fromStepId) fail("missing-step-transition", "Unknown step endpoint.");
    const changed = ids(t.changedSubexpressionIds);
    if (!changed.length || changed.some((name) => !pair[0].has(name) || !pair[1].has(name)))
      fail("missing-step-subexpression", "Every changed subexpression must exist on both sides of the transition.");
    for (const selected of changed) {
      const from = selectedSubtrees(step.from, selected), to = selectedSubtrees(step.to, selected);
      if (from.length !== 1 || to.length !== 1 || from[0] === to[0])
        fail("missing-step-subexpression", "A highlight must identify one genuinely changed subtree on each side.");
    }
    if (JSON.stringify(changed) !== JSON.stringify(step.changedSubexpressionIds)) fail("missing-step-subexpression", "Transition and chain highlights disagree.");
    const ruleIds = ids(t.ruleIds) as RuleKind[];
    if (!ruleIds.length || ruleIds.some((name) => !getRule(name)) || !ruleIds.includes(step.rule.kind))
      fail("missing-step-rule", "Rule is absent from the shared derivation library or from the step.");
    if (step.rule.kind === "registered-identity" && !REGISTERED_IDENTITY_IDS.some((name) => name === step.rule.params.identityId))
      fail("missing-step-rule", "Unregistered mathematical identity.");
    const premiseIds = ids(t.premiseIds);
    if (premiseIds.some((name) => !knownPremises.has(name)) || step.premiseRefs.some((p) => !premiseIds.includes(p.ref)))
      fail("missing-step-premise", "A transition must expose every premise used by its step.");
    if (id(t.chainId) !== chain.id || t.workedCaseId !== "two-signed-steps") fail("missing-step-transition", "Unknown chain or worked case.");
    return Object.freeze({id: id(t.id), chainId: chain.id, fromStepId, toStepId, title: text(t.title, "title"),
      changedSubexpressionIds: Object.freeze(changed), ruleIds: Object.freeze(ruleIds), premiseIds: Object.freeze(premiseIds), workedCaseId: "two-signed-steps" as const});
  });
  if (transitions.length !== chain.steps.length || new Set(transitions.map((t) => t.id)).size !== transitions.length ||
      new Set(transitions.map((t) => t.fromStepId)).size !== chain.steps.length)
    fail("missing-step-transition", "Every step needs exactly one selectable transition.");
  const fields = Object.fromEntries(["title", "routeLabel", "sourceLabel", "sourceNotice", "premiseNotice", "generalization", "absoluteNote", "modernNote"].map((k) => [k, text(value[k], k)]));
  const sourceLink = text(value.sourceLink, "sourceLink"), source = sourceLink.match(/^\/papers\/brownian-motion\/s4\/#([a-z0-9-]+)$/);
  if (!source || !argumentIds.includes(source[1] ?? "")) fail("missing-step-source", "Source route must lead to an existing explanation anchor.");
  const historicalText = [fields.premiseNotice, ...premises.map((p) => p.text), ...chain.steps.flatMap((s) => Object.values(s.reasons))].join(" ");
  if (/momentum relaxation|Langevin|1908/.test(historicalText)) fail("missing-step-anachronism", "Later dynamics belongs only in the labeled modern note.");
  return Object.freeze({...value, ...fields, argument, sourceLink, chain, premises: Object.freeze(premises), transitions: Object.freeze(transitions)}) as unknown as MissingStepLesson;
}
