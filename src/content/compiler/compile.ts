/**
 * Content Compilation Entry Point.
 * Provides both synchronous `compileReadingContent` for fast tests/in-memory builds
 * and full async `compileContent` with plugin checks and review queue generation.
 *
 * Spec: AGENTS.md and am-cm-compiler-core-oa7
 */

import { checkMissingStepContent } from "../../equations/missingStep/contentCheck.ts";
import type { EquationRecord } from "../../equations/record.ts";
import { REGISTERED_IDS } from "../../experiments/catalogue.ts";
import { validateEntranceRecord } from "../entrances/entranceRecord.ts";
import {
  type Argument,
  type Block,
  type Citation,
  extensionSectionsByLesson,
  type Foundation,
  type FoundationExtension,
  foundationExtensionIssues,
  type Paper,
  READING_IDS,
  type ReadingRecord,
  validateFoundationExtension,
  validateReadingRecord,
} from "../schemas/reading.ts";
import { type CompileResult, type CompilerOptions, compileContent } from "./compiler.ts";
import { ContentError, checkFileSize, checkNfc, parseContentFile } from "./loaders.ts";
import { checkMisconceptionRecord } from "./marginRecords.ts";
import { matchContentRoute } from "./routes.ts";

export type Diagnostic = Readonly<{
  severity: "error" | "review" | "flag";
  code: string;
  path: string;
  message: string;
  family?: string | undefined;
  checkId?: string | undefined;
  beadId?: string | undefined;
  file?: string | undefined;
  recordId?: string | undefined;
  rule?: string | undefined;
  repair?: string | undefined;
  flaggedText?: string | undefined;
  contentHash?: string | undefined;
  fingerprint?: string | undefined;
}>;

export type PaperPayload = Readonly<{
  schemaVersion: 1;
  paper: Paper;
  arguments: readonly Argument[];
  foundations: readonly Foundation[];
  citations: readonly Citation[];
  equations: readonly EquationRecord[];
}>;

export { type CompileResult, type CompilerOptions, compileContent };

interface RawQuantityRecord {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  dimensionStatus?: unknown;
  dimension?: unknown;
  mathematicalKind?: unknown;
  frame?: unknown;
}

interface RawLegacySpellingRecord {
  spelling?: unknown;
  canonicalIds?: unknown;
}

/**
 * Synchronous compiler for reading content records, outlines, and foundations.
 * Supports JSON, YAML, allowlisted documentation files, quantity validation, and full error aggregation.
 */
