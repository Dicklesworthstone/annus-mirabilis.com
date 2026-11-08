/**
 * The 1905 boundary walkthrough reaches each recorded stop through the real ME-03 session.
 * am-rt-control-tapes-0gc: the emitting body loses energy, its radiation gains that energy,
 * and the isolated enclosure containing both retains its total energy and mass.
 */
import { afterAll, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WalkthroughControl } from "../../components/lab/WalkthroughControl.tsx";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { loadWalkthroughCatalogue } from "../../content/walkthroughs.ts";
import labDigests from "../../generated/lab-source-digests.json";
import { constantValue, getConstantSet } from "../../physics/reference/constants.ts";
import { TestLogger } from "../../testing/log/logger.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import { draftTapeForSettings, loadDraftTape } from "../permalink/draftTape.ts";
import { playWalkthrough } from "../permalink/playWalkthrough.ts";
import {
  type LabTapeBinding,
  restoreTape,
  settingsFromTape,
  tapeForSettings,
  tapeStateDigestV2,
  tapeStateOf,
} from "../permalink/sessionTape.ts";
import { validateControlTape } from "../tapes/schema.ts";
import { ME03_DEFAULTS } from "./definition.ts";
import { createMe03Session } from "./session.ts";
import { ME03_TAPE } from "./tape.ts";

const logger = new TestLogger("me03-boundary-walkthrough");
afterAll(() => logger.flush());

const recordUrl = new URL(
  "../../../content/experiments/tapes/where-the-energy-went.yaml",
  import.meta.url,
);
const record = validateControlTape(
  parseYaml(readFileSync(recordUrl, "utf8")),
  fileURLToPath(recordUrl),
);
const catalogue = loadWalkthroughCatalogue(fileURLToPath(new URL("../../../", import.meta.url)));
const expectedStops = [
  { actionIndex: 1, boundary: "body-alone", energy: -2 },
  { actionIndex: 2, boundary: "radiation", energy: 2 },
  { actionIndex: 3, boundary: "combined-isolated-system", energy: 0 },
] as const;

const changedSource: LabTapeBinding = {
  ...ME03_TAPE,
  environment: {
    ...ME03_TAPE.environment,
    artifactDigest: `host:sha256:${"f".repeat(64)}`,
  },
};

function walkthrough() {
  const found = catalogue.walkthroughs.find((item) => item.tapeId === record.tapeId);
  assert.ok(found, "The authored ME-03 walkthrough must reach the reader's catalogue.");
  return found;
}

function checkpoint(actionIndex: number) {
  const found = walkthrough().checkpoints.find((item) => item.actionIndex === actionIndex);
  assert.ok(found, `The walkthrough must expose its recorded action ${actionIndex}.`);
  return found;
}

function output(session: ReturnType<typeof createMe03Session>, quantityId: string) {
  const found = session
    .getSnapshot()
    .accepted?.outputs.find((item) => item.quantityId === quantityId);
  assert.ok(found, `The accepted ME-03 snapshot must contain ${quantityId}.`);
  return found;
}

function numericOutput(
  session: ReturnType<typeof createMe03Session>,
  quantityId: string,
  unit: string,
): number {
  const found = output(session, quantityId);
  expect(found.unit).toBe(unit);
  assert.ok(
    found.status === "value" && typeof found.value === "number",
    `${quantityId} must be an accepted scalar value.`,
  );
  return found.value;
}

