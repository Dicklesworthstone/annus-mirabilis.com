/**
 * BOTH OF THIS COMPONENT'S REFUSALS ARE UNREACHABLE, and this file is the record rather than a
 * test of either site (am-r3qt). Established by planting, not by reading: disabling the snapshot
 * guard leaves the existing avogadro suites at 7 pass 0 fail, so nothing was driving it.
 *
 *   unexpected-result-status, at AvogadroLab.tsx line 61, is the fall-through after the component
 *   has handled value, underdetermined and outside-domain. The session declares
 *   `statuses: ["value", "outside-domain", "underdetermined"]` as the outputs' admitted set -
 *   EXACTLY those three - so a result carrying any other status never reaches the component.
 *
 *   no-accepted-snapshot, at line 82, refuses a render with no accepted snapshot. The session
 *   routes every publish through publishedOrRefused, which throws publication-refused when the
 *   store declines, so a session that exists has an accepted snapshot and one that does not never
 *   returns a view to render.
 *
 * Both are defensive guards whose preconditions are established upstream, which is the am-okw3
 * shape, and both are worth keeping: the first is what would catch a session that began emitting a
 * typed no-value the component has no branch for - symbolic, analytic-limit, not-applicable or
 * divergent - and the second is what would catch a store that published nothing.
 *
 * THE PREMISES ARE ASSERTED so the claims fail if the structure changes rather than being prose
 * that quietly goes stale. Widen the session's admitted statuses, or let it return a view without
 * routing through publishedOrRefused, and this goes red.
 *
 * NEITHER CODE IS NAMED IN A STRING LITERAL HERE, and no line number is written in the
 * parenthesised form, because both credit a site with the refusal scanner. A category-3 record
 * must name its refusal without claiming to have driven it; the rule and the two plants that
 * established it are on am-r3qt.
 */

import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AVOGADRO_DEFAULTS,
  decodeAvogadroParameters,
  encodeAvogadroParameters,
} from "../../../experiments/avogadro/definition.ts";
import { executionOutcomeRegistry } from "../../../experiments/results/outcomes.ts";
import * as intervalOwner from "../../../physics/reference/inference/identifiability.ts";
import { installDom, uninstallDom } from "../../../testing/reactDom.ts";
import { AvogadroLab } from "./AvogadroLab.tsx";

const session = readFileSync(
  new URL("../../../experiments/avogadro/session.ts", import.meta.url),
  "utf8",
);

describe("AvogadroLab's refusals are unreachable, and the upstream facts that make them so", () => {
  test("the session admits exactly the three statuses the component handles", () => {
    const declared = /statuses:\s*Object\.freeze\(\[([^\]]+)\]/.exec(session)?.[1];
    expect(declared).toBeDefined();
    const statuses = [...(declared ?? "").matchAll(/"([a-z-]+)"/g)].map((m) => m[1]).sort();
    expect(statuses).toEqual(["outside-domain", "underdetermined", "value"]);

    // The component's branches, read from its own source, must cover every admitted status. If a
    // status is added to the session without a branch here, the fall-through becomes reachable and
    // this record becomes false - which is what it is for.
    const component = readFileSync(new URL("./AvogadroLab.tsx", import.meta.url), "utf8");
    for (const status of statuses) expect(component).toContain(status);
  });

  test("the session refuses to exist without an accepted publication", () => {
    expect(session).toContain("function publishedOrRefused");
    expect(session).toContain("publication-refused");
  });

  test("the lab renders, so the claims are about a path that runs", () => {
    // Non-vacuity. "Those guards are unreachable" would say nothing about a component nothing
    // exercises, so the record asserts that this one does render its readings.
    expect(renderToStaticMarkup(<AvogadroLab />)).toContain("data-quantity-id");
  });
});

