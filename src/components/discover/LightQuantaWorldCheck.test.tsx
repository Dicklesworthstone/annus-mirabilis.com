import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { loadHistoricalDataset } from "../../content/datasets/loader.ts";
import { datasetPlotVerdict } from "../../content/datasets/plotVerdict.ts";
import { LIGHT_QUANTA_LATER_EVIDENCE } from "../../content/lightQuantaShelf.ts";
import { WORLD_CHECK } from "../../discovery/lightQuanta/journeyI.ts";
import {
  HISTORICAL_CHECK_EXAMPLE,
  PRINTED_STOPPING_CHECK,
} from "../../discovery/lightQuanta/worldCheck.ts";
import {
  evaluateMillikanOverlay,
  MILLIKAN_1916_FIT_ID,
  MILLIKAN_FIG6_AXES,
  type MillikanOverlayResult,
} from "../../experiments/lq08/millikan.ts";
import { loadMillikanOverlay } from "../../experiments/lq08/millikanRecord.ts";
import { createLq08Session, evaluateLq08 } from "../../experiments/lq08/session.ts";
import { encodeResult } from "../../experiments/results/codec.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { Sci } from "../lab/Sci.tsx";
import { LightQuantaWorldCheck } from "./LightQuantaWorldCheck.tsx";

type Session = ReturnType<typeof createLq08Session>;
const overlay = loadMillikanOverlay();
const record = loadHistoricalDataset(resolve("content/datasets/millikan-1916-sodium.yaml"));
const check = (session?: Session, millikan: MillikanOverlayResult = overlay) => (
  <LightQuantaWorldCheck
    example={HISTORICAL_CHECK_EXAMPLE}
    check={WORLD_CHECK}
    printedVolts={PRINTED_STOPPING_CHECK.volts}
    laterEvidence={LIGHT_QUANTA_LATER_EVIDENCE}
    millikan={millikan}
    session={session}
  />
);
const quantity = (html: string) =>
  /data-world-check-quantity="stoppingPotentialMagnitude">([^<]*)</.exec(html)?.[1];
const plottedPoints = (html: string) =>
  [...html.matchAll(/<circle[^>]*data-intercept-volts="([^"]+)"[^>]*>/g)].map(([tag, volts]) => ({
    frequency: Number(/data-frequency-hz="([^"]+)"/.exec(tag)?.[1]),
    potential: Number(volts),
    usedForSlope: /data-used-for-slope="true"/.test(tag),
  }));

/**
 * Journey I's check against the world (dispatch 142). A reader without JavaScript receives LQ-08 at
 * the §8 check, 1.03 × 10¹⁵ per second with the exit cost neglected: 4.26 V on today's constants,
 * beside the paper's 4.34 V from its own.
 */
describe("the check reads LQ-08's accepted snapshot", () => {
  test("the served readout is the snapshot's stopping potential, beside the printed figure", () => {
    const html = renderToStaticMarkup(check());
    expect(quantity(html)).toBe("4.26 V");
    expect(html).toContain("from the paper’s own constants, 4.34 V");
    expect(html).toContain('data-card-id="millikan-1916-photoelectric-h"');
    expect(html).toContain("Later evidence, not on the 1904 shelf");
  });

  test("it reads the snapshot rather than computing from the frequency", () => {
    const real = createLq08Session("world-check-altered", HISTORICAL_CHECK_EXAMPLE);
    const served = real.getServerSnapshot();
    const accepted = served.accepted;
    if (!accepted) throw new Error("the prepared session published nothing");
    const altered = {
      ...served,
      accepted: {
        ...accepted,
        outputs: accepted.outputs.map((o) =>
          o.quantityId === "stoppingPotentialMagnitude" && o.status === "value"
            ? { ...o, value: 3.5 }
            : o,
        ),
      },
    };
    const session: Session = {
      ...real,
      getSnapshot: () => altered,
      getServerSnapshot: () => altered,
    };
    expect(quantity(renderToStaticMarkup(check(session)))).toBe("3.5 V");
  });

  test("below the threshold the owner's own reason is shown, not a zero", () => {
    const parameters = {
      ...HISTORICAL_CHECK_EXAMPLE.parameters,
      frequency: 3e14,
      workFunction: 2.2,
    };
    const outputs = evaluateLq08(parameters);
    const owner = outputs.find((o) => o.quantityId === "stoppingPotentialMagnitude");
    // The owner itself says not-applicable here; the readout must carry its words.
    expect(owner?.status).toBe("not-applicable");
    const below = createLq08Session("world-check-below", {
      ...HISTORICAL_CHECK_EXAMPLE,
      parameters,
      results: outputs.map(encodeResult),
    });
    const shown = quantity(renderToStaticMarkup(check(below)));
    expect(shown).toBe(owner?.status === "not-applicable" ? owner.reason : "no reason");
  });
});

