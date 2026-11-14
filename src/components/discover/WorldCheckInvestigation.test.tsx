import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { LIGHT_QUANTA_LATER_EVIDENCE } from "../../content/lightQuantaShelf.ts";
import { MASS_ENERGY_LATER_EVIDENCE } from "../../content/massEnergyShelf.ts";
import { SPECIAL_RELATIVITY_LATER_EVIDENCE } from "../../content/specialRelativityShelf.ts";
import {
  DiscoveryInvestigationProvider,
  useDiscoveryInvestigation,
} from "../../discovery/investigation/context.tsx";
import type { InvestigationStore } from "../../discovery/investigation/core.ts";
import { readStoredInvestigation } from "../../discovery/investigation/persistence.ts";
import { INVESTIGATIONS } from "../../discovery/investigation/specs.ts";
import {
  WORLD_CHECK as LIGHT_CHECK,
  PPE_TASK as LIGHT_TASK,
} from "../../discovery/lightQuanta/journeyI.ts";
import {
  HISTORICAL_CHECK_EXAMPLE,
  PRINTED_STOPPING_CHECK,
} from "../../discovery/lightQuanta/worldCheck.ts";
import {
  WORLD_CHECK as MASS_CHECK,
  PPE_TASK as MASS_TASK,
} from "../../discovery/massEnergy/journeyIV.ts";
import { PpeTask } from "../../discovery/PpeTask.tsx";
import {
  WORLD_CHECK as CLOCK_CHECK,
  PPE_TASK as CLOCK_TASK,
} from "../../discovery/relativity/journeyIII.ts";
import { MOVING_CLOCK_CHECK_EXAMPLE } from "../../discovery/relativity/worldCheck.ts";
import { loadMillikanOverlay } from "../../experiments/lq08/millikanRecord.ts";
import { createLq08Session } from "../../experiments/lq08/session.ts";
import { loadBainbridgeRecord } from "../../experiments/me03/bainbridgeRecord.ts";
import { createMe03Session, DEFAULT_PREPARED_EXAMPLE } from "../../experiments/me03/session.ts";
import { createSr05Session } from "../../experiments/sr05/session.ts";
import labDigests from "../../generated/lab-source-digests.json";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { LightQuantaWorldCheck } from "./LightQuantaWorldCheck.tsx";
import { MassEnergyWorldCheck } from "./MassEnergyWorldCheck.tsx";
import { RelativityWorldCheck } from "./RelativityWorldCheck.tsx";

const CASES = [
  { paper: "light-quanta", task: LIGHT_TASK },
  { paper: "special-relativity", task: CLOCK_TASK },
  { paper: "mass-energy", task: MASS_TASK },
] as const;
type Paper = (typeof CASES)[number]["paper"];

function worldCheck(paper: Paper) {
  if (paper === "light-quanta") {
    const owner = createLq08Session("discover-capture-light", HISTORICAL_CHECK_EXAMPLE);
    return {
      owner,
      element: (
        <LightQuantaWorldCheck
          example={HISTORICAL_CHECK_EXAMPLE}
          check={LIGHT_CHECK}
          printedVolts={PRINTED_STOPPING_CHECK.volts}
          laterEvidence={LIGHT_QUANTA_LATER_EVIDENCE}
          millikan={loadMillikanOverlay()}
          session={owner}
        />
      ),
    };
  }
  if (paper === "special-relativity") {
    const owner = createSr05Session("discover-capture-clock", MOVING_CLOCK_CHECK_EXAMPLE);
    return {
      owner,
      element: (
        <RelativityWorldCheck
          example={MOVING_CLOCK_CHECK_EXAMPLE}
          check={CLOCK_CHECK}
          laterEvidence={SPECIAL_RELATIVITY_LATER_EVIDENCE}
          session={owner}
        />
      ),
    };
  }
  const example = { ...DEFAULT_PREPARED_EXAMPLE, sourceDigest: labDigests["me-03"] };
  const owner = createMe03Session("discover-capture-mass", example.parameters);
  return {
    owner,
    element: (
      <MassEnergyWorldCheck
        example={example}
        check={MASS_CHECK}
        laterEvidence={MASS_ENERGY_LATER_EVIDENCE}
        bainbridge={loadBainbridgeRecord()}
        session={owner}
      />
    ),
  };
}

