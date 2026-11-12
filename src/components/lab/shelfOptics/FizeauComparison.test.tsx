import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { prepareFizeauWorldCheck } from "../../../discovery/relativity/fizeauWorldCheck.ts";
import type { FizeauRecord } from "../../../experiments/shelfOptics/fizeau.ts";
import { shelfSnapshot } from "../../../experiments/shelfOptics/state.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../../testing/reactDom.ts";
import { FizeauWorldCheck } from "../../discover/FizeauWorldCheck.tsx";
import { FizeauComparison } from "./FizeauComparison.tsx";
import { ShelfOpticsLab } from "./ShelfOpticsLab.tsx";

test("the actual journey composition serves the measured table and model without JavaScript", () => {
  const prepared = prepareFizeauWorldCheck();
  const html = renderToStaticMarkup(<FizeauWorldCheck {...prepared} />);
  expect(html).toContain('data-comparison-kind="measured-fact"');
  expect(html).toContain('data-historical-dataset="fizeau-1851-water"');
  expect(html.match(/data-fizeau-observed=/g)?.length).toBe(19);
  expect(html).toContain("0.23016");
  expect(html).toContain("0.20692");
  expect(html).toContain("available before 1905");
  expect(html).toContain("does not distinguish an ether account");
  expect(html).toContain("an assumed refractive index");
  expect(html).toContain("table used here was published in 1859");
});

test("withdrawal does not leak observations through the journey's static example", () => {
  const record: FizeauRecord = {
    kind: "withheld",
    citation: "Fizeau 1859",
    reason: "The data is withdrawn.",
  };
  const html = renderToStaticMarkup(<FizeauWorldCheck {...prepareFizeauWorldCheck(record)} />);
  expect(html).toContain("The data is withdrawn.");
  expect(html).not.toContain("data-fizeau-observed");
  expect(html).not.toContain('data-comparison-kind="measured-fact"');
  expect(html).not.toContain("0.23016");
});

test("refused or unapplied requests explicitly retain the previous accepted comparison", () => {
  const prepared = prepareFizeauWorldCheck();
  const html = renderToStaticMarkup(
    <FizeauComparison
      record={prepared.record}
      snapshot={shelfSnapshot(prepared.example, 7)}
      dirty
      refused
    />,
  );
  expect(html).toContain("settings were refused");
  expect(html).toContain("accepted calculation 7");
  expect(html).toContain('data-fizeau-currency="previous-accepted"');
});

type Handlers = Record<string, ((event: unknown) => void) | undefined>;
function handlers(control: Element): Handlers {
  const input = control.closest("form")?.querySelector("input");
  const key = [control, ...(input ? [input] : [])]
    .flatMap((candidate) => Object.getOwnPropertyNames(candidate))
    .find((name) => name.startsWith("__reactProps$"));
  if (!key) throw new Error("The mounted React element has no handlers.");
  return (control as unknown as Record<string, Handlers>)[key] ?? {};
}
function element<T extends Element>(container: ParentNode, selector: string): T {
  const found = container.querySelector<T>(selector);
  if (!found) throw new Error(`Missing ${selector}`);
  return found;
}

describe("the source comparison follows actual form submissions", () => {
  beforeEach(installDom);
  afterEach(uninstallDom);

  test("draft, accept, refuse, restore and reversal share the same accepted snapshot while observations stay fixed", async () => {
    const prepared = prepareFizeauWorldCheck();
    const container = createContainer();
    const root = createRoot(container);
    const prediction = () =>
      element(container, '[data-fizeau-model="fresnel-drag"] [data-fizeau-predicted]').textContent;
    const observations = () =>
      [...container.querySelectorAll("[data-fizeau-observed]")].map((node) => node.textContent);
    const change = async (key: string, value: string) => {
      const input = element<HTMLInputElement>(container, `[id$="-${key}"]`);
      await act(async () => {
        input.value = value;
        handlers(input).onChange?.({ target: input, currentTarget: input });
      });
    };
    const submit = async () => {
      const form = element<HTMLFormElement>(container, "form");
      await act(async () => {
        handlers(form).onSubmit?.({ preventDefault() {} });
      });
    };
    try {
      await act(async () =>
        root.render(<ShelfOpticsLab example={prepared.example} fizeau={prepared.record} />),
      );
      const original = observations();
      const initial = prediction();
      await change("waterSpeed", "0");
      expect(prediction()).toBe(initial);
      expect(container.textContent).toContain("edits have not been applied");
      await submit();
      expect(prediction()).toBe("0");
      expect(
        element(container, "[data-comparison-revision]").getAttribute("data-comparison-revision"),
      ).toBe("1");
      await change("waterSpeed", "not a number");
      await submit();
      expect(prediction()).toBe("0");
      expect(container.textContent).toContain("settings were refused");
      const restore = [...container.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Apply Fizeau"),
      );
      if (!restore) throw new Error("The source preset is not reachable.");
      await act(async () => restore.click());
      expect(prediction()).toBe(initial);
      expect(element<HTMLInputElement>(container, '[id$="-waterSpeed"]').value).toBe("7.059");
      const reversal = element<HTMLInputElement>(container, 'input[type="checkbox"]');
      await act(async () => {
        reversal.checked = true;
        handlers(reversal).onChange?.({ currentTarget: reversal });
      });
      await submit();
      expect(container.querySelector("[data-fizeau-unavailable]")).not.toBeNull();
      expect(container.querySelector("[data-fizeau-predicted]")).toBeNull();
      expect(observations()).toEqual(original);
    } finally {
      await act(async () => root.unmount());
      removeContainer(container);
    }
  });
});
