import { afterEach, beforeEach, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { KitchenInputs } from "../components/lab/kitchen/KitchenControls.tsx";
import { KitchenResults } from "../components/lab/kitchen/KitchenResults.tsx";
import { kitchenAnalysisJson } from "../experiments/bm07/kitchen/export.ts";
import { createKitchenHost } from "../experiments/bm07/kitchen/host.ts";
import type { KitchenDocument } from "../experiments/bm07/kitchen/schema.ts";
import { createKitchenSession, type KitchenAccepted } from "../experiments/bm07/kitchen/session.ts";
import { kitchenFixture } from "./kitchen/fixture.mjs";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

beforeEach(installDom);
afterEach(uninstallDom);
const source = `source:sha256:${"a".repeat(64)}`;
const metadata = {
  radius_um: ".5",
  radius_provenance: "independent",
  radius_scale_axis: "independent",
  radius_interval_um: "[.4,.6]",
  temperature_interval_k: "[290,300]",
  pixels_per_um_x_interval: "[9,11]",
  pixels_per_um_y_interval: "[9,11]",
  viscosity_interval_mpa_s: "[.9,1.1]",
  gas_constant_interval: "[8.3144,8.3145]",
  physical_input_coverage: ".975",
  physical_input_provenance: "Synthetic test premise, not experimental coverage evidence.",
};
async function accepted(patch: Record<string, string> = {}): Promise<KitchenAccepted> {
  let listener: (message: unknown) => void = () => {};
  const host = createKitchenHost((message) => listener(structuredClone(message)), source);
  const session = createKitchenSession(
    "uncertainty-ui",
    () => ({
      listen(fn) {
        listener = fn;
        return () => {};
      },
      send(message) {
        void host.receive(structuredClone(message));
      },
      dispose() {
        host.dispose();
      },
    }),
    source,
  );
  try {
    const done = new Promise<KitchenAccepted>((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error(session.getSnapshot().message || "No accepted analysis"));
      }, 3000);
      const off = session.subscribe(() => {
        const a = session.getSnapshot().accepted;
        if (a) {
          clearTimeout(timer);
          off();
          resolve(a);
        }
      });
    });
    await session.submit(kitchenFixture({ metadata: { ...metadata, ...patch } }));
    return await done;
  } finally {
    session.disconnect();
  }
}

test("a complete accepted uncertainty result renders with its assumptions and separate intervals without hydration", async () => {
  const a = await accepted(),
    shell = document.createElement("div");
  shell.innerHTML = renderToStaticMarkup(<KitchenResults accepted={a} />);
  expect(shell.querySelector('[data-kitchen-uncertainty="combined"]')).not.toBeNull();
  expect(shell.querySelector("[data-kitchen-combined-coverage]")?.textContent).toContain(
    "At least 95%",
  );
  expect(shell.querySelector("[data-calibration-dependence]")?.textContent).toContain("power -2");
  expect(shell.textContent).toContain("Input-range envelope");
  expect(shell.textContent).toContain("Recalculated camera interval");
  expect(shell.textContent).toContain("Synthetic practice data");
  expect(shell.textContent).toContain(metadata.physical_input_provenance);
});

test("unknown coverage does not borrow the original conditional interval's probability", async () => {
  const a = await accepted({ physical_input_coverage: "", radius_scale_axis: "x" });
  const shell = document.createElement("div");
  shell.innerHTML = renderToStaticMarkup(<KitchenResults accepted={a} />);
  expect(shell.querySelector('[data-kitchen-uncertainty="sensitivity"]')).not.toBeNull();
  expect(shell.querySelector("[data-kitchen-combined-coverage]")?.textContent).toBe("Not claimed");
  expect(shell.querySelector("[data-kitchen-combined]")?.textContent).toContain(
    "sensitivity analysis",
  );
  expect(shell.querySelector("[data-calibration-dependence]")?.textContent).toContain("power -3");
});

test("range and coverage controls have labels and a static explanation instead of made-up defaults", async () => {
  const a = await accepted({ physical_input_coverage: "" }),
    shell = document.createElement("div");
  shell.innerHTML = renderToStaticMarkup(
    <KitchenInputs accepted={a} busy={false} revise={() => {}} onError={() => {}} />,
  );
  for (const name of [
    "pixels_per_um_x_interval",
    "pixels_per_um_y_interval",
    "radius_scale_axis",
    "viscosity_interval_mpa_s",
    "gas_constant_interval",
    "physical_input_coverage",
    "physical_input_provenance",
  ]) {
    const control = shell.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!;
    expect(control).not.toBeNull();
    expect([...shell.querySelectorAll("label")].some((label) => label.htmlFor === control.id)).toBe(
      true,
    );
  }
  expect(shell.querySelector<HTMLInputElement>('[name="physical_input_coverage"]')?.value).toBe("");
  expect(shell.textContent).toContain("not the coverage of each range separately");
});

test("editing and applying a relationship cannot mutate the already accepted result or download", async () => {
  const a = await accepted(),
    receipt = kitchenAnalysisJson(a, source);
  const container = createContainer(),
    root = createRoot(container);
  const revisions: KitchenDocument[] = [],
    errors: string[] = [];
  try {
    await act(async () => {
      root.render(
        <>
          <KitchenInputs
            accepted={a}
            busy={false}
            revise={(d) => revisions.push(d)}
            onError={(e) => errors.push(e)}
          />
          <KitchenResults accepted={a} />
        </>,
      );
    });
    const select = container.querySelector<HTMLSelectElement>('[name="radius_scale_axis"]')!;
    await act(async () => {
      select.value = "x";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(revisions.length).toBe(0);
    expect(kitchenAnalysisJson(a, source)).toBe(receipt);
    expect(container.querySelector("[data-calibration-dependence]")?.textContent).toContain(
      "power -2",
    );
    await act(async () => {
      container
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(errors).toEqual([]);
    expect(revisions.length).toBe(1);
    expect(revisions[0]!.metadata.radius_scale_axis).toBe("x");
    expect(revisions[0]!.points).toEqual(a.document.points);
    expect(a.document.metadata.radius_scale_axis).toBe("independent");
    expect(kitchenAnalysisJson(a, source)).toBe(receipt);
    expect(container.querySelector("[data-calibration-dependence]")?.textContent).toContain(
      "power -2",
    );
  } finally {
    await act(async () => {
      root.unmount();
    });
    removeContainer(container);
  }
});
