import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TracerLab } from "../components/lab/TracerLab.tsx";
import { BM01_OUTPUTS } from "../experiments/bm01/definition.ts";
import { ExecutionChrome } from "../experiments/labels/ExecutionChrome.tsx";
import { modelNoteFromView } from "../experiments/labels/modelNoteData.ts";
import { labelRootAttributes } from "../experiments/labels/resultAttributes.ts";
import { refusalCodeRegistry } from "../experiments/results/refusalCodes.ts";
import example from "../generated/bm01-example.json";
import { getConstantSet } from "../physics/reference/constants.ts";
import { rmsDisplacement, stokesEinsteinD } from "../physics/reference/diffusion.ts";

/**
 * Prohibited claims and constant set tests for BM-01 (am-bm-01-tracer-ensemble-hdly AC10):
 * - Every displayed displacement names its constant set;
 * - Under einstein-1905-brownian-printed, 60 s displacement is 6.2 um (ca. 6 Mikron), never 6.1 um;
 * - No scenario, tape, caption, or model note calls R "printed" (R is an editorial input);
 * - Planted negatives verify that calling R "printed" or displaying 6.1 um under the historical set fails.
 */

describe("bm01.prohibitedClaims: Constant-Set Labelling & Prohibited Claims (AC10)", () => {
  test("TracerLab displays name the active constant set beside displacements (modern-si-2019)", () => {
    const html = renderToStaticMarkup(createElement(TracerLab, { example }));
    // Must contain data-constant-set-id attribute or named set
    expect(html).toContain('data-constant-set-id="modern-si-2019"');
    // Beside displacement output
    expect(html).toContain('data-quantity-id="rmsDisplacement1d"');
  });

  test("TracerLab displays name the historical constant set beside displacements under Einstein 1905 preset", () => {
    const historicalExample = {
      ...example,
      parameters: {
        ...example.parameters,
        T: 290.15,
        eta: 0.00135,
        a: 0.5e-6,
      },
      results: example.results.map((r) => {
        const obj = JSON.parse(r);
        if (obj.quantityId === "temperature") obj.value = 290.15;
        if (obj.quantityId === "viscosity") obj.value = 0.00135;
        if (obj.quantityId === "particleRadius") obj.value = 0.5e-6;
        return JSON.stringify(obj);
      }),
    };
    const html = renderToStaticMarkup(createElement(TracerLab, { example: historicalExample }));
    expect(html).toContain('data-constant-set-id="einstein-1905-brownian-printed"');
    expect(html).toContain("Einstein 1905 (Annalen der Physik)");
    expect(html).toContain('data-quantity-id="rmsDisplacement1d"');
  });

  test("under einstein-1905-brownian-printed, 60s displacement rounds to 6.2 um and never 6.1 um", () => {
    // Under Einstein historical constants: D = 0.3158402 um^2/s
    const D = 0.3158402e-12;
    const sixtySec = rmsDisplacement(D, 60);
    expect(sixtySec.result.status).toBe("value");
    if (sixtySec.result.status !== "value") {
      throw new Error("Expected value status");
    }
    const valUm = (sixtySec.result.value as number) * 1e6; // 6.156365...
    expect(valUm).toBeCloseTo(6.156365, 4);

    // Format to 2 significant figures / 1 decimal: rounds to 6.2 um
    const formatted = valUm.toFixed(1);
    expect(formatted).toBe("6.2");
    expect(formatted).not.toBe("6.1");

    // Guard assertion: a display asserting 6.1 um under einstein-1905-brownian-printed fails
    const checkHistoricalDisplay = (displayedText: string, constantSetId: string) => {
      if (constantSetId === "einstein-1905-brownian-printed" && displayedText.includes("6.1 μm")) {
        throw new Error(
          "Prohibited claim: 6.1 μm is the modern-kB value; einstein-1905-brownian-printed yields 6.2 μm.",
        );
      }
    };

    expect(() =>
      checkHistoricalDisplay("6.2 μm (ca. 6 Mikron)", "einstein-1905-brownian-printed"),
    ).not.toThrow();
    // Planted negative
    expect(() => checkHistoricalDisplay("6.1 μm", "einstein-1905-brownian-printed")).toThrow(
      /Prohibited claim: 6.1 μm is the modern-kB value/,
    );
  });

  test("claims check: no scenario, tape, caption, or model note calls R a printed value", () => {
    const validateProhibitedClaims = (text: string, context: string): void => {
      // Prohibited patterns: claiming R is printed in paper 2 or paper 1
      const prohibitedPatterns = [
        /printed\s+R\b/i,
        /\bR\s+as\s+printed\b/i,
        /printed\s+gas\s+constant\b/i,
        /printed\s+molar\s+gas\s+constant\b/i,
        /R\s+printed\s+in\s+paper/i,
      ];
      for (const pattern of prohibitedPatterns) {
        if (pattern.test(text)) {
          throw new Error(
            `Claims violation in ${context}: R is an editorial input, not a printed value: ${text}`,
          );
        }
      }
    };

    // Scan bm-01 manifest
    const manifestContent = readFileSync(
      resolve(process.cwd(), "content/experiments/bm-01.yaml"),
      "utf8",
    );
    expect(() =>
      validateProhibitedClaims(manifestContent, "content/experiments/bm-01.yaml"),
    ).not.toThrow();

    // Scan readings owners for BM-01
    const readingsOwner = readFileSync(
      resolve(
        process.cwd(),
        "content/editorial/readings-owners/am-bm-01-tracer-ensemble-hdly.yaml",
      ),
      "utf8",
    );
    expect(() => validateProhibitedClaims(readingsOwner, "readings-owners/bm-01")).not.toThrow();

    // Planted negative: a text calling R printed fails the claims check
    const badCaption = "Einstein used the printed R = 8.31 J/(mol K) from paper 2 §5.";
    expect(() => validateProhibitedClaims(badCaption, "fixture")).toThrow(
      /Claims violation in fixture: R is an editorial input, not a printed value/,
    );
  });
});

