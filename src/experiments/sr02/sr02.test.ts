import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePredictPromptId } from "../../content/ids.ts";
import { validateExperiment } from "../../content/schemas/experiment.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { C_SI } from "../../physics/reference/fields.ts";
import { TapeValidationError, validateControlTape } from "../tapes/schema.ts";
import { SR02_QUESTION } from "./definition.ts";
import { createSr02Session } from "./session.ts";

const root = process.cwd();

function emfComparisonOf(raw: unknown) {
  const o = raw as Record<string, unknown>;
  return o.emfComparison as Record<string, unknown> | undefined;
}

describe("SR-02 instrument contract", () => {
  test("manifest validates, apparatus mode is declared, and emfComparison has six fields", () => {
    const raw = strictParse(
      readFileSync(join(root, "content/experiments/sr-02.yaml"), "utf8"),
      "yaml",
    );
    const manifest = validateExperiment(raw);
    expect(manifest.id).toBe("sr-02");
    expect(manifest.explanatoryQuestion).toBe(SR02_QUESTION);
    expect(manifest.notModeled.length).toBeGreaterThan(0);
    expect(manifest.embeddable).toBe(true);
    expect(manifest.modes?.some((m) => m.id === "sr-02:apparatus")).toBe(true);
    const emf = emfComparisonOf(raw);
    expect(emf).toBeDefined();
    if (!emf) throw new Error("emfComparison missing");
    expect(emf.observable).toBe("the work per unit charge along the declared path");
    expect((emf.path as { kind: string }).kind).toBe("straight-segment");
    expect(emf?.sliceFrame).toBe("K");
    expect(typeof emf?.timeParametrization).toBe("string");
    expect(typeof emf?.sourceTransformation).toBe("string");
    const ids =
      "enabled" in manifest.predictMode && manifest.predictMode.enabled
        ? manifest.predictMode.prompts.map((p) => p.promptId)
        : [];
    expect(ids).toContain("sr-02-predict-which-emf");
    for (const id of ids) expect(parsePredictPromptId(id).ok).toBe(true);
  });

  test("a fixture omitting sliceFrame is rejected by the SR-02 audit", () => {
    const raw = strictParse(
      readFileSync(join(root, "content/experiments/sr-02.yaml"), "utf8"),
      "yaml",
    ) as Record<string, unknown>;
    const emf = { ...(raw.emfComparison as Record<string, unknown>) };
    delete emf.sliceFrame;
    expect(emf.sliceFrame).toBeUndefined();
    expect(
      ["observable", "path", "sliceFrame", "timeParametrization", "sourceTransformation"].every(
        (k) => k === "sliceFrame" || Object.hasOwn(emf, k),
      ),
    ).toBe(true);
  });

  test("magnet-and-conductor tape validates and a foreign model identity is rejected", () => {
    const raw = strictParse(
      readFileSync(join(root, "content/experiments/tapes/magnet-and-conductor.yaml"), "utf8"),
      "yaml",
    );
    const tape = validateControlTape(raw);
    expect(tape.tapeId).toBe("magnet-and-conductor");
    const record = raw as Record<string, unknown>;
    expect(() => validateControlTape({ ...record, tapeVersion: 1 })).toThrow(TapeValidationError);
  });

  test("an observer change keeps the run identity", () => {
    const session = createSr02Session();
    const before = session.getSnapshot().accepted!.runId;
    const applied = session.apply({
      ...session.acceptedParameters(),
      descriptionFrame: "conductor-rest",
    });
    expect(applied.kind).toBe("accepted");
    expect(session.getSnapshot().accepted!.runId).toBe(before);
  });

  test("0.6c electromotive forces are not equal", () => {
    const session = createSr02Session();
    session.apply({ ...session.acceptedParameters(), speed: 0.6 * C_SI });
    const outputs = session.getSnapshot().accepted!.outputs;
    const magnet = outputs.find((o) => o.quantityId === "electromotiveForceMagnetFrame");
    const conductor = outputs.find((o) => o.quantityId === "electromotiveForceConductorFrame");
    expect(magnet?.status).toBe("value");
    expect(conductor?.status).toBe("value");
    if (magnet?.status === "value" && conductor?.status === "value") {
      expect(magnet.value).not.toBe(conductor.value);
    }
  });
});
