import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WALK_KERNELS } from "../physics/reference/diffusion/walkLaws.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * am-bm-05-random-steps-ntzl acceptance criterion: "The manifest's export kernel ids match the
 * kernel 2 versus kernel 3 resolution recorded in docs/FRANKENSIM_BINDING.md." No content
 * manifest exists yet for BM-05 (content/experiments/bm-05.yaml is not built this pass -- see
 * the commit message), so this checks the one place that resolution is currently encoded,
 * src/physics/reference/diffusion/walkLaws.ts's WALK_KERNELS, directly against the binding
 * doc's own prose, rather than against a manifest that doesn't exist. When the manifest lands,
 * it should assert equality against WALK_KERNELS rather than duplicate this doc scrape.
 */
describe("BM-05 kernel-id resolution matches docs/FRANKENSIM_BINDING.md decision (a)", () => {
  const binding = readFileSync(join(root, "docs/FRANKENSIM_BINDING.md"), "utf8");

  test("the binding doc documents kernel 3 as the physically scaled Gaussian with variance 2*D*dt", () => {
    expect(binding).toContain(
      "Kernel 3 is the physically scaled Gaussian with per-step variance 2 D dt.",
    );
  });

  test("the binding doc explicitly refuses kernel 2 for physical labels and names BM-05 as the kernel-2 consumer", () => {
    expect(binding).toContain(
      "BM-01's physical tracer ensemble uses kernel 3 (or 0 or 1). BM-05 may use kernel 2 as the unit-step teaching walk beside the physically scaled kernels.",
    );
  });

  test("WALK_KERNELS binds the physical Gaussian option to stepKernel 3, matching the doc", () => {
    expect(WALK_KERNELS.gaussian.stepKernel).toBe(3);
    expect(binding).toContain("bind the physical Gaussian to `stepKernel` 3");
  });

  test("WALK_KERNELS' coin and uniform ids (0 and 1) match the doc's own numbering for those kernels", () => {
    expect(WALK_KERNELS.coin.stepKernel).toBe(0);
    expect(WALK_KERNELS.uniform.stepKernel).toBe(1);
  });

  test("the fourth-moment factors pinned in WALK_KERNELS match the doc's TypeScript walk-law agreement note", () => {
    expect(binding).toContain(
      "pin `fourthMomentFactor` 1 (coin, excess kurtosis −2), 1.8 (uniform, −1.2), and 3 (Gaussian, 0)",
    );
    expect(WALK_KERNELS.coin.fourthMomentFactor).toBe(1);
    expect(WALK_KERNELS.coin.excessKurtosis).toBe(-2);
    expect(WALK_KERNELS.uniform.fourthMomentFactor).toBe(1.8);
    expect(WALK_KERNELS.uniform.excessKurtosis).toBe(-1.2);
    expect(WALK_KERNELS.gaussian.fourthMomentFactor).toBe(3);
    expect(WALK_KERNELS.gaussian.excessKurtosis).toBe(0);
  });

  test("id 2 (the dimensionless unit-variance teaching kernel) is never used as WALK_KERNELS' Gaussian id", () => {
    expect(WALK_KERNELS.gaussian.stepKernel).not.toBe(2);
  });
});
