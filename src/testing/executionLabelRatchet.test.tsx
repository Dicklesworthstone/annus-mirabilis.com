import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { exportMarkup } from "./exportMarkup.ts";

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
 * The one that remains, and why (recorded on the bead): Configuration (BM-03), whose build-time
 * snapshot carries outputs that are not in the contract the lab declares, so a digest would still
 * derive "unavailable". ModeAllocation (LQ-02), OsmoticPartition (BM-02) and ShelfOptics left the
 * list in f16dcaa3: with no instance store, each is static while its state is still the one it
 * started from, as the reasoning workbenches are (12a926b9).
 * WaveDescription and DriftDiffusion derive their label without a model note: their not-modeled
 * lists live only in the manifests.
 */
const STILL_HARD_CODED = ["lab/bm03/ConfigurationLab.tsx"];

/** Routes whose labs now derive the label; each must render the static label at build time. */
const DERIVED_ROUTES = [
  "avogadro-lab",
  "light-thread",
  "bm-02",
  "bm-04",
  "bm-05",
  "bm-06",
  "bm-07",
  "lq-01",
  "lq-02",
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
  "sr-05",
  "sr-06",
  "sr-07",
  "sr-08",
  "sr-09",
  "sr-10",
  "sr-11",
  "sr-12",
  "sr-13",
  "shelf-fizeau",
  "shelf-maxwell-galilean",
  "shelf-michelson-morley",
];

/**
 * The routes that may render "host" at build time: the listed lab's route, and no other.
 * The source scan above reads one directory and a set of spellings; this reads what every lab page
 * actually renders, so neither a new spelling nor a lab outside src/components escapes it. Until
 * 2026-09-24 it did not exist, and rendering every lab route found two more build-time "host"
 * labels, in src/reasoning (countermodels/independence and lq-08/data, fixed in 12a926b9). May only
 * shrink, with STILL_HARD_CODED.
 */
const HOST_AT_BUILD_TIME = ["bm-03/"];

/**
 * Routes whose instrument root may render with no label at build time. The kitchen holds no data
 * until a reader loads their own; none of the four labels describes an empty workbench, and its badge
 * says "No data loaded". Every other instrument root carries a label: on 2026-09-24 BM-07, SR-05 and
 * SR-06 carried none, and SR-06's eyebrow printed "Ideal model, host calculation" as fixed text
 * (ec9d4957, 82ce8f44, b774006a).
 */
const UNLABELLED_AT_BUILD_TIME = ["bm-07/kitchen/"];

const COMPONENTS = fileURLToPath(new URL("../components/", import.meta.url));
const LAB_APP = fileURLToPath(new URL("../app/lab/", import.meta.url));

/** Every page module under src/app/lab, as a path relative to it ending in "/" ("" is /lab/). */
function labPages(dir: string, base = ""): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = `${dir}${name}`;
    if (statSync(full).isDirectory()) return labPages(`${full}/`, `${base}${name}/`);
    return name === "page.tsx" ? [base] : [];
  });
}
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

  test("no lab route renders a host label at build time except the listed labs', and every instrument root carries a label", async () => {
    const pages = labPages(LAB_APP);
    const host: string[] = [];
    const unlabelled: string[] = [];
    let renders = 0;
    for (const rel of pages) {
      const mod = await import(`${LAB_APP}${rel}page.tsx`);
      const dynamic = rel.includes("[");
      const paramsList: object[] =
        dynamic && mod.generateStaticParams ? await mod.generateStaticParams() : [{}];
      for (const params of paramsList) {
        const out = mod.default({
          searchParams: Promise.resolve({}),
          params: Promise.resolve(params),
        });
        const html = await exportMarkup(out instanceof Promise ? await out : out);
        renders += 1;
        const route = dynamic ? `${rel}${JSON.stringify(params)}` : rel;
        if (html.includes('data-execution-label="host"')) host.push(route);
        if (html.includes("data-instrument-id=") && !html.includes("data-execution-label="))
          unlabelled.push(route);
      }
    }
    console.log(
      `[execution labels] ${renders} lab renders over ${pages.length} page modules; ${host.length} render "host" at build time`,
    );
    expect(pages.length).toBeGreaterThan(40);
    expect(host.sort()).toEqual([...HOST_AT_BUILD_TIME].sort());
    console.log(
      `[execution labels] ${unlabelled.length} render an instrument root with no label: ${unlabelled.join(", ")}`,
    );
    expect(unlabelled.sort()).toEqual([...UNLABELLED_AT_BUILD_TIME].sort());
  });
});
