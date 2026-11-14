import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { loadRelativityObserverGroup } from "../../experiments/groups/load.ts";
import { DEFAULT_PREPARED_EXAMPLE as doppler } from "../../experiments/sr09/session.ts";
import { DEFAULT_PREPARED_EXAMPLE as lightComplex } from "../../experiments/sr10/session.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { LinkedObserverLab } from "./LinkedObserverLab.tsx";

describe("linked observer's no-JavaScript reading", () => {
  test("renders the real owners' independent worked examples with static execution labels", () => {
    const html = renderToStaticMarkup(
      <LinkedObserverLab
        definition={loadRelativityObserverGroup()}
        examples={{ doppler, lightComplex }}
      />,
    );
    expect(html).toContain('data-group-enabled="false"');
    expect(html).toContain('data-group-phase="independent"');
    expect(html).toContain('data-currency-state="current"');
    expect(html).toContain('data-member="sr-09"');
    expect(html).toContain('data-member="sr-10"');
    expect(html.match(/Static worked example/g)).toHaveLength(2);
    expect(html).not.toContain("Ideal model, host calculation");
    expect(html).toContain('data-output="waveFrequencyMoving" data-result-status="value">250');
    expect(html).toContain('data-output="lightComplexEnergyMoving" data-result-status="value">0.5');
    expect(html).toContain('data-output="lightComplexVolumeMoving" data-result-status="value">2');
    expect(html).toContain("JavaScript enables linked and independent observer changes");
    expect(html).toContain("Matching numbers here do not link the controls");
    expect(html).not.toContain("The same observer gives the same factor");
  });
});

describe("linked observer controls operate the actual instrument owners", () => {
  let container: HTMLElement;
  let root: Root;

  beforeEach(async () => {
    await installDom();
    container = createContainer();
    root = createRoot(container);
    await act(async () =>
      root.render(
        <LinkedObserverLab
          definition={loadRelativityObserverGroup()}
          examples={{ doppler, lightComplex }}
        />,
      ),
    );
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    removeContainer(container);
    await uninstallDom();
  });

  function field(label: string): HTMLInputElement {
    const found = [...container.querySelectorAll("label")].find(
      (entry) => entry.textContent === label,
    );
    assert(found);
    const input = document.getElementById(found.htmlFor);
    assert(input instanceof HTMLInputElement);
    return input;
  }
  async function type(label: string, value: string) {
    const input = field(label);
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      assert(setter);
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  async function submit(label: string) {
    const form = field(label).form;
    assert(form);
    await act(async () =>
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
  }
  function button(label: string): HTMLButtonElement {
    const found = [...container.querySelectorAll("button")].find(
      (entry) => entry.textContent === label,
    );
    assert(found);
    return found;
  }
  function view() {
    const region = container.querySelector("[data-linked-observer]");
    assert(region);
    return region;
  }
  function member(instrumentId: string) {
    const region = container.querySelector(`[data-member="${instrumentId}"]`);
    assert(region);
    return region;
  }
  function reading(instrumentId: string, quantityId: string) {
    return member(instrumentId).querySelector(`[data-output="${quantityId}"]`)?.textContent;
  }
  function identities() {
    return ["sr-09", "sr-10"].map((id) => [
      member(id).getAttribute("data-run-id"),
      member(id).getAttribute("data-snapshot-version"),
    ]);
  }

  test("link, shared change, refusal, unlink and independent change preserve the right accepted pair", async () => {
    expect(view().getAttribute("data-group-enabled")).toBe("false");
    expect(
      [...container.querySelectorAll("[data-execution-label]")].map((entry) => entry.textContent),
    ).toEqual(["Static worked example", "Static worked example"]);
    const runs = identities().map(([run]) => run);
    await submit("Shared observer speed v/c");
    expect(view().getAttribute("data-group-enabled")).toBe("true");
    expect(view().getAttribute("data-group-phase")).toBe("accepted");
    expect(container.querySelector(".linked-observer-independent")).toBeNull();
    await type("Shared observer speed v/c", "-0.6");
    await submit("Shared observer speed v/c");
    expect(reading("sr-09", "waveFrequencyMoving")).toBe("1000");
    expect(reading("sr-10", "lightComplexEnergyMoving")).toBe("2");
    expect(reading("sr-10", "lightComplexVolumeMoving")).toBe("0.5");
    expect(identities().map(([run]) => run)).toEqual(runs);
    const complete = identities();
    await type("Shared observer speed v/c", "1");
    await submit("Shared observer speed v/c");
    expect(view().getAttribute("data-group-phase")).toBe("refused");
    expect(
      container.querySelector("[data-currency-state]")?.getAttribute("data-currency-state"),
    ).toBe("stale");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "accepted results remain available",
    );
    expect(container.querySelector(".linked-observer-chip")?.textContent).toContain(
      "0 of 2 instruments settled",
    );
    expect(identities()).toEqual(complete);
    expect(reading("sr-09", "waveFrequencyMoving")).toBe("1000");
    await act(async () => button("Unlink observers").click());
    expect(view().getAttribute("data-group-enabled")).toBe("false");
    expect(identities()).toEqual(complete);
    expect(field("Doppler observer speed v/c").value).toBe("-0.6");
    expect(field("Light-complex observer speed v/c").value).toBe("-0.6");
    await type("Doppler observer speed v/c", "0");
    await submit("Doppler observer speed v/c");
    expect(reading("sr-09", "waveFrequencyMoving")).toBe("500");
    expect(reading("sr-10", "lightComplexEnergyMoving")).toBe("2");
    expect(identities()[1]).toEqual(complete[1]);
    expect(identities().map(([run]) => run)).toEqual(runs);
  });

  test("an empty shared input keeps the accepted pair visibly stale and a repaired value recovers", async () => {
    await submit("Shared observer speed v/c");
    const complete = identities();
    await type("Shared observer speed v/c", "");
    await submit("Shared observer speed v/c");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Enter observer speed",
    );
    expect(
      container.querySelector("[data-currency-state]")?.getAttribute("data-currency-state"),
    ).toBe("stale");
    expect(container.querySelector(".linked-observer-conclusion")).toBeNull();
    expect(identities()).toEqual(complete);
    await type("Shared observer speed v/c", "0");
    await submit("Shared observer speed v/c");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(
      container.querySelector("[data-currency-state]")?.getAttribute("data-currency-state"),
    ).toBe("current");
    expect(reading("sr-09", "dopplerFactor")).toBe("1");
    expect(reading("sr-10", "dopplerFactor")).toBe("1");
  });

  test("a refused first link retains both separately labelled static descriptions", async () => {
    const before = identities();
    await type("Shared observer speed v/c", "1");
    await submit("Shared observer speed v/c");
    expect(view().getAttribute("data-group-phase")).toBe("refused");
    expect(identities()).toEqual(before);
    expect(container.textContent).toContain("Separate accepted descriptions");
    expect(container.textContent).toContain("They are not yet a shared comparison");
    expect(container.textContent).not.toContain("Last complete comparison");
    expect(container.querySelector(".linked-observer-conclusion")).toBeNull();
    expect(reading("sr-09", "waveFrequencyMoving")).toBe("250");
    expect(reading("sr-10", "lightComplexEnergyMoving")).toBe("0.5");
    expect(
      [...container.querySelectorAll("[data-execution-label]")].map((entry) => entry.textContent),
    ).toEqual(["Static worked example", "Static worked example"]);
  });
});