describe("ME-03: where the energy went", () => {
  test("the authored sequence exposes three reachable, source-pinned boundaries", () => {
    const artifactDigest = labDigests["me-03"].replace(/^source:/, "host:");
    expect(artifactDigest).toMatch(/^host:sha256:[0-9a-f]{64}$/);
    expect(ME03_TAPE.environment.artifactDigest).toBe(artifactDigest);
    expect(record.modelIdentity.artifactDigest).toBe(artifactDigest);
    expect(record.initialConditions).toEqual(
      tapeStateOf({
        ...ME03_DEFAULTS,
        disposition: "retained",
        cardId: "me-03-sealed-lamp-and-mirror",
      }),
    );
    expect(record.checkpoints.map((item) => item.actionIndex)).toEqual([1, 2, 3]);
    expect(
      record.events.map((event) =>
        event.kind === "control"
          ? [event.actionIndex, event.commandClass, event.parameterId, event.value]
          : [event.kind],
      ),
    ).toEqual([
      [1, "setup-change", "emittedEnergy", 2],
      [2, "measurement-change", "boundary", "radiation"],
      [3, "measurement-change", "boundary", "combined-isolated-system"],
    ]);
    expect(walkthrough().checkpoints.map((item) => item.actionIndex)).toEqual([1, 2, 3]);

    for (const expected of expectedStops) {
      const stop = checkpoint(expected.actionIndex);
      assert.ok(stop.tape, `${stop.label} must carry a replayable checkpoint.`);
      expect(stop.unavailable).toBeUndefined();
      expect(stop.tape.teachingTapeRef).toBeUndefined();
      expect(stop.tape.modelIdentity.artifactDigest).toBe(artifactDigest);
      expect(stop.settings.boundary).toBe(expected.boundary);
      expect(stop.settings.emittedEnergy).toBe(2);
      expect(stop.settings.inputEnergy).toBe(0);
      expect(stop.settings.mode).toBe("1905");
    }

    logger.info("The recorded body, radiation and combined boundaries are reachable.", {
      testId: "authored-boundaries",
      tapeId: record.tapeId,
      actions: record.checkpoints.map((item) => item.actionIndex),
      artifactDigest,
    });
  });

  test("forward and backward seeks restore the real ledger and every recorded number", () => {
    const session = createMe03Session("me03-boundary-seek", {
      ...ME03_DEFAULTS,
      boundary: "radiation",
      emittedEnergy: 7,
      inputEnergy: 11,
      mode: "box-1906",
      notation: "modern",
    });
    const c = constantValue(getConstantSet(record.constantSetId), "speedOfLight").value;

    for (const actionIndex of [1, 2, 3, 2, 1, 3]) {
      const expected = expectedStops.find((item) => item.actionIndex === actionIndex);
      const recorded = record.checkpoints.find((item) => item.actionIndex === actionIndex);
      assert.ok(expected);
      assert.ok(recorded);
      const stop = checkpoint(actionIndex);
      assert.ok(stop.tape);

      expect(restoreTape(ME03_TAPE, session, stop.tape)).toEqual({ kind: "restored" });
      const parameters = session.acceptedParameters();
      expect(parameters).toEqual({
        ...ME03_DEFAULTS,
        ...settingsFromTape(stop.settings, ME03_DEFAULTS),
      });
      expect(parameters.boundary).toBe(expected.boundary);
      expect(parameters.emittedEnergy).toBe(2);
      expect(parameters.inputEnergy).toBe(0);
      expect(parameters.mode).toBe("1905");
      expect(numericOutput(session, "energyChange", "J")).toBe(expected.energy);
      expect(numericOutput(session, "radiationEnergyChange", "J")).toBe(2);
      expect(numericOutput(session, "systemEnergyChange", "J")).toBe(0);
      expect(numericOutput(session, "systemMassChange", "kg")).toBe(0);

      const mass = output(session, "massChange");
      expect(mass.unit).toBe("kg");
      if (expected.boundary === "radiation") {
        assert.ok(mass.status === "not-applicable");
        expect("value" in mass).toBe(false);
        expect(mass.reason).toContain("rest mass");
      } else if (expected.boundary === "body-alone") {
        const value = numericOutput(session, "massChange", "kg");
        expect(value).toBeLessThan(0);
        expect(
          withinTolerance(value, -parameters.emittedEnergy / (c * c), {
            relative: 1e-12,
          }).ok,
        ).toBe(true);
      } else {
        expect(numericOutput(session, "massChange", "kg")).toBe(0);
      }
      expect(output(session, "radiationMassChange").status).toBe("not-applicable");

      const displayed = recorded.expectedDisplayValues ?? [];
      expect(displayed.some((item) => item.outputId === "energyChange")).toBe(true);
      for (const item of displayed) {
        assert.ok(item.outputId, "Each authored number must identify its owner output.");
        expect(item.constantSetId).toBe(record.constantSetId);
        const actual = numericOutput(session, item.outputId, item.unit);
        if (item.value === 0) {
          expect(actual).toBe(0);
        } else {
          // An absolute tolerance would incorrectly accept zero for this tiny mass change.
          expect(withinTolerance(actual, item.value, { relative: 1e-12 }).ok).toBe(true);
        }
      }

      const state = tapeStateOf(parameters);
      assert.ok(state);
      expect(tapeStateDigestV2(state, actionIndex)).toBe(stop.tape.acceptedCheckpoint.digest);
      logger.info("A recorded boundary was restored through the real ME-03 owner.", {
        testId: `seek-action-${actionIndex}`,
        actionIndex,
        boundary: parameters.boundary,
        energyChange: expected.energy,
        massStatus: mass.status,
        recordedValuesChecked: displayed.length,
        digest: stop.tape.acceptedCheckpoint.digest,
      });
    }
  });

  test("changed source and damaged checkpoints leave the live experiment untouched", () => {
    const stop = checkpoint(2);
    assert.ok(stop.tape);
    const scenarios = [
      { name: "changed-source", binding: changedSource, tape: stop.tape },
      {
        name: "damaged-checkpoint",
        binding: ME03_TAPE,
        tape: {
          ...stop.tape,
          acceptedCheckpoint: {
            ...stop.tape.acceptedCheckpoint,
            digest: "host:0000000000000000",
          },
        },
      },
    ];

    for (const scenario of scenarios) {
      const session = createMe03Session(`me03-refuse-${scenario.name}`, {
        ...ME03_DEFAULTS,
        emittedEnergy: 9,
        inputEnergy: 4,
        disposition: "retained",
      });
      const before = session.getSnapshot();
      const result = restoreTape(scenario.binding, session, scenario.tape);
      expect(result.kind).toBe("not-restored");
      expect(session.getSnapshot()).toBe(before);
      if (scenario.name === "changed-source" && result.kind === "not-restored") {
        assert.ok(record.modelIdentity.artifactDigest);
        assert.ok(changedSource.environment.artifactDigest);
        expect(result.notice).toContain(record.modelIdentity.artifactDigest);
        expect(result.notice).toContain(changedSource.environment.artifactDigest);
      }
      logger.info("A refused replay preserved the existing accepted snapshot.", {
        testId: scenario.name,
        refusal: result.kind,
      });
    }
  });

  test("the published Play control offers and replays the completed boundary sequence", () => {
    const session = createMe03Session("me03-published-walkthrough");
    const markup = renderToStaticMarkup(
      createElement(WalkthroughControl, { binding: ME03_TAPE, session }),
    );
    expect(markup).toContain('data-walkthrough="where-the-energy-went"');
    expect(markup).not.toContain('data-walkthrough="the-1906-box"');
    const played = playWalkthrough(ME03_TAPE, session, record.tapeId);
    assert.ok(played.kind === "played", "The default published resolver must play this tape.");
    expect(played.steps).toBe(3);
    expect(played.isNewRun).toBe(false);
    expect(session.acceptedParameters().boundary).toBe("combined-isolated-system");
    expect(numericOutput(session, "energyChange", "J")).toBe(0);
    expect(numericOutput(session, "massChange", "kg")).toBe(0);
    logger.info("The published Play control replays all three recorded boundaries.", {
      testId: "published-play-control",
      tapeId: played.tapeId,
      steps: played.steps,
      isNewRun: played.isNewRun,
    });
  });

  test("new ME-03 shares retain the source identity through restore and draft loading", () => {
    const source = createMe03Session("me03-share-source");
    const stop = checkpoint(2);
    assert.ok(stop.tape);
    expect(restoreTape(ME03_TAPE, source, stop.tape)).toEqual({ kind: "restored" });
    const parameters = source.acceptedParameters();

    const shared = tapeForSettings(ME03_TAPE, parameters);
    const draft = draftTapeForSettings(ME03_TAPE, parameters);
    assert.ok(shared);
    assert.ok(draft);
    expect(shared.modelIdentity.artifactDigest).toBe(ME03_TAPE.environment.artifactDigest);
    expect(draft.modelIdentity.artifactDigest).toBe(ME03_TAPE.environment.artifactDigest);

    const target = createMe03Session("me03-share-target");
    expect(restoreTape(ME03_TAPE, target, shared)).toEqual({ kind: "restored" });
    expect(target.acceptedParameters()).toEqual(parameters);
    expect(numericOutput(target, "energyChange", "J")).toBe(2);
    expect(output(target, "massChange").status).toBe("not-applicable");
    expect(loadDraftTape(ME03_TAPE, draft)).toEqual({
      kind: "loaded",
      settings: parameters,
    });

    const before = target.getSnapshot();
    expect(restoreTape(changedSource, target, shared).kind).toBe("not-restored");
    expect(target.getSnapshot()).toBe(before);
    expect(loadDraftTape(changedSource, draft).kind).toBe("not-restored");
    logger.info("Both settings tape producers preserved the verified ME-03 source identity.", {
      testId: "source-pinned-settings-shares",
      artifactDigest: shared.modelIdentity.artifactDigest,
      boundary: parameters.boundary,
    });
  });

  test("environments without a source pin keep the optional tape field absent", () => {
    const { artifactDigest: _artifactDigest, ...environment } = ME03_TAPE.environment;
    const unpinned: LabTapeBinding = { ...ME03_TAPE, environment };
    for (const tape of [
      tapeForSettings(unpinned, ME03_DEFAULTS),
      draftTapeForSettings(unpinned, ME03_DEFAULTS),
    ]) {
      assert.ok(tape);
      expect(tape.modelIdentity).not.toHaveProperty("artifactDigest");
    }
    logger.info("Unpinned bindings omit the optional identity field in both producers.", {
      testId: "absent-source-pin",
    });
  });
});
