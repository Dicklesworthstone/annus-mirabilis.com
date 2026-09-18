import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { validateHistoricalDataset } from "../../content/schemas/experiment.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { createLinearProjector } from "../../visuals/kit/coordinates.ts";
import { DatasetOverlay } from "../../visuals/overlays/DatasetOverlay.tsx";
import { DatasetTable } from "../../visuals/overlays/DatasetTable.tsx";
import { createContainer, installDom, removeContainer, uninstallDom } from "../reactDom.ts";

beforeEach(async () => {
  await installDom();
});

afterEach(async () => {
  await uninstallDom();
});

const OVERLAY_FIXTURE_YAML = `id: overlay-fixture-dataset
title: "Overlay Test Dataset"
evidenceStatus: historical-measurement
publications:
  - id: pub-1
    citation: "Perrin (1909) Brownian Investigation"
    locator:
      kind: table
      number: 1
    publicationDate:
      type: issue-publication
      text: "1909"
      earliest: "1909-01-01"
      latest: "1909-12-31"
      precision: year
      source: "Ann. Chim. Phys."
      verifiedAt: "2026-09-16"
primaryPublicationId: pub-1
digitizer:
  name: "Editorial Team"
  method: "Double keying"
  date: "2026-09-16"
  sourcePageImage: "perrin.png"
  digitizationRevision: 1
columns:
  - name: "X"
    quantityId: "length"
    unit: "m"
    role: "controlled"
  - name: "Observed Y"
    quantityId: "rmsDisplacement1d"
    unit: "m"
    role: "observed"
  - name: "Fitted Curve"
    quantityId: "diffusionCoefficient"
    unit: "m²/s"
    role: "reported-fit"
    fitDescription: "Perrin theoretical fit line"
rows:
  - cells:
      - kind: number
        value: 1
      - kind: number
        value: 2
      - kind: number
        value: 2.1
  - cells:
      - kind: number
        value: 2
      - kind: bound
        direction: upper
        value: 4
      - kind: number
        value: 4.2
  - cells:
      - kind: number
        value: 3
      - kind: missing
        reason: "outlier"
      - kind: number
        value: 6.3
uncertainty:
  type: standard-deviation
  description: "sample std dev"
notes: "Overlay test notes"
rights:
  status: public-domain-verified
  statement: "Public domain"
  source: "test"
  recordedAt: "2026-09-16"
  reuseTerms: unrestricted-scholarly
allowedInferenceModelIds: []
`;

describe("DatasetOverlay (am-inst-dataset-overlay-ra9r)", () => {
  const xProj = createLinearProjector({ domain: [0, 5], range: [0, 500] });
  const yProj = createLinearProjector({ domain: [0, 10], range: [400, 0] });

  test("renders empirical points, bounded directional markers, and citation bar", async () => {
    const raw = strictParse(OVERLAY_FIXTURE_YAML, "yaml");
    const ds = validateHistoricalDataset(raw);

    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(() => {
        root.render(
          createElement(DatasetOverlay, {
            dataset: ds,
            xColumnIndex: 0,
            yColumnIndex: 1,
            xProjector: xProj,
            yProjector: yProj,
            normalizationFactor: 1.5,
            normalizationMethod: "arbitrary unit scaling",
            showTable: true,
          }),
        );
      });

      // Citation & shelf badge
      expect(container.textContent).toContain("Perrin (1909)");
      expect(container.querySelector('[data-testid="shelf-badge"]')?.textContent).toBe(
        "later evidence, published 1909",
      );

      // Normalization notice
      expect(container.textContent).toContain("Norm: ×1.5");

      // Empirical point for row 0
      const empiricalPoint = container.querySelector('[data-testid="empirical-point"]');
      expect(empiricalPoint).not.toBeNull();

      // Bounded marker for row 1 (upper bound)
      const boundMarker = container.querySelector(
        '[data-testid="bound-marker"][data-bound-direction="upper"]',
      );
      expect(boundMarker).not.toBeNull();

      // Row 2 is missing, so only 2 points plotted in svg
      const plottedRows = container.querySelectorAll('[data-testid="dataset-point"]');
      expect(plottedRows.length).toBe(2);

      // Table is rendered with missing reason
      const table = container.querySelector('[data-testid="dataset-table"]');
      expect(table).not.toBeNull();
      expect(table?.textContent).toContain("outlier");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("renders reported-fit column with diamond marker distinct from empirical points", async () => {
    const raw = strictParse(OVERLAY_FIXTURE_YAML, "yaml");
    const ds = validateHistoricalDataset(raw);

    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(() => {
        root.render(
          createElement(DatasetOverlay, {
            dataset: ds,
            xColumnIndex: 0,
            yColumnIndex: 2, // reported-fit column
            xProjector: xProj,
            yProjector: yProj,
          }),
        );
      });

      const fitMarkers = container.querySelectorAll('[data-testid="reported-fit-marker"]');
      expect(fitMarkers.length).toBe(3);
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("DatasetTable renders column roles and bounded/missing descriptions accurately", async () => {
    const raw = strictParse(OVERLAY_FIXTURE_YAML, "yaml");
    const ds = validateHistoricalDataset(raw);

    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(() => {
        root.render(
          createElement(DatasetTable, {
            dataset: ds,
            selectedRowIndex: 1,
          }),
        );
      });

      const headers = container.querySelectorAll("th[data-column-role]");
      expect(headers.length).toBe(3);
      expect(headers[0]?.getAttribute("data-column-role")).toBe("controlled");
      expect(headers[1]?.getAttribute("data-column-role")).toBe("observed");
      expect(headers[2]?.getAttribute("data-column-role")).toBe("reported-fit");

      // Row 1 is selected
      const row1 = container.querySelector('tr[data-row-index="1"]');
      expect(row1?.getAttribute("data-selected")).toBe("true");
      expect(row1?.textContent).toContain("≤ 4");

      // Row 2 missing cell
      const row2 = container.querySelector('tr[data-row-index="2"]');
      expect(row2?.textContent).toContain("outlier");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
