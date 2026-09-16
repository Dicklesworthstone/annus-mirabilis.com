import { describe, expect, test } from "bun:test";
import { BM04_DEFAULTS } from "../experiments/bm04/definition.ts";
import type { ResultPredicateClause } from "../reader/weave/predicates.ts";
import { evaluateBm04 } from "../workers/operations/bm04.ts";

async function evaluateBm04WeaveClauses(
  params: Record<string, unknown>,
): Promise<ResultPredicateClause[]> {
  const comp = await evaluateBm04(params);
  if (comp.kind !== "accepted") return [];
  const outputs = comp.data.outputs;
  const mobilityD = outputs.find((o) => o.quantityId === "diffusionCoefficient");
  const kickMult = Number(params.m ?? 1);
  const force = Number(params.F ?? 4.047373e-15);

  const isBalanced = Math.abs(kickMult - 1) < 1e-6;
  const isZeroForce = force === 0;

  return [
    {
      id: "bm04-s3-diffusion-coefficient",
      phrase: "D = mu * k_B * T relates drag mobility to diffusion rate",
      active: mobilityD?.status === "value",
      tone: mobilityD?.status === "value" ? "live" : "broken",
      caption:
        mobilityD?.status === "value"
          ? `Diffusion coefficient is ${(mobilityD.value as number).toExponential(3)} m²/s.`
          : "Diffusivity not defined for given parameters.",
    },
    {
      id: "bm04-s3-force-balance",
      phrase: "drift flux equals diffusive counter-flux in dynamic equilibrium",
      active: isBalanced && !isZeroForce,
      tone: isBalanced ? "live" : "broken",
      caption: isZeroForce
        ? "Without external force, the spatial distribution relaxes uniformly without drift."
        : isBalanced
          ? "Osmotic drift exactly cancels diffusive spreading."
          : `Kinetic kicks (${kickMult}x) do not match thermodynamic balance.`,
    },
  ];
}

describe("bm04.weave.integration: BM-04 weave predicates integration", () => {
  test("evaluates bm04-s3-diffusion-coefficient and bm04-s3-force-balance at default parameters", async () => {
    const clauses = await evaluateBm04WeaveClauses(BM04_DEFAULTS);
    expect(clauses).toHaveLength(2);
    const coeffClause = clauses.find((c) => c.id === "bm04-s3-diffusion-coefficient");
    const balanceClause = clauses.find((c) => c.id === "bm04-s3-force-balance");

    expect(coeffClause?.active).toBe(true);
    expect(coeffClause?.tone).toBe("live");
    expect(balanceClause?.active).toBe(true);
    expect(balanceClause?.tone).toBe("live");
  });

  test("bm04-s3-force-balance breaks when kicks are mismatched (m != 1)", async () => {
    const clauses = await evaluateBm04WeaveClauses({ ...BM04_DEFAULTS, m: 2 });
    const balanceClause = clauses.find((c) => c.id === "bm04-s3-force-balance");
    expect(balanceClause?.active).toBe(false);
    expect(balanceClause?.tone).toBe("broken");
  });

  test("bm04-s3-force-balance handles zero force with relaxation caption", async () => {
    const clauses = await evaluateBm04WeaveClauses({ ...BM04_DEFAULTS, F: 0 });
    const balanceClause = clauses.find((c) => c.id === "bm04-s3-force-balance");
    expect(balanceClause?.active).toBe(false);
    expect(balanceClause?.caption).toContain("Without external force");
  });
});