describe("the later measurement is admitted independently of the 1905 prediction", () => {
  test("the journey plots the real record on its signed scale and preserves the fit's row selection", () => {
    const html = renderToStaticMarkup(check());
    const used = record.fits?.find((fit) => fit.id === MILLIKAN_1916_FIT_ID)?.rowsUsed;
    expect(record.evidenceStatus).toBe("historical-measurement");
    expect(record.withdrawal).toBeUndefined();
    expect(used?.length).toBeGreaterThan(0);
    const frequencyIndex = record.columns.findIndex((column) => column.quantityId === "frequency");
    const potentialIndex = record.columns.findIndex(
      (column) => column.quantityId === "photoelectricInterceptPotential",
    );
    expect(frequencyIndex).toBeGreaterThanOrEqual(0);
    expect(potentialIndex).toBeGreaterThanOrEqual(0);
    const points = record.rows.map((row, index) => {
      const frequency = row.cells[frequencyIndex];
      const potential = row.cells[potentialIndex];
      return {
        frequency: frequency?.kind === "number" ? frequency.value : Number.NaN,
        potential: potential?.kind === "number" ? potential.value : Number.NaN,
        usedForSlope: used?.includes(index) ?? false,
      };
    });
    expect(points.some((point) => point.potential < 0)).toBe(true);
    expect(points.some((point) => !point.usedForSlope)).toBe(true);
    expect(plottedPoints(html)).toEqual(points);
    // The printed check stays a prediction; the empirical comparison is a separate, later part.
    expect(html).toContain('data-comparison-kind="printed-prediction"');
    expect(html).toContain('data-comparison-kind="measured-fact"');
    expect(html).toContain('data-historical-dataset="millikan-1916-sodium"');
    expect(html).toContain("1916: test the predicted slope");
    const modelStart = html.indexOf('data-view-id="lq-08-stopping-plot"');
    expect(modelStart).toBeGreaterThan(-1);
    const modelPlot = html.slice(modelStart, html.indexOf("</svg>", modelStart));
    expect(plottedPoints(modelPlot)).toEqual([]);
  });

  test("the fitted and model slopes remain distinct in the comparison", () => {
    expect(overlay.kind).toBe("plottable");
    if (overlay.kind !== "plottable") return;
    const html = renderToStaticMarkup(check());
    const measured = renderToStaticMarkup(<Sci value={overlay.fittedSlopeVs} digits={3} />);
    const model = renderToStaticMarkup(<Sci value={overlay.modelLineSlopeVs} digits={4} />);
    expect(/<dd data-measured-slope="[^"]*">(.*?)<\/dd>/.exec(html)?.[1]).toContain(measured);
    expect(/<dd data-model-slope="[^"]*">(.*?)<\/dd>/.exec(html)?.[1]).toContain(model);
    expect(overlay.fittedSlopeVs).not.toBe(overlay.modelLineSlopeVs);
    expect(html).toContain("not every uncertainty in reading the figure");
  });

  test("withdrawing a record with rows refuses the comparison and never leaks those rows", () => {
    const withdrawn = datasetPlotVerdict(
      {
        ...record,
        evidenceStatus: "withdrawn",
        withdrawal: {
          date: "2026-11-06",
          reason: "The point readings require another source check.",
        },
      },
      MILLIKAN_FIG6_AXES.x,
      MILLIKAN_FIG6_AXES.y,
      overlay.citation,
    );
    const withheld = evaluateMillikanOverlay(withdrawn, undefined, undefined);
    expect(withheld.kind).toBe("withheld");
    const html = renderToStaticMarkup(check(undefined, withheld));
    expect(html).toContain("The point readings require another source check.");
    expect(html).toContain('data-world-check-measurement="withheld"');
    expect(html).not.toContain('data-comparison-kind="measured-fact"');
    expect(html).not.toContain("data-measured-slope");
    expect(html).not.toContain('data-testid="millikan-fig6-panel"');
    expect(plottedPoints(html)).toEqual([]);
    expect(quantity(html)).toBe("4.26 V");
  });
});

describe("measurements stay fixed while the shared laboratory changes", () => {
  beforeEach(installDom);
  afterEach(uninstallDom);

  test("the laboratory and readout follow the same accepted run without moving the historical points", async () => {
    const session = createLq08Session("world-check-live", HISTORICAL_CHECK_EXAMPLE);
    const container = createContainer();
    const root = createRoot(container);
    const readout = () =>
      container.querySelector('[data-world-check-quantity="stoppingPotentialMagnitude"]')
        ?.textContent;
    const labValue = () =>
      container.querySelector('[data-output="stoppingPotentialMagnitude"]')?.textContent;
    try {
      await act(async () => root.render(check(session)));
      expect(readout()).toBe("4.26 V");
      const points = plottedPoints(container.innerHTML);
      expect(points.length).toBeGreaterThan(0);
      const fitted = container.querySelector("[data-measured-slope]")?.textContent;
      expect(fitted).toBeTruthy();
      const initialLabValue = labValue();
      expect(initialLabValue).toBeTruthy();

      await act(async () => {
        expect(session.apply({ frequency: 6e14, workFunction: 2.2 }).kind).toBe("accepted");
      });
      expect(readout()).toBe("0.281 V");
      expect(labValue()).toBe("0.2814 V");
      expect(labValue()).not.toBe(initialLabValue);
      expect(plottedPoints(container.innerHTML)).toEqual(points);
      expect(container.querySelector("[data-measured-slope]")?.textContent).toBe(fitted);

      await act(async () => {
        expect(session.apply({ frequency: 3e14 }).kind).toBe("accepted");
      });
      expect(readout()).toContain("no emitted electron in this model");
      expect(labValue()).toBe(`Not applicable: ${readout()}`);
      expect(plottedPoints(container.innerHTML)).toEqual(points);
    } finally {
      await act(async () => root.unmount());
      removeContainer(container);
    }
  });
});

describe("with no accepted snapshot the check refuses", () => {
  test("world-check-snapshot-missing: it throws its code rather than show a potential the laboratory never produced", () => {
    const real = createLq08Session("world-check-refusal", HISTORICAL_CHECK_EXAMPLE);
    const empty = { ...real.getServerSnapshot(), accepted: null };
    const session: Session = { ...real, getSnapshot: () => empty, getServerSnapshot: () => empty };
    expect(() => renderToStaticMarkup(check(session))).toThrow("world-check-snapshot-missing");
    // Positive control: the same real session, snapshot intact, renders the readout.
    expect(renderToStaticMarkup(check(real))).toContain(
      'data-world-check-quantity="stoppingPotentialMagnitude"',
    );
  });
});