export function compileReadingContent(files: readonly Readonly<{ path: string; text: string }>[]): {
  ok: boolean;
  diagnostics: Diagnostic[];
  papers: PaperPayload[];
  foundations: Foundation[];
  /** The foundation lessons' equation records, which belong to no paper payload. */
  foundationEquations: EquationRecord[];
} {
  const diagnostics: Diagnostic[] = [];
  const records = new Map<string, ReadingRecord>();
  const issue = (code: string, path: string, message: string) =>
    diagnostics.push({ severity: "error", code, path, message });

  const paths = new Set<string>();
  const registeredQuantityIds = new Set<string>();
  const legacySpellings: { path: string; records: RawLegacySpellingRecord[] }[] = [];
  const extensions: { path: string; extension: FoundationExtension }[] = [];

  for (const file of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    if (paths.has(file.path)) {
      issue("duplicate-path", file.path, "A content file was supplied more than once.");
      continue;
    }
    paths.add(file.path);

    try {
      checkNfc(file.text, file.path);
      checkFileSize(new TextEncoder().encode(file.text).length, file.path);

      const routeMatch = matchContentRoute(file.path);
      if (!routeMatch) {
        issue(
          "unrouted-content",
          file.path,
          `No schema owns this path: '${file.path}'. The content compiler rejects unrouted files.`,
        );
        continue;
      }

      // Documentation files (e.g. README.md) are allowlisted and skipped from reading records
      if (
        routeMatch.kind === "derivation-chain" ||
        routeMatch.kind === "derivation-policy" ||
        routeMatch.kind === "documentation" ||
        routeMatch.kind === "frozen-id-snapshot" ||
        routeMatch.kind === "source-manifest" ||
        routeMatch.kind === "source-block" ||
        routeMatch.kind === "aliases" ||
        routeMatch.kind === "paragraph-bindings" ||
        routeMatch.kind === "display-terms"
      ) {
        continue;
      }

      // Extension sections: checked here, and against the lessons they extend after the loop.
      if (routeMatch.kind === "foundation-extension") {
        const extension = validateFoundationExtension(parseContentFile(file), file.path);
        // Reported as the loop reports a duplicate id, rather than as a second throw of
        // path-identity in this file; foundationExtension.test.ts exercises it.
        if (extension.id !== routeMatch.params.id) {
          issue("path-identity", file.path, "Record identity disagrees with its file path.");
          continue;
        }
        extensions.push({ path: file.path, extension });
        continue;
      }

      // Editorial rules / reviews / owners / overrides
      if (
        routeMatch.kind === "flag-reviews" ||
        routeMatch.kind === "readings-owner" ||
        routeMatch.kind === "editorial-rules" ||
        routeMatch.kind === "editorial-overrides"
      ) {
        parseContentFile(file);
        continue;
      }

      // Entrance records
      if (routeMatch.kind === "entrance") {
        const parsed = parseContentFile(file);
        validateEntranceRecord(parsed, file.path);
        continue;
      }

      // Misconceptions carry their own schema, and until 2026-09-24 this compiler rejected every
      // one as an unknown reading record, so none could exist. Each is checked against its schema
      // and its path here. Editorial notes are admitted as the production compiler admits them;
      // why they are not checked here is in marginRecords.ts. Neither joins the reading payload:
      // the paper page reads them itself (src/reader/marginRecords.ts).
      if (routeMatch.kind === "misconception") {
        checkMisconceptionRecord(parseContentFile(file), file.path, routeMatch.params);
        continue;
      }
      if (routeMatch.kind === "editorial-note") {
        parseContentFile(file);
        continue;
      }

      // Quantities YAML records
      if (routeMatch.kind === "quantity") {
        const parsed = parseContentFile(file);
        const matchParams = routeMatch.params;

        if (matchParams.slug === "legacy-spellings") {
          if (Array.isArray(parsed)) {
            legacySpellings.push({ path: file.path, records: parsed as RawLegacySpellingRecord[] });
          }
          continue;
        }

        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (!item || typeof item !== "object") {
              issue("invalid-quantity", file.path, "Quantity item must be an object.");
              continue;
            }
            const q = item as RawQuantityRecord;
            if (typeof q.id !== "string" || !/^[a-z][a-zA-Z0-9]*$/.test(q.id)) {
              issue(
                "invalid-quantity",
                file.path,
                `Invalid quantity id: ${JSON.stringify(q.id)}. Must be lowerCamelCase.`,
              );
              continue;
            }
            if (registeredQuantityIds.has(q.id)) {
              issue("duplicate-id", file.path, `Duplicate quantity id: "${q.id}".`);
              continue;
            }
            registeredQuantityIds.add(q.id);
          }
        }
        continue;
      }

      const parsed = parseContentFile(file);
      const record = validateReadingRecord(parsed, file.path);
      const matchParams = routeMatch.params;

      if (
        record.kind !== routeMatch.kind ||
        record.id !== (matchParams.id ?? matchParams.slug) ||
        ((record.kind === "argument" || record.kind === "equation") &&
          "paper" in record &&
          record.paper !== matchParams.paper)
      ) {
        throw new ContentError(
          "path-identity",
          file.path,
          "Record identity disagrees with its file path.",
        );
      }

      if (records.has(record.id)) {
        issue("duplicate-id", file.path, `Duplicate id: ${record.id}.`);
        continue;
      }
      records.set(record.id, record);
    } catch (e) {
      if (e instanceof ContentError) {
        issue(e.code, e.path, e.message);
      } else if (e instanceof Error) {
        issue("invalid-content", file.path, e.message);
      } else {
        throw e;
      }
    }
  }

  const foundationIds = new Set(
    [...records.values()].filter((r) => r.kind === "foundation").map((r) => r.id),
  );
  for (const found of foundationExtensionIssues(extensions, foundationIds))
    issue(found.code, found.path, found.message);
  for (const [lesson, sections] of extensionSectionsByLesson(extensions)) {
    const target = records.get(lesson);
    if (target?.kind === "foundation")
      records.set(lesson, { ...target, extensionSections: sections });
  }

  // Validate legacy-spellings against registered quantity IDs
  for (const group of legacySpellings) {
    for (const item of group.records) {
      const spelling = typeof item.spelling === "string" ? item.spelling : "";
      const canonicalIds = Array.isArray(item.canonicalIds) ? (item.canonicalIds as string[]) : [];

      if (registeredQuantityIds.has(spelling)) {
        issue(
          "legacy-spelling-as-id",
          group.path,
          `Legacy spelling "${spelling}" collides with a registered quantity id.`,
        );
      }

      for (const canonId of canonicalIds) {
        if (!registeredQuantityIds.has(canonId)) {
          issue(
            "legacy-spelling-unresolved",
            group.path,
            `Legacy spelling "${spelling}" references unregistered canonical id "${canonId}".`,
          );
        }
      }
    }
  }

  const ref = (id: string, kind: ReadingRecord["kind"], from: string) => {
    const r = records.get(id);
    if (r?.kind !== kind) issue("dangling-reference", from, `Expected ${kind}: ${id}.`);
    return r;
  };

  const foundationRefs = (blocks: readonly Block[], from: string) => {
    for (const b of blocks) if (b.kind === "foundation") ref(b.id, "foundation", from);
  };

  const claimed = new Set<string>();
  for (const r of records.values()) {
    if (r.kind === "paper") {
      ref(r.citation, "citation", r.id);
      const anchors = new Set<string>();
      for (const s of r.sections) {
        if (anchors.has(s.id) || !/^s\d+$/.test(s.id))
          issue("section-id", r.id, `Invalid or duplicate section: ${s.id}.`);
        anchors.add(s.id);
        for (const a of s.arguments) {
          const arg = ref(a, "argument", r.id);
          if (claimed.has(a))
            issue("duplicate-placement", r.id, `Argument appears more than once: ${a}.`);
          claimed.add(a);
          if (arg?.kind === "argument" && (arg.paper !== r.id || arg.section !== s.id))
            issue("section-mismatch", a, "Argument belongs to a different paper or section.");
        }
      }
    }
    if (r.kind === "equation") {
      if (r.paper === "foundations") {
        // A lesson's record names the lesson it belongs to where a paper's names an argument.
        ref(r.argument, "foundation", r.id);
      } else {
        ref(r.paper, "paper", r.id);
        const argument = ref(r.argument, "argument", r.id);
        if (argument?.kind === "argument" && argument.paper !== r.paper)
          issue("equation-placement", r.id, "Equation belongs to a different paper.");
      }
      for (const note of r.notes) ref(note.foundation, "foundation", r.id);
      diagnostics.push({
        severity: "review",
        code: "equation-review-pending",
        path: r.id,
        message:
          "Modern teaching equation; historical notation and editorial review are not claimed.",
      });
    }
    if (r.kind === "argument" || r.kind === "foundation") {
      for (const c of r.citations) ref(c, "citation", r.id);
      diagnostics.push({
        severity: "review",
        code: "editorial-review-pending",
        path: r.id,
        message: "Authored explanation; no human review is claimed.",
      });
    }
    if (r.kind === "argument") {
      ref(r.paper, "paper", r.id);
      for (const p of r.prerequisites) ref(p.id, "argument", r.id);
      for (const id of Object.values(r.help)) ref(id, "foundation", r.id);
      for (const reading of READING_IDS) foundationRefs(r.readings[reading], r.id);
      // A formula that names equation records is shown AS those records, so each must exist and
      // belong to this argument: another argument's equation would put the wrong claim in place.
      for (const reading of READING_IDS)
        for (const b of r.readings[reading])
          if (b.kind === "formula")
            for (const eq of b.equations ?? []) {
              const record = ref(eq, "equation", r.id);
              if (record?.kind === "equation" && record.argument !== r.id)
                issue(
                  "formula-equation-placement",
                  r.id,
                  `Formula names ${eq}, an equation of ${record.argument}.`,
                );
            }
      for (const id of r.experiments)
        if (!(REGISTERED_IDS as readonly string[]).includes(id))
          issue("unavailable-experiment", r.id, `No implemented preview route for ${id}.`);
    }
    if (r.kind === "foundation") {
      for (const p of r.prerequisites) {
        const pId = typeof p === "string" ? p : p.foundationId.replace(/^foundation:/, "");
        ref(pId, "foundation", r.id);
      }
      foundationRefs([...r.explanation, ...r.example], r.id);
      // As in an argument: a lesson's formula is shown AS the records it names, so each must be a
      // record of this lesson, never a paper's equation or another lesson's.
      for (const b of [...r.explanation, ...r.example])
        if (b.kind === "formula")
          for (const eq of b.equations ?? []) {
            const record = ref(eq, "equation", r.id);
            if (
              record?.kind === "equation" &&
              (record.paper !== "foundations" || record.argument !== r.id)
            )
              issue(
                "formula-equation-placement",
                r.id,
                `Formula names ${eq}, an equation of ${record.argument}.`,
              );
          }
    }
  }

  for (const r of records.values())
    if (r.kind === "argument" && !claimed.has(r.id))
      issue("orphan-argument", r.id, "Argument is absent from its paper's outline.");

  const done = new Set<string>();
  const active = new Set<string>();
  function visit(id: string): void {
    if (active.has(id)) {
      issue("prerequisite-cycle", id, "A prerequisite cannot depend on its own conclusion.");
      return;
    }
    if (done.has(id)) return;
    const r = records.get(id);
    if (!r) return;
    active.add(id);
    const edges =
      r.kind === "foundation"
        ? [
            ...r.prerequisites
              .filter((p) => typeof p === "string" || p.kind === "proof-edge")
              .map((p) => (typeof p === "string" ? p : p.foundationId.replace(/^foundation:/, ""))),
            ...[...r.explanation, ...r.example]
              .filter((b): b is Extract<Block, { kind: "foundation" }> => b.kind === "foundation")
              .map((b) => b.id),
          ]
        : r.kind === "argument"
          ? r.prerequisites.filter((p) => p.edge === "premise").map((p) => p.id)
          : [];
    edges.forEach(visit);
    active.delete(id);
    done.add(id);
  }

  for (const id of records.keys()) visit(id);

  for (const diagnostic of checkMissingStepContent(
    files,
    [...records.values()].filter((record) => record.kind === "argument").map((record) => record.id),
  ))
    issue(diagnostic.code, diagnostic.path, diagnostic.message);

  const papers: PaperPayload[] = [];
  if (!diagnostics.some((d) => d.severity === "error"))
    for (const paper of records.values())
      if (paper.kind === "paper") {
        const args = paper.sections.flatMap((s) =>
          s.arguments.map((id) => records.get(id) as Argument),
        );
        const needed = new Set<string>();
        function add(id: string): void {
          if (needed.has(id)) return;
          needed.add(id);
          const f = records.get(id) as Foundation;
          if (f) {
            f.prerequisites.forEach((p) => {
              const pId = typeof p === "string" ? p : p.foundationId.replace(/^foundation:/, "");
              add(pId);
            });
            for (const b of [...f.explanation, ...f.example])
              if (b.kind === "foundation") add(b.id);
          }
        }
        for (const a of args) {
          Object.values(a.help).forEach(add);
          for (const reading of READING_IDS)
            for (const b of a.readings[reading]) if (b.kind === "foundation") add(b.id);
        }
        const equations = [...records.values()].filter(
          (r): r is EquationRecord => r.kind === "equation" && r.paper === paper.id,
        );
        for (const equation of equations) {
          for (const note of equation.notes) {
            add(note.foundation);
          }
        }
        const foundations = [...needed].sort().map((id) => records.get(id) as Foundation);
        const citations = [
          ...new Set([
            paper.citation,
            ...args.flatMap((a) => a.citations),
            ...foundations.flatMap((f) => f.citations),
          ]),
        ]
          .sort()
          .map((id) => records.get(id) as Citation);
        papers.push({
          schemaVersion: 1,
          paper,
          arguments: args,
          foundations,
          citations,
          equations,
        });
      }

  return {
    ok: !diagnostics.some((d) => d.severity === "error"),
    diagnostics,
    papers,
    foundations: [...records.values()].filter((r): r is Foundation => r.kind === "foundation"),
    foundationEquations: [...records.values()].filter(
      (r): r is EquationRecord => r.kind === "equation" && r.paper === "foundations",
    ),
  };
}