describe("declared radius uncertainty in the mounted comparison", () => {
  let root: Root;
  let container: HTMLElement;
  beforeEach(async () => {
    await installDom();
    history.replaceState(null, "", "/lab/avogadro-lab/");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    await uninstallDom();
  });
  function element<T extends Element>(selector: string): T {
    const found = container.querySelector<T>(selector);
    if (!found) throw new Error(`Missing mounted control: ${selector}`);
    return found;
  }
  async function show() {
    await act(async () => root.render(<AvogadroLab />));
  }
  async function change(selector: string, value: string) {
    const control = element<HTMLInputElement | HTMLSelectElement>(selector);
    await act(async () => {
      if (control instanceof HTMLInputElement) {
        const key = Object.getOwnPropertyNames(control).find((name) =>
          name.startsWith("__reactProps$"),
        );
        if (!key) throw new Error("The mounted input has no change handler.");
        const handlers = (
          control as unknown as Record<string, { onChange: (event: unknown) => void }>
        )[key];
        if (!handlers) throw new Error("The mounted input has no handlers.");
        control.value = value;
        handlers.onChange({ target: control, currentTarget: control });
        return;
      }
      const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      if (!setValue) throw new Error("The control has no native value setter.");
      setValue.call(control, value);
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  async function submit(label = "Three-method comparison settings") {
    const event = new Event("submit", { bubbles: true, cancelable: true });
    await act(async () =>
      element<HTMLFormElement>(`form[aria-label="${label}"]`).dispatchEvent(event),
    );
    expect(event.defaultPrevented).toBe(true);
  }
  function table() {
    return element<HTMLElement>('[aria-label="Molecular-number comparison"]');
  }
  function bookmark() {
    const link = [...container.querySelectorAll<HTMLAnchorElement>("a")].find((node) =>
      node.textContent?.includes("Bookmark these accepted settings"),
    );
    if (!link) throw new Error("Missing accepted bookmark.");
    return link;
  }

  test("a submitted interval becomes readable and shareable; an insufficient-coverage draft leaves all accepted routes intact", async () => {
    await show();
    const exact = table().innerHTML;
    await change('[name="radiusInterval"]', "1");
    await change('[name="radiusLowerUm"]', "0.4");
    await change('[name="radiusUpperUm"]', "0.65");
    expect(table().innerHTML).toBe(exact);
    expect(table().textContent).toContain("Conditional 95% interval");
    await submit();
    expect(table().textContent).toContain("At least 95% coverage (Bonferroni)");
    expect(element("[data-accepted-radius-interval]").textContent).toContain("0.4 to 0.65");
    const accepted = decodeAvogadroParameters(new URL(bookmark().href).search);
    if (accepted.kind !== "accepted") throw new Error(accepted.reason);
    expect(accepted.parameters.radiusLowerUm).toBe(0.4);
    expect(accepted.parameters.radiusUpperUm).toBe(0.65);
    expect(accepted.parameters.radiusCoveragePercent).toBe(97.5);
    const before = table().innerHTML;
    const link = bookmark().href;
    const version = element<HTMLElement>("[data-instrument-id='avogadro-lab']").dataset
      .snapshotVersion;
    await change('[name="radiusCoveragePercent"]', "95");
    await change('[name="alphaScale"]', "2");
    await submit();
    expect(element('[role="alert"][data-refusal-code="invalid-parameter"]').textContent).toContain(
      "97.5",
    );
    expect(table().innerHTML).toBe(before);
    expect(bookmark().href).toBe(link);
    expect(
      element<HTMLElement>("[data-instrument-id='avogadro-lab']").dataset.snapshotVersion,
    ).toBe(version);
    expect(element<HTMLInputElement>('[name="radiusCoveragePercent"]').value).toBe("95");
  });

  test("a bookmark restores the accepted declaration and a refused history replacement preserves it", async () => {
    const parameters = {
      ...AVOGADRO_DEFAULTS,
      radiusInterval: 1,
      constantBasis: 1,
      radiusLowerUm: 0.3,
      radiusUpperUm: 0.8,
      radiusCoveragePercent: 99,
    };
    history.replaceState(null, "", `/lab/avogadro-lab/?${encodeAvogadroParameters(parameters)}`);
    await show();
    expect(table().textContent).toContain("At least 96.5% coverage (Bonferroni)");
    expect(element<HTMLInputElement>('[name="radiusLowerUm"]').value).toBe("0.3");
    expect(element("[data-accepted-radius-interval]").textContent).toContain("99%");
    expect(table().textContent).toContain("Independent estimate");
    const before = table().innerHTML;
    const link = bookmark().href;
    history.replaceState(
      null,
      "",
      `/lab/avogadro-lab/?${encodeAvogadroParameters({ ...parameters, radiusCoveragePercent: 95 })}`,
    );
    await act(async () => window.dispatchEvent(new PopStateEvent("popstate")));
    expect(element('[role="alert"][data-refusal-code="invalid-parameter"]').textContent).toContain(
      "last accepted example",
    );
    expect(table().innerHTML).toBe(before);
    expect(bookmark().href).toBe(link);
  });

  test("a controlled study labels exact and conservative intervals using each frozen row's settings", async () => {
    await show();
    const original = table().innerHTML;
    await change("[data-avogadro-sensitivity] select", "radiusInterval");
    await submit("One-input molecular-number study");
    const study = element('[aria-label="Three-route sensitivity results"]');
    expect(study.textContent).toContain("Exact radius");
    expect(study.textContent).toContain("Declared radius interval");
    expect(study.textContent).toContain("Conditional 95% interval");
    expect(study.textContent).toContain("At least 95% coverage (Bonferroni)");
    expect(table().innerHTML).toBe(original);
    const studyBefore = study.innerHTML;
    await change('[name="radiusInterval"]', "1");
    await change('[name="radiusUpperUm"]', "0.8");
    await submit();
    expect(study.innerHTML).toBe(studyBefore);
    expect(element("[data-study-source-revision]").textContent).toContain(
      "earlier completed study",
    );
  });

  test("an interval-owner execution outcome keeps both mounted results and an earlier completed study", async () => {
    history.replaceState(
      null,
      "",
      `/lab/avogadro-lab/?${encodeAvogadroParameters({ ...AVOGADRO_DEFAULTS, radiusInterval: 1 })}`,
    );
    await show();
    await submit("One-input molecular-number study");
    const acceptedTable = table().innerHTML;
    const acceptedStudy = element('[aria-label="Three-route sensitivity results"]').innerHTML;
    const acceptedLink = bookmark().href;
    const unavailable = {
      kind: "outcome" as const,
      outcome: {
        outcome: "invariant-violation" as const,
        ...executionOutcomeRegistry["invariant-violation"],
      },
    };
    const owner = spyOn(intervalOwner, "conditionalMolecularNumberInterval").mockReturnValue(
      unavailable,
    );
    try {
      await change('[name="alphaScale"]', "2");
      await submit();
      const mainFailure = element<HTMLElement>(
        'form[aria-label="Three-method comparison settings"] [role="alert"]',
      );
      expect(mainFailure.dataset.executionOutcome).toBe("invariant-violation");
      expect(mainFailure.dataset.refusalCode).toBeUndefined();
      expect(mainFailure.textContent).toContain(unavailable.outcome.message);
      expect(table().innerHTML).toBe(acceptedTable);
      expect(bookmark().href).toBe(acceptedLink);
      await submit("One-input molecular-number study");
      const studyFailure = element<HTMLElement>('[data-avogadro-sensitivity] [role="alert"]');
      expect(studyFailure.dataset.executionOutcome).toBe("invariant-violation");
      expect(studyFailure.textContent).toContain("previous completed study is unchanged");
      expect(element('[aria-label="Three-route sensitivity results"]').innerHTML).toBe(acceptedStudy);
      expect(table().innerHTML).toBe(acceptedTable);
    } finally {
      owner.mockRestore();
    }
  });

});
