import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { MillikanFigure6Panel } from "../../components/lab/lq08/MillikanFigure6Panel.tsx";
import { StoppingPotentialPlot } from "../../components/lab/lq08/PhotoelectricPlot.tsx";
import { datasetPlotVerdict } from "../../content/datasets/plotVerdict.ts";
import {
  type HistoricalDataset,
  validateHistoricalDataset,
} from "../../content/schemas/experiment.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { evaluateMillikanOverlay, type MillikanSlopeFit } from "../../experiments/lq08/millikan.ts";
import { projectReception } from "../../reader/faces/results/resultsProjection.ts";
import { createLinearProjector } from "../../visuals/kit/coordinates.ts";
import { DatasetEvidenceReveal } from "../../visuals/overlays/DatasetEvidenceReveal.tsx";
import { DatasetOverlay } from "../../visuals/overlays/DatasetOverlay.tsx";
import { DatasetTable } from "../../visuals/overlays/DatasetTable.tsx";

/**
 * A withdrawn HistoricalDataset is never drawn, tabulated or offered as evidence
 * (am-data-millikan-1916-zh2q).
 *
 * LQ-08 plotted the Millikan 1916 sodium record as measurements while its rows sat on one straight
 * line to a fifth of a millivolt, and nothing between the record and the plot could refuse. Every
 * view that shows a dataset's values now asks datasetValuesMayBeShown first. Each case below runs
 * one record in two states, standing and withdrawn: the standing run is the positive control that
 * proves the view would have shown the values, so the withdrawn run's absence means something.
 *
 * The rows are constructed for this test and are not anyone's measurements. Their tokens are chosen
 * to be unique in the markup, so an absent token is an absent value, not a formatting miss.
 */
const WITHDRAWAL = Object.freeze({
  date: "2026-09-24",
  reason: "Constructed rows withdrawn for this test; a real record states its own reason.",
});

// Frequency in Hz and stopping potential in V; slope near, and deliberately not equal to, h/e.
const ROWS: readonly (readonly [number, string, number, string])[] = [
  [5.13e14, "5.13", 0.3071, "0.3071"],
  [6.27e14, "6.27", 0.7793, "0.7793"],
  [7.41e14, "7.41", 1.2459, "1.2459"],
  [8.55e14, "8.55", 1.7203, "1.7203"],
];

function record(evidenceStatus: "historical-measurement" | "withdrawn"): HistoricalDataset {
  const raw = strictParse(
    readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        "../../content/schemas/__fixtures__/experiment/dataset-valid.yaml",
      ),
      "utf8",
    ),
    "yaml",
  ) as Record<string, unknown> & { publications: Record<string, unknown>[] };
  raw.id = "constructed-stopping-line";
  raw.title = "Constructed stopping-line record";
  raw.evidenceStatus = evidenceStatus;
  if (evidenceStatus === "withdrawn") raw.withdrawal = { ...WITHDRAWAL };
  raw.publications[0] = { ...raw.publications[0], citation: "Constructed for this test" };
  raw.columns = [
    { name: "Frequency", quantityId: "frequency", unit: "Hz", role: "controlled" },
    {
      name: "Stopping Potential",
      quantityId: "stoppingPotentialMagnitude",
      unit: "V",
      role: "observed",
    },
  ];
  raw.rows = ROWS.map(([nu, nuToken, v, vToken]) => ({
    cells: [
      { kind: "number", value: nu, originalToken: nuToken },
      { kind: "number", value: v, originalToken: vToken },
    ],
  }));
  raw.addressesResults = [
    {
      resultId: "result-constructed",
      relation: "tested-a-prediction",
      statement: "Constructed rows address a constructed result.",
    },
  ];
  raw.fits = undefined;
  return validateHistoricalDataset(raw);
}

const STANDING = record("historical-measurement");
const WITHDRAWN = record("withdrawn");
const VOLTAGE_TOKENS = ROWS.map((r) => r[3]);

/** The fixture's own columns: frequency and a potential, read as the verdict reads any record. */
const AXES = {
  x: { quantityId: "frequency", unit: "Hz" },
  y: { quantityId: "stoppingPotentialMagnitude", unit: "V" },
} as const;
const ALL_ROWS: MillikanSlopeFit = { rowsUsed: [0, 1, 2, 3], printedSlopes: [] };
const LABEL = "later evidence, published 1916";

const verdictOf = (dataset: HistoricalDataset) =>
  datasetPlotVerdict(dataset, AXES.x, AXES.y, "Constructed citation");
const overlayOf = (dataset: HistoricalDataset) =>
  evaluateMillikanOverlay(verdictOf(dataset), ALL_ROWS, LABEL);

/** What LQ-08 draws for a record: the model's stopping plot, and the panel when there are points. */
const plotOf = (dataset: HistoricalDataset) => {
  const overlay = overlayOf(dataset);
  return renderToStaticMarkup(
    <>
      <StoppingPotentialPlot
        currentFrequency={6e14}
        currentWorkFunction={2}
        currentStoppingPotential={0.48}
        millikanData={overlay}
      />
      {overlay.kind === "plottable" && <MillikanFigure6Panel data={overlay} />}
    </>,
  );
};

