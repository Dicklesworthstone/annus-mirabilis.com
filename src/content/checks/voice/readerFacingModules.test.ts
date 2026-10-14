/**
 * THE READER-FACING .ts MODULES THE VOICE LINT HAS NEVER OPENED (am-dbpk).
 *
 * `componentText.ts`'s walk takes a file only when it ends in `.tsx`, and its extraction is
 * JSX-specific: run `extractStringsFromTsx` over `src/experiments/bm05/definition.ts` and it
 * returns ZERO strings, so widening the file filter alone would change nothing. Reader-facing
 * prose also lives in `.ts` object literals, and none of it had ever been judged.
 *
 * THE POPULATION IS DECLARED, NOT "every .ts file". A sweep of the whole tree counts schema
 * validation messages and gate output no reader sees; an earlier measurement of "17,113 strings in
 * 1,031 files" was a right count of the wrong population, with `experiment.ts` alone contributing
 * 469. The defensible population is the modules that render to readers: each experiment's
 * `definition.ts`, the `*Shelf.ts` card sets, and the embed catalogue. 42 modules today.
 *
 * WHY THIS LIVES IN A TEST RATHER THAN IN THE CHECK. Wiring a second extraction path into
 * `checkVoice`'s registered check is a larger change with a reader-facing severity question in it
 * (below). This file is a gate in the meantime: it runs in the bun lane, which dsr's `checks` list
 * runs, so a regression fails a gated lane rather than waiting for that work. The extraction is
 * kept here deliberately instead of in a new module, because a module whose only importer is its
 * own test is the orphan shape this repository already has three ratchets for.
 *
 * WHAT IT FOUND ON ITS FIRST RUN, all six errors adjudicated one at a time:
 *
 *   4 em-dash    ALL QUOTATIONS, and not defects. Every one is inside a shelf card's `matched`
 *                field, which holds a verbatim transcription of a journal page: Poynting 1884
 *                ("Received December 17, 1883,—Read January 10, 1884."), Michelson and Morley 1887
 *                ("Art. XXXVI.—On the Relative Motion..."), Lorentz 1904 and de Sitter 1913. The
 *                em dash is the 19th-century compositor's, and AGENTS.md's rule governs the site's
 *                own prose. They are exempt STRUCTURALLY, by the layer their key implies, rather
 *                than by an allowlist of strings: `quotationExempt: true` is already on the rule,
 *                and this is the same reasoning matchers.ts gives for why a content record carries
 *                no heading element.
 *   1 ascii-dash A REAL DEFECT, and the reason this gate is worth having.
 *                src/experiments/sr01/definition.ts's `separatingAssumption` read "...the frame
 *                doing the judging -- but the same light-signal procedure...". That string is
 *                rendered by PredictPanel.tsx and is present in two built JS chunks, so a reader
 *                saw it. Repaired in the same commit as this file's arrival.
 *   1 overclaim  A FALSE POSITIVE, and NOT judged here. See the exclusion below.
 */

import { expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { checkVoice } from "./index.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

/**
 * Keys whose values are identifiers, paths or enum tokens rather than prose.
 *
 * This is a key-name filter and not a content filter, which matters: it decides what a string IS
 * from where it sits, so a prose field can never be excluded by what it happens to say.
 */
const NON_PROSE_KEYS: ReadonlySet<string> = new Set([
  "id",
  "slug",
  "key",
  "kind",
  "href",
  "url",
  "path",
  "module",
  "quantityId",
  "kernelFunction",
  "exportName",
  "fnName",
  "revision",
  "capabilityId",
  "instrumentId",
  "experimentId",
  "paper",
  "section",
  "anchor",
  "argumentId",
  "equationId",
  "unit",
  "units",
  "language",
  "lang",
  "code",
  "digest",
  "sourceDigest",
  "tapeId",
  "mode",
  "status",
  "severity",
  "owner",
  "beadId",
]);

/**
 * Keys whose value is a TRANSCRIPTION of a source, so the layer is `quotation`.
 *
 * `matched` on a shelf card is the quoted page text a card was verified against. Marking it by KEY
 * is what keeps the four 19th-century em dashes structurally out of reach of a rule about the
 * site's own voice, rather than listing four strings that would go stale the next time a card is
 * re-verified.
 */
const QUOTATION_KEYS: ReadonlySet<string> = new Set(["matched"]);

/**
 * EMPTY, AND THE EXEMPTION IT HELD IS RETIRED RATHER THAN RENUMBERED (2026-10-14).
 *
 * It held `overclaim`, excluded for ONE finding: `src/experiments/sr05/definition.ts`'s R3 reading
 * said Einstein "proved it for a path made of straight pieces and assumed it for a curve". That
 * sentence draws the distinction between a proof and an assumption, which is the opposite of an
 * overclaim, and the rule fired because `isDirectlyNegated` looks BACKWARD 40 characters for a
 * hedge while this one follows. The exclusion's own note said that rewording accurate historical
 * prose to satisfy a lint would be the wrong repair, and it was right.
 *
 * The sentence was not reworded to satisfy the lint. It was corrected to match its own editorial
 * record: 27a1cc43b changed that word to "derived" on 2026-10-11 in
 * `content/editorial/readings-owners/am-sr-05-moving-clocks-2zka.yaml`, for the stated reason that
 * "proved" is "the wrong half of the project own vocabulary", and the rendered copy never got it.
 * 880063cf5 carried the correction into the copy a reader sees. The finding went with it, which is
 * a side effect rather than the purpose.
 *
 * So this population now holds zero `overclaim` errors and the rule is judged like every other
 * one. The set is KEPT as an empty set rather than deleted, which is this repository idiom (see
 * `JOURNEY_FINDINGS_NOT_YET_AUDITABLE` in verify-content.ts): the code reading it then asserts
 * zero instead of disappearing, and re-introducing an exclusion has to be done visibly.
 *
 * `isDirectlyNegated`'s backward-only window is untouched and is still a real defect, owned by
 * am-dbpk. Nothing here depends on it any more.
 */
const NOT_YET_JUDGED: ReadonlySet<string> = new Set([]);

function readerFacingModules(): string[] {
  const out: string[] = [];
  const experiments = join(ROOT, "src/experiments");
  for (const entry of readdirSync(experiments)) {
    const definition = join(experiments, entry, "definition.ts");
    try {
      if (statSync(definition).isFile()) out.push(definition);
    } catch {
      // Not every experiment directory carries a definition module.
    }
  }
  for (const entry of readdirSync(join(ROOT, "src/content"))) {
    if (/Shelf\.ts$/.test(entry)) out.push(join(ROOT, "src/content", entry));
  }
  const catalogue = join(ROOT, "src/experiments/embed/catalogue.ts");
  if (statSync(catalogue).isFile()) out.push(catalogue);
  return out.sort();
}

type ProseString = {
  readonly file: string;
  readonly key: string;
  readonly text: string;
  /** The `id` of the record this string sits in, where one is in scope. */
  readonly recordId: string;
};

/**
 * The `id` of the nearest enclosing object literal.
 *
 * This exists because `quotationExempt` is NOT satisfied by the layer alone:
 * `source.layer === "quotation" && !!source.attribution`. A quotation has to NAME its source, which
 * is the same attribution discipline AGENTS.md applies to Einstein's own words. So a transcription
 * is exempt only once this says WHICH card it was transcribed for, and a `matched` field on a
 * record with no id stays judged as the site's own prose.
 */
function enclosingRecordId(node: ts.Node): string {
  for (let current: ts.Node | undefined = node; current; current = current.parent) {
    if (!ts.isObjectLiteralExpression(current)) continue;
    for (const property of current.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const name = ts.isIdentifier(property.name)
        ? property.name.text
        : ts.isStringLiteral(property.name)
          ? property.name.text
          : "";
      if (name !== "id") continue;
      const value = property.initializer;
      if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text;
    }
  }
  return "";
}

/** Every string-literal property value whose key can hold prose. */
function proseStrings(file: string): ProseString[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const out: ProseString[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node)) {
      const name = ts.isIdentifier(node.name)
        ? node.name.text
        : ts.isStringLiteral(node.name)
          ? node.name.text
          : "";
      const init = node.initializer;
      if (
        name &&
        !NON_PROSE_KEYS.has(name) &&
        (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init))
      ) {
        out.push({
          file: file.slice(ROOT.length + 1),
          key: name,
          text: init.text,
          recordId: enclosingRecordId(node),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

/** 45 characters is the threshold an earlier measurement on this bead settled on for prose. */
const PROSE_MIN = 45;

function judged() {
  const modules = readerFacingModules();
  const strings = modules.flatMap(proseStrings).filter((s) => s.text.trim().length >= PROSE_MIN);
  const findings = strings.flatMap((item) =>
    checkVoice(item.text, {
      context: "prose",
      ...(QUOTATION_KEYS.has(item.key) && item.recordId
        ? { source: { layer: "quotation" as const, attribution: item.recordId } }
        : {}),
    }).map((finding) => ({ item, finding })),
  );
  return { modules, strings, findings };
}

test("the population is real and printed beside the verdict", () => {
  const { modules, strings } = judged();
  console.log(
    `[voice .ts modules] ${modules.length} reader-facing modules; ${strings.length} prose strings of ${PROSE_MIN}+ characters judged`,
  );
  // A walk that found nothing would make every assertion below pass over an empty set, which is
  // the shape this repository has a rule about. The floor is well under the measured 42 so a
  // removed experiment does not fail it, and well over zero.
  expect(modules.length).toBeGreaterThanOrEqual(30);
  expect(strings.length).toBeGreaterThanOrEqual(400);
});

test("no reader-facing .ts module carries a voice ERROR", () => {
  const { findings } = judged();
  const errors = findings
    .filter(({ finding }) => finding.severity === "error" && !NOT_YET_JUDGED.has(finding.rule))
    .map(
      ({ item, finding }) =>
        `${item.file} [${item.key}] ${finding.rule}: ${JSON.stringify(finding.matchedText)} in ${JSON.stringify(item.text.slice(0, 90))}`,
    );
  expect(errors).toEqual([]);
});

test("the quotation layer is load-bearing, not decoration", () => {
  // The four 19th-century em dashes are exempt BECAUSE their key marks a transcription. Without
  // that layer they are errors, so this asserts the mechanism rather than trusting it: if the
  // QUOTATION_KEYS entry were dropped, the test above would go red and this one explains why.
  const { strings } = judged();
  const transcriptions = strings.filter((s) => QUOTATION_KEYS.has(s.key));
  expect(transcriptions.length).toBeGreaterThan(0);
  const asSiteProse = transcriptions.flatMap((s) =>
    checkVoice(s.text, { context: "prose" }).filter((f) => f.severity === "error"),
  );
  // Every transcription must name its record, or it cannot be exempt at all.
  expect(transcriptions.every((s) => s.recordId.length > 0)).toBe(true);
  const asQuotation = transcriptions.flatMap((s) =>
    checkVoice(s.text, {
      context: "prose",
      source: { layer: "quotation", attribution: s.recordId },
    }).filter((f) => f.severity === "error"),
  );
  // THE LAYER ALONE IS NOT ENOUGH, which is the part worth pinning: without an attribution the
  // exemption does not apply, so a transcription that named no source would stay judged.
  const withoutAttribution = transcriptions.flatMap((s) =>
    checkVoice(s.text, { context: "prose", source: { layer: "quotation" } }).filter(
      (f) => f.severity === "error",
    ),
  );
  expect(withoutAttribution.length).toBeGreaterThan(0);
  expect(asSiteProse.length).toBeGreaterThan(0);
  expect(asQuotation).toEqual([]);
});

test("PLANTED: the real defect this gate was written for is caught", () => {
  // The exact string that shipped in sr01/definition.ts before this bead's repair. Planted as a
  // literal rather than by editing the file back, so the plant cannot be left in the tree.
  const shipped =
    "That would hold only if simultaneity itself did not depend on the frame doing the judging -- but the same light-signal procedure, applied by observers in relative motion, assigns different remote times to the same pair of events.";
  const errors = checkVoice(shipped, { context: "prose" }).filter((f) => f.severity === "error");
  expect(errors.map((f) => f.rule)).toContain("ascii-dash");
  // And the repaired text is clean, so the gate is not simply refusing that sentence.
  const repaired = shipped.replace(" -- but ", ". But ");
  expect(checkVoice(repaired, { context: "prose" }).filter((f) => f.severity === "error")).toEqual(
    [],
  );
});

test("no rule is excluded from this population, and overclaim in particular is judged", () => {
  // This asserted `excluded.length === 1`, the one overclaim finding the exclusion was written
  // for, under a comment reading "Fewer means it is being paid down and the number should come
  // with it." It was paid down; the NOT_YET_JUDGED docblock says how. The number comes with it as
  // zero, and the assertion is now about the exclusion being EMPTY rather than about its size, so
  // paying a debt down can never again turn this red.
  expect([...NOT_YET_JUDGED]).toEqual([]);
  const { findings } = judged();
  const excluded = findings.filter(
    ({ finding }) => finding.severity === "error" && NOT_YET_JUDGED.has(finding.rule),
  );
  expect(excluded.length).toBe(0);

  // The half that matters: overclaim is judged over this population like any other rule now, and
  // it finds nothing. Naming it keeps the retired exemption subject under test, so a new
  // overclaim error fails here rather than being quietly excluded again.
  const overclaim = findings.filter(
    ({ finding }) => finding.rule === "overclaim" && finding.severity === "error",
  );
  expect(overclaim.map(({ item }) => item.key)).toEqual([]);
  // The old final line asserted the one excluded finding was in src/experiments/sr05/definition.ts,
  // naming the site so the exclusion could not quietly cover a second module. There is no excluded
  // finding to name any more; what replaces it is the assertion above, that NOTHING is excluded.
});
