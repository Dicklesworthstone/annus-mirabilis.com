import { describe, expect, test } from "bun:test";
import { createAvogadroSession } from "../avogadro/session.ts";
import { createBm03Session } from "../bm03/session.ts";
import { createLightThreadSession } from "../lightThread/session.ts";
import { LQ03_TAPE } from "../lq03/tape.ts";
import { LQ04_TAPE } from "../lq04/tape.ts";
import { LQ05_TAPE } from "../lq05/tape.ts";
import { LQ06_TAPE } from "../lq06/tape.ts";
import { LQ07_TAPE } from "../lq07/tape.ts";
import { LQ08_TAPE } from "../lq08/tape.ts";
import { LQ09_TAPE } from "../lq09/tape.ts";
import { ME01_TAPE } from "../me01/tape.ts";
import { ME02_TAPE } from "../me02/tape.ts";
import { ME03_TAPE } from "../me03/tape.ts";
import { createShelfSession } from "../shelf/session.ts";
import { createSr01Session } from "../sr01/session.ts";
import { SR02_TAPE } from "../sr02/tape.ts";
import { SR04_TAPE } from "../sr04/tape.ts";
import { SR05_TAPE } from "../sr05/tape.ts";
import { SR06_TAPE } from "../sr06/tape.ts";
import { SR07_TAPE } from "../sr07/tape.ts";
import { SR08_TAPE } from "../sr08/tape.ts";
import { SR09_TAPE } from "../sr09/tape.ts";
import { SR10_TAPE } from "../sr10/tape.ts";
import { SR11_TAPE } from "../sr11/tape.ts";
import { SR12_TAPE } from "../sr12/tape.ts";
import { SR13_TAPE } from "../sr13/tape.ts";
import type { ExperimentView } from "../store/instanceStore.ts";
import type { TapeSession } from "./sessionTape.ts";

const bindings = [
  LQ03_TAPE,
  LQ04_TAPE,
  LQ05_TAPE,
  LQ06_TAPE,
  LQ07_TAPE,
  LQ08_TAPE,
  LQ09_TAPE,
  SR02_TAPE,
  SR04_TAPE,
  SR05_TAPE,
  SR06_TAPE,
  SR07_TAPE,
  SR08_TAPE,
  SR09_TAPE,
  SR10_TAPE,
  SR11_TAPE,
  SR12_TAPE,
  SR13_TAPE,
  ME01_TAPE,
  ME02_TAPE,
  ME03_TAPE,
];

type NativeOwner = Readonly<{
  apply(input: unknown): Readonly<{ kind: string }>;
  startNewRun(input: unknown): Readonly<{ kind: string }>;
  getSnapshot(): ExperimentView;
}>;

/** These three owners do not use a tape binding; read their real accepted parameters directly. */
function parametersOf(owner: NativeOwner): TapeSession {
  return {
    ...owner,
    acceptedParameters: () => {
      const accepted = owner.getSnapshot().accepted;
      if (!accepted) throw new Error("The native owner has no accepted result.");
      return accepted.parameters;
    },
  };
}

const factories: readonly Readonly<{
  id: string;
  create(instanceId: string): TapeSession;
}>[] = [
  ...bindings.map((binding) => ({
    id: binding.environment.experimentId,
    create: binding.createSession,
  })),
  { id: "bm-03", create: createBm03Session },
  { id: "sr-01", create: createSr01Session },
  { id: "avogadro", create: (id) => parametersOf(createAvogadroSession(id)) },
  { id: "light-thread", create: (id) => parametersOf(createLightThreadSession(id)) },
  {
    id: "shelf",
    create: (id) => parametersOf(createShelfSession("shelf-maxwell-galilean", "full", id)),
  },
];

describe("native synchronous run identity", () => {
  for (const entry of factories) {
    test(`${entry.id} explicitly forks unchanged settings in the same accepted owner`, () => {
      const instanceId = `${entry.id}-native-new-run`;
      const owner = entry.create(instanceId);
      const original = owner.getSnapshot().accepted;
      expect(original?.runId).toBeTruthy();
      expect(owner.startNewRun).toBeFunction();
      const parameters = { ...owner.acceptedParameters() };
      const runIds = new Set([original?.runId]);

      for (let attempt = 0; attempt < 2; attempt++) {
        const before = owner.getSnapshot().accepted;
        expect(owner.startNewRun?.(parameters).kind).toBe("accepted");
        const view = owner.getSnapshot();
        const accepted = view.accepted;
        expect(view.pending).toBe(false);
        expect(accepted?.runId).toBeTruthy();
        expect(runIds.has(accepted?.runId)).toBe(false);
        runIds.add(accepted?.runId);
        expect(accepted).toMatchObject({
          instanceId,
          parentRunId: before?.runId,
          final: true,
          parameters,
        });
        expect(accepted?.revisions.input).toBe((before?.revisions.input ?? 0) + 1);
        expect(owner.acceptedParameters()).toEqual(parameters);
      }

      const identified = owner.getSnapshot().accepted;
      expect(owner.apply(parameters).kind).toBe("accepted");
      expect(owner.getSnapshot().accepted?.runId).toBe(identified?.runId);
      const accepted = owner.getSnapshot().accepted;
      expect(owner.startNewRun?.(null).kind).not.toBe("accepted");
      expect(owner.getSnapshot().accepted).toBe(accepted);
    });
  }
});

for (const { binding, patch } of [
  { binding: ME01_TAPE, patch: { frameSpeed: 0.2, offsetDisplay: "offsets", notation: "modern" } },
  { binding: ME03_TAPE, patch: { boundary: "radiation", notation: "modern" } },
  { binding: LQ06_TAPE, patch: { volumeRatio: 0.25, selectedSubexpression: "N_E_over_R_beta_nu" } },
  { binding: SR08_TAPE, patch: { descriptionFrame: "moving", decomposeComponents: false } },
] as const) {
  test(`${binding.environment.experimentId} retains ordinary description changes and accepts all classes in a new run`, () => {
    const owner = binding.createSession(`${binding.environment.experimentId}-class-changes`);
    const before = owner.getSnapshot().accepted;
    const changed = { ...owner.acceptedParameters(), ...patch };
    expect(owner.apply(changed).kind).toBe("accepted");
    expect(owner.getSnapshot().accepted?.runId).toBe(before?.runId);
    expect(owner.acceptedParameters()).toEqual(changed);

    // Reapply the defaults as part of the explicit fork: observer, measurement and presentation
    // changes must all be accepted before the one final snapshot for the new run is published.
    expect(owner.startNewRun?.(binding.defaults).kind).toBe("accepted");
    expect(owner.getSnapshot().accepted).toMatchObject({
      parentRunId: before?.runId,
      final: true,
      parameters: binding.defaults,
    });
    expect(owner.getSnapshot().accepted?.runId).not.toBe(before?.runId);
    expect(owner.acceptedParameters()).toEqual(binding.defaults);
  });
}
