import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkVoice } from "../../content/checks/voice/index.ts";
import { BM04_OUTPUTS, BM04_PRESETS } from "../../experiments/bm04/definition.ts";
import { createBm04Session, type PreparedBm04Example } from "../../experiments/bm04/session.ts";
import { SR02_OUTPUTS } from "../../experiments/sr02/definition.ts";
import { createSr02Session } from "../../experiments/sr02/session.ts";
import { SR13_OUTPUTS } from "../../experiments/sr13/definition.ts";
import { createSr13Session } from "../../experiments/sr13/session.ts";
import prepared from "../../generated/bm04-example.json";
import { CHAPTER_INVESTIGATION_KEYS } from "../../platform/storage/keys.ts";
import { createBm04Host } from "../../workers/host/bm04Host.ts";
import { CHAPTER_INVESTIGATIONS, chapterInvestigationAt } from "./chapterTasks.ts";
import { createInvestigationStore, type Reading } from "./core.ts";

const OUTPUTS = { "bm-04": BM04_OUTPUTS, "sr-02": SR02_OUTPUTS, "sr-13": SR13_OUTPUTS };

function value(reading: Reading, quantityId: string): number {
  const result = reading.outputs.find((output) => output.quantityId === quantityId);
  assert.ok(result);
  assert.equal(result.status, "value");
  assert.equal(typeof result.value, "number");
  return result.value as number;
}

