import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePredictPromptId } from "../../content/ids.ts";
import { validateExperiment } from "../../content/schemas/experiment.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { LQ05_DEFAULTS, LQ05_QUESTION } from "../../experiments/lq05/definition.ts";
import { validateLq05Parameters } from "../../experiments/lq05/parameters.ts";
import { decodeLq05Settings, encodeLq05Settings } from "../../experiments/lq05/permalink.ts";
import {
  buildLq05Snapshot,
  createLq05Session,
  evaluateLq05,
} from "../../experiments/lq05/session.ts";
import {
  binomialInside,
  enumerateConfigurations,
  independentPointsProbability,
  lockedPositionsProbability,
  sampleIndependentPoints,
} from "../../physics/reference/radiation.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("LQ-05 independent configurations & locked-positions counterexample", () => {
  test("manifest validates, prompt ids parse, and presets are present", () => {
    const raw = strictParse(
      readFileSync(join(root, "content/experiments/lq-05.yaml"), "utf8"),
      "yaml",
    );
    const manifest = validateExperiment(raw);
    expect(manifest.id).toBe("lq-05");
    expect(manifest.explanatoryQuestion).toBe(LQ05_QUESTION);
    expect(manifest.notModeled.length).toBeGreaterThan(0);

    const ids =
      "enabled" in manifest.predictMode && manifest.predictMode.enabled
        ? manifest.predictMode.prompts.map((p) => p.promptId)
        : [];
    expect(ids).toContain("lq-05-predict-ten-points");
    expect(ids).toContain("lq-05-predict-locked");
    for (const id of ids) {
      const parsed = parsePredictPromptId(id);
      expect(parsed.ok).toBe(true);
    }
  });

  test("readings-owner record exists and validates as YAML", () => {
    const raw = strictParse(
      readFileSync(
        join(
          root,
          "content/editorial/readings-owners/am-lq-05-independent-configurations-jtvo.yaml",
        ),
        "utf8",
      ),
      "yaml",
    );
    expect(raw).toBeDefined();
    expect((raw as { ownerBeadId: string }).ownerBeadId).toBe(
      "am-lq-05-independent-configurations-jtvo",
    );
  });

  test("teaching tapes validate as YAML", () => {
    const lockedTape = strictParse(
      readFileSync(join(root, "content/experiments/tapes/the-locked-positions.yaml"), "utf8"),
      "yaml",
    );
    expect((lockedTape as { tapeId: string }).tapeId).toBe("the-locked-positions");

    const stageETape = strictParse(
      readFileSync(join(root, "content/experiments/tapes/lq-05-journey-stage-e.yaml"), "utf8"),
      "yaml",
    );
    expect((stageETape as { tapeId: string }).tapeId).toBe("lq-05-journey-stage-e");
  });

  test("golden fixture: n=4, f=1/2 gives exact W = 1/16", () => {
    const res = independentPointsProbability(4, 0.5);
    expect(res.value).toBeCloseTo(0.0625, 10);
    expect(res.lnW).toBeCloseTo(4 * Math.log(0.5), 10);
    expect(res.deltaSOverKb).toBeCloseTo(4 * Math.log(0.5), 10);

    const exactRes = independentPointsProbability(4, { p: 1n, q: 2n });
    expect(exactRes.exactRational?.numerator).toBe(1n);
    expect(exactRes.exactRational?.denominator).toBe(16n);
  });

  test("golden fixture: n=10, f=1/2 gives W = 1/1024 and deltaS/k = -6.931472", () => {
    const res = independentPointsProbability(10, 0.5);
    expect(res.value).toBeCloseTo(1 / 1024, 10);
    expect(res.deltaSOverKb).toBeCloseTo(-6.931471805599453, 6);

    const exactRes = independentPointsProbability(10, { p: 1n, q: 2n });
    expect(exactRes.exactRational?.numerator).toBe(1n);
    expect(exactRes.exactRational?.denominator).toBe(1024n);
  });

  test("golden fixture: n=60, f=1/2 evaluates in log-space without nonfinite numbers", () => {
    const res = independentPointsProbability(60, 0.5);
    expect(res.value).toBeCloseTo(0.5 ** 60, 24);
    expect(res.log10W).toBeCloseTo(60 * Math.log10(0.5), 6);
    expect(res.log10W).toBeCloseTo(-18.0617997, 5);
    expect(Number.isFinite(res.lnW)).toBe(true);

    const snapshot = buildLq05Snapshot(
      "inst-60",
      "run-60",
      null,
      {
        ...LQ05_DEFAULTS,
        n: 60,
        f: 0.5,
      },
      1,
      0,
    );
    for (const out of snapshot.outputs) {
      if (out.status === "value" && typeof out.value === "number") {
        expect(Number.isFinite(out.value)).toBe(true);
      }
    }
  });

  test("golden fixture: n=10, f=1/4 gives exact W = 1/1048576", () => {
    const res = independentPointsProbability(10, { p: 1n, q: 4n });
    expect(res.value).toBeCloseTo(1 / 1048576, 12);
    expect(res.exactRational?.numerator).toBe(1n);
    expect(res.exactRational?.denominator).toBe(1048576n);
  });

  test("adversarial fixture: locked-positions probability is f, NOT f^n", () => {
    const pIndep = independentPointsProbability(10, 0.5);
    const pLocked = lockedPositionsProbability(10, 0.5);

    // The locked position probability MUST be f = 0.5
    expect(pLocked.value).toBe(0.5);
    // The independent probability is 0.5^10 = 0.0009765625
    expect(pIndep.value).toBeCloseTo(0.0009765625, 8);

    // Adversarial assertion: they are NOT equal; locked is 512 times larger
    expect(pLocked.value).not.toBe(pIndep.value);
    expect(pLocked.value / pIndep.value).toBe(512);

    // Evaluate lq-05 with locked = true vs false
    const evalIndep = evaluateLq05({ ...LQ05_DEFAULTS, n: 10, f: 0.5, locked: false });
    const evalLocked = evaluateLq05({ ...LQ05_DEFAULTS, n: 10, f: 0.5, locked: true });

    const outIndep = evalIndep.outputs.find((o) => o.quantityId === "configurationProbability");
    const outLocked = evalLocked.outputs.find((o) => o.quantityId === "configurationProbability");
    expect(outIndep?.status).toBe("value");
    if (outIndep?.status === "value" && typeof outIndep.value === "number") {
      expect(outIndep.value).toBeCloseTo(0.5 ** 10, 10);
    }
    expect(outLocked?.status).toBe("value");
    if (outLocked?.status === "value" && typeof outLocked.value === "number") {
      expect(outLocked.value).toBe(0.5);
    }
  });

  test("enumeration budget: m=2, n=20 is admitted; m=2, n=21 returns budget-exhausted outcome", () => {
    const enum20 = enumerateConfigurations(20, 2);
    expect(enum20.status).toBe("value");
    if (enum20.status === "value") {
      expect(enum20.totalConfigurations).toBe(1048576);
      expect(enum20.favorableConfigurations).toBe(1);
    }

    const enum21 = enumerateConfigurations(21, 2);
    expect(enum21.status).toBe("execution-outcome");
    if (enum21.status === "execution-outcome") {
      expect(enum21.outcome.outcome).toBe("budget-exhausted");
    }
  });

  test("binomial distribution: probabilities sum to 1 and peak at expected mode", () => {
    const dist = binomialInside(10, 0.5);
    const sum = dist.terms.reduce((acc, term) => acc + term.probability, 0);
    expect(sum).toBeCloseTo(1.0, 10);
    expect(dist.terms.length).toBe(11);

    // For n=10, f=0.5, peak is at k=5
    let maxK = 0;
    let maxProb = 0;
    for (const term of dist.terms) {
      if (term.probability > maxProb) {
        maxProb = term.probability;
        maxK = term.k;
      }
    }
    expect(maxK).toBe(5);
    expect(maxProb).toBeCloseTo(252 / 1024, 10);
    expect(dist.terms[5]?.exactProbability.numerator).toBe(252n);
    expect(dist.terms[5]?.exactProbability.denominator).toBe(1024n);
  });

  test("deterministic Philox sampling: identical seeds produce identical success counts", () => {
    const res1 = sampleIndependentPoints({ n: 4, f: 0.5, trials: 1000, seed: "123456789" });
    const res2 = sampleIndependentPoints({ n: 4, f: 0.5, trials: 1000, seed: "123456789" });
    const resDiff = sampleIndependentPoints({ n: 4, f: 0.5, trials: 1000, seed: "987654321" });

    expect(res1.successCount).toBe(res2.successCount);
    expect(res1.sampleFraction).toBe(res2.sampleFraction);
    expect(res1.drawCountAfter).toBe(4000);
    expect(resDiff.drawCountAfter).toBe(4000);
  });

  test("seed transport roundtrip parses large 64-bit uint seeds", () => {
    const largeSeeds = [
      "0",
      "1",
      "9007199254740991", // 2^53 - 1
      "9007199254740992", // 2^53
      "18446744073709551615", // 2^64 - 1
    ];

    for (const s of largeSeeds) {
      const params = {
        ...LQ05_DEFAULTS,
        seed: s,
      };
      const query = encodeLq05Settings(params);
      const decoded = decodeLq05Settings(query);
      if (decoded.kind === "settings") {
        expect(decoded.parameters.seed).toBe(s);
      } else {
        expect(decoded.kind).toBe("settings");
      }
    }
  });

  test("session creation and snapshot conform to ExperimentSession contract", () => {
    const session = createLq05Session("lq05-test-session", LQ05_DEFAULTS);
    const snap = session.getSnapshot();
    expect(snap.status).toBe("accepted");
    expect(snap.accepted?.experimentId).toBe("lq-05");
    expect(snap.accepted?.instanceId).toBe("lq05-test-session");
    expect(snap.accepted?.outputs.length).toBeGreaterThanOrEqual(4);

    session.apply({ ...LQ05_DEFAULTS, n: 8, f: 0.25 });
    const updated = session.getSnapshot();
    expect(updated.accepted?.parameters.n).toBe(8);
    expect(updated.accepted?.parameters.f).toBe(0.25);
  });

  test("parameter validation catches invalid ranges", () => {
    const valid = validateLq05Parameters(LQ05_DEFAULTS);
    expect(valid.kind).toBe("accepted");

    const badN = validateLq05Parameters({ ...LQ05_DEFAULTS, n: 0 });
    expect(badN.kind).toBe("refused");

    const badFrac = validateLq05Parameters({ ...LQ05_DEFAULTS, f: 1.5 });
    expect(badFrac.kind).toBe("refused");

    const zeroFrac = validateLq05Parameters({ ...LQ05_DEFAULTS, f: 0 });
    expect(zeroFrac.kind).toBe("refused");
  });
});
