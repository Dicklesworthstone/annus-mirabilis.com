import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { validateBm08Parameters } from "../../experiments/bm08/parameters.ts";
import prepared from "../../generated/bm08-example.json";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { createBm08Host } from "../../workers/host/bm08Host.ts";
import { CameraControlledComparison } from "./CameraControlledComparison.tsx";

async function until(predicate: () => boolean) {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, "The accepted camera comparison must settle.");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 2)));
  }
}

async function change(control: HTMLInputElement | HTMLSelectElement, value: string) {
  if (control instanceof HTMLSelectElement) {
    await act(async () => {
      control.value = value;
      control.dispatchEvent(new Event("change", { bubbles: true }));
    });
    return;
  }
  const key = Object.keys(control).find((name) => name.startsWith("__reactProps$"));
  assert.ok(key);
  const props = (
    control as unknown as Record<string, { onChange(event: { target: typeof control }): void }>
  )[key];
  assert.ok(props);
  await act(async () => {
    control.value = value;
    props.onChange({ target: control });
  });
}

test("a refused camera change keeps its accepted evidence and repairs through the real owner", async () => {
  await installDom({ intersections: "visible" });
  const previousWorker = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  const requests: unknown[] = [];
  const failures: unknown[] = [];
  let holdResults = false;
  const held: (() => void)[] = [];
  class CameraWorker extends EventTarget {
    private closed = false;
    private readonly owner = createBm08Host((message) => {
      const deliver = () => {
        if (!this.closed)
          this.dispatchEvent(new MessageEvent("message", { data: structuredClone(message) }));
      };
      if (holdResults && message.messageKind === "result") held.push(deliver);
      else deliver();
    }, prepared.sourceDigest);
    constructor() {
      super();
      queueMicrotask(() => {
        if (!this.closed) this.owner.hello();
      });
    }
    postMessage(message: unknown) {
      if (
        message &&
        typeof message === "object" &&
        "messageKind" in message &&
        message.messageKind === "request"
      )
        requests.push(structuredClone(message));
      void this.owner.receive(structuredClone(message)).catch((error) => {
        failures.push(error);
        this.dispatchEvent(new Event("error"));
      });
    }
    terminate() {
      this.closed = true;
      this.owner.dispose();
    }
  }
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: CameraWorker });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    const parameters = validateBm08Parameters(prepared.parameters);
    assert.equal(parameters.kind, "accepted");
    if (parameters.kind !== "accepted")
      throw new Error("Prepared camera settings must be admitted.");
    await act(async () =>
      root.render(
        <StrictMode>
          <CameraControlledComparison example={{ ...prepared, parameters: parameters.data }} />
        </StrictMode>,
      ),
    );
    const region = host.querySelector<HTMLElement>("[data-controlled-camera-comparison]");
    const form = host.querySelector<HTMLFormElement>(
      'form[aria-label="Controlled camera comparison settings"]',
    );
    const input = form?.querySelector<HTMLSelectElement>('select[id$="-input"]');
    assert.ok(region && form && input);
    const button = (name: string) => {
      const found = [...host.querySelectorAll("button")].find(
        (entry) => entry.textContent?.trim() === name,
      );
      assert.ok(found, name);
      return found;
    };
    const identities = () => {
      const rows = host.querySelector<HTMLElement>("[data-comparison-results]");
      assert.ok(rows);
      return {
        baseline: rows.dataset.baselineSnapshot,
        variant: rows.dataset.variantSnapshot,
        baselineRun: rows.dataset.baselineRunId,
        variantRun: rows.dataset.variantRunId,
      };
    };
    await act(async () => button("Start controlled camera comparison").click());
    await until(
      () => region.dataset.comparisonPhase === "live" && region.dataset.pending === "false",
    );
    const accepted = identities();
    const completed = host.querySelector("[data-comparison-results]")?.textContent;
    const beforeRequests = requests.length;
    expect(beforeRequests).toBeGreaterThan(0);
    await change(input, "exposure");
    const exposure = form.querySelector<HTMLInputElement>('input[id$="-value"]');
    assert.ok(exposure);
    await change(exposure, "0.3");
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(region.dataset.currencyState).toBe("refused");
    const refusal = host.querySelector<HTMLElement>("[data-comparison-recovery]");
    assert.ok(refusal);
    expect(refusal.dataset.refusalCode).toBe("off-replay-grid");
    expect(refusal.dataset.applyFailure).toBe("refused");
    expect(refusal.textContent).toContain("Enter an exposure in steps of 0.25 s");
    expect(refusal.textContent).toContain("Both columns still show the last completed comparison");
    expect(
      refusal.querySelector('[data-comparison-rejected-input="exposure"]')?.textContent,
    ).toContain("0.3");
    expect(identities()).toEqual(accepted);
    expect(host.querySelector("[data-comparison-results]")?.textContent).toBe(completed);
    expect(requests.length).toBe(beforeRequests);

    holdResults = true;
    await act(async () => button("Use the preceding recorded exposure").click());
    expect(region.dataset.currencyState).toBe("pending");
    expect(identities()).toEqual(accepted);
    await until(() => held.length > 0);
    expect(requests.length).toBeGreaterThan(beforeRequests);
    const requested = requests.at(-1) as { token: { parameters: Record<string, unknown> } };
    expect(requested.token.parameters).toEqual({ ...parameters.data, exposure: 0.25 });
    await act(async () => {
      holdResults = false;
      for (const deliver of held.splice(0)) deliver();
    });
    await until(() => region.dataset.pending === "false");
    expect(failures).toEqual([]);
    expect(region.dataset.currencyState).toBe("current");
    expect(host.querySelector("[data-comparison-recovery]")).toBeNull();
    const repaired = identities();
    expect(repaired.baseline).toBe(accepted.baseline);
    expect(repaired.baselineRun).toBe(accepted.baselineRun);
    expect(repaired.variantRun).toBe(accepted.variantRun);
    expect(repaired.variant).not.toBe(accepted.variant);
    const row = host.querySelector('[data-comparison-input="exposure"]');
    expect(row?.querySelectorAll("td")[2]?.textContent?.trim()).toBe("0.25");
    expect(exposure.value).toBe("0.25");
    expect(host.textContent).not.toMatch(/\b(?:NaN|Infinity)\b/u);
  } finally {
    await act(async () => root.unmount());
    if (previousWorker) Object.defineProperty(globalThis, "Worker", previousWorker);
    else Reflect.deleteProperty(globalThis, "Worker");
    await uninstallDom();
  }
});
