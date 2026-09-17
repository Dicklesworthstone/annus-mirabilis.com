import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TracerLab } from "../components/lab/TracerLab.tsx";
import example from "../generated/bm01-example.json";
import { rmsDisplacement } from "../physics/reference/diffusion.ts";

/**
 * Prohibited claims and constant set tests for BM-01 (am-bm-01-tracer-ensemble-hdly AC10):
 * - Every displayed displacement names its constant set;
 * - Under einstein-1905-brownian-printed, 60 s displacement is 6.2 um (ca. 6 Mikron), never 6.1 um;
 * - No scenario, tape, caption, or model note calls R "printed" (R is an editorial input);
 * - Planted negatives verify that calling R "printed" or displaying 6.1 um under the historical set fails.
 */

describe("bm01.prohibitedClaims: Constant-Set Labelling & Prohibited Claims (AC10)", () => {
  test("TracerLab displays name the active constant set beside displacements", () => {
    const html = renderToStaticMarkup(createElement(TracerLab, { example }));
    // Must contain data-constant-set-id attribute or named set
    expect(html).toContain('data-constant-set-id="modern-si-2019"');
    // Beside displacement output
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
