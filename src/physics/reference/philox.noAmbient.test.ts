import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Philox No Ambient Randomness Verification", () => {
  test("src/physics/reference/philox.ts contains zero Math.random occurrences", () => {
    const philoxPath = join(process.cwd(), "src/physics/reference/philox.ts");
    const philoxSource = readFileSync(philoxPath, "utf8");

    // Remove comments
    const codeOnly = philoxSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

    expect(codeOnly.includes("Math.random")).toBe(false);
  });

  test("diffusion and reference evaluators do not use Math.random", () => {
    const diffusionPath = join(process.cwd(), "src/physics/reference/diffusion.ts");
    const diffusionSource = readFileSync(diffusionPath, "utf8");

    const codeOnly = diffusionSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

    expect(codeOnly.includes("Math.random")).toBe(false);
  });
});
