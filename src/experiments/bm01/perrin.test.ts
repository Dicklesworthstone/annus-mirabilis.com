import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { loadHistoricalDataset } from "../../content/datasets/loader.ts";
import { datasetPlotVerdict } from "../../content/datasets/plotVerdict.ts";
import { getDatasetShelfStatus } from "../../content/datasets/shelf.ts";
import {
  type HistoricalDataset,
  validateHistoricalDataset,
} from "../../content/schemas/experiment.ts";
import example from "../../generated/bm01-example.json";
import { getConstantSet } from "../../physics/reference/constants.ts";
import { moments, stokesEinsteinD } from "../../physics/reference/diffusion.ts";
import type { AcceptedSnapshot } from "../store/instanceStore.ts";
import { createBm01BrowserChannel } from "./browser.ts";
import {
  comparePerrin,
  evaluatePerrinRecord,
  PERRIN_1909_DATASET_ID,
  PERRIN_AXES,
  PERRIN_TRACER_INPUTS,
} from "./perrin.ts";
import { loadPerrinRecord } from "./perrinRecord.ts";
import { createBm01Session } from "./session.ts";

const dataset = () =>
  loadHistoricalDataset(
    resolve(process.cwd(), "content/datasets", `${PERRIN_1909_DATASET_ID}.yaml`),
  );
const accepted = (): AcceptedSnapshot => {
  const snapshot = createBm01Session(
    "perrin-test",
    example,
    createBm01BrowserChannel,
  ).getServerSnapshot().accepted;
  if (!snapshot) throw new Error("The real prepared BM-01 example did not publish.");
  return snapshot;
};
const evaluate = (record: HistoricalDataset) => {
  const shelf = getDatasetShelfStatus(record);
  return evaluatePerrinRecord(
    datasetPlotVerdict(record, PERRIN_AXES.x, PERRIN_AXES.y, "Perrin, p. 77"),
    shelf.eligible ? undefined : shelf.badgeLabel,
    record.digitizer.sourcePageImage,
    record.uncertainty.description,
  );
};

describe("Perrin's visually transcribed first-series measurements", () => {
  test("the typed record retains the four printed values, source page and rounding limits", () => {
    const source = dataset();
    expect(source.digitizer.name).toBe("agent:ChatGPT-product-priorities");
    expect(source.digitizer.digitizationRevision).toBe(1);
    expect(source.digitizer.sourcePageImage).toContain("#page=75");
    expect(source.uncertainty.type).toBe("printed-rounding-only");
    expect(source.allowedInferenceModelIds).toEqual(["estimateSummaryStatistics"]);
    expect(source.calibrationIds).toEqual([]);
    expect(source.rows.map((row) => row.cells[1])).toEqual([
      { kind: "number", value: 5.02e-11, originalToken: "50,2" },
      { kind: "number", value: 1.135e-10, originalToken: "113,5" },
      { kind: "number", value: 1.28e-10, originalToken: "128" },
      { kind: "number", value: 1.44e-10, originalToken: "144" },
    ]);
    const record = loadPerrinRecord();
    expect(record.kind).toBe("plottable");
    if (record.kind !== "plottable") return;
    expect(record.evidenceLabel).toBe("later evidence, published 1909");
    expect(record.citation).toContain("First-series table, p. 77");
    expect(record.points.map((point) => point.elapsedTimeSeconds)).toEqual([30, 60, 90, 120]);
  });

  test("withdrawal withholds every observation before serialization", () => {
    const withdrawn: HistoricalDataset = {
      ...dataset(),
      evidenceStatus: "withdrawn",
      withdrawal: { date: "2026-11-11", reason: "Source withdrawn for this test." },
    };
    const verdict = evaluate(withdrawn);
    expect(verdict).toEqual({
      kind: "withheld",
      citation: "Perrin, p. 77",
      reason: "Source withdrawn for this test.",
    });
    expect(JSON.stringify(verdict)).not.toContain("points");
    expect(JSON.stringify(verdict)).not.toContain("5.02");
  });

  test("a pre-1905 or different later publication cannot be presented as Perrin's 1909 evidence", () => {
    const source = dataset();
    for (const year of ["1904", "1910"]) {
      const changed = validateHistoricalDataset({
        ...source,
        publications: source.publications.map((publication) => ({
          ...publication,
          publicationDate: {
            ...publication.publicationDate,
            text: `September ${year}`,
            earliest: `${year}-09-01`,
            latest: `${year}-09-30`,
          },
        })),
      });
      expect(evaluate(changed).kind).toBe("withheld");
    }
  });

  test("a missing observation or wrong unit cannot silently produce a partial comparison", () => {
    const source = dataset();
    expect(evaluate({ ...source, rows: source.rows.slice(0, 3) }).kind).toBe("withheld");
    const wrongUnit: HistoricalDataset = {
      ...source,
      columns: source.columns.map((column) =>
        column.quantityId === "meanSquareDisplacement1d" ? { ...column, unit: "m" } : column,
      ),
    };
    expect(evaluate(wrongUnit).kind).toBe("withheld");
    const verdict = datasetPlotVerdict(source, PERRIN_AXES.x, PERRIN_AXES.y, "Perrin, p. 77");
    expect(evaluatePerrinRecord(verdict, undefined, "", "").kind).toBe("withheld");
    expect(evaluatePerrinRecord(verdict, "later evidence, published 1910", "", "").kind).toBe(
      "withheld",
    );
    expect(
      evaluatePerrinRecord(
        { ...verdict, datasetId: "different-record" },
        "later evidence, published 1909",
        "",
        "",
      ).kind,
    ).toBe("withheld");
  });
});

