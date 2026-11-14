import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import {
  createInvestigationStore,
  readInvestigationEvidence,
} from "../discovery/investigation/core.ts";
import { INVESTIGATIONS } from "../discovery/investigation/specs.ts";
import { PPE_TASK as LIGHT_TASK } from "../discovery/lightQuanta/journeyI.ts";
import { PPE_TASK as MASS_TASK } from "../discovery/massEnergy/journeyIV.ts";
import { PPE_TASK as CLOCK_TASK } from "../discovery/relativity/journeyIII.ts";
import { createLq08Session, type PreparedLq08Example } from "../experiments/lq08/session.ts";
import { createMe03Session } from "../experiments/me03/session.ts";
import { createSr05Session, type PreparedSr05Example } from "../experiments/sr05/session.ts";
import photoelectric from "../generated/lq08-example.json";
import clocks from "../generated/sr05-example.json";
import { chapterInvestigationSession } from "./chapterInvestigationSession.ts";

describe("chapter capture follows actual owner attempts", () => {
  const cases = [
    {
      paper: "light-quanta" as const,
      task: LIGHT_TASK,
      owner: () => createLq08Session("chapter-light", photoelectric as PreparedLq08Example),
      changed: { incidentPower: 0.002 },
      invalid: { frequency: -1 },
      quantity: "incidentPower",
      expected: 0.002,
    },
    {
      paper: "special-relativity" as const,
      task: CLOCK_TASK,
      owner: () => createSr05Session("chapter-clock", clocks as PreparedSr05Example),
      changed: { speed: 0.6, worldlinePreset: "circle", coordinateDuration: 10 },
      invalid: { speed: 1 },
      quantity: "properTime",
      expected: 8,
    },
    {
      paper: "mass-energy" as const,
      task: MASS_TASK,
      owner: () => createMe03Session("chapter-mass"),
      changed: { boundary: "combined-isolated-system" },
      invalid: { emittedEnergy: -1 },
      quantity: "massChange",
      expected: 0,
    },
  ];

  for (const item of cases) {
    test(`${item.paper}: refuses retained evidence during pending and failed attempts, then accepts the fresh owner's result`, () => {
      const owner = item.owner();
      const session = chapterInvestigationSession(owner);
      const spec = INVESTIGATIONS[item.paper];
      const investigation = createInvestigationStore(spec);
      const disconnect = investigation.connect(session, "chapter-model-source");
      const states: string[] = [];
      const unsubscribe = session.subscribe(() => {
        const snapshot = session.getSnapshot();
        states.push(snapshot.status);
        if (snapshot.pending)
          expect(
            readInvestigationEvidence(spec, session, "chapter-model-source").current,
          ).toBeNull();
      });
      try {
        expect(investigation.begin("I expect a change in the chosen quantity.", item.task).ok).toBe(
          true,
        );
        const baseline = investigation.getSnapshot().report?.baseline.reading;
        assert.ok(baseline);
        const changed = { ...owner.acceptedParameters(), ...item.changed };
        expect(session.apply(changed).kind).toBe("accepted");
        const accepted = owner.getSnapshot().accepted;
        assert.ok(accepted);
        expect(session.getSnapshot().accepted).toBe(accepted);
        const output = accepted.outputs.find((result) => result.quantityId === item.quantity);
        assert.ok(output && output.status === "value");
        expect(output.value).toBe(item.expected);

        // A valid changed result followed by an invalid attempt must not be captured as if the
        // invalid settings had just produced that earlier result. The owner itself retains it.
        expect(session.apply({ ...changed, ...item.invalid }).kind).toBe("refused");
        expect(owner.getSnapshot().accepted).toBe(accepted);
        expect(session.getSnapshot().accepted).toBe(accepted);
        expect(investigation.getSnapshot().current).toBeNull();
        expect(investigation.capture("This refused attempt").ok).toBe(false);
        expect(investigation.getSnapshot().report?.observations).toEqual([]);
        expect(investigation.getSnapshot().report?.baseline.reading).toEqual(baseline);

        expect(session.apply(changed).kind).toBe("accepted");
        const fresh = owner.getSnapshot().accepted;
        assert.ok(fresh);
        expect(fresh.actionIndex).toBeGreaterThan(accepted.actionIndex);
        expect(investigation.capture("Fresh accepted change").ok).toBe(true);
        const kept = investigation.getSnapshot().report?.observations[0]?.reading;
        expect(kept?.outputs).toEqual(
          spec.quantities.map(({ id }) => fresh.outputs.find((result) => result.quantityId === id)),
        );
        expect(kept?.parameters).toEqual(fresh.parameters);
        expect(states).toContain("pending");
        expect(states).toContain("refused");
        expect(states.at(-1)).toBe("accepted");
      } finally {
        unsubscribe();
        disconnect();
        if ("disconnect" in owner) owner.disconnect();
      }
    });
  }

  test("an exception from the real owner's input path keeps the old evidence and blocks capture until a fresh result", () => {
    const owner = createLq08Session("chapter-throw", photoelectric as PreparedLq08Example);
    const session = chapterInvestigationSession(owner);
    const original = owner.getSnapshot().accepted;
    const input = Object.defineProperty({}, "frequency", {
      enumerable: true,
      get() {
        throw new TypeError("unreadable input");
      },
    });
    expect(() => session.apply(input)).toThrow("unreadable input");
    expect(session.getSnapshot().status).toBe("unavailable");
    expect(session.getSnapshot().accepted).toBe(original);
    expect(
      readInvestigationEvidence(INVESTIGATIONS["light-quanta"], session, "model").current,
    ).toBeNull();
    expect(session.startNewRun(owner.acceptedParameters()).kind).toBe("accepted");
    expect(session.getSnapshot().status).toBe("accepted");
    expect(session.getSnapshot().accepted).not.toBe(original);
    expect(
      readInvestigationEvidence(INVESTIGATIONS["light-quanta"], session, "model").current,
    ).not.toBeNull();
  });
});
