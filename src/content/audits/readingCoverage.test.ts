/**
 * THE READINGS AUDIT'S POPULATION, AND THE TWO PLANTS am-rc1001-bridge-plan-pcjk.14 ASKS FOR.
 *
 * THE DEFECT, as that bead measured it on 2026-10-01 and as this file reproduces below: the readings
 * audit run by verify-content read only `content/editorial/readings-owners/`, which is 41 files
 * declaring 63 instrument captions, and all 63 already carry four readings. So the gate was green
 * over the one population with nothing left to find and silent about the five where the shortfalls
 * are -- 129 displays with no r3, 26 headings and 9 closings with no reading at all.
 *
 * The first test below is the regression half: it asserts that the caption population IS complete,
 * which is why a gate reading only captions could never fail, and then that the other five
 * populations exist and are larger. Before `readingCoverage.ts` there was nothing that could make
 * that second assertion, which is the whole finding.
 */
import { describe, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import baseline from "./readingCoverage.baseline.json" with { type: "json" };
import {
  type CoverageBaseline,
  coverageCensusLine,
  coverageFindings,
  measureReadingCoverage,
  POPULATIONS,
  READING_LEVELS,
} from "./readingCoverage.ts";

const ROOT = process.cwd();
const BASE = baseline.shortfalls as CoverageBaseline;
const SUITE = "reading-coverage";

/** The structured log AGENTS.md requires of every suite, with the population it examined. */
function logRun(rows: readonly Record<string, unknown>[]): void {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  const dir = join(ROOT, "artifacts", "test-logs", SUITE);
  mkdirSync(dir, { recursive: true });
  const logRunId = `${stamp}-${Math.random().toString(16).slice(2, 10)}`;
  writeFileSync(
    join(dir, `${logRunId}.jsonl`),
    `${rows.map((r) => JSON.stringify({ timestamp: new Date().toISOString(), suite: SUITE, logRunId, beadId: "am-rc1001-bridge-plan-pcjk.14", ...r })).join("\n")}\n`,
    "utf8",
  );
}

describe("the readings audit reads every population, not the one already complete", () => {
  const pops = measureReadingCoverage(ROOT);
  const byName = new Map(pops.map((p) => [p.name, p]));

  test("[census] all six populations, and the census line names each", () => {
    const line = coverageCensusLine(pops);
    console.log(`[reading-coverage] ${line}`);
    expect(pops).toHaveLength(6);
    expect(line).toBe(
      "examined 210 paragraphs, 48 passages, 200 displays, 26 headings, 9 closings, 63 captions",
    );
    logRun(
      pops.map((p) => ({
        testId: `population:${p.name}`,
        expected: `>= ${p.floor}`,
        actual: p.examined,
        outcome: p.examined >= p.floor ? "passed" : "failed",
        missing: Object.fromEntries(p.applicable.map((l) => [l, p.missing[l].length])),
      })),
    );
  });

  test("THE DEFECT: captions were complete, so a gate reading only captions could not fail", () => {
    const captions = byName.get("captions");
    if (!captions) throw new Error("captions population missing");
    // Every one of the 63 carries all four. This is why the old population was the wrong one.
    for (const level of READING_LEVELS) expect(captions.missing[level]).toEqual([]);
    expect(captions.examined).toBe(63);
    // And the five it never read are larger than it, which nothing could assert before this module.
    const others = pops.filter((p) => p.name !== "captions");
    expect(others.reduce((n, p) => n + p.examined, 0)).toBe(210 + 48 + 200 + 26 + 9);
  });

  test("the real shortfalls are displays' r3, headings and closings, and they are reported", () => {
    // CEILINGS, not censuses. These three numbers were 129, 26 and 9 when this module was written
    // on 2026-10-11, and they are the project's readings debt, so what must hold is that they do
    // not GROW. Asserting the equality broke on correct work within three days: four section-5
    // historian's margins were authored on 2026-10-14 and took the display shortfall to 125, which
    // turned this test red while nothing it protects had changed. The printed line below is the
    // measurement; the assertion is the property.
    const displays = byName.get("displays")?.missing.r3 ?? [];
    const headings = byName.get("headings")?.missing.r0 ?? [];
    const closings = byName.get("closings")?.missing.r0 ?? [];
    console.log(
      `[readings debt] displays without r3 ${displays.length} (129 on 2026-10-11), ` +
        `headings without r0 ${headings.length} of 26, closings without r0 ${closings.length} of 9`,
    );
    expect(displays.length).toBeLessThanOrEqual(129);
    expect(headings.length).toBeLessThanOrEqual(26);
    expect(closings.length).toBeLessThanOrEqual(9);
    // Non-vacuity, on purpose and in both directions. A debt of zero everywhere would satisfy
    // three ceilings while meaning the reader found nothing, so each population that still carries
    // a shortfall is asserted to carry one, and the populations that are COMPLETE are asserted
    // complete, which is what makes the numbers above a measurement.
    expect(displays.length).toBeGreaterThan(0);
    expect(headings.length).toBeGreaterThan(0);
    expect(closings.length).toBeGreaterThan(0);
    expect(byName.get("passages")?.missing.r3).toEqual([]);
    expect(byName.get("paragraphs")?.missing.r0).toEqual([]);
    // Every id names its paper, which a bare display id cannot. `eq-s4-d5` and five of its
    // neighbours each name a record in three different papers, so before this was qualified no
    // entry of this list could be traced to a file and a consumer that deduped lost 42 of 125.
    const papers = new Set([
      "brownian-motion",
      "light-quanta",
      "mass-energy",
      "special-relativity",
    ]);
    for (const id of displays) {
      const paper = id.split("/")[0] ?? "";
      expect(papers.has(paper), `display shortfall id "${id}" names no paper`).toBe(true);
    }
    expect(displays.filter((id) => id.startsWith("brownian-motion/")).length).toBeGreaterThan(0);
  });

  test("a paragraph binding's r1 to r3 are not baselined, because it carries r0 by design", () => {
    // AGENTS.md: "Every printed paragraph is bound to one or more passages and has its own r0
    // overview." Its other three readings live in those passages. Counting 210 paragraphs as
    // missing three readings each is a category error, and the baseline must not record it.
    expect(byName.get("paragraphs")?.applicable).toEqual(["r0"]);
    expect(Object.keys(BASE.paragraphs ?? {})).toEqual(["r0"]);
    expect(POPULATIONS.find((p) => p.name === "paragraphs")?.obliged).toEqual(["r0"]);
  });

  test("the two deliberately unexplained units are reported as declared, not as missing", () => {
    const paragraphs = byName.get("paragraphs");
    expect(paragraphs?.declared).toEqual(["special-relativity/s1-fn1", "special-relativity/s5-p8"]);
    // They carry their own r0; what they declare is that no PASSAGE explains them.
    for (const id of paragraphs?.declared ?? []) expect(paragraphs?.missing.r0).not.toContain(id);
  });

  test("the live corpus is clean against its own baseline", () => {
    const findings = coverageFindings(pops, BASE);
    expect(findings).toEqual([]);
  });
});

describe("PLANTED: the floor and the ratchet both fire", () => {
  /** A scratch corpus holding only what one population reads, so a plant is cheap and local. */
  function scratchWithDisplays(count: number): string {
    const root = mkdtempSync(join(tmpdir(), "am-reading-coverage-"));
    const from = resolve(ROOT, "content/equation-explanations");
    const to = join(root, "content", "equation-explanations", "mass-energy");
    mkdirSync(to, { recursive: true });
    const names = [
      "eq-s0-d1",
      "eq-s0-d2",
      "eq-s0-d3",
      "eq-s0-d4",
      "eq-s0-d5",
      "eq-s0-d6",
      "eq-s0-d7",
    ];
    for (const name of names.slice(0, count))
      copyFileSync(join(from, "mass-energy", `${name}.yaml`), join(to, `${name}.yaml`));
    return root;
  }

  test("a corpus with the displays directory emptied FAILS ON THE FLOOR", () => {
    const root = scratchWithDisplays(0);
    const pops = measureReadingCoverage(root);
    const displays = pops.find((p) => p.name === "displays");
    console.log(
      `[plant] displays directory emptied: examined ${displays?.examined} of floor ${displays?.floor}`,
    );
    expect(displays?.examined).toBe(0);
    const findings = coverageFindings(pops, BASE);
    const codes = findings.map((f) => f.check);
    expect(codes).toContain("readings-population-under-floor");
    // Named by population, so the message says which directory was lost.
    expect(findings.find((f) => f.check === "readings-population-under-floor")?.recordId).toBe(
      "paragraphs",
    );
    expect(findings.filter((f) => f.check === "readings-population-under-floor")).toHaveLength(6);
  });

  test("REMOVING ONE DISPLAY'S r3 raises the count by one and the ratchet goes red", () => {
    const root = scratchWithDisplays(7);
    const file = join(root, "content", "equation-explanations", "mass-energy", "eq-s0-d1.yaml");
    const before = readFileSync(file, "utf8");
    // Print what landed before reading the verdict: a plant that does not change the file is a
    // finding about the plant.
    expect(before).toMatch(/^r3:/m);
    const planted = before.replace(/^r3:.*(?:\n(?![a-zA-Z#]).*)*$/m, "");
    writeFileSync(file, planted, "utf8");
    expect(readFileSync(file, "utf8")).not.toMatch(/^r3:/m);
    console.log(`[plant] eq-s0-d1: r3 removed, file ${before.length} -> ${planted.length} chars`);

    const pops = measureReadingCoverage(root);
    const displays = pops.find((p) => p.name === "displays");
    expect(displays?.examined).toBe(7);
    // Mass-energy's seven displays all carry r3 (7 of 7 in check-equation-explanations), so the
    // count rises from 0 to exactly 1 and names the id.
    expect(displays?.missing.r3).toEqual(["mass-energy/eq-s0-d1"]);

    // The ratchet is read against a baseline scoped to this scratch population, because the live
    // baseline's 129 is a count over 200 displays and says nothing about a corpus of 7.
    const scratchBase: CoverageBaseline = { displays: { r0: 0, r1: 0, r2: 0, r3: 0 } };
    const findings = coverageFindings(pops, scratchBase);
    const grew = findings.filter((f) => f.check === "readings-shortfall-grew");
    expect(grew).toHaveLength(1);
    expect(grew[0]?.recordId).toBe("displays.r3");
    expect(grew[0]?.message).toContain("rose from 0 to 1");
    expect(grew[0]?.message).toContain("eq-s0-d1");
  });

  test("and the unplanted scratch corpus is clean, so neither plant always refuses", () => {
    const root = scratchWithDisplays(7);
    const pops = measureReadingCoverage(root);
    const displays = pops.find((p) => p.name === "displays");
    expect(displays?.missing.r3).toEqual([]);
    const scratchBase: CoverageBaseline = { displays: { r0: 0, r1: 0, r2: 0, r3: 0 } };
    expect(
      coverageFindings(pops, scratchBase).filter((f) => f.check === "readings-shortfall-grew"),
    ).toEqual([]);
  });
});