describe("the model uses the accepted diffusivity and the audited moment owner", () => {
  test("the source preset leaves the observed scatter visible without fitting", () => {
    const snapshot = accepted();
    const D = stokesEinsteinD(PERRIN_TRACER_INPUTS, getConstantSet("modern-si-2019")).result;
    expect(D.status).toBe("value");
    if (D.status !== "value" || typeof D.value !== "number") return;
    const diffusionValue = D.value;
    const sourceSnapshot: AcceptedSnapshot = {
      ...snapshot,
      parameters: { ...snapshot.parameters, ...PERRIN_TRACER_INPUTS },
      outputs: snapshot.outputs.map((output) =>
        output.quantityId === "diffusionCoefficient"
          ? { ...output, value: diffusionValue }
          : output,
      ),
    };
    const comparison = comparePerrin(loadPerrinRecord(), sourceSnapshot);
    expect(comparison.kind).toBe("available");
    if (comparison.kind !== "available") return;
    expect(comparison.sourceConditionsMatch).toBe(true);
    expect(comparison.points.map((point) => point.observedMeanSquareM2)).toEqual([
      5.02e-11, 1.135e-10, 1.28e-10, 1.44e-10,
    ]);
    for (const point of comparison.points) {
      const expected = moments(1, diffusionValue, point.elapsedTimeSeconds).marginal.result;
      expect(expected.status).toBe("value");
      if (expected.status === "value") expect(point.predictedMeanSquareM2).toBe(expected.value);
    }
    const last = comparison.points[3];
    expect(last).toBeDefined();
    if (last) {
      expect(last.predictedMeanSquareM2).toBeGreaterThan(last.observedMeanSquareM2);
      expect(last.measuredMinusModelM2).toBeLessThan(0);
    }
  });

  test("accepted diffusivity changes the prediction, while draft-independent inputs and data stay fixed", () => {
    const record = loadPerrinRecord();
    const snapshot = accepted();
    const original = comparePerrin(record, snapshot);
    const changed = comparePerrin(record, {
      ...snapshot,
      outputs: snapshot.outputs.map((output) =>
        output.quantityId === "diffusionCoefficient" &&
        output.status === "value" &&
        typeof output.value === "number"
          ? { ...output, value: output.value * 2 }
          : output,
      ),
    });
    expect(original.kind).toBe("available");
    expect(changed.kind).toBe("available");
    if (original.kind !== "available" || changed.kind !== "available") return;
    changed.points.forEach((point, i) => {
      const before = original.points[i];
      expect(before).toBeDefined();
      if (!before) return;
      expect(point.observedMeanSquareM2).toBe(before.observedMeanSquareM2);
      expect(point.predictedMeanSquareM2 / before.predictedMeanSquareM2).toBeCloseTo(2, 12);
    });
  });

  test("absent or unusable accepted diffusivity is a reason, never a fabricated zero", () => {
    const record = loadPerrinRecord();
    const snapshot = accepted();
    const missing = {
      ...snapshot,
      outputs: snapshot.outputs.filter((output) => output.quantityId !== "diffusionCoefficient"),
    };
    expect(comparePerrin(record, missing).kind).toBe("unavailable");
    const nonpositive = {
      ...snapshot,
      outputs: snapshot.outputs.map((output) =>
        output.quantityId === "diffusionCoefficient" ? { ...output, value: 0 } : output,
      ),
    };
    expect(comparePerrin(record, nonpositive).kind).toBe("unavailable");
  });
});
