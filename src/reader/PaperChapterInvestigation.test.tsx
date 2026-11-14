import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DiscoveryInvestigationProvider } from "../discovery/investigation/context.tsx";
import { KeptInvestigations } from "../discovery/investigation/KeptInvestigations.tsx";
import { readStoredInvestigation } from "../discovery/investigation/persistence.ts";
import { INVESTIGATIONS } from "../discovery/investigation/specs.ts";
import { PPE_TASK as LIGHT_TASK } from "../discovery/lightQuanta/journeyI.ts";
import { PPE_TASK as MASS_TASK } from "../discovery/massEnergy/journeyIV.ts";
import { PpeTask } from "../discovery/PpeTask.tsx";
import { PPE_TASK as CLOCK_TASK } from "../discovery/relativity/journeyIII.ts";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import { PaperChapterInvestigation } from "./PaperChapterInvestigation.tsx";
import { ReaderController } from "./ReaderController.tsx";

const CASES = [
  { paper: "light-quanta", section: "s8", other: "s7", task: LIGHT_TASK },
  { paper: "special-relativity", section: "s4", other: "s3", task: CLOCK_TASK },
  { paper: "mass-energy", section: "s0", other: null, task: MASS_TASK },
] as const;

describe("the chapter's live task keeps the accepted experiment across reading and return", () => {
  let root: Root;
  beforeEach(async () => {
    await installDom({ intersections: "visible" });
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    await uninstallDom();
  });
  async function until(check: () => boolean) {
    for (let attempt = 0; attempt < 150 && !check(); attempt++)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    expect(check()).toBe(true);
  }
  function button(label: string) {
    const found = [...document.querySelectorAll("button")].find(
      (node) => node.textContent?.trim() === label,
    );
    assert.ok(found, label);
    return found;
  }
  async function click(label: string) {
    await act(async () => button(label).click());
  }
  async function openWorkspace() {
    const details = document.querySelector<HTMLDetailsElement>(".investigation-disclosure");
    assert.ok(details);
    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event("toggle"));
    });
    await until(() => document.querySelector('textarea[id$="-prediction"]') !== null);
  }
  function textarea(suffix: string) {
    const field = document.querySelector<HTMLTextAreaElement>(`textarea[id$="-${suffix}"]`);
    assert.ok(field);
    return field;
  }
  function props(node: Element): Record<string, (event: unknown) => void> {
    const key = Object.keys(node).find((name) => name.startsWith("__reactProps$"));
    assert.ok(key);
    return (node as unknown as Record<string, Record<string, (event: unknown) => void>>)[key] ?? {};
  }
  async function type(selector: string, value: string, commit = false) {
    const field = document.querySelector<HTMLInputElement>(selector);
    assert.ok(field, selector);
    await act(async () => {
      field.value = value;
      props(field).onChange?.({ target: field, currentTarget: field });
    });
    if (commit)
      await act(async () => props(field).onBlur?.({ target: field, currentTarget: field }));
  }

  for (const item of CASES) {
    test(`${item.paper}: explicit load, actual controls, unchanged baseline, restored Discover and Notebook`, async () => {
      const spec = INVESTIGATIONS[item.paper];
      const path = `/papers/${item.paper}/${item.section}/`;
      document.documentElement.dataset.readingOnly = "on";
      window.history.replaceState({}, "", `${path}#${spec.laboratoryAnchor}`);
      await act(async () =>
        root.render(
          <div data-reader-root data-view="reading">
            <ReaderController
              registry={{
                paperId: item.paper,
                anchors: [spec.promptId, spec.laboratoryAnchor],
                foundations: [],
              }}
              titles={{}}
              questions={{}}
            />
            <dialog data-clarification-dialog />
            <p data-reader-announcement />
            <PaperChapterInvestigation paper={item.paper} section={item.section} />
          </div>,
        ),
      );
      const disclosure = document.querySelector<HTMLDetailsElement>(
        `[data-chapter-lab="${spec.experimentId}"]`,
      );
      assert.ok(disclosure);
      expect(disclosure.open).toBe(true);
      expect(document.querySelector(`[data-instrument-id="${spec.experimentId}"]`)).toBeNull();
      await openWorkspace();
      expect(button("Pin prediction and starting reading").disabled).toBe(true);
      expect(readStoredInvestigation(item.paper).status).toBe("missing");
      await click("Load this experiment");
      await until(
        () => document.querySelector(`[data-instrument-id="${spec.experimentId}"]`) !== null,
      );
      await until(() => !button("Pin prediction and starting reading").disabled);
      const lab = document.querySelector(`[data-instrument-id="${spec.experimentId}"]`);
      assert.ok(lab);
      const instance = lab.getAttribute("data-instance-id");
      assert.ok(instance);
      expect(document.querySelectorAll(`#${spec.laboratoryAnchor}`).length).toBe(1);
      textarea("prediction").value = "I expect the chosen change to leave one quantity unchanged.";
      await click("Pin prediction and starting reading");
      const baseline = readStoredInvestigation(item.paper).report?.baseline.reading;
      assert.ok(baseline);
      expect(baseline.instanceId).toBe(instance);

      if (item.paper === "light-quanta") {
        await type('input[id$="-incidentPower"]', "2", true);
      } else if (item.paper === "special-relativity") {
        await type('input[name="speed"]', "0.6");
        await type('input[name="coordinateDuration"]', "10");
        const choice = document.querySelector<HTMLSelectElement>('select[name="worldlinePreset"]');
        assert.ok(choice);
        await act(async () => {
          choice.value = "circle";
          choice.dispatchEvent(new Event("change", { bubbles: true }));
        });
        const form = choice.closest("form");
        assert.ok(form);
        await act(async () => {
          form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        });
      } else {
        await click("Both, as one isolated system");
        expect(document.querySelector("[data-boundary-comparison-offer]")).toBeNull();
        expect(document.querySelector("[data-boundary-comparison]")).toBeNull();
      }

      const keptAction = lab.getAttribute("data-accepted-action-index");
      if (item.paper === "light-quanta") {
        // Both local validation paths stop before session.apply: blank text and scaled overflow.
        for (const invalid of ["", "1e300"]) {
          const retainedVersion = lab.getAttribute("data-snapshot-version");
          await type('input[id$="-frequency"]', invalid, true);
          expect(button("Capture changed reading").disabled).toBe(true);
          expect(lab.getAttribute("data-view-state")).toBe("refused");
          expect(lab.getAttribute("data-snapshot-version")).toBe(retainedVersion);
          await click("Capture changed reading");
          expect(readStoredInvestigation(item.paper).report?.observations).toEqual([]);
          await type('input[id$="-frequency"]', "600", true);
          expect(button("Capture changed reading").disabled).toBe(false);
        }
      } else if (item.paper === "special-relativity") {
        await type('input[name="speed"]', "1");
        await click("Apply clock settings");
        expect(button("Capture changed reading").disabled).toBe(true);
        expect(lab.getAttribute("data-accepted-action-index")).toBe(keptAction);
        await click("Use accepted settings");
        expect(button("Capture changed reading").disabled).toBe(false);
        expect(lab.getAttribute("data-accepted-action-index")).toBe(keptAction);
        expect(document.body.textContent).toContain("No new calculation was made.");
      } else {
        await type('input[name="emittedEnergy"]', "-1");
        await click("Calculate with these energies");
        expect(button("Capture changed reading").disabled).toBe(true);
        expect(lab.getAttribute("data-accepted-action-index")).toBe(keptAction);
        expect(readStoredInvestigation(item.paper).report?.observations).toEqual([]);
        await type('input[name="emittedEnergy"]', "1");
        await click("Calculate with these energies");
        expect(button("Capture changed reading").disabled).toBe(false);
      }
      await click("Capture changed reading");
      const report = readStoredInvestigation(item.paper).report;
      assert.ok(report);
      const changed = report.observations[0]?.reading;
      assert.ok(changed);
      expect(changed.instanceId).toBe(instance);
      expect(changed.actionIndex).toBeGreaterThan(baseline.actionIndex);
      expect(changed.origin).toBe("accepted-laboratory-result");
      expect(report.baseline.reading).toEqual(baseline);
      const value = (id: string) => changed.outputs.find((entry) => entry.quantityId === id)?.value;
      if (item.paper === "light-quanta") expect(value("incidentPower")).toBe(0.002);
      else if (item.paper === "special-relativity") {
        expect(value("properTime")).toBe(8);
        expect(changed.parameters.worldlinePreset).toBe("circle");
        expect(String(changed.actionIndex)).toBe(keptAction);
      } else expect(value("massChange")).toBe(0);

      // Closing a panel or visiting a reader history entry is not a new experiment lifetime.
      await act(async () => {
        disclosure.open = false;
        disclosure.dispatchEvent(new Event("toggle"));
        window.history.pushState({}, "", `${path}?view=results#${spec.promptId}`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      expect(document.querySelector<HTMLElement>("[data-reader-root]")?.dataset.view).toBe(
        "results",
      );
      expect(document.querySelector(`[data-instrument-id="${spec.experimentId}"]`)).toBe(lab);
      await act(async () => {
        window.history.replaceState({}, "", `${path}#${spec.laboratoryAnchor}`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      expect(document.querySelector<HTMLElement>("[data-reader-root]")?.dataset.view).toBe(
        "reading",
      );
      expect(disclosure.open).toBe(true);
      expect(document.querySelector(`[data-instrument-id="${spec.experimentId}"]`)).toBe(lab);
      expect(readStoredInvestigation(item.paper).report?.observations[0]?.reading).toEqual(changed);
      textarea("explanation").value =
        "I compared the accepted settings and kept the model's assumptions visible.";
      await click("Keep my explanation");
      const saved = JSON.stringify(readStoredInvestigation(item.paper).report);

      await act(async () =>
        root.render(
          <DiscoveryInvestigationProvider spec={spec}>
            <PpeTask task={item.task} />
          </DiscoveryInvestigationProvider>,
        ),
      );
      await openWorkspace();
      expect(button("Capture changed reading").disabled).toBe(true);
      expect(document.body.textContent).toContain(report.prediction);
      expect(JSON.stringify(readStoredInvestigation(item.paper).report)).toBe(saved);
      await act(async () => root.render(<KeptInvestigations />));
      expect(
        document.querySelector(`[data-kept-investigation="${item.paper}"]`)?.textContent,
      ).toContain(report.prediction);
      expect(JSON.stringify(readStoredInvestigation(item.paper).report)).toBe(saved);
    }, 20_000);
  }
});
