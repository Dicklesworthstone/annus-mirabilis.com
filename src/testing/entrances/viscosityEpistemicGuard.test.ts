import { afterAll, describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { newRunIdentity, TestLogger } from "../log/logger.ts";

const BEAD_ID = "am-bm-first-encounter-fjvh";

describe("Viscosity Epistemic Guard & Cross-Term Consistency (am-bm-first-encounter-fjvh)", () => {
  const logger = new TestLogger("brownian-first-encounter", newRunIdentity());

  afterAll(async () => {
    await logger.flush();
  });

  it("proves the exact square-root scaling for viscosity vs displacement", () => {
    const start = performance.now();
    // Physical relations:
    // Stokes-Einstein: D = (R * T) / (6 * pi * eta * r * N_A) => D proportional to 1 / eta
    // Einstein diffusion spread: sqrt(<x^2>) = sqrt(2 * D * t) => sqrt(<x^2>) proportional to 1 / sqrt(eta)
    // If viscosity eta doubles (eta_2 = 2 * eta_1), diffusivity halves (D_2 = D_1 / 2)
    // RMS displacement becomes sqrt(2 * (D_1/2) * t) = (1 / sqrt(2)) * sqrt(2 * D_1 * t)
    const eta1 = 1.0;
    const eta2 = 2.0;
    const D1 = 1.0 / eta1;
    const D2 = 1.0 / eta2;

    const t = 1.0;
    const rms1 = Math.sqrt(2 * D1 * t);
    const rms2 = Math.sqrt(2 * D2 * t);

    const ratio = rms2 / rms1;
    const expectedRatio = 1.0 / Math.sqrt(2.0); // ~0.70710678

    expect(ratio).toBeCloseTo(expectedRatio, 6);
    expect(ratio).not.toBeCloseTo(0.5, 2); // Explicitly NOT 1/2 !

    logger.log({
      testId: "epistemic-viscosity-sqrt2-scaling",
      beadId: BEAD_ID,
      expected: expectedRatio,
      actual: ratio,
      outcome: "passed",
      durationMs: performance.now() - start,
      comparisonKind: "tolerance",
      tolerance: { absolute: 1e-6 },
      extra: {
        scalingFactor: ratio,
        fallacyChecked: "halving-displacement-on-doubling-viscosity",
      },
    });
  });

  it("asserts that Brownian explanatory prose does not make the false 1/2 linearity claim for viscosity", () => {
    const start = performance.now();
    const directoriesToScan = [
      resolve(process.cwd(), "content/arguments/brownian-motion"),
      resolve(process.cwd(), "content/foundations"),
      resolve(process.cwd(), "src/reader/entrances"),
    ];

    const forbiddenPhrases = [
      /doubl(?:ing|e|ed)\s+viscosity\s+halves\s+(?:the\s+)?(?:displacement|distance|wander)/i,
      /twice\s+the\s+viscosity\s+results\s+in\s+half\s+the\s+(?:displacement|distance)/i,
      /doubl(?:ing|e|ed)\s+viscosity\s+(?:gives|causes)\s+half\s+(?:the\s+)?displacement/i,
      /half\s+as\s+far\s+when\s+viscosity\s+doubles/i,
    ];

    let filesScanned = 0;

    for (const dir of directoriesToScan) {
      const files = readdirSync(dir);
      for (const file of files) {
        if (!file.endsWith(".json") && !file.endsWith(".ts") && !file.endsWith(".tsx")) {
          continue;
        }
        filesScanned++;
        const content = readFileSync(resolve(dir, file), "utf-8");

        for (const pattern of forbiddenPhrases) {
          const match = pattern.exec(content);
          if (match) {
            throw new Error(
              `Epistemic violation in '${file}': Found false linearity claim: "${match[0]}". Doubling viscosity changes displacement by 1/sqrt(2), not 1/2.`,
            );
          }
        }
      }
    }

    expect(filesScanned).toBeGreaterThan(5);

    logger.log({
      testId: "epistemic-prose-viscosity-check",
      beadId: BEAD_ID,
      expected: "zero instances of 1/2 displacement linearity fallacy",
      actual: `scanned ${filesScanned} files cleanly`,
      outcome: "passed",
      durationMs: performance.now() - start,
      comparisonKind: "formatted",
    });
  });

  it("checks consistency: entrance and Chain A / observable argument reference the same zero-mean / cross-term vanishing relation", () => {
    // Read entrance record and observable argument record
    const entrancePath = resolve(
      process.cwd(),
      "content/arguments/brownian-motion/entrance-brownian-motion.json",
    );
    const argObservablePath = resolve(
      process.cwd(),
      "content/arguments/brownian-motion/arg-bm-observable.json",
    );

    const entranceJson = JSON.parse(readFileSync(entrancePath, "utf-8"));
    const argJson = JSON.parse(readFileSync(argObservablePath, "utf-8"));

    // Both must use the same four authored displacement numbers [-3, -1, 1, 3]
    expect(entranceJson.authoredEntries).toEqual([-3, -1, 1, 3]);

    const argSteps = JSON.stringify(argJson.readings.steps);
    expect(argSteps).toContain("−3, −1, +1, +3");
    expect(argSteps).toContain("mean square is 5");
    // The same numbers, not the same sentences: 717ae3d7 rewrote these steps (R2 now contains R1)
    // and kept every value. The RMS is the square root of the mean square 5, about 2.236, and the
    // mean distance is the plain average of the four magnitudes, 2.
    expect(argSteps).toContain("\\\\sqrt{5}");
    expect(argSteps).toMatch(/root-mean-square displacement[^"]*2\.236/);
    expect(argSteps).toContain("(3 + 1 + 1 + 3) / 4 = 2");

    // Both must point to Section 5 / mean-variance-rms foundation
    expect(entranceJson.bridge.whyUsefulHere).toContain("Section 5");
    expect(
      entranceJson.bridge.continueWith.some((r: { targetId: string }) =>
        r.targetId.includes("mean-variance-rms"),
      ),
    ).toBe(true);
  });
});
