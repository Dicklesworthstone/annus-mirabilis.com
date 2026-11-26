import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  installPredictPersistence,
  predictPersistence,
  REMEMBERS_NOTHING,
} from "../../experiments/predict/predictPersistence.ts";
import { encodeResult } from "../../experiments/results/codec.ts";
import { SR03_DEFAULTS, type Sr03Parameters } from "../../experiments/sr03/definition.ts";
import { createSr03Session, type PreparedSr03Example } from "../../experiments/sr03/session.ts";
import { RetainedSessionProvider } from "../../experiments/store/retainedSession.tsx";
import {
  createSessionRetention,
  type SessionRetention,
} from "../../experiments/store/sessionRetention.ts";
import rawExample from "../../generated/sr03-example.json";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { createSr03Host } from "../../workers/host/sr03Host.ts";
import { evaluateSr03 } from "../../workers/operations/sr03.ts";
import type { WorkerChannel } from "../../workers/scheduler/sr03Scheduler.ts";
import { RodSimultaneityLab } from "./RodSimultaneityLab.tsx";

const example = rawExample as PreparedSr03Example;
const spatial = "eq-model-sr-event-separation-position";
const temporal = "eq-model-sr-event-separation-time";

async function prepared(parameters: Sr03Parameters): Promise<PreparedSr03Example> {
  const result = await evaluateSr03(parameters);
  assert.ok(result.kind === "accepted");
  return {
    ...example,
    parameters,
    stepIndex: result.data.stepIndex,
    simulationTime: result.data.simulationTime,
    results: result.data.outputs.map(encodeResult),
  };
}

