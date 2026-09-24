/**
 * EVERY PRINTED PARAGRAPH REACHES ITS EXPLANATION (am-bind-paragraphs-and-displays-me-u7bu).
 *
 * Measured on 2026-09-24: 0 of the manifests' argument obligations resolved to an argument record,
 * 0 printed displays were bound to an equation record, and nothing tied a German paragraph to the
 * passage that explains it. The explanation-grain decision (D-2026-09-24-explanation-grain) keeps
 * the argument passages as the unit of explanation and binds the source to them explicitly:
 * - every printed paragraph and footnote names one or more passages, and has its own r0 overview;
 *   a paragraph no passage explains yet is declared "unexplained" with its reason instead, keeps its
 *   r0, and is counted apart, so a gap is stated rather than covered by an invented passage;
 * - every printed display names equation records, or carries a declared status and its reason;
 * - every argument obligation the manifest records resolves to passages or a declared status.
 * The bindings live in content/bindings/<paper>.yaml. This reads them against the frozen manifest,
 * the paper's argument passages and its equation records, and reports each gap by name. A paper on
 * the required list must have its file, so deleting it cannot pass for complete.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "../provenance/yaml.ts";

/** Papers whose source must be fully bound. A paper joins when its bindings are written. */
export const BINDINGS_REQUIRED: readonly string[] = ["mass-energy"];

export type BindingReport = Readonly<{
  paper: string;
  /** Bound to passages, and declared unexplained with a reason: together they must be all of them. */
  paragraphs: Readonly<{ bound: number; declared: number; of: number }>;
  displays: Readonly<{ bound: number; of: number }>;
  obligations: Readonly<{ resolved: number; of: number }>;
  problems: readonly string[];
}>;

type ManifestUnit = Readonly<{ id: string; kind: string; obligations: readonly string[] }>;

function manifestUnits(root: string, paper: string): readonly ManifestUnit[] | null {
  const path = join(root, "content", "source-blocks", paper, "manifest.yaml");
  if (!existsSync(path)) return null;
  const units = (parseYaml(readFileSync(path, "utf8")) as { units?: unknown } | null)?.units;
  if (!Array.isArray(units)) return [];
  return units.flatMap((u) => {
    const { id, kind, destination } = (u ?? {}) as {
      id?: unknown;
      kind?: unknown;
      destination?: { argumentObligations?: unknown };
    };
    const obligations = destination?.argumentObligations;
    return typeof id === "string" && typeof kind === "string"
      ? [
          {
            id,
            kind,
            obligations: Array.isArray(obligations)
              ? obligations.filter((o): o is string => typeof o === "string")
              : [],
          },
        ]
      : [];
  });
}

/** The ids of the JSON records of one kind for a paper (content/arguments/<paper>, ...). */
function recordIds(root: string, dir: string, paper: string): ReadonlySet<string> {
  const path = join(root, "content", dir, paper);
  if (!existsSync(path)) return new Set();
  return new Set(
    readdirSync(path)
      .filter((name) => name.endsWith(".json"))
      .flatMap((name) => {
        const record = JSON.parse(readFileSync(join(path, name), "utf8")) as { id?: unknown };
        return typeof record.id === "string" ? [record.id] : [];
      }),
  );
}

type Paragraph = {
  unit?: unknown;
  passages?: unknown;
  r0?: unknown;
  status?: unknown;
  reason?: unknown;
};

/** The only status a paragraph may declare: no passage explains it yet. */
export const PARAGRAPH_STATUS = "unexplained";
type Display = { unit?: unknown; equations?: unknown; status?: unknown; reason?: unknown };
type Obligation = { obligation?: unknown; passages?: unknown; status?: unknown; reason?: unknown };

const strings = (x: unknown): readonly string[] =>
  Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : [];