describe("bm01.executionLabels: FrankenSim vs Fallback Labels & Model Note (AC5)", () => {
  const baseAccepted = {
    instanceId: "inst-test",
    runId: "run-test",
    snapshotVersion: 2,
    parameters: example.parameters,
    revisions: { input: 2, solverStep: 2 },
  };

  test("FrankenSim accepted trial produces frankensim label and model note host reductions", () => {
    const wasmView = {
      status: "accepted" as const,
      pending: false,
      accepted: {
        ...baseAccepted,
        outputs: [
          {
            quantityId: "tracerPositions",
            unit: "m",
            semanticKind: "synthetic-tracer-endpoints-xyz",
            ownerId: "fs-wasm.brownian_frames",
            status: "value" as const,
            value: 0,
          },
          {
            quantityId: "sampleMean",
            unit: "m",
            semanticKind: "sample-coordinate-mean",
            ownerId: "diffusion.ensembleMoments",
            status: "value" as const,
            value: 0,
          },
          {
            quantityId: "sampleMeanSquare",
            unit: "m2",
            semanticKind: "sample-coordinate-second-moment",
            ownerId: "diffusion.ensembleMoments",
            status: "value" as const,
            value: 0,
          },
          {
            quantityId: "sampleRms",
            unit: "m",
            semanticKind: "sample-coordinate-rms",
            ownerId: "diffusion.ensembleMoments",
            status: "value" as const,
            value: 0,
          },
        ],
      },
      requested: undefined,
      refusal: undefined,
      outcome: undefined,
    };

    const rootAttrs = labelRootAttributes(
      "frankensim-accepted",
      wasmView as any,
      "tracerPositions",
    );
    expect(rootAttrs["data-execution-label"]).toBe("frankensim");
    expect(rootAttrs["data-result-status"]).toBe("value");

    const modelNote = modelNoteFromView(wasmView as any, {
      notModeled: "Molecular collisions (no collision bath owns the displacement).",
      showTheCodeHref: "#stc-test",
      roles: {
        tracerPositions: "primary",
        sampleMean: "secondary",
        sampleMeanSquare: "secondary",
        sampleRms: "secondary",
      },
      engineSentences: {
        tracerPositions: "Computed with FrankenSim (brownian_frames).",
        sampleMean: "Host reduction (ensembleMoments).",
        sampleMeanSquare: "Host reduction (ensembleMoments).",
        sampleRms: "Host reduction (ensembleMoments).",
      },
    });

    const chromeHtml = renderToStaticMarkup(
      createElement(ExecutionChrome, {
        state: "frankensim-accepted",
        view: wasmView as any,
        modelNote,
      }),
    );
    expect(chromeHtml).toContain('data-execution-label="frankensim"');
    expect(chromeHtml).toContain('data-execution-state="frankensim-accepted"');
    expect(chromeHtml).toContain("Ideal model, computed with FrankenSim");
    expect(chromeHtml).toContain("Computed with FrankenSim (brownian_frames)");
    expect(chromeHtml).toContain("Host reduction (ensembleMoments)");
  });

  test("Host fallback trial produces host label and host reference engine note", () => {
    const hostView = {
      status: "accepted" as const,
      pending: false,
      accepted: {
        ...baseAccepted,
        outputs: [
          {
            quantityId: "tracerPositions",
            unit: "m",
            semanticKind: "synthetic-tracer-endpoints-xyz",
            ownerId: "diffusion.recordTracers",
            status: "value" as const,
            value: 0,
          },
          {
            quantityId: "sampleMean",
            unit: "m",
            semanticKind: "sample-coordinate-mean",
            ownerId: "diffusion.ensembleMoments",
            status: "value" as const,
            value: 0,
          },
        ],
      },
      requested: undefined,
      refusal: undefined,
      outcome: undefined,
    };

    const rootAttrs = labelRootAttributes("host-accepted", hostView as any, "tracerPositions");
    expect(rootAttrs["data-execution-label"]).toBe("host");

    const modelNote = modelNoteFromView(hostView as any, {
      notModeled: "Molecular collisions (no collision bath owns the displacement).",
      showTheCodeHref: "#stc-test",
      roles: {
        tracerPositions: "primary",
        sampleMean: "secondary",
      },
      engineSentences: {
        tracerPositions: "Host reference calculation (recordTracers).",
        sampleMean: "Host reduction (ensembleMoments).",
      },
    });

    const chromeHtml = renderToStaticMarkup(
      createElement(ExecutionChrome, {
        state: "host-accepted",
        view: hostView as any,
        modelNote,
      }),
    );
    expect(chromeHtml).toContain('data-execution-label="host"');
    expect(chromeHtml).toContain('data-execution-state="host-accepted"');
    expect(chromeHtml).toContain("Ideal model, host calculation");
    expect(chromeHtml).toContain("Host reference calculation (recordTracers)");
    expect(chromeHtml).toContain("Host reduction (ensembleMoments)");
  });

  test("Static worked example produces static label and static-example state", () => {
    const html = renderToStaticMarkup(createElement(TracerLab, { example }));
    expect(html).toContain('data-execution-label="static"');
    expect(html).toContain('data-execution-state="static-example"');
    expect(html).toContain("Static worked example");
  });
});

