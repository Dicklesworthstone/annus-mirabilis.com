import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkVoice } from "../content/checks/voice/index.ts";
import { parseYaml } from "../content/provenance/yaml.ts";
import { validateExperiment } from "../content/schemas/experiment.ts";
import { auditReadings, type ReadingsAuditInput } from "../content/audits/readings.ts";
import { createLq08Session } from "../experiments/lq08/session.ts";
import { einsteinPrintedStoppingCheck } from "../physics/reference/photoelectric.ts";
import { withinTolerance } from "../units/tolerance.ts";

describe("LQ-08 Historical Caption & Readout Texts (am-lq-08-photoelectric-va5a)", () => {
  const manifestPath = resolve(process.cwd(), "content/experiments/lq-08.yaml");
  const manifestRaw = parseYaml(readFileSync(manifestPath, "utf-8"));
  const experiment = validateExperiment(manifestRaw, "lq-08");

  const readingsOwnerPath = resolve(
    process.cwd(),
    "content/editorial/readings-owners/am-lq-08-photoelectric-va5a.yaml",
  );
  const ownerRaw = parseYaml(readFileSync(readingsOwnerPath, "utf-8")) as {
    ownerBeadId: string;
    paper: string;
    targetKinds: readonly ("instrument-caption")[];
    entries: readonly {
      id: string;
      targetKind: "instrument-caption";
      paper: string;
      readings: {
        r0: string;
        r1: string;
        r2: string;
        r3: string;
        r3Citations?: readonly string[];
      };
    }[];
  };

  it("audit-readings finds R0–R3 for neglect and not-a-named-metal statements with contract fields", () => {
    const input: ReadingsAuditInput = {
      targets: ownerRaw.entries.map((e) => ({
        targetId: e.id,
        targetKind: e.targetKind,
        paper: e.paper,
        readings: e.readings,
      })),
      owners: [
        {
          ownerBeadId: ownerRaw.ownerBeadId,
          fileName: "am-lq-08-photoelectric-va5a.yaml",
          paper: ownerRaw.paper,
          targetKinds: ownerRaw.targetKinds,
          targetIds: ownerRaw.entries.map((e) => e.id),
        },
      ],
    };

    const report = auditReadings(input);
    expect(report.ok).toBe(true);
    expect(report.findings.length).toBe(0);

    // Verify individual target presence
    const neglectTarget = ownerRaw.entries.find((e) => e.id === "lq-08-neglect-statement");
    expect(neglectTarget).toBeDefined();
    expect(neglectTarget?.readings.r0).toContain("Setting escape work to zero");
    expect(neglectTarget?.readings.r3).toContain("Einstein (1905, §8, p. 147)");

    const notNamedMetalTarget = ownerRaw.entries.find(
      (e) => e.id === "lq-08-not-named-metal-statement",
    );
    expect(notNamedMetalTarget).toBeDefined();
    expect(notNamedMetalTarget?.readings.r0).toContain("Real metals require energy");
    expect(notNamedMetalTarget?.readings.r3).toContain("not a prediction for any named metal");
  });

  it("passes voice linter across all R0–R3 caption readings without pedagogical or promotional overclaims", () => {
    for (const entry of ownerRaw.entries) {
      for (const [level, text] of Object.entries(entry.readings)) {
        if (typeof text === "string") {
          const findings = checkVoice(text, { context: "prose" });
          const errors = findings.filter((f) => f.severity === "error");
          expect(errors).toEqual([]);
        }
      }
    }
  });

  it("historical check readout contains the neglect statement and not-a-named-metal statement", () => {
    const check = einsteinPrintedStoppingCheck();
    const { readoutStatements } = check;

    // Neglect statement
    expect(readoutStatements.neglectStatement).toContain("P' = 0");
    expect(readoutStatements.neglectStatement).toContain("deliberate neglect of escape work");
    expect(readoutStatements.neglectStatement).toContain("order-of-magnitude");
    expect(readoutStatements.neglectStatement).toContain("Lenard");

    // Not a named metal statement
    expect(readoutStatements.notNamedMetalStatement).toContain("not a prediction for any named metal");
    expect(readoutStatements.notNamedMetalStatement).toContain("P' > 0");
    expect(readoutStatements.notNamedMetalStatement).toContain("work function contributes");
  });

  it("computes live hypothetical comparison from session snapshot (h*nu=4.259738 eV, Vs=2.259738 V at Phi=2 eV to 10^-9)", () => {
    const session = createLq08Session("test-hypothetical-live");
    // Apply UV frequency 1.03e15 Hz and hypothetical Phi = 2.0 eV
    session.apply({
      frequency: 1.03e15,
      workFunction: 2.0,
      incidentPower: 0.001,
    });

    const snapshot = session.getSnapshot().accepted;
    expect(snapshot).toBeDefined();

    const qeOut = snapshot?.outputs.find((o) => o.quantityId === "quantumEnergy");
    const vsOut = snapshot?.outputs.find((o) => o.quantityId === "stoppingPotentialMagnitude");

    expect(qeOut?.status).toBe("value");
    expect(vsOut?.status).toBe("value");
    if (qeOut?.status !== "value" || vsOut?.status !== "value") {
      throw new Error("Expected status 'value'");
    }

    const eCharge = 1.602176634e-19;
    const qeJoules = qeOut.value as number;
    const qeEv = qeJoules / eCharge;
    const vsVolts = vsOut.value as number;

    // Target values: h*nu = 4.259738 eV, Vs = 2.259738 V
    const targetQeEv = 4.259738;
    const targetVs = 2.259738;

    // Relative tolerance check to 10^-9
    const qeTol = withinTolerance(qeEv, targetQeEv, { relative: 1e-6 });
    expect(qeTol.ok).toBe(true);

    const vsTol = withinTolerance(vsVolts, targetVs, { relative: 1e-6 });
    expect(vsTol.ok).toBe(true);

    // Exact high-precision match against reference formula: (h * nu) / e - Phi
    const expectedExactQeEv = (6.62607015e-34 * 1.03e15) / 1.602176634e-19;
    const expectedExactVs = expectedExactQeEv - 2.0;
    expect(withinTolerance(qeEv, expectedExactQeEv, { relative: 1e-9 }).ok).toBe(true);
    expect(withinTolerance(vsVolts, expectedExactVs, { relative: 1e-9 }).ok).toBe(true);
  });

  it("retyping guard: hypothetical comparison is dynamic from snapshot, not a frozen literal", () => {
    const session = createLq08Session("test-retyping-guard");
    session.apply({ frequency: 1.03e15, workFunction: 2.0 });
    const snap1 = session.getSnapshot().accepted;
    const out1 = snap1?.outputs.find((o) => o.quantityId === "stoppingPotentialMagnitude");

    // Change frequency: live output MUST change, proving it's not a frozen literal
    session.apply({ frequency: 1.2e15, workFunction: 2.0 });
    const snap2 = session.getSnapshot().accepted;
    const out2 = snap2?.outputs.find((o) => o.quantityId === "stoppingPotentialMagnitude");

    expect(out1?.status).toBe("value");
    expect(out2?.status).toBe("value");
    if (out1?.status !== "value" || out2?.status !== "value") {
      throw new Error("Expected status 'value'");
    }
    const vs1 = out1.value as number;
    const vs2 = out2.value as number;

    expect(vs1).not.toBe(vs2);
    expect(vs2).toBeGreaterThan(vs1);

    // A static literal caption validator fails the retyping guard
    function guardRetyping(readoutProducer: (f: number) => number): void {
      const vA = readoutProducer(1.03e15);
      const vB = readoutProducer(1.20e15);
      if (vA === vB) {
        throw new Error("Retyping guard violation: stopping potential literal is frozen across parameter changes");
      }
    }

    expect(() => guardRetyping(() => 2.259738)).toThrow("Retyping guard violation");
  });

  it("invariant: hypothetical comparison without hypothetical label fails validation", () => {
    function validateHypotheticalReadout(readout: {
      stoppingPotentialVolts: number;
      label?: string;
    }): boolean {
      if (readout.label !== "hypothetical") {
        throw new Error("Readout invariant violation: hypothetical comparison must carry hypothetical label");
      }
      return true;
    }

    const check = einsteinPrintedStoppingCheck();
    expect(validateHypotheticalReadout(check.readoutStatements.hypotheticalComparison)).toBe(true);

    // Omitting the hypothetical label fails
    expect(() =>
      validateHypotheticalReadout({
        stoppingPotentialVolts: 2.259738,
        label: "actual-metal",
      }),
    ).toThrow("Readout invariant violation");
  });
});
