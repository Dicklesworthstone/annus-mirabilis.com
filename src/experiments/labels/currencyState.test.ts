import { afterAll, describe, expect, test } from "bun:test";
import { getLogger } from "../../testing/log/logger.ts";
import { makeRefusal } from "../results/refusals.ts";
import { createInstanceStore } from "../store/instanceStore.ts";
import {
  CURRENCY_STATES,
  currencyAttributes,
  currencyCopyFor,
  deriveCurrencyState,
} from "./currencyState.ts";

const logger = getLogger("execution-labels");
const BEAD = "am-inst-execution-labels-5ywv";

function options() {
  return {
    experimentId: "bm-06",
    instanceId: "bm-06:currency",
    initialParameters: { D: 1, seed: "0" },
    parameterClasses: { D: "input" as const, seed: "input" as const },
    outputs: {
      density: {
        statuses: ["value"] as const,
        unit: "1/m",
        semanticKind: "coordinate-density",
        ownerId: "diffusion.ftcs1d",
      },
    },
  };
}

const output = {
  quantityId: "density",
  unit: "1/m",
  semanticKind: "coordinate-density",
  ownerId: "diffusion.ftcs1d",
  status: "value" as const,
  value: 1,
};

function acceptOnce() {
  const store = createInstanceStore(options());
  const token = store.issue("setup-change");
  store.publish({ ...token, stepIndex: 0, simulationTime: 0, final: true, outputs: [output] });
  return store;
}

describe("deriveCurrencyState: four mutually exclusive states from the real store", () => {
  test("an accepted final snapshot is accepted, with matching input revisions", () => {
    const store = acceptOnce();
    const view = store.getSnapshot();
    expect(deriveCurrencyState(view)).toBe("accepted");
    expect(view.pending).toBe(false);
    expect(view.accepted?.revisions.input).toBe(view.requested?.revisions.input);
    logger.log({
      testId: "currency-accepted-from-store",
      beadId: BEAD,
      instrumentId: "bm-06",
      instanceId: view.accepted?.instanceId,
      runId: view.accepted?.runId,
      snapshotVersion: view.accepted?.snapshotVersion,
      extra: { currencyState: "accepted" },
      outcome: "passed",
      message: "accepted snapshot derives currency accepted",
    });
  });

  test("issue(continue) after accept is running, not stale (input revision unchanged)", () => {
    const store = acceptOnce();
    const accepted = store.getSnapshot().accepted;
    if (!accepted) throw new Error("expected an accepted snapshot");
    const before = accepted.revisions.input;
    store.issue("continue");
    const view = store.getSnapshot();
    expect(view.pending).toBe(true);
    expect(view.requested?.revisions.input).toBe(before);
    expect(deriveCurrencyState(view)).toBe("running");
    expect(deriveCurrencyState(view)).not.toBe("stale");
    logger.log({
      testId: "currency-running-from-continue",
      beadId: BEAD,
      extra: { currencyState: "running" },
      outcome: "passed",
      message: "pending continue is running, not stale",
    });
  });

  test("a refused setup-change is refused, not stale", () => {
    const store = acceptOnce();
    const token = store.issue("setup-change", { D: 2 });
    store.refuse(token, makeRefusal("invalid-parameter", { parameterIds: ["D"] }));
    const view = store.getSnapshot();
    expect(view.status).toBe("refused");
    expect(view.pending).toBe(false);
    expect(view.requested?.revisions.input).not.toBe(view.accepted?.revisions.input);
    expect(deriveCurrencyState(view)).toBe("refused");
    expect(deriveCurrencyState(view)).not.toBe("stale");
    logger.log({
      testId: "currency-refused-from-store",
      beadId: BEAD,
      extra: { currencyState: "refused", refusalCode: view.refusal?.code },
      outcome: "passed",
      message: "refused request derives currency refused",
    });
  });

  test("STALE IS REACHABLE: pause an outstanding setup-change after an accepted snapshot", () => {
    const store = acceptOnce();
    const accepted = store.getSnapshot().accepted;
    if (!accepted) throw new Error("expected an accepted snapshot");
    const acceptedInput = accepted.revisions.input;
    store.issue("setup-change", { D: 2 });
    expect(deriveCurrencyState(store.getSnapshot())).toBe("running");
    store.pause();
    const view = store.getSnapshot();
    expect(view.pending).toBe(false);
    expect(view.refusal).toBeNull();
    expect(view.status).toBe("paused");
    expect(view.requested?.revisions.input).not.toBe(acceptedInput);
    expect(view.requested?.revisions.input).not.toBe(view.accepted?.revisions.input);
    expect(deriveCurrencyState(view)).toBe("stale");
    logger.log({
      testId: "currency-stale-reachable-via-pause",
      beadId: BEAD,
      inputRevision: view.requested?.revisions.input,
      acceptedInputRevision: view.accepted?.revisions.input,
      extra: { currencyState: "stale", viewState: view.status },
      outcome: "passed",
      message: "pause after setup-change reaches stale",
    });
  });

  test("no accepted snapshot yields no currency", () => {
    const store = createInstanceStore(options());
    expect(deriveCurrencyState(store.getSnapshot())).toBeUndefined();
    store.issue("setup-change");
    expect(deriveCurrencyState(store.getSnapshot())).toBeUndefined();
  });

  test("each currency state has unique heading, unique sentence, and unique data attribute", () => {
    const headings = new Set<string>();
    const texts = new Set<string>();
    const attrs = new Set<string>();
    for (const state of CURRENCY_STATES) {
      const copy = currencyCopyFor(state);
      expect(copy.heading.length).toBeGreaterThan(0);
      expect(copy.text.length).toBeGreaterThan(0);
      expect(headings.has(copy.heading)).toBe(false);
      expect(texts.has(copy.text)).toBe(false);
      headings.add(copy.heading);
      texts.add(copy.text);
      const attr = currencyAttributes(state)["data-currency-state"];
      expect(attr).toBe(state);
      expect(attrs.has(attr)).toBe(false);
      attrs.add(attr);
    }
    expect(headings.size).toBe(4);
    expect(texts.size).toBe(4);
    expect(attrs.size).toBe(4);
  });
});

afterAll(async () => {
  await logger.flush();
});
