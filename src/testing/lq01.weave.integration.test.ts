import { describe, expect, test } from "bun:test";
import { LQ01_DEFAULTS } from "../experiments/lq01/definition.ts";
import type { ResultPredicateClause } from "../reader/weave/predicates.ts";
import { evaluateLq01 } from "../workers/operations/lq01.ts";

async function evaluateLq01WeaveClauses(
  params: Record<string, unknown>,
): Promise<ResultPredicateClause[]> {
  const comp = await evaluateLq01(params);
  if (comp.kind !== "accepted") return [];
  const outputs = comp.data.outputs;
  const centerI = outputs.find((o) => o.quantityId === "centerIntensity");
  const vis = outputs.find((o) => o.quantityId === "fringeVisibility");
  const shellP = outputs.find((o) => o.quantityId === "shellPower");
  const mode = String(params.mode ?? "interference");
  const readout = String(params.readout ?? "time-average");

  const visVal = vis?.status === "value" && typeof vis.value === "number" ? vis.value : 0;
  const shellPVal =
    shellP?.status === "value" && typeof shellP.value === "number" ? shellP.value : 0;
  const hasInterference = visVal > 0;
  const isTimeAveraged = readout === "time-average";
  const isSpreading = mode === "spreading" && shellPVal > 0;

  return [
    {
      id: "lq01-s0-wave-success",
      phrase: "continuous wave description excellently suited for purely optical phenomena",
      active: hasInterference && mode === "interference",
      tone: hasInterference ? "live" : "broken",
      caption:
        centerI?.status === "value"
          ? `Coherent wave interference creates stable fringes with visibility ${visVal.toFixed(2)}.`
          : "Wave pattern undefined.",
    },
    {
      id: "lq01-s0-time-averages",
      phrase: "optical observations concern time averages rather than instantaneous values",
      active: isTimeAveraged,
      tone: isTimeAveraged ? "live" : "held",
      caption: isTimeAveraged
        ? "Detectors record the time-averaged intensity ⟨I⟩ over millions of cycles."
        : "Viewing rapid instantaneous squared field oscillation.",
    },
    {
      id: "lq01-s0-energy-spreading",
      phrase: "energy of light from a point source spreads continuously over an ever larger volume",
      active: isSpreading,
      tone: isSpreading ? "live" : "held",
      caption: isSpreading
        ? `Radiant power ${shellPVal.toFixed(2)} W spreads over 4πr² with strict shell conservation.`
        : "Switch to spreading mode to inspect spherical geometric energy dilution.",
    },
  ];
}

describe("lq01.weave.integration: LQ-01 weave predicates integration (am-lq-01-wave-description-kv2r)", () => {
  test("evaluates lq01-s0-wave-success and lq01-s0-time-averages at default interference settings", async () => {
    const clauses = await evaluateLq01WeaveClauses(LQ01_DEFAULTS);
    expect(clauses).toHaveLength(3);

    const waveSuccess = clauses.find((c) => c.id === "lq01-s0-wave-success");
    const timeAverages = clauses.find((c) => c.id === "lq01-s0-time-averages");

    expect(waveSuccess?.active).toBe(true);
    expect(waveSuccess?.tone).toBe("live");
    expect(timeAverages?.active).toBe(true);
    expect(timeAverages?.tone).toBe("live");
  });

  test("lq01-s0-energy-spreading activates when mode is spreading", async () => {
    const clauses = await evaluateLq01WeaveClauses({ ...LQ01_DEFAULTS, mode: "spreading" });
    const spreading = clauses.find((c) => c.id === "lq01-s0-energy-spreading");

    expect(spreading?.active).toBe(true);
    expect(spreading?.tone).toBe("live");
    expect(spreading?.caption).toContain("spreads over 4πr²");
  });

  test("lq01-s0-time-averages dims when readout is instantaneous", async () => {
    const clauses = await evaluateLq01WeaveClauses({ ...LQ01_DEFAULTS, readout: "instantaneous" });
    const timeAverages = clauses.find((c) => c.id === "lq01-s0-time-averages");

    expect(timeAverages?.active).toBe(false);
    expect(timeAverages?.tone).toBe("held");
  });
});