describe("the additional chapter investigations", () => {
  test("every task has its own durable slot, real source anchor and owner outputs", () => {
    expect(CHAPTER_INVESTIGATIONS).toHaveLength(3);
    for (const chapter of CHAPTER_INVESTIGATIONS) {
      expect(chapter.id).toBe(chapter.task.promptId);
      expect(chapter.id).toBe(chapter.spec.promptId);
      expect(chapter.spec.experimentId).toBe(chapter.laboratory);
      expect(CHAPTER_INVESTIGATION_KEYS[chapter.id]).toBeDefined();
      expect(chapterInvestigationAt(chapter.paper, chapter.section)).toBe(chapter);
      expect(chapter.criteria.length).toBeGreaterThanOrEqual(2);
      expect(chapter.criteria.length).toBeLessThanOrEqual(4);
      const anchor = chapter.spec.sourceHref.split("#")[1];
      assert.ok(anchor);
      const argument = JSON.parse(
        readFileSync(
          new URL(`../../../content/arguments/${chapter.paper}/${anchor}.json`, import.meta.url),
          "utf8",
        ),
      );
      expect(argument.id).toBe(anchor);
      expect(argument.section).toBe(chapter.section);
      for (const quantity of chapter.spec.quantities) {
        expect(OUTPUTS[chapter.laboratory][quantity.id]).toBeDefined();
        expect(quantity.id).not.toBe("trajectoryPositions");
        expect(quantity.id).not.toBe("densityProfile");
      }
    }
    expect(chapterInvestigationAt("special-relativity", "s4")).toBeUndefined();
    expect(chapterInvestigationAt("brownian-motion", "s5")).toBeUndefined();
  });

  test("the prompts and feedback use the shared editorial voice rules", () => {
    for (const chapter of CHAPTER_INVESTIGATIONS) {
      const text = [
        chapter.title,
        chapter.task.task,
        chapter.task.perturbPrompt,
        chapter.task.explainPrompt,
        ...Object.values(chapter.feedback),
        ...chapter.explanation,
        ...chapter.criteria,
        chapter.revisit,
      ];
      for (const paragraph of text)
        expect(checkVoice(paragraph, { context: "task-feedback" })).toEqual([]);
    }
  });

  test("the Brownian comparison captures the actual worker owner's zero-force kicks change", async () => {
    const chapter = CHAPTER_INVESTIGATIONS[0];
    const example = prepared as PreparedBm04Example;
    const session = createBm04Session("chapter-kicks", example, () => {
      let receive: (message: unknown) => void = () => {};
      const host = createBm04Host(
        (message) => receive(structuredClone(message)),
        example.sourceDigest,
      );
      return {
        send(message: unknown) {
          void host.receive(structuredClone(message));
        },
        listen(listener: (message: unknown) => void) {
          receive = listener;
          queueMicrotask(() => host.hello());
          return () => {
            receive = () => {};
          };
        },
        dispose: host.dispose,
      };
    });
    const store = createInvestigationStore(chapter.spec);
    const disconnect = store.connect(session, example.sourceDigest);
    const settled = async () => {
      if (!session.getSnapshot().pending) return;
      await new Promise<void>((resolve) => {
        const unsubscribe = session.subscribe(() => {
          if (!session.getSnapshot().pending) {
            unsubscribe();
            resolve();
          }
        });
      });
    };
    try {
      expect(session.apply(BM04_PRESETS["zero-force-relaxation"].parameters).kind).toBe("accepted");
      expect(store.getSnapshot().current).toBeNull();
      await settled();
      expect(store.begin("Without kicks and without force, the step remains.", chapter.task).ok).toBe(true);
      const baseline = store.getSnapshot().report?.baseline.reading;
      assert.ok(baseline);
      expect(value(baseline, "kickDiffusivity")).toBeGreaterThan(0);
      expect(session.apply(BM04_PRESETS["naegeli-zero-force"].parameters).kind).toBe("accepted");
      expect(store.capture("Still pending").ok).toBe(false);
      await settled();
      expect(store.capture("Molecular kicks off").ok).toBe(true);
      const report = store.getSnapshot().report;
      assert.ok(report);
      const changed = report.observations[0]?.reading;
      assert.ok(changed);
      expect(changed.parameters.F).toBe(0);
      expect(changed.parameters.m).toBe(0);
      expect(value(changed, "kickDiffusivity")).toBe(0);
      expect(value(changed, "driftVelocity")).toBe(0);
      expect(changed.origin).toBe("accepted-laboratory-result");
      expect(report.baseline.reading).toEqual(baseline);
    } finally {
      disconnect();
      session.disconnect();
    }
  }, 10_000);

  test("the field task captures an observer change without creating a new run", () => {
    const chapter = CHAPTER_INVESTIGATIONS[1];
    const session = createSr02Session("chapter-fields");
    const store = createInvestigationStore(chapter.spec);
    store.connect(session, "fields-test-source");
    expect(store.begin("The charge at rest feels an electric force.", chapter.task).ok).toBe(true);
    const baseline = store.getSnapshot().report?.baseline.reading;
    assert.ok(baseline);
    expect(
      session.apply({ ...session.acceptedParameters(), descriptionFrame: "conductor-rest" }).kind,
    ).toBe("accepted");
    expect(store.capture("Conductor frame").ok).toBe(true);
    const changed = store.getSnapshot().report?.observations[0]?.reading;
    assert.ok(changed);
    expect(changed.parameters.descriptionFrame).toBe("conductor-rest");
    expect(changed.runId).toBe(baseline.runId);
    expect(changed.revisions.observer).toBeGreaterThan(baseline.revisions.observer ?? 0);
    expect(changed.outputs).toEqual(baseline.outputs);
    expect(value(changed, "electricFieldStationary")).toBe(0);
    expect(value(changed, "electricFieldMoving")).not.toBe(0);
  });

  test("the electron task changes convention while retaining its measured predictions", () => {
    const chapter = CHAPTER_INVESTIGATIONS[2];
    const session = createSr13Session("chapter-electron");
    const store = createInvestigationStore(chapter.spec);
    store.connect(session, "electron-test-source");
    expect(
      store.begin(
        "The force definition changes, while the electron follows the same path.",
        chapter.task,
      ).ok,
    ).toBe(true);
    const baseline = store.getSnapshot().report?.baseline.reading;
    assert.ok(baseline);
    const beforeTrajectory = session.getSnapshot().accepted?.outputs.find(
      (output) => output.quantityId === "trajectoryPositions",
    );
    expect(
      session.apply({ ...session.acceptedParameters(), forceConvention: "laboratory" }).kind,
    ).toBe("accepted");
    expect(store.capture("Planck's laboratory convention").ok).toBe(true);
    const changed = store.getSnapshot().report?.observations[0]?.reading;
    assert.ok(changed);
    expect(changed.parameters.forceConvention).toBe("laboratory");
    expect(changed.runId).toBe(baseline.runId);
    expect(value(changed, "lorentzFactor")).toBe(1.25);
    expect(value(changed, "kineticEnergy")).toBe(value(baseline, "kineticEnergy"));
    expect(
      value(changed, "transverseMassComoving") / value(changed, "transverseMassLaboratory"),
    ).toBeCloseTo(1.25, 12);
    expect(
      session.getSnapshot().accepted?.outputs.find(
        (output) => output.quantityId === "trajectoryPositions",
      ),
    ).toEqual(beforeTrajectory);
  });
});
