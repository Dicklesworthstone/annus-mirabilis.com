import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "../../a11y/descriptions/DataTable.tsx";
import type { RepresentationScale } from "../../visuals/kit/types.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "../reactDom.ts";

beforeEach(async () => {
  await installDom();
});

afterEach(async () => {
  await uninstallDom();
});

describe("DataTable: Layer 3 inspectable table component (am-a11y-graph-descriptions-vxe1)", () => {
  const columns: readonly DataTableColumn[] = [
    { id: "x", header: "Displacement", unit: "μm" },
    { id: "p", header: "Probability Density", unit: "1/μm" },
    { id: "count", header: "Particle Count", unit: "dimensionless" },
  ];

  const rows: readonly DataTableRow[] = Array.from({ length: 25 }, (_, i) => ({
    id: `row-${i}`,
    label: `Point ${i + 1}`,
    values: [(i * 0.1).toFixed(2), (Math.exp(-i * 0.1) * 0.5).toFixed(4), 100 - i * 3],
  }));

  const scale: RepresentationScale = {
    spatialMagnification: { appliesTo: "scene", factor: 1000, note: "optical microscope" },
    simulatedElapsedTime: { quantityId: "t", value: 2.0, unit: "s" },
    playbackMultiplier: 1,
    glyphSize: { drawnPx: 4, represents: "none" },
    quantityNormalization: { kind: "per-bin-width", note: "per μm" },
  };

  test("renders accessible semantic table structure with caption, thead, tbody, th, and td", async () => {
    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(() => {
        root.render(
          createElement(DataTable, {
            caption: "Distribution of tracer positions at t = 2 s",
            columns,
            rows,
            snapshotVersion: "snap-42",
            pageSize: 10,
          }),
        );
      });

      const tableWrapper = container.querySelector('[data-layer="3"][data-table="inspectable"]');
      expect(tableWrapper).not.toBeNull();
      expect(tableWrapper?.getAttribute("data-snapshot-version")).toBe("snap-42");

      const table = container.querySelector("table.inspectable-table");
      expect(table).not.toBeNull();

      const caption = table?.querySelector("caption");
      expect(caption?.textContent).toBe("Distribution of tracer positions at t = 2 s");

      // Column headers with scope="col"
      const colHeaders = table?.querySelectorAll("thead th[scope='col']");
      expect(colHeaders?.length).toBe(4); // "Row" + 3 columns
      expect(colHeaders?.[0]?.textContent).toBe("Row");
      expect(colHeaders?.[1]?.textContent).toContain("Displacement (μm)");
      expect(colHeaders?.[2]?.textContent).toContain("Probability Density (1/μm)");
      expect(colHeaders?.[3]?.textContent).toBe("Particle Count"); // dimensionless has no unit suffix

      // Page size is 10, so exactly 10 data rows in tbody
      const bodyRows = table?.querySelectorAll("tbody tr");
      expect(bodyRows?.length).toBe(10);

      // Row headers with scope="row"
      const firstRowHead = bodyRows?.[0]?.querySelector("th[scope='row']");
      expect(firstRowHead?.textContent).toBe("Point 1");

      const firstRowCells = bodyRows?.[0]?.querySelectorAll("td");
      expect(firstRowCells?.length).toBe(3);
      expect(firstRowCells?.[0]?.textContent).toBe("0.00");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("handles bounded pagination with next/prev buttons and info text", async () => {
    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(() => {
        root.render(
          createElement(DataTable, {
            caption: "Paginated test table",
            columns,
            rows,
            snapshotVersion: 1,
            pageSize: 10,
          }),
        );
      });

      const paginationNav = container.querySelector("nav.table-pagination");
      expect(paginationNav).not.toBeNull();

      const info = paginationNav?.querySelector(".pagination-info");
      expect(info?.textContent).toBe("Page 1 of 3 (25 total entries)");

      const prevBtn = paginationNav?.querySelector("button.prev-btn") as HTMLButtonElement;
      const nextBtn = paginationNav?.querySelector("button.next-btn") as HTMLButtonElement;
      expect(prevBtn.disabled).toBe(true);
      expect(nextBtn.disabled).toBe(false);

      // Click next -> Page 2
      await act(() => {
        nextBtn.click();
      });

      expect(info?.textContent).toBe("Page 2 of 3 (25 total entries)");
      expect(prevBtn.disabled).toBe(false);
      expect(nextBtn.disabled).toBe(false);

      const table = container.querySelector("table.inspectable-table");
      const bodyRows = table?.querySelectorAll("tbody tr");
      expect(bodyRows?.length).toBe(10);
      expect(bodyRows?.[0]?.querySelector("th")?.textContent).toBe("Point 11");

      // Click next again -> Page 3 (last page with 5 items)
      await act(() => {
        nextBtn.click();
      });

      expect(info?.textContent).toBe("Page 3 of 3 (25 total entries)");
      expect(prevBtn.disabled).toBe(false);
      expect(nextBtn.disabled).toBe(true);

      const page3Rows = table?.querySelectorAll("tbody tr");
      expect(page3Rows?.length).toBe(5);
      expect(page3Rows?.[0]?.querySelector("th")?.textContent).toBe("Point 21");

      // Click prev -> Page 2
      await act(() => {
        prevBtn.click();
      });

      expect(info?.textContent).toBe("Page 2 of 3 (25 total entries)");
      expect(nextBtn.disabled).toBe(false);
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("renders representation-scale facts table when scale is provided", async () => {
    const container = createContainer();
    const root = createRoot(container);

    try {
      await act(() => {
        root.render(
          createElement(DataTable, {
            caption: "Table with scale facts",
            columns,
            rows: rows.slice(0, 3),
            snapshotVersion: 2,
            scale,
          }),
        );
      });

      const scaleDetails = container.querySelector("details.scale-facts-disclosure");
      expect(scaleDetails).not.toBeNull();

      const scaleTable = scaleDetails?.querySelector("table.scale-facts-table");
      expect(scaleTable).not.toBeNull();

      const rows_ = scaleTable?.querySelectorAll("tbody tr");
      expect(rows_?.length).toBe(5); // 5 RepresentationScale facts

      const text = scaleTable?.textContent ?? "";
      expect(text).toContain("Spatial magnification");
      expect(text).toContain("Scene magnified ×1,000");
      expect(text).toContain("Simulated elapsed time");
      expect(text).toContain("2 s (t)");
      expect(text).toContain("Playback clock");
      expect(text).toContain("true rate (1 s/s)");
      expect(text).toContain("Glyph size");
      expect(text).toContain("4 px marker (uncalibrated marker, not a physical particle size)");
      expect(text).toContain("Quantity normalization");
      expect(text).toContain("per-bin-width");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
