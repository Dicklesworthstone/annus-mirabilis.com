import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RetainedSessionProvider } from "../../experiments/store/retainedSession.tsx";
import {
  createSessionRetention,
  type SessionRetention,
} from "../../experiments/store/sessionRetention.ts";
import type { LabReference } from "../../reader/stack/stackStore.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { ModeAllocationLab } from "./ModeAllocationLab.tsx";
import { OsmoticPartitionLab } from "./OsmoticPartitionLab.tsx";

let root: Root;
let container: HTMLElement;
let cache: SessionRetention;
let reference: LabReference | null;
const report = (next: LabReference) => {
  reference = next;
};

beforeEach(async () => {
  await installDom();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  cache = createSessionRetention();
  reference = null;
});
afterEach(async () => {
  await act(async () => root.unmount());
  cache.dispose();
  await uninstallDom();
});

function temperature(): HTMLInputElement {
  const named = container.querySelector<HTMLInputElement>('input[name="T"]');
  if (named) return named;
  const label = [...container.querySelectorAll("label")].find(
    (item) => item.textContent === "Temperature (K)",
  );
  const input = label
    ? container.querySelector<HTMLInputElement>(`#${CSS.escape(label.htmlFor)}`)
    : null;
  if (!input) throw new Error("The temperature control is missing.");
  return input;
}
type Handlers = { onChange?: (event: unknown) => void; onSubmit?: (event: unknown) => void };
function handlers(input: HTMLInputElement, target: Element = input): Handlers {
  const key = Object.keys(input).find((name) => name.startsWith("__reactProps$"));
  if (!key) throw new Error("The mounted control has no React handlers.");
  const result = (target as unknown as Record<string, Handlers>)[key];
  if (!result) throw new Error("The mounted target has no React handlers.");
  return result;
}
async function editTemperature(value: string) {
  const input = temperature();
  await act(async () => {
    const change = handlers(input).onChange;
    if (!change) throw new Error("The temperature control cannot change.");
    input.value = value;
    change({ target: input, currentTarget: input });
  });
}
async function apply() {
  const input = temperature();
  const form = input.closest("form");
  if (!form) throw new Error("The settings form is missing.");
  await act(async () => {
    const submit = handlers(input, form).onSubmit;
    if (!submit) throw new Error("The form cannot submit.");
    submit({ preventDefault() {} });
  });
}
function identity() {
  const lab = container.querySelector("[data-instrument-id]");
  if (!lab) throw new Error("The laboratory is missing.");
  return [
    "data-instance-id",
    "data-run-id",
    "data-snapshot-version",
    "data-accepted-input-revision",
  ].map((name) => lab.getAttribute(name));
}
async function render(lab: ReactElement, placementKey = "/paper/passage-one") {
  await act(async () =>
    root.render(
      <RetainedSessionProvider
        cache={cache}
        placementKey={placementKey}
        instanceId="form-lab"
        previous={reference}
        onReference={report}
      >
        {lab}
      </RetainedSessionProvider>,
    ),
  );
}

for (const scenario of [
  {
    name: "the osmotic partition",
    initial: "293.15",
    changed: "310",
    lab: () => <OsmoticPartitionLab instanceId="form-lab" restoreFromLocation={false} />,
  },
  {
    name: "the classical mode allocation",
    initial: "1500",
    changed: "2500",
    lab: () => <ModeAllocationLab instanceId="form-lab" restoreFromLocation={false} />,
  },
]) {
  describe(scenario.name, () => {
    test("returning to a passage restores the same accepted owner and its form", async () => {
      await render(scenario.lab());
      const initialIdentity = identity();
      expect(temperature().value).toBe(scenario.initial);
      await editTemperature(scenario.changed);
      expect(identity()).toEqual(initialIdentity);
      await apply();
      const accepted = identity();
      expect(accepted[1]).not.toBe(initialIdentity[1]);
      expect(reference?.instanceId).toBe(accepted[0] ?? "");
      expect(reference?.runId).toBe(accepted[1] ?? "");
      // A later unfinished draft is not an accepted scientific input.
      await editTemperature("unfinished");
      expect(identity()).toEqual(accepted);
      await act(async () => root.render(null));
      await render(scenario.lab());
      expect(identity()).toEqual(accepted);
      expect(temperature().value).toBe(scenario.changed);
      expect(
        container.querySelector("[data-execution-label]")?.getAttribute("data-execution-label"),
      ).toBe("host");
    });

    test("another passage gets an independent owner while the first remains reusable", async () => {
      await render(scenario.lab());
      await editTemperature(scenario.changed);
      await apply();
      const first = identity();
      const saved = reference;
      await act(async () => root.render(null));
      reference = null;
      await render(scenario.lab(), "/paper/passage-two");
      expect(identity()[0]).not.toBe(first[0]);
      expect(temperature().value).toBe(scenario.initial);
      await act(async () => root.render(null));
      reference = saved;
      await render(scenario.lab());
      expect(identity()).toEqual(first);
      expect(temperature().value).toBe(scenario.changed);
    });
  });
}
