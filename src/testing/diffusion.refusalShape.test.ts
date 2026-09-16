import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { refusalCodeRegistry } from "../experiments/results/refusalCodes.ts";
import { getConstantSet } from "../physics/reference/constants.ts";
import { driftDiffusionFrames1d } from "../physics/reference/diffusion.ts";

const modern = getConstantSet("modern-si-2019");

function isRefusalShape(r: {
  code: string;
  domainKind: string;
  affected: object;
  message: string;
  rankedRepairs: unknown;
  details?: object;
}): boolean {
  return (
    typeof r.code === "string" &&
    typeof r.domainKind === "string" &&
    typeof r.message === "string" &&
    Array.isArray(r.rankedRepairs) &&
    typeof r.affected === "object"
  );
}

describe("refusal shape", () => {
  test("drift-diffusion-unstable and drift-cfl-exceeded are registered and emitted", () => {
    expect(refusalCodeRegistry["drift-diffusion-unstable"]).toBeDefined();
    expect(refusalCodeRegistry["drift-cfl-exceeded"]).toBeDefined();
    const voice = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../content/editorial/voice-rules.yaml"),
      "utf8",
    );
    expect(voice.includes("drift-diffusion-unstable")).toBe(true);
    expect(voice.includes("drift-cfl-exceeded")).toBe(true);
    const unstable = driftDiffusionFrames1d({
      cells: 10,
      width: 1,
      frames: 2,
      stepsPerFrame: 1,
      dt: 10,
      kickDiffusivity: 0.4294396,
      mobility: 1,
      force: 0.4,
      temperature: 293.15,
      profile: "uniform",
      set: modern,
    });
    expect(unstable.kind).toBe("refused");
    if (unstable.kind === "refused") {
      expect(isRefusalShape(unstable.refusal)).toBe(true);
      expect(unstable.refusal.code).toBe("drift-diffusion-unstable");
      expect("ratio" in (unstable.refusal.details ?? {})).toBe(true);
      expect("dtMax" in (unstable.refusal.details ?? {})).toBe(true);
      expect("limit" in (unstable.refusal.details ?? {})).toBe(true);
    }
    const cfl = driftDiffusionFrames1d({
      cells: 10,
      width: 1,
      frames: 2,
      stepsPerFrame: 1,
      dt: 10,
      kickDiffusivity: 0,
      mobility: 1,
      force: 5,
      temperature: 293.15,
      profile: "uniform",
      set: modern,
    });
    expect(cfl.kind).toBe("refused");
    if (cfl.kind === "refused") {
      expect(isRefusalShape(cfl.refusal)).toBe(true);
      expect(cfl.refusal.code).toBe("drift-cfl-exceeded");
      expect("courant" in (cfl.refusal.details ?? {})).toBe(true);
    }
  });
});