describe("a withdrawn dataset is never shown", () => {
  test("the verdict for a withdrawn record carries its reason and none of its values", () => {
    const standing = verdictOf(STANDING);
    expect(standing.kind).toBe("plottable");
    if (standing.kind !== "plottable") return;
    expect(standing.points.map((p) => p.y)).toEqual(ROWS.map((r) => r[2]));

    const withdrawn = verdictOf(WITHDRAWN);
    expect(withdrawn.kind).toBe("withheld");
    if (withdrawn.kind !== "withheld") return;
    expect(withdrawn.reason).toBe(WITHDRAWAL.reason);
    expect(withdrawn.citation).toBe("Constructed citation");
    // What a server page hands a client component: no row survives serialization.
    const serialized = JSON.stringify(evaluateMillikanOverlay(withdrawn, ALL_ROWS, LABEL));
    for (const [nu, , v] of ROWS) {
      expect(serialized).not.toContain(String(nu));
      expect(serialized).not.toContain(String(v));
    }
  });

  test("LQ-08 draws a standing record's points in its panel and none of a withdrawn one", () => {
    const standing = plotOf(STANDING);
    expect(standing).toContain('data-testid="millikan-fig6-panel"');
    expect(standing.match(/<circle[^>]*data-intercept-volts=/g)?.length).toBe(ROWS.length);

    const withdrawn = plotOf(WITHDRAWN);
    expect(withdrawn).not.toContain('data-testid="millikan-fig6-panel"');
    expect(withdrawn.match(/<circle[^>]*data-intercept-volts=/g)).toBeNull();
    expect(withdrawn).toContain('data-testid="millikan-withheld"');
    expect(withdrawn).toContain("not shown yet");
    expect(withdrawn).toContain(WITHDRAWAL.reason);
    expect(withdrawn).toContain("Constructed citation");
    expect(withdrawn).not.toContain("fitted here to his points");
  });

  test("the generic overlay, table and evidence reveal show a note in place of a withdrawn record", () => {
    const projector = createLinearProjector({ domain: [0, 1e15], range: [0, 400] });
    const valueViews = (dataset: HistoricalDataset) => [
      renderToStaticMarkup(
        <DatasetOverlay
          dataset={dataset}
          xProjector={projector}
          yProjector={projector}
          showTable
        />,
      ),
      renderToStaticMarkup(<DatasetTable dataset={dataset} />),
    ];
    for (const html of valueViews(STANDING)) {
      expect(html).not.toContain('data-testid="dataset-withheld"');
      // Positive control: each view prints every one of the record's values.
      for (const token of VOLTAGE_TOKENS) expect(html).toContain(token);
    }
    for (const html of valueViews(WITHDRAWN)) {
      expect(html).toContain('data-testid="dataset-withheld"');
      expect(html).toContain(WITHDRAWAL.reason);
      for (const token of VOLTAGE_TOKENS) expect(html).not.toContain(token);
    }
    // The reveal opens on its source-locator step, so its first render prints no values either
    // way; what is refused is the reveal itself, whose later steps print the tokens.
    const reveal = (dataset: HistoricalDataset) =>
      renderToStaticMarkup(<DatasetEvidenceReveal dataset={dataset} />);
    expect(reveal(STANDING)).toContain('data-testid="dataset-evidence-reveal"');
    expect(reveal(WITHDRAWN)).not.toContain('data-testid="dataset-evidence-reveal"');
    expect(reveal(WITHDRAWN)).toContain('data-testid="dataset-withheld"');
  });

  test("a withdrawn record is not offered as reception evidence for a result", () => {
    const dateOf = () => ({ date: "2026", precision: "year" as const });
    expect(projectReception("result-constructed", [STANDING], dateOf)).toHaveLength(1);
    expect(projectReception("result-constructed", [WITHDRAWN], dateOf)).toHaveLength(0);
  });

  test("a standing record with fewer than three usable rows is withheld, since no line fits", () => {
    const two = datasetPlotVerdict(
      { ...STANDING, rows: STANDING.rows.slice(0, 2) },
      AXES.x,
      AXES.y,
      "Constructed citation",
    );
    expect(two.kind).toBe("plottable");
    const overlay = evaluateMillikanOverlay(two, ALL_ROWS, LABEL);
    expect(overlay.kind).toBe("withheld");
    if (overlay.kind === "withheld") expect(overlay.reason).toContain("Only 2 of the points");
  });

  test("a record without the columns a plot reads is withheld, not drawn from the wrong ones", () => {
    const verdict = datasetPlotVerdict(
      STANDING,
      { quantityId: "wavelength", unit: "nm" },
      AXES.y,
      "Constructed citation",
    );
    expect(verdict.kind).toBe("withheld");
    if (verdict.kind === "withheld") expect(verdict.reason).toContain("no wavelength column in nm");
  });
});
