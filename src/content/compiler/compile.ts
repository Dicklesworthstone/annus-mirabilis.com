import type { EquationRecord } from "../../equations/record.ts";
import { ContentError, parseContentJson } from "./json.ts";
import { READING_IDS, validateReadingRecord, type ReadingRecord, type Paper, type Argument, type Foundation, type Citation, type Block } from "../schemas/reading.ts";
export type Diagnostic = Readonly<{ severity: "error" | "review"; code: string; path: string; message: string }>;
export type PaperPayload = Readonly<{ schemaVersion: 1; paper: Paper; arguments: readonly Argument[]; foundations: readonly Foundation[]; citations: readonly Citation[]; equations: readonly EquationRecord[] }>;
const routes = [
  { pattern: /^equations\/([a-z0-9-]+)\/([a-z0-9-]+)\.json$/, kind: "equation" },
  { pattern: /^papers\/([a-z0-9-]+)\.json$/, kind: "paper" },
  { pattern: /^arguments\/([a-z0-9-]+)\/([a-z0-9-]+)\.json$/, kind: "argument" },
  { pattern: /^foundations\/([a-z0-9-]+)\.json$/, kind: "foundation" },
  { pattern: /^bibliography\/([a-z0-9-]+)\.json$/, kind: "citation" },
] as const;
export function compileReadingContent(files: readonly Readonly<{ path: string; text: string }>[]) {
  const diagnostics: Diagnostic[] = [], records = new Map<string, ReadingRecord>();
  const issue = (code: string, path: string, message: string) => diagnostics.push({ severity: "error", code, path, message });
  const paths = new Set<string>();
  for (const file of [...files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)) {
    if (paths.has(file.path)) { issue("duplicate-path", file.path, "A content file was supplied more than once."); continue; } paths.add(file.path);
    try {
      const route = routes.find(r => r.pattern.test(file.path));
      if (!route) throw new ContentError("unrouted-content", file.path, "No schema owns this path. The preview admits JSON records only.");
      const record = validateReadingRecord(parseContentJson(file.text, file.path), file.path);
      const match = route.pattern.exec(file.path)!;
      if (record.kind !== route.kind || record.id !== match[match.length - 1] || (["argument", "equation"].includes(record.kind) && "paper" in record && record.paper !== match[1])) throw new ContentError("path-identity", file.path, "Record identity disagrees with its file path.");
      if (records.has(record.id)) { issue("duplicate-id", file.path, `Duplicate id: ${record.id}.`); continue; }
      records.set(record.id, record);
    } catch (e) { if (!(e instanceof ContentError)) throw e; issue(e.code, e.path, e.message); }
  }
  const ref = (id: string, kind: ReadingRecord["kind"], from: string) => {
    const r = records.get(id); if (r?.kind !== kind) issue("dangling-reference", from, `Expected ${kind}: ${id}.`); return r;
  };
  const foundationRefs = (blocks: readonly Block[], from: string) => { for (const b of blocks) if (b.kind === "foundation") ref(b.id, "foundation", from); };
  const claimed = new Set<string>();
  for (const r of records.values()) {
    if (r.kind === "paper") {
      ref(r.citation, "citation", r.id); const anchors = new Set<string>();
      for (const s of r.sections) {
        if (anchors.has(s.id) || !/^s\d+$/.test(s.id)) issue("section-id", r.id, `Invalid or duplicate section: ${s.id}.`); anchors.add(s.id);
        for (const a of s.arguments) {
          const arg = ref(a, "argument", r.id);
          if (claimed.has(a)) issue("duplicate-placement", r.id, `Argument appears more than once: ${a}.`); claimed.add(a);
          if (arg?.kind === "argument" && (arg.paper !== r.id || arg.section !== s.id)) issue("section-mismatch", a, "Argument belongs to a different paper or section.");
        }
      }
    }
    if (r.kind === "equation") {
      ref(r.paper, "paper", r.id); const argument = ref(r.argument, "argument", r.id);
      if (argument?.kind === "argument" && argument.paper !== r.paper) issue("equation-placement", r.id, "Equation belongs to a different paper.");
      for (const note of r.notes) ref(note.foundation, "foundation", r.id);
      diagnostics.push({ severity: "review", code: "equation-review-pending", path: r.id, message: "Modern teaching equation; historical notation and editorial review are not claimed." });
    }
    if (r.kind === "argument" || r.kind === "foundation") {
      for (const c of r.citations) ref(c, "citation", r.id);
      diagnostics.push({ severity: "review", code: "editorial-review-pending", path: r.id, message: "Authored explanation; no human review is claimed." });
    }
    if (r.kind === "argument") {
      ref(r.paper, "paper", r.id);
      for (const p of r.prerequisites) ref(p.id, "argument", r.id);
      for (const id of Object.values(r.help)) ref(id, "foundation", r.id);
      for (const reading of READING_IDS) foundationRefs(r.readings[reading], r.id);
      for (const id of r.experiments) if (!["bm-01", "bm-05", "bm-06", "bm-07"].includes(id)) issue("unavailable-experiment", r.id, `No implemented preview route for ${id}.`);
    }
    if (r.kind === "foundation") {
      for (const p of r.prerequisites) ref(p, "foundation", r.id);
      foundationRefs([...r.explanation, ...r.example], r.id);
    }
  }
  for (const r of records.values()) if (r.kind === "argument" && !claimed.has(r.id)) issue("orphan-argument", r.id, "Argument is absent from its paper's outline.");
  const done = new Set<string>(), active = new Set<string>();
  function visit(id: string): void {
    if (active.has(id)) { issue("prerequisite-cycle", id, "A prerequisite cannot depend on its own conclusion."); return; }
    if (done.has(id)) return;
    const r = records.get(id); if (!r) return; active.add(id);
    const edges = r.kind === "foundation" ? [...r.prerequisites, ...[...r.explanation, ...r.example].filter((b): b is Extract<Block, { kind: "foundation" }> => b.kind === "foundation").map(b => b.id)] : r.kind === "argument" ? r.prerequisites.filter(p => p.edge === "premise").map(p => p.id) : [];
    edges.forEach(visit); active.delete(id); done.add(id);
  }
  for (const id of records.keys()) visit(id);
  const papers: PaperPayload[] = [];
  if (!diagnostics.some(d => d.severity === "error")) for (const paper of records.values()) if (paper.kind === "paper") {
    const args = paper.sections.flatMap(s => s.arguments.map(id => records.get(id) as Argument));
    const needed = new Set<string>();
    function add(id: string): void { if (needed.has(id)) return; needed.add(id); const f = records.get(id) as Foundation; f.prerequisites.forEach(add); for (const b of [...f.explanation, ...f.example]) if (b.kind === "foundation") add(b.id); }
    for (const a of args) { Object.values(a.help).forEach(add); for (const reading of READING_IDS) for (const b of a.readings[reading]) if (b.kind === "foundation") add(b.id); }
    const equations = [...records.values()].filter((r): r is EquationRecord => r.kind === "equation" && r.paper === paper.id);
    for (const equation of equations) equation.notes.forEach(note => add(note.foundation));
    const foundations = [...needed].sort().map(id => records.get(id) as Foundation);
    const citations = [...new Set([paper.citation, ...args.flatMap(a => a.citations), ...foundations.flatMap(f => f.citations)])].sort().map(id => records.get(id) as Citation);
    papers.push({ schemaVersion: 1, paper, arguments: args, foundations, citations, equations });
  }
  return { ok: !diagnostics.some(d => d.severity === "error"), diagnostics, papers, foundations: [...records.values()].filter((r): r is Foundation => r.kind === "foundation") };
}
