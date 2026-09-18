import { describe, expect, test } from "bun:test";
import { makeRefusal } from "../experiments/results/refusals.ts";
import { createInstanceStore, type Publication } from "../experiments/store/instanceStore.ts";
import {
  ANALYTIC_OWNER_ID,
  ANALYTIC_QUANTITY_ID,
  analyticProbe,
} from "./runtime-fixtures/fixtureAnalytic.ts";

function createStore() {
  return createInstanceStore({
    experimentId: "relativity-observer",
    instanceId: "inst-obs-1",
    initialParameters: { seedDecimal: "42", frameSpeedVc: 0.0 },
    parameterClasses: { seedDecimal: "input", frameSpeedVc: "observer" },
    outputs: {
      [ANALYTIC_QUANTITY_ID]: {
        statuses: ["value"],
        unit: "1",
        semanticKind: "scalar",
        ownerId: ANALYTIC_OWNER_ID,
      },
    },
  });
}

function makePublication(
  token: ReturnType<ReturnType<typeof createStore>["issue"]>,
  options?: {
    stepIndex?: number;
    simulationTime?: number;
    final?: boolean;
    value?: number;
  },
): Publication {
  const v = (token.parameters.frameSpeedVc as number) ?? 0.0;
  const seed = (token.parameters.seedDecimal as string) ?? "42";
  const probeVal = options?.value ?? analyticProbe(seed, v);

  return {
    ...token,
    stepIndex: options?.stepIndex ?? 1,
    simulationTime: options?.simulationTime ?? 1.0,
    final: options?.final ?? true,
    outputs: [
      {
        quantityId: ANALYTIC_QUANTITY_ID,
        status: "value",
        value: probeVal,
        unit: "1",
        semanticKind: "scalar",
        ownerId: ANALYTIC_OWNER_ID,
      },
    ],
  };
}

describe("stale observer descriptions (am-rt-snapshot-store-aft)", () => {
  test("out-of-order observer changes: publishing action 6 before 5 refuses 5 as stale-action and preserves 0.8c values", () => {
    const store = createStore();

    // Establish baseline accepted state at action 1
    const initialToken = store.issue("setup-change", { seedDecimal: "42" });
    const initialPub = makePublication(initialToken, { stepIndex: 0, simulationTime: 0 });
    const dec0 = store.publish(initialPub);
    expect(dec0.accepted).toBe(true);
    expect(store.getSnapshot().accepted?.actionIndex).toBe(1);

    // Issue intermediate actions to advance actionIndex to 5 and 6
    const t2 = store.issue("observer-change", { frameSpeedVc: 0.2 });
    expect(store.publish(makePublication(t2)).accepted).toBe(true);

    const t3 = store.issue("observer-change", { frameSpeedVc: 0.3 });
    expect(store.publish(makePublication(t3)).accepted).toBe(true);

    const t4 = store.issue("observer-change", { frameSpeedVc: 0.4 });
    expect(store.publish(makePublication(t4)).accepted).toBe(true);

    // Issue actionIndex 5 with v = 0.6c
    const t5 = store.issue("observer-change", { frameSpeedVc: 0.6 });
    expect(t5.actionIndex).toBe(5);
    expect(t5.parameters.frameSpeedVc).toBe(0.6);

    // Issue actionIndex 6 with v = 0.8c
    const t6 = store.issue("observer-change", { frameSpeedVc: 0.8 });
    expect(t6.actionIndex).toBe(6);
    expect(t6.parameters.frameSpeedVc).toBe(0.8);

    // Prepare publications for both actions
    const pub5 = makePublication(t5);
    const pub6 = makePublication(t6);
    const expectedValue6 = analyticProbe("42", 0.8);
    const expectedValue5 = analyticProbe("42", 0.6);

    // Publish action 6 first
    const dec6 = store.publish(pub6);
    expect(dec6.accepted).toBe(true);

    // Verify view has accepted action 6 with 0.8c values
    const viewAfter6 = store.getSnapshot();
    expect(viewAfter6.status).toBe("accepted");
    expect(viewAfter6.pending).toBe(false);
    expect(viewAfter6.accepted?.actionIndex).toBe(6);
    expect(viewAfter6.accepted?.parameters.frameSpeedVc).toBe(0.8);
    const out6 = viewAfter6.accepted?.outputs.find((o) => o.quantityId === ANALYTIC_QUANTITY_ID);
    expect(out6).toBeDefined();
    expect(out6?.status).toBe("value");
    if (out6?.status === "value") {
      expect(out6.value).toBe(expectedValue6);
    }

    // Now publish late action 5
    const dec5 = store.publish(pub5);
    expect(dec5.accepted).toBe(false);
    if (!dec5.accepted) {
      expect(dec5.reason).toBe("stale-action");
    }

    // View state must remain untouched, preserving action 6 (0.8c)
    const viewAfter5 = store.getSnapshot();
    expect(viewAfter5.status).toBe("accepted");
    expect(viewAfter5.pending).toBe(false);
    expect(viewAfter5.accepted?.actionIndex).toBe(6);
    expect(viewAfter5.accepted?.parameters.frameSpeedVc).toBe(0.8);
    const outAfter5 = viewAfter5.accepted?.outputs.find(
      (o) => o.quantityId === ANALYTIC_QUANTITY_ID,
    );
    expect(outAfter5?.status).toBe("value");
    if (outAfter5?.status === "value") {
      expect(outAfter5.value).toBe(expectedValue6);
      expect(outAfter5.value).not.toBe(expectedValue5);
    }
  });

  test("requested, accepted, pending, refused, paused, and unavailable states are distinguishable in API", () => {
    const store = createStore();
    // 1. Initial idle state before issue or acceptance
    expect(store.getSnapshot().status).toBe("idle");

    // 2. Pending state: token issued but not yet published
    const token = store.issue("setup-change", { seedDecimal: "99" });
    expect(store.getSnapshot().status).toBe("pending");
    expect(store.getSnapshot().pending).toBe(true);
    expect(store.getSnapshot().requested?.actionIndex).toBe(1);
    expect(store.getSnapshot().accepted).toBeNull();

    // 3. Accepted state: published and accepted
    const pub = makePublication(token);
    store.publish(pub);
    expect(store.getSnapshot().status).toBe("accepted");
    expect(store.getSnapshot().pending).toBe(false);
    expect(store.getSnapshot().accepted?.actionIndex).toBe(1);

    // 4. Paused state (pause requires an active requested token)
    store.issue("continue");
    expect(store.getSnapshot().status).toBe("pending");
    store.pause();
    expect(store.getSnapshot().status).toBe("paused");

    // 5. Refused state
    const tNext = store.issue("observer-change", { frameSpeedVc: 0.5 });
    const refusal = makeRefusal("invalid-parameter", { parameterIds: ["frameSpeedVc"] });
    const decRefuse = store.refuse(tNext, refusal);
    expect(decRefuse.accepted).toBe(true);
    expect(store.getSnapshot().status).toBe("refused");
    expect(store.getSnapshot().refusal?.code).toBe("invalid-parameter");

    // 6. Unavailable state via fail()
    const tUnavail = store.issue("setup-change", { seedDecimal: "100" });
    const decFail = store.fail(tUnavail, {
      outcome: "worker-crashed",
      message: "The calculation worker stopped unexpectedly.",
      retry: "new-run",
    });
    expect(decFail.accepted).toBe(true);
    expect(store.getSnapshot().status).toBe("unavailable");
    expect(store.getSnapshot().outcome?.outcome).toBe("worker-crashed");
  });
});