describe("Discover captures accepted laboratory attempts, with retained evidence on refusal", () => {
  let root: Root;
  let investigation: InvestigationStore | null;
  beforeEach(async () => {
    await installDom({ intersections: "visible" });
    investigation = null;
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    await uninstallDom();
  });
  function Probe() {
    investigation = useDiscoveryInvestigation();
    return null;
  }
  function button(label: string) {
    const found = [...document.querySelectorAll("button")].find(
      (element) => element.textContent?.trim() === label,
    );
    assert.ok(found, label);
    return found;
  }
  async function click(label: string) {
    await act(async () => button(label).click());
  }
  async function type(selector: string, value: string, commit = false) {
    const field = document.querySelector<HTMLInputElement>(selector);
    assert.ok(field, selector);
    const key = Object.keys(field).find((name) => name.startsWith("__reactProps$"));
    assert.ok(key);
    const props = () =>
      (field as unknown as Record<string, Record<string, (event: unknown) => void>>)[key];
    await act(async () => {
      field.value = value;
      props()?.onChange?.({ target: field, currentTarget: field });
    });
    if (commit) await act(async () => props()?.onBlur?.({ target: field, currentTarget: field }));
  }
  function laterEvidence(paper: Paper): string {
    if (paper === "light-quanta") {
      const points = [...document.querySelectorAll("circle[data-intercept-volts]")];
      assert.ok(points.length > 0, "The admitted Millikan points must be rendered.");
      return JSON.stringify(
        points.map((point) => [
          point.getAttribute("data-frequency-hz"),
          point.getAttribute("data-intercept-volts"),
          point.getAttribute("data-used-for-slope"),
        ]),
      );
    }
    const selector =
      paper === "mass-energy"
        ? '[data-historical-dataset="bainbridge-1933-mass-energy"] tbody'
        : "[data-world-check-later-measurement]";
    const text = document.querySelector(selector)?.textContent;
    assert.ok(text);
    return text;
  }

  for (const item of CASES) {
    test(`${item.paper}: a refused control attempt cannot capture an earlier accepted change; repair preserves the owner and historical evidence`, async () => {
      const spec = INVESTIGATIONS[item.paper];
      const { owner, element } = worldCheck(item.paper);
      window.history.replaceState({}, "", `/discover/${item.paper}/`);
      await act(async () =>
        root.render(
          <DiscoveryInvestigationProvider spec={spec}>
            {element}
            <PpeTask task={item.task} />
            <Probe />
          </DiscoveryInvestigationProvider>,
        ),
      );
      assert.ok(investigation);
      const store = investigation;
      const disclosure = document.querySelector<HTMLDetailsElement>(".investigation-disclosure");
      assert.ok(disclosure);
      await act(async () => {
        disclosure.open = true;
        disclosure.dispatchEvent(new Event("toggle"));
      });
      for (
        let attempt = 0;
        attempt < 100 && !document.querySelector('textarea[id$="-prediction"]');
        attempt++
      )
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
        });
      const prediction = document.querySelector<HTMLTextAreaElement>('textarea[id$="-prediction"]');
      assert.ok(prediction);
      prediction.value =
        "I expect the accepted change to preserve the quantity the task identifies.";
      await click("Pin prediction and starting reading");
      const baseline = store.getSnapshot().report?.baseline.reading;
      assert.ok(baseline);
      const historical = laterEvidence(item.paper);
      const lab = document.querySelector(`[data-instrument-id="${spec.experimentId}"]`);
      assert.ok(lab);
      expect(document.querySelector("[data-photoelectric-comparison-offer]")).toBeNull();
      expect(document.querySelector("[data-photoelectric-comparison]")).toBeNull();
      expect(document.querySelector("[data-boundary-comparison-offer]")).toBeNull();
      expect(document.querySelector("[data-boundary-comparison]")).toBeNull();

      if (item.paper === "light-quanta") await type('input[id$="-incidentPower"]', "2", true);
      else if (item.paper === "special-relativity") await click("Constant-speed circle at 0.6c");
      else await click("Both, as one isolated system");
      const accepted = owner.getSnapshot().accepted;
      assert.ok(accepted);
      expect(accepted.actionIndex).toBeGreaterThan(baseline.actionIndex);
      expect(button("Capture changed reading").disabled).toBe(false);

      if (item.paper === "light-quanta") await type('input[id$="-frequency"]', "-1", true);
      else if (item.paper === "special-relativity") {
        await type('input[name="speed"]', "1");
        await click("Apply clock settings");
      } else {
        await type('input[name="emittedEnergy"]', "-1");
        await click("Calculate with these energies");
      }
      expect(
        document.querySelector('[data-apply-failure="refused"],[data-refusal-code]'),
      ).not.toBeNull();
      expect(owner.getSnapshot().accepted).toBe(accepted);
      expect(lab.getAttribute("data-view-state")).toBe("refused");
      expect(store.getSnapshot().current).toBeNull();
      expect(button("Capture changed reading").disabled).toBe(true);
      expect(store.capture("This refused attempt").ok).toBe(false);
      expect(readStoredInvestigation(item.paper).report?.observations).toEqual([]);
      expect(store.getSnapshot().report?.baseline.reading).toEqual(baseline);
      expect(laterEvidence(item.paper)).toBe(historical);

      if (item.paper === "light-quanta") {
        // These form-only refusals do not call apply, so the component's notification is essential.
        for (const invalid of ["", "1e300"]) {
          await type('input[id$="-frequency"]', "1030", true);
          expect(store.getSnapshot().current).not.toBeNull();
          const kept = owner.getSnapshot().accepted;
          await type('input[id$="-frequency"]', invalid, true);
          expect(owner.getSnapshot().accepted).toBe(kept);
          expect(store.getSnapshot().current).toBeNull();
          expect(button("Capture changed reading").disabled).toBe(true);
          expect(store.capture("Form refused this value").ok).toBe(false);
        }
        await type('input[id$="-frequency"]', "1030", true);
      } else if (item.paper === "special-relativity") {
        await click("Use accepted settings");
        expect(owner.getSnapshot().accepted).toBe(accepted);
        expect(document.body.textContent).toContain("No new calculation was made.");
      } else {
        await type('input[name="emittedEnergy"]', "1");
        await click("Calculate with these energies");
      }
      const repaired = owner.getSnapshot().accepted;
      assert.ok(repaired);
      expect(store.getSnapshot().current?.actionIndex).toBe(repaired.actionIndex);
      expect(button("Capture changed reading").disabled).toBe(false);
      await click("Capture changed reading");
      const saved = readStoredInvestigation(item.paper).report;
      assert.ok(saved);
      const reading = saved.observations[0]?.reading;
      assert.ok(reading);
      expect(saved.observations).toHaveLength(1);
      expect(saved.baseline.reading).toEqual(baseline);
      expect(reading.instanceId).toBe(accepted.instanceId);
      expect(reading.actionIndex).toBe(repaired.actionIndex);
      expect(reading.parameters).toEqual(repaired.parameters);
      expect(reading.outputs).toEqual(
        spec.quantities.map(({ id }) =>
          repaired.outputs.find((result) => result.quantityId === id),
        ),
      );
      const value = (id: string) =>
        reading.outputs.find((result) => result.quantityId === id)?.value;
      if (item.paper === "light-quanta") expect(value("incidentPower")).toBe(0.002);
      else if (item.paper === "special-relativity") expect(value("properTime")).toBe(8);
      else expect(value("massChange")).toBe(0);
      expect(laterEvidence(item.paper)).toBe(historical);
    });
  }
});
