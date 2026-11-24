import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { BM06_DEFAULTS } from "../../experiments/bm06/definition.ts";
import { createBm06Session, type PreparedBm06Example } from "../../experiments/bm06/session.ts";
import {
  installPredictPersistence,
  predictPersistence,
  REMEMBERS_NOTHING,
} from "../../experiments/predict/predictPersistence.ts";
import { encodeResult } from "../../experiments/results/codec.ts";
import { RetainedSessionProvider } from "../../experiments/store/retainedSession.tsx";
import {
  createSessionRetention,
  type SessionRetention,
} from "../../experiments/store/sessionRetention.ts";
import rawExample from "../../generated/bm06-example.json";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { createBm06Host } from "../../workers/host/bm06Host.ts";
import { evaluateBm06 } from "../../workers/operations/bm06.ts";
import { createWorkerAdmission } from "../../workers/scheduler/admission.ts";
import { createWorkerRetention } from "../../workers/scheduler/retention.ts";
import type { WorkerChannel } from "../../workers/scheduler/scheduler.ts";
import { BrownianLab } from "./BrownianLab.tsx";

const example = rawExample as PreparedBm06Example;

describe("the spreading laboratory's accepted equation values", () => {
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

  function value(term: "rms" | "diffusion" | "time") {
    const element = container.querySelector<HTMLElement>(
      '[data-equation-values] [data-term-value="eq-model-bm-rms.t.' + term + '"]',
    );
    assert.ok(element, "The spreading equation must expose " + term + ".");
    return element;
  }

  function values() {
    const element = container.querySelector<HTMLElement>(
      '[data-equation-id="eq-model-bm-rms"] [data-equation-values]',
    );
    assert.ok(element, "The actual laboratory must mount its live equation.");
    return element;
  }

  test("the static page shows copied diffusivity and its accepted spread", async () => {
    const parameters = {
      ...BM06_DEFAULTS,
      t: 4,
      copiedDiffusivityInstanceId: "held-tracer",
      copiedDiffusivityRunId: "held-tracer-run",
      copiedDiffusivitySnapshotVersion: 7,
      copiedDiffusivityValue: 1.6e-12,
    };
    const result = await evaluateBm06(parameters, { yieldControl: async () => {} });
    assert.equal(result.kind, "accepted");
    if (result.kind !== "accepted") return;
    container.innerHTML = renderToStaticMarkup(
      <BrownianLab
        instanceId="copied-spreading-example"
        restoreFromLocation={false}
        example={{
          ...example,
          parameters,
          stepIndex: result.data.stepIndex,
          simulationTime: result.data.simulationTime,
          results: result.data.outputs.map(encodeResult),
        }}
      />,
    );

    expect(values().getAttribute("data-execution-label")).toBe("static");
    expect(values().getAttribute("data-instance-id")).toBe("copied-spreading-example");
    expect(values().getAttribute("data-pending")).toBe("false");
    expect(values().closest('[data-predict-response="awaiting"]')).not.toBeNull();
    expect(value("diffusion").textContent).toBe("1.6 μm²/s");
    expect(value("rms").textContent).toBe("3.5777 μm");
    expect(value("time").getAttribute("data-value-kind")).toBe("symbolic");
    const active = container.querySelector('[data-output="activeDiffusionCoefficient"]');
    const physical = container.querySelector('[data-output="diffusionCoefficient"]');
    expect(active?.textContent).toBe("1.6 μm²/s");
    expect(physical?.textContent).not.toBe(active?.textContent);
    expect(physical?.closest("tr")?.textContent).toContain("physical settings (not used)");
    expect(
      container.querySelector('[data-output="rmsDisplacement1d"]')?.textContent,
    ).toBe(value("rms").textContent);
    expect(container.textContent).toContain("a one-time value, not a live link");
    expect(container.textContent).toContain("JavaScript is off");
  });

  test("edits and refused or pending requests retain accepted values until acceptance", async () => {
    let deferResults = false;
    const delayed: Array<() => void> = [];
    const factory = (): WorkerChannel => {
      let receive: ((message: unknown) => void) | undefined;
      let failed: (() => void) | undefined;
      const host = createBm06Host((message) => {
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
    cache = createSessionRetention();
    const identity = {
      experimentId: "bm-06",
      instanceId: "spreading-equation-controls",
      sourceDigest: example.sourceDigest,
    };
    const placementKey = "spreading-equation-controls";
    const owner = cache.prepare(placementKey, identity, (instanceId) =>
      createBm06Session(instanceId, example, factory, {
        admission: createWorkerAdmission(1),
        retention: createWorkerRetention(0),
      }),
    );
    const release = cache.retain(owner);
    const session = owner.session;
    await act(async () => {
      root.render(
        <RetainedSessionProvider
          cache={cache as SessionRetention}
          placementKey={placementKey}
          instanceId={identity.instanceId}
          previous={null}
          onReference={() => {}}
        >
          <BrownianLab
            example={example}
            instanceId={identity.instanceId}
            restoreFromLocation={false}
          />
        </RetainedSessionProvider>,
      );
    });
    release();

    async function settle(until: () => boolean) {
      for (let attempt = 0; attempt < 400 && !until(); attempt++)
        await act(async () => new Promise<void>((resolve) => setTimeout(resolve, 5)));
      expect(until()).toBe(true);
    }

    async function editTime(text: string) {
      const input = container.querySelector<HTMLInputElement>('input[name="t"]');
      assert.ok(input);
      const propsKey = Object.keys(input).find((key) => key.startsWith("__reactProps$"));
      assert.ok(propsKey);
      const props = (
        input as unknown as Record<
          string,
          { onChange: (event: { target: HTMLInputElement }) => void }
        >
      )[propsKey];
      assert.ok(props);
      await act(async () => {
        input.value = text;
        props.onChange({ target: input });
      });
    }

    async function apply() {
      const form = container.querySelector('form[aria-label="Brownian laboratory settings"]');
      assert.ok(form);
      await act(async () => {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
    }

    const initial = session.getSnapshot().accepted;
    assert.ok(initial);
    const initialRms = value("rms").textContent;
    const initialD = value("diffusion").textContent;
    expect(values().closest('[data-predict-response="awaiting"]')).not.toBeNull();
    await editTime("4");
    expect(session.getSnapshot().accepted).toBe(initial);
    expect(value("rms").textContent).toBe(initialRms);

    deferResults = true;
    await apply();
    await settle(() => delayed.length > 0);
    expect(values().getAttribute("data-pending")).toBe("true");
    expect(values().getAttribute("data-run-id")).toBe(initial.runId);
    expect(value("rms").textContent).toBe(initialRms);
    expect(values().textContent).toContain("a new calculation is pending");
    deferResults = false;
    await act(async () => {
      for (const deliver of delayed.splice(0)) deliver();
    });
    await settle(() => !session.getSnapshot().pending);
    const accepted = session.getSnapshot().accepted;
    assert.ok(accepted);
    expect(accepted.parameters.t).toBe(4);
    expect(values().getAttribute("data-run-id")).toBe(accepted.runId);
    expect(values().getAttribute("data-snapshot-version")).toBe(
      String(accepted.snapshotVersion),
    );
    expect(values().getAttribute("data-execution-label")).toBe("host");
    expect(value("rms").textContent).not.toBe(initialRms);
    expect(value("diffusion").textContent).toBe(initialD);
    const acceptedRms = value("rms").textContent;
    const tableRms = container.querySelector('[data-output="rmsDisplacement1d"]')?.textContent;
    expect(tableRms).toBe(acceptedRms);

    await editTime("-1");
    await apply();
    expect(
      container.querySelector("[data-apply-failure]")?.getAttribute("data-apply-failure"),
    ).toBe("refused");
    expect(session.getSnapshot().accepted).toBe(accepted);
    expect(value("rms").textContent).toBe(acceptedRms);
    expect(values().textContent).toContain("request refused");
    expect(
      container.querySelector('[data-output="rmsDisplacement1d"]')?.textContent,
    ).toBe(tableRms);
  });
});
