/**
 * THE PROOF FOR `viewCitations`, IN TWO HALVES THAT WATCH DIFFERENT THINGS.
 *
 * The SYNTHETIC half drives both branches with manifests built here, and it is what establishes that
 * the gate can fail at all. It replants the exact historical defect - bm-08's view citing
 * "diffusionCoefficient", a quantityId shared by seven of its outputs - so the proof survives the tree
 * being repaired, which it now has been. AGENTS.md: a gate's own test must not live only in the lane
 * that gate controls, and where a fixture can be lane-independent it should be.
 *
 * The LIVE half reads all 33 manifests from disk with the real validator and asserts zero unresolved.
 * It is the half that notices a NEW bad citation, and it is the half that would go vacuous if the
 * glob ever matched nothing - so it also asserts a floor on what it examined. A sweep that cannot fail
 * and a sweep with nothing to find look identical.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateExperiment } from "../schemas/experiment.ts";
import { strictParse } from "../schemas/strictParse.ts";
import { type CitedManifest, checkViewCitations, summarizeViewCitations } from "./viewCitations.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const DIR = join(ROOT, "content/experiments");

function liveManifests(): CitedManifest[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => validateExperiment(strictParse(readFileSync(join(DIR, f), "utf8"), "yaml")))
    .map((exp) => exp as unknown as CitedManifest);
}

/** A minimal manifest in the shape the checker reads. Only the four fields it looks at. */
function manifest(over: Partial<CitedManifest> = {}): CitedManifest {
  return {
    id: "bm-08",
    outputs: [{ id: "naiveD" }, { id: "pairD" }],
    parameters: [{ id: "sigma" }],
    views: [],
    actions: [],
    ...over,
  };
}

describe("viewCitations: synthetic, which is what proves the gate can fail", () => {
  test("the historical defect: a view citing a quantityId shared by several outputs is unresolved", () => {
    // bm-08's camera-path and camera-table both cited "diffusionCoefficient", which is the quantityId
    // of naiveD, centeredD, covarianceD, pairD and three intervals, and the id of none of them.
    const report = checkViewCitations([
      manifest({ views: [{ id: "camera-path", consumes: ["diffusionCoefficient"] }] }),
    ]);
    expect(report.citations.length).toBe(1);
    expect(report.unresolved.length).toBe(1);
    expect(report.unresolved[0]?.site).toBe("view camera-path");
    expect(report.unresolved[0]?.ref).toBe("diffusionCoefficient");
    expect(report.unresolved[0]?.lab).toBe("bm-08");
  });

  test("an action's acceptedResult is read too, not only a view's consumes", () => {
    const report = checkViewCitations([
      manifest({
        actions: [
          { actionId: "bm-08-choose", acceptedResult: { outputs: ["naiveD", "noSuchId"] } },
        ],
      }),
    ]);
    expect(report.citations.length).toBe(2);
    expect(report.unresolved.map((c) => c.ref)).toEqual(["noSuchId"]);
    expect(report.unresolved[0]?.site).toBe("action bm-08-choose");
  });

  test("a declared output resolves, so the check is not simply refusing everything", () => {
    const report = checkViewCitations([
      manifest({ views: [{ id: "camera-table", consumes: ["naiveD", "pairD"] }] }),
    ]);
    expect(report.unresolved.length).toBe(0);
    expect(report.citations.every((c) => c.resolution === "output")).toBe(true);
  });

  test("a PARAMETER citation resolves: lq-05's grid consumes the controls a reader sets", () => {
    const report = checkViewCitations([manifest({ views: [{ id: "grid", consumes: ["sigma"] }] })]);
    expect(report.unresolved.length).toBe(0);
    expect(report.citations[0]?.resolution).toBe("parameter");
  });

  test("a manifest with no views and no actions contributes no citations, and says so", () => {
    // The vacuity case, asserted on purpose: a lab citing nothing must not be reported as clean by
    // having been counted, and the report's own labs field is what distinguishes the two.
    const report = checkViewCitations([manifest()]);
    expect(report.labs).toBe(1);
    expect(report.citations.length).toBe(0);
    expect(summarizeViewCitations(report)).toContain("across 1 manifest(s)");
  });

  test("an empty manifest list examines nothing, which the summary states rather than hides", () => {
    const report = checkViewCitations([]);
    expect(report.labs).toBe(0);
    expect(report.citations.length).toBe(0);
    expect(summarizeViewCitations(report)).toContain("across 0 manifest(s)");
  });
});

describe("viewCitations: the live tree, which is what notices a new one", () => {
  test("every citation in every manifest names something that manifest declares", () => {
    const report = checkViewCitations(liveManifests());
    console.log(`[view citations] ${summarizeViewCitations(report)}`);
    const named = report.unresolved.map((c) => `${c.lab} ${c.site}: "${c.ref}"`);
    expect(named).toEqual([]);
  });

  test("it examined a real population, so the clean verdict above is not vacuous", () => {
    const report = checkViewCitations(liveManifests());
    // Floors, not censuses: 33 manifests and 583 citations were measured on 2026-10-06, and these
    // are set below both so adding a lab or a view never turns this red. Zero of either would make
    // the assertion above meaningless, which is the only thing this test is here to prevent.
    expect(report.labs).toBeGreaterThanOrEqual(30);
    expect(report.citations.length).toBeGreaterThanOrEqual(500);
    expect(report.citations.filter((c) => c.resolution === "output").length).toBeGreaterThan(0);
    expect(report.citations.filter((c) => c.resolution === "parameter").length).toBeGreaterThan(0);
  });

  test("the three repaired labs cite output ids, and no longer their quantity ids", () => {
    // The specific repair, pinned by identity rather than by count: these are the ids the views'
    // components actually read, so a future edit that reverts to a quantityId fails here by name as
    // well as in the sweep above.
    const report = checkViewCitations(liveManifests());
    const refsOf = (lab: string, site: string) =>
      report.citations.filter((c) => c.lab === lab && c.site === site).map((c) => c.ref);
    expect(refsOf("bm-08", "view camera-path")).toEqual([
      "times",
      "idealPositions",
      "blurredPositions",
      "positions",
    ]);
    expect(refsOf("bm-08", "view camera-speed")).toEqual([
      "speedTimes",
      "idealSpeeds",
      "cameraSpeeds",
    ]);
    expect(refsOf("bm-08", "view camera-table")).toContain("naiveD");
    expect(refsOf("lq-09", "view lq-09-data-table")).toContain("ionizationEnergyEv");
    expect(refsOf("lq-09", "view lq-09-data-table")).not.toContain("ionizationEnergyPerMolecule");
    expect(refsOf("lq-06", "view lq-06-mean-energy-strip")).toContain("meanQuantumEnergyWienEv");
  });
});