/** The paper's binding report, or null when the paper has no manifest to bind. */
export function checkParagraphBindings(root: string, paper: string): BindingReport | null {
  const units = manifestUnits(root, paper);
  if (units === null) return null;
  const problems: string[] = [];
  const paragraphs = units.filter((u) => u.kind === "paragraph" || u.kind === "footnote");
  const displays = units.filter((u) => u.kind === "display-equation");
  const obligations = [...new Set(units.flatMap((u) => u.obligations))];
  const passages = recordIds(root, "arguments", paper);
  const equations = recordIds(root, "equations", paper);

  const file = join(root, "content", "bindings", `${paper}.yaml`);
  const raw = existsSync(file)
    ? ((parseYaml(readFileSync(file, "utf8")) as {
        paragraphs?: Paragraph[];
        displays?: Display[];
        obligations?: Obligation[];
      } | null) ?? {})
    : null;
  if (raw === null)
    problems.push(`${paper} has no content/bindings/${paper}.yaml, and it is required`);
  const byUnit = <T extends { unit?: unknown }>(list: T[] | undefined) =>
    new Map((list ?? []).flatMap((x) => (typeof x.unit === "string" ? [[x.unit, x]] : [])));
  const paragraphBindings = byUnit(raw?.paragraphs);
  const displayBindings = byUnit(raw?.displays);
  const obligationBindings = new Map(
    (raw?.obligations ?? []).flatMap((o) =>
      typeof o.obligation === "string" ? [[o.obligation, o] as const] : [],
    ),
  );

  const passagesOk = (where: string, named: readonly string[]) => {
    if (named.length === 0) {
      problems.push(`${where} names no passage`);
      return false;
    }
    const missing = named.filter((p) => !passages.has(p));
    for (const p of missing) problems.push(`${where} names ${p}, which is not a ${paper} passage`);
    return missing.length === 0;
  };

  let paragraphsBound = 0;
  let paragraphsDeclared = 0;
  for (const unit of paragraphs) {
    const b = paragraphBindings.get(unit.id);
    if (!b) {
      problems.push(`${paper} ${unit.id} is bound to no passage`);
      continue;
    }
    const r0 = typeof b.r0 === "string" ? b.r0.trim() : "";
    if (r0 === "") problems.push(`${paper} ${unit.id} has no r0 overview`);
    if (b.status !== undefined) {
      const reason = typeof b.reason === "string" ? b.reason.trim() : "";
      if (b.status !== PARAGRAPH_STATUS)
        problems.push(
          `${paper} ${unit.id} declares ${String(b.status)}; a paragraph may only be declared ${PARAGRAPH_STATUS}`,
        );
      else if (reason === "")
        problems.push(`${paper} ${unit.id} is declared ${PARAGRAPH_STATUS} without a reason`);
      else if (strings(b.passages).length > 0)
        problems.push(
          `${paper} ${unit.id} names passages and is declared ${PARAGRAPH_STATUS}; it is one or the other`,
        );
      else if (r0 !== "") paragraphsDeclared++;
      continue;
    }
    if (passagesOk(`${paper} ${unit.id}`, strings(b.passages)) && r0 !== "") paragraphsBound++;
  }

  let displaysBound = 0;
  for (const unit of displays) {
    const b = displayBindings.get(unit.id);
    const named = strings(b?.equations);
    const declared = typeof b?.status === "string" && typeof b?.reason === "string";
    if (!b || (named.length === 0 && !declared)) {
      problems.push(`${paper} ${unit.id} has neither an equation record nor a declared status`);
      continue;
    }
    const unknown = named.filter((e) => !equations.has(e));
    for (const e of unknown)
      problems.push(`${paper} ${unit.id} names ${e}, which is not a ${paper} equation record`);
    if (unknown.length === 0) displaysBound++;
  }

  let obligationsResolved = 0;
  for (const obligation of obligations) {
    const b = obligationBindings.get(obligation);
    const declared = typeof b?.status === "string" && typeof b?.reason === "string";
    if (!b) {
      problems.push(`${paper} obligation ${obligation} resolves to nothing`);
      continue;
    }
    if (declared || passagesOk(`${paper} obligation ${obligation}`, strings(b.passages)))
      obligationsResolved++;
  }

  // A binding for a unit the manifest does not have is a stale or mistyped id.
  const known = new Set(units.map((u) => u.id));
  for (const id of [...paragraphBindings.keys(), ...displayBindings.keys()])
    if (!known.has(id)) problems.push(`${paper} binds ${id}, which is not a manifest unit`);

  return {
    paper,
    paragraphs: { bound: paragraphsBound, declared: paragraphsDeclared, of: paragraphs.length },
    displays: { bound: displaysBound, of: displays.length },
    obligations: { resolved: obligationsResolved, of: obligations.length },
    problems,
  };
}

/**
 * "mass-energy: 14 of 14 paragraphs bound, 7 of 7 printed displays bound or declared, ...", with
 * the paragraphs declared unexplained named beside the bound ones when there are any.
 */
export const reportLine = (r: BindingReport): string =>
  `${r.paper}: ${r.paragraphs.bound} of ${r.paragraphs.of} paragraphs bound${
    r.paragraphs.declared > 0 ? `, ${r.paragraphs.declared} declared ${PARAGRAPH_STATUS}` : ""
  }, ${r.displays.bound} of ${r.displays.of} printed displays bound or declared, ${r.obligations.resolved} of ${r.obligations.of} obligations resolved`;

export type ParagraphBinding = Readonly<{
  unit: string;
  passages: readonly string[];
  r0: string;
  /**
   * "Paragraph 6" or "Footnote 2", counted in printed order, for a paper printed without sections
   * (mass-energy); "§4, paragraph 7" or "Introduction, paragraph 2", counted within each part, for
   * a paper with sections, where a count across the whole paper would tell a reader nothing.
   */
  label: string;
  /** Declared: no passage explains this paragraph yet, so it links to none. */
  unexplained: boolean;
}>;

/**
 * The paper's paragraph bindings in printed order, with a reader-facing label for each, or null
 * when it has none. The renderer's view of content/bindings/<paper>.yaml; checkParagraphBindings
 * is what makes the build refuse a bad one.
 */
export function loadParagraphBindings(
  root: string,
  paper: string,
): readonly ParagraphBinding[] | null {
  const file = join(root, "content", "bindings", `${paper}.yaml`);
  if (!existsSync(file)) return null;
  const raw = parseYaml(readFileSync(file, "utf8")) as { paragraphs?: Paragraph[] } | null;
  const entries = (raw?.paragraphs ?? []).filter(
    (p): p is Paragraph & { unit: string } => typeof p.unit === "string",
  );
  const partOf = (unit: string) => /^(s\d+)-/.exec(unit)?.[1] ?? "s0";
  const sectioned = entries.some((p) => partOf(p.unit) !== "s0");
  const counts = new Map<string, number>();
  return entries.map((p) => {
    const footnote = /-fn\d+$/.test(p.unit);
    const part = sectioned ? partOf(p.unit) : "";
    const key = `${part}:${footnote ? "fn" : "p"}`;
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    const kind = footnote ? "footnote" : "paragraph";
    const label = !sectioned
      ? `${footnote ? "Footnote" : "Paragraph"} ${n}`
      : `${part === "s0" ? "Introduction" : `§${part.slice(1)}`}, ${kind} ${n}`;
    return {
      unit: p.unit,
      passages: strings(p.passages),
      r0: typeof p.r0 === "string" ? p.r0.trim() : "",
      label,
      unexplained: p.status === PARAGRAPH_STATUS,
    };
  });
}