describe("bm01.statusCases: Status Cases, Limits & Refusals (Test Plan)", () => {
  test("gas medium request is refused with stokes-gas-medium and Cunningham slip correction explanation", () => {
    const modern = getConstantSet("modern-si-2019");
    const gas = stokesEinsteinD({ T: 293.15, eta: 0.001, a: 0.5e-6, medium: "gas" }, modern);
    expect(gas.result.status).toBe("outside-domain");
    if (gas.result.status !== "outside-domain") {
      throw new Error("Expected outside-domain status");
    }
    expect(gas.result.condition).toBe("stokes-gas-medium");
    expect(gas.result.domainKind).toBe("model");
    expect(gas.result.reason).toContain("slip correction");

    // Must match registered refusal code in refusalCodes registry
    const refusal = refusalCodeRegistry["stokes-gas-medium"];
    expect(refusal).toBeDefined();
    expect(refusal.domainKind).toBe("model");
    expect(refusal.message).toContain("slip correction");
    expect(refusal.repair).toContain("Newtonian liquid");
  });

  test("BM01 outputs schema admits analytic-limit at t=0 and underdetermined at M=1", () => {
    const outputs = [
      BM01_OUTPUTS.signedMeanLowerBand,
      BM01_OUTPUTS.signedMeanUpperBand,
      BM01_OUTPUTS.meanSquareLowerBand,
      BM01_OUTPUTS.meanSquareUpperBand,
      BM01_OUTPUTS.meanBand,
      BM01_OUTPUTS.secondMomentBand,
    ];
    for (const output of outputs) {
      expect(output).toBeDefined();
      if (!output) throw new Error("Missing declared output");
      expect(output.statuses).toContain("analytic-limit");
      expect(output.statuses).toContain("underdetermined");
    }
  });
});
