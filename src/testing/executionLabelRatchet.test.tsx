import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * am-inst-execution-labels-5ywv: an execution label is earned from the derived state, never written
 * as a literal. On 2026-09-24, 28 lab components hard-coded data-execution-label="host", so the
 * build-time worked example every reader first sees was labelled a live host calculation.
 *
 * The literal has more than one spelling. Until 2026-09-24 this scanned only data-execution-label="host",
 * and three labs said "Ideal model, host calculation" over their build-time example on live 211e9af4
 * in forms it could not see: BM-05 and BM-06 passed state="host-accepted" to ExecutionChrome and
 * labelRootAttributes, and SR-02 chose its attribute by mode, {apparatus ? "static" : "host"}. Those
 * spellings are matched too. A label chosen from a per-snapshot test (isStatic ? ... : "host-accepted",
 * as TracerLab and CameraLab do) is a derivation and is not.
 *
 * STILL_HARD_CODED is a ratchet. A component may leave it only by deriving its label, and must
 * leave it when it does: the list is compared for equality, so a migrated lab left on the list
 * fails as slack, and a new hard-coded label fails as a regression.
 *
 * The four that remain, and why (recorded on the bead):
 * - no digested example: ShelfOptics;
 * - no instance store for deriveHostExecution to read: ModeAllocation (LQ-02), OsmoticPartition
 *   (BM-02);
 * - a build-time snapshot whose outputs are not in the contract the lab declares, so a digest
 *   would still derive "unavailable": Configuration (BM-03).
 * WaveDescription and DriftDiffusion derive their label without a model note: their not-modeled
 * lists live only in the manifests.
 */
const STILL_HARD_CODED = [
  "lab/ModeAllocationLab.tsx",
  "lab/OsmoticPartitionLab.tsx",
  "lab/bm03/ConfigurationLab.tsx",
  "lab/shelfOptics/ShelfOpticsLab.tsx",
];

/** Routes whose labs now derive the label; each must render the static label at build time. */
const DERIVED_ROUTES = [
  "avogadro-lab",
  "light-thread",
  "bm-04",
  "bm-05",
  "bm-06",
  "lq-01",
  "lq-03",
  "lq-04",
  "lq-05",
  "lq-06",
  "lq-07",
  "lq-08",
  "lq-09",
  "me-01",
  "me-02",
  "me-03",
  "sr-01",
  "sr-02",
  "sr-03",
  "sr-04",
  "sr-07",
  "sr-08",
  "sr-09",
  "sr-10",
  "sr-11",
  "sr-12",
  "sr-13",
];

const COMPONENTS = fileURLToPath(new URL("../components/", import.meta.url));
const LITERAL = new RegExp(
  [
    'data-execution-label="host"',
    'data-execution-label=\\{[^}]*"host"\\s*\\}',
    '\\bstate="host-accepted"',
    '\\b(?:labelRootAttributes|executionLabelAttributes)\\(\\s*"host-accepted"',
  ].join("|"),
);

/** Blank comments before matching, so a comment that DESCRIBES the literal is not the literal. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

function tsxFiles(dir: string, base = ""): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = `${dir}${name}`;
    const rel = `${base}${name}`;
    if (statSync(full).isDirectory()) return tsxFiles(`${full}/`, `${rel}/`);
    return name.endsWith(".tsx") && !name.includes(".test.") ? [rel] : [];
  });
}

describe("execution labels are derived, not written", () => {
  test("the comment stripper hides a described literal and keeps a real one", () => {
    expect(LITERAL.test(withoutComments('// data-execution-label="host" was hard-coded'))).toBe(
      false,
    );
    expect(LITERAL.test(withoutComments('{/* data-execution-label="host" */}'))).toBe(false);
    expect(LITERAL.test(withoutComments('<section data-execution-label="host">'))).toBe(true);
    expect(
      LITERAL.test(withoutComments('<a href="https://x.org" data-execution-label="host">')),
    ).toBe(true);
  });

  test("each spelling of a fixed host label is caught, and a per-snapshot choice is not", () => {
    for (const fixed of [
      '<ExecutionChrome state="host-accepted" view={view} />',
      '{...labelRootAttributes("host-accepted", view, "probabilityDensity")}',
      '{...executionLabelAttributes("host-accepted")}',
      'data-execution-label={apparatus ? "static" : "host"}',
    ])
      expect({ fixed, caught: LITERAL.test(withoutComments(fixed)) }).toEqual({
        fixed,
        caught: true,
      });
    for (const derived of [
      'state={isStatic ? "static-example" : "host-accepted"}',
      '{...labelRootAttributes(executionKind, view, "sampleRms")}',
      "state={executionKind}",
      '// state="host-accepted" was hard-coded here',
    ])
      expect({ derived, caught: LITERAL.test(withoutComments(derived)) }).toEqual({
        derived,
        caught: false,
      });
  });

  test("exactly the listed components still hard-code the host label", () => {
    const files = tsxFiles(COMPONENTS);
    const hardCoded = files
      .filter((f) => LITERAL.test(withoutComments(readFileSync(`${COMPONENTS}${f}`, "utf8"))))
      .sort();
    console.log(
      `[execution labels] ${files.length} components scanned, ${hardCoded.length} hard-code "host"`,
    );
    expect(files.length).toBeGreaterThan(100);
    expect(hardCoded).toEqual([...STILL_HARD_CODED].sort());
  });

  test("each lab that derives its label renders the static label for its build-time example", async () => {
    for (const route of DERIVED_ROUTES) {
      const mod = await import(`../app/lab/${route}/page.tsx`);
      const out = mod.default({ searchParams: Promise.resolve({}), params: Promise.resolve({}) });
      const html = renderToStaticMarkup(out instanceof Promise ? await out : out);
      const labels = [...html.matchAll(/data-execution-label="([a-z]+)"/g)].map((m) => m[1]);
      expect({ route, labels: [...new Set(labels)] }).toEqual({ route, labels: ["static"] });
      expect(html).toContain("Static worked example");
    }
  });
});