describe("the rod laboratory's accepted event-separation equations", () => {
  let container: HTMLElement;
  let root: Root;
  let cache: SessionRetention | undefined;
  let previousPredictions: ReturnType<typeof predictPersistence>;

  beforeEach(async () => {
    await installDom({ intersections: "visible" });
    previousPredictions = predictPersistence();
    installPredictPersistence(REMEMBERS_NOTHING);
    container = createContainer();
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    cache?.dispose();
    cache = undefined;
    removeContainer(container);
    installPredictPersistence(previousPredictions);
    await uninstallDom();
  });

  function laboratory(instanceId: string): HTMLElement {
    const element = container.querySelector<HTMLElement>(
      `[data-instrument-id="sr-03"][data-instance-id="${instanceId}"]`,
    );
    assert.ok(element, "The actual rod laboratory must retain its instance.");
    return element;
  }

  function panel(instanceId: string): HTMLElement {
    const element = laboratory(instanceId).querySelector<HTMLElement>(
      '[data-laboratory-equations="sr-03"]',
    );
    assert.ok(element, "The accepted event pair must have its equation panel.");
    return element;
  }

  function term(instanceId: string, equationId: string, suffix: string): HTMLElement {
    const element = panel(instanceId).querySelector<HTMLElement>(
      `[data-term-value="${equationId}.t.${suffix}"]`,
    );
    assert.ok(element, `The panel must expose ${equationId}.t.${suffix}.`);
    return element;
  }

  function allTimeValues(instanceId: string): HTMLElement[] {
    return Array.from(
      container.querySelectorAll<HTMLElement>(`[data-term-value="${temporal}.t.timeMoving"]`),
    ).filter(
      (value) =>
        value.closest<HTMLElement>("[data-equation-values]")?.dataset.instanceId === instanceId,
    );
  }

  function normalizedText(element: HTMLElement): string {
    return (element.textContent ?? "").replaceAll("−", "-");
  }

  function checkIdentity(instanceId: string) {
    const owner = laboratory(instanceId);
    const groups = panel(instanceId).querySelectorAll<HTMLElement>("[data-equation-values]");
    expect(groups.length).toBe(2);
    for (const group of groups) {
      expect(group.dataset.experimentId).toBe("sr-03");
      expect(group.dataset.instanceSlot).toBe("primary");
      for (const attribute of [
        "data-instance-id",
        "data-run-id",
        "data-snapshot-version",
        "data-input-revision",
        "data-accepted-input-revision",
        "data-pending",
        "data-execution-label",
      ]) {
        expect(group.getAttribute(attribute)).toBe(owner.getAttribute(attribute));
      }
    }
  }

  function tableValue(instanceId: string, quantityId: string): HTMLElement {
    const element = laboratory(instanceId).querySelector<HTMLElement>(
      `[data-view-id="sr-03-data-table"] [data-output="${quantityId}"]`,
    );
    assert.ok(element, `The accepted table must expose ${quantityId}.`);
    return element;
  }

  test("the static signature pair shows the same accepted event differences as the table", async () => {
    const instanceId = "static-event-pair";
    container.innerHTML = renderToStaticMarkup(
      <RodSimultaneityLab
        example={await prepared(SR03_DEFAULTS)}
        instanceId={instanceId}
        restoreFromLocation={false}
      />,
    );

    checkIdentity(instanceId);
    for (const group of panel(instanceId).querySelectorAll<HTMLElement>(
      "[data-equation-values]",
    )) {
      expect(group.dataset.executionLabel).toBe("static");
      expect(group.dataset.pending).toBe("false");
    }
    expect(panel(instanceId).closest('[data-predict-response="awaiting"]')).not.toBeNull();
    expect(container.querySelector('[data-predict-response="shown"]')).toBeNull();
    expect(term(instanceId, spatial, "position").dataset.valueKind).toBe("value");
    expect(term(instanceId, spatial, "position").textContent).toBe("2997900000 m");
    expect(term(instanceId, spatial, "positionMoving").textContent).toBe("3747400000 m");
    expect(term(instanceId, temporal, "time").textContent).toBe("0 s");
    expect(normalizedText(term(instanceId, temporal, "timeMoving"))).toBe("-7.5 s");
    expect(term(instanceId, temporal, "factor").textContent).toContain("1.25");
    expect(term(instanceId, temporal, "speed").dataset.valueKind).toBe("symbolic");
    expect(term(instanceId, temporal, "light").dataset.valueKind).toBe("symbolic");
    expect(Number.parseFloat(normalizedText(tableValue(instanceId, "spatialSeparationK")))).toBe(
      10,
    );
    expect(
      Number.parseFloat(normalizedText(tableValue(instanceId, "spatialSeparationKPrime"))),
    ).toBe(12.5);
    expect(
      Number.parseFloat(normalizedText(tableValue(instanceId, "temporalSeparationKPrime"))),
    ).toBe(-7.5);
    expect(Number.parseFloat(normalizedText(tableValue(instanceId, "rodLengthK")))).toBe(8);
    expect(
      laboratory(instanceId).querySelector("[data-event-separation-context]")?.textContent,
    ).toContain("one time in the measuring frame");
    expect(
      laboratory(instanceId).querySelector("[data-event-separation-context]")?.textContent,
    ).toContain("299,792,458");
  });

  test("real controls and pinned equations retain only their own accepted event pair", async () => {
    let deferResults = false;
    const delayed: Array<() => void> = [];
    const factory = (): WorkerChannel => {
      let receive: ((message: unknown) => void) | undefined;
      let failed: (() => void) | undefined;
      const host = createSr03Host((message) => {
        if (deferResults && message.messageKind === "result")
          delayed.push(() => receive?.(message));
        else receive?.(message);
      }, example.sourceDigest);
      return {
        listen(onMessage, onError) {
          receive = onMessage;
          failed = onError;
          queueMicrotask(() => host.hello());
          return () => {
            receive = undefined;
            failed = undefined;
          };
        },
        send(message) {
          void host.receive(structuredClone(message)).catch(() => failed?.());
        },
        dispose() {
          host.dispose();
        },
      };
    };
    const firstPlacementId = "event-pair-one";
    const secondPlacementId = "event-pair-two";
    const firstExample = await prepared(SR03_DEFAULTS);
    const secondExample = await prepared({ ...SR03_DEFAULTS, L0: 20 });
    cache = createSessionRetention();
    const firstOwner = cache.prepare(
      firstPlacementId,
      { experimentId: "sr-03", instanceId: firstPlacementId, sourceDigest: example.sourceDigest },
      (instanceId) => createSr03Session(instanceId, firstExample, factory),
    );
    const secondOwner = cache.prepare(
      secondPlacementId,
      { experimentId: "sr-03", instanceId: secondPlacementId, sourceDigest: example.sourceDigest },
      (instanceId) => createSr03Session(instanceId, secondExample, factory),
    );
    const releaseFirst = cache.retain(firstOwner);
    const releaseSecond = cache.retain(secondOwner);
    await act(async () => {
      root.render(
        <>
          <RetainedSessionProvider
            cache={cache as SessionRetention}
            placementKey={firstPlacementId}
            instanceId={firstPlacementId}
            previous={null}
            onReference={() => {}}
          >
            <RodSimultaneityLab
              example={firstExample}
              instanceId={firstPlacementId}
              restoreFromLocation={false}
            />
          </RetainedSessionProvider>
          <RetainedSessionProvider
            cache={cache as SessionRetention}
            placementKey={secondPlacementId}
            instanceId={secondPlacementId}
            previous={null}
            onReference={() => {}}
          >
            <RodSimultaneityLab
              example={secondExample}
              instanceId={secondPlacementId}
              restoreFromLocation={false}
            />
          </RetainedSessionProvider>
        </>,
      );
    });
    releaseFirst();
    releaseSecond();
    const firstId = firstOwner.instanceId;
    const secondId = secondOwner.instanceId;

    async function settle(until: () => boolean) {
      for (let attempt = 0; attempt < 400 && !until(); attempt++)
        await act(async () => new Promise<void>((resolve) => setTimeout(resolve, 5)));
      expect(until()).toBe(true);
    }

    async function change(control: HTMLInputElement | HTMLSelectElement, value: string) {
      const propsKey = Object.keys(control).find((key) => key.startsWith("__reactProps$"));
      assert.ok(propsKey);
      const props = (
        control as unknown as Record<
          string,
          { onChange: (event: { target: HTMLInputElement | HTMLSelectElement }) => void }
        >
      )[propsKey];
      assert.ok(props);
      await act(async () => {
        control.value = value;
        props.onChange({ target: control });
      });
    }

    const initial = firstOwner.session.getSnapshot().accepted;
    const other = secondOwner.session.getSnapshot().accepted;
    assert.ok(initial && other);
    checkIdentity(firstId);
    checkIdentity(secondId);
    expect(normalizedText(term(firstId, temporal, "timeMoving"))).toBe("-7.5 s");
    expect(normalizedText(term(secondId, temporal, "timeMoving"))).toBe("-15 s");
    const skip = laboratory(firstId).querySelector<HTMLButtonElement>(
      'button[aria-label^="Skip prediction for "]',
    );
    assert.ok(skip);
    await act(async () => {
      skip.click();
    });
    expect(panel(firstId).closest('[data-predict-response="shown"]')).not.toBeNull();
    expect(panel(secondId).closest('[data-predict-response="awaiting"]')).not.toBeNull();
    const pin = panel(firstId).querySelector<HTMLButtonElement>(
      `[data-pin-equation="${temporal}"]`,
    );
    assert.ok(pin && !pin.disabled);
    await act(async () => {
      pin.click();
    });
    expect(allTimeValues(firstId)).toHaveLength(2);
    expect(allTimeValues(secondId)).toHaveLength(1);

    const pair = laboratory(firstId).querySelector<HTMLSelectElement>(
      'select[id$="-endpoint-pair"]',
    );
    assert.ok(pair);
    deferResults = true;
    await change(pair, "causal-timelike");
    await settle(() => delayed.length > 0);
    expect(firstOwner.session.getSnapshot().accepted).toBe(initial);
    checkIdentity(firstId);
    expect(allTimeValues(firstId)).toHaveLength(2);
    for (const value of allTimeValues(firstId)) {
      expect(normalizedText(value)).toBe("-7.5 s");
      const group = value.closest<HTMLElement>("[data-equation-values]");
      expect(group?.dataset.pending).toBe("true");
      expect(group?.dataset.runId).toBe(initial.runId);
      expect(group?.textContent).toContain("a new calculation is pending");
    }
    expect(secondOwner.session.getSnapshot().accepted).toBe(other);
    expect(normalizedText(term(secondId, temporal, "timeMoving"))).toBe("-15 s");
    deferResults = false;
    await act(async () => {
      for (const deliver of delayed.splice(0)) deliver();
    });
    await settle(() => !firstOwner.session.getSnapshot().pending);
    const accepted = firstOwner.session.getSnapshot().accepted;
    assert.ok(accepted);
    expect(accepted.parameters.endpointPairId).toBe("causal-timelike");
    expect(accepted.snapshotVersion).not.toBe(initial.snapshotVersion);
    checkIdentity(firstId);
    expect(term(firstId, temporal, "time").textContent).toBe("10 s");
    expect(allTimeValues(firstId)).toHaveLength(2);
    expect(
      Number.parseFloat(normalizedText(tableValue(firstId, "temporalSeparationKPrime"))),
    ).toBe(8.75);
    for (const value of allTimeValues(firstId)) {
      expect(normalizedText(value)).toBe("8.75 s");
      const group = value.closest<HTMLElement>("[data-equation-values]");
      expect(group?.dataset.pending).toBe("false");
      expect(group?.dataset.snapshotVersion).toBe(String(accepted.snapshotVersion));
      expect(group?.dataset.runId).toBe(accepted.runId);
      expect(group?.dataset.executionLabel).toBe("host");
    }

    const speed = laboratory(firstId).querySelector<HTMLInputElement>(
      'input[type="number"][id$="-v"]',
    );
    assert.ok(speed);
    await change(speed, "1");
    expect(
      laboratory(firstId).querySelector("[data-apply-failure]")?.getAttribute("data-apply-failure"),
    ).toBe("refused");
    expect(firstOwner.session.getSnapshot().accepted).toBe(accepted);
    expect(allTimeValues(firstId)).toHaveLength(2);
    for (const value of allTimeValues(firstId)) {
      expect(normalizedText(value)).toBe("8.75 s");
      expect(value.closest("[data-equation-values]")?.textContent).toContain("request refused");
    }
    expect(
      Number.parseFloat(normalizedText(tableValue(firstId, "temporalSeparationKPrime"))),
    ).toBe(8.75);
    expect(secondOwner.session.getSnapshot().accepted).toBe(other);
    expect(normalizedText(term(secondId, temporal, "timeMoving"))).toBe("-15 s");
    expect(panel(secondId).textContent).not.toContain("request refused");
    checkIdentity(secondId);
  });
});
