/**
 * Targeted tests for the row-level and export refusals in csv.ts (am-p465, am-kd9h).
 *
 * Batch 5c completes the kitchen pair. 5a drove the tokenizer and the metadata block; this file
 * drives everything downstream of the header - the per-row contract, the frame stamp, and the
 * export side - one bad cell at a time against a base CSV that parses.
 *
 * Each case cites its site as `(csv.ts:NN)` and asserts the MESSAGE as well as the code: fifteen of
 * these sites share `kitchen-input-invalid`, so a code-only assertion would credit a line the case
 * never reached.
 *
 * ONE SITE IS DELIBERATELY ABSENT. csv.ts:311 refuses an "incomplete frame stamp" when
 * `c.slice(12).length !== 4`, but csv.ts:208 has already refused any row whose cell count is not
 * exactly twelve, or exactly sixteen when the header declares frame columns. A row that reaches 372
 * therefore always has exactly four trailing cells and the guard cannot fire. It is left untested
 * and counted rather than covered by a case that would in fact land on 250.
 */

import { describe, expect, test } from "bun:test";
import { exportKitchenCsv, parseKitchenCsv } from "./csv.ts";
import { KitchenInputError } from "./schema.ts";

function refusalFrom(run: () => unknown): KitchenInputError {
  try {
    run();
  } catch (err) {
    if (err instanceof KitchenInputError) return err;
    throw err;
  }
  throw new Error("The input was accepted when it should have been refused.");
}

const META: Record<string, string> = {
  source_width_px: "640",
  source_height_px: "480",
  working_scale: "1",
  rotation_degrees: "0",
  pixel_aspect_ratio: "1",
  pixels_per_um_x: "10",
  pixels_per_um_y: "10",
  pixels_per_um_x_uncertainty: "0",
  pixels_per_um_y_uncertainty: "0",
  calibration_axes: "both",
  calibration_method: "micrometer",
  calibration_interval_um: "",
  declared_interval_s: "1",
  frame_rate_hz: "30",
  timing_source: "frame-callback",
  temperature_k: "293.15",
  temperature_interval_k: "",
  viscosity_mpa_s: "1",
  viscosity_source: "Declared teaching parameter, not measured water",
  radius_um: "",
  radius_interval_um: "",
  radius_interval_coverage: "",
  exposure_s: "0",
  drift_source: "unknown",
  constant_set_id: "scenario-gas-constant-measured",
  sample: "A classroom arithmetic example",
  data_origin: "synthetic",
  radius_provenance: "unknown",
};
const METADATA_BLOCK = Object.entries(META)
  .map(([k, v]) => `# ${k}=${v}`)
  .join("\n");
const COLUMNS =
  "schema_version,kind,object_id,frame_time_s,x_px,y_px,lost,loss_reason,point_status,exclusion_reason,calibration_id,identity_decision";
const FRAME_COLUMNS = "requested_time_s,timing_source,presented_frames,frame_id";
const GOOD_ROW = "2,particle,p1,0,100,200,0,,measured,,cal-1,";

/** A CSV with valid metadata, the plain header, and whatever rows the case supplies. */
const csv = (...rows: string[]) => `${METADATA_BLOCK}\n${COLUMNS}\n${rows.join("\n")}\n`;
/** The same, with the frame columns declared. */
const framed = (...rows: string[]) =>
  `${METADATA_BLOCK}\n${COLUMNS},${FRAME_COLUMNS}\n${rows.join("\n")}\n`;
const refusalForCsv = (text: string) => refusalFrom(() => parseKitchenCsv(text));

/** The base must parse, or every case below would pass for the wrong reason. */
test("the base CSV is accepted (guard for this file)", () => {
  const document = parseKitchenCsv(csv(GOOD_ROW));
  expect(document.points).toHaveLength(1);
  expect(document.metadata.sample).toBe("A classroom arithmetic example");
});

describe("csv.ts refusals: the file shape around the rows", () => {
  test("more observations than the importer supports (csv.ts:36)", () => {
    const rows = Array.from(
      { length: 20001 },
      (_, i) => `2,particle,p${i},${i},1,2,0,,measured,,c,`,
    );
    const err = refusalFrom(() => parseKitchenCsv(`${COLUMNS}\n${rows.join("\n")}\n`));
    expect(err.code).toBe("kitchen-input-invalid");
    expect(err.message).toContain("at most 20000 observations are supported.");
  });

  test("a deprecated uncertainty with no deprecated scale (csv.ts:205)", () => {
    const err = refusalForCsv(`# pixels_per_um_uncertainty=1\n${COLUMNS}\n${GOOD_ROW}\n`);
    expect(err.code).toBe("kitchen-input-invalid");
    expect(err.message).toContain("a deprecated uncertainty needs its deprecated scale.");
  });

  test("a header that is not the declared column order (csv.ts:216)", () => {
    const err = refusalForCsv(`kind,schema_version\n${GOOD_ROW}\n`);
    expect(err.code).toBe("kitchen-input-invalid");
    expect(err.message).toContain("use these columns in order: schema_version, kind,");
  });

  test("a header with no observations under it (csv.ts:223)", () => {
    const err = refusalForCsv(`${COLUMNS}\n`);
    expect(err.code).toBe("observation-incomplete");
    expect(err.message).toContain("include at least one observation.");
  });

  test("a row with fewer cells than its header declares (csv.ts:250)", () => {
    const err = refusalForCsv(csv("2,particle,p1,0,100,200,0,,measured,,cal-1"));
    expect(err.code).toBe("csv-shape-invalid");
    expect(err.message).toContain("each row must have exactly the columns declared in its header.");
  });
});

describe("csv.ts refusals: one observation", () => {
  test("a schema version this importer does not read (csv.ts:271)", () => {
    const err = refusalForCsv(csv("1,particle,p1,0,100,200,0,,measured,,cal-1,"));
    expect(err.code).toBe("kitchen-input-invalid");
    expect(err.message).toContain("this importer reads schema 2.");
  });

  test("a kind outside the fixed choice (csv.ts:240)", () => {
    const err = refusalForCsv(csv("2,blob,p1,0,100,200,0,,measured,,cal-1,"));
    expect(err.code).toBe("kitchen-input-invalid");
    expect(err.message).toContain("choose particle, stationary, calibration.");
    expect(err.field).toBe("kind");
  });

  test("an empty object_id (csv.ts:281)", () => {
    const err = refusalForCsv(csv("2,particle,,0,100,200,0,,measured,,cal-1,"));
    expect(err.code).toBe("kitchen-input-invalid");
    expect(err.message).toContain("object_id and calibration_id must not be empty.");
  });

  test("a time past the supported duration (csv.ts:289)", () => {
    const err = refusalForCsv(csv("2,particle,p1,601,100,200,0,,measured,,cal-1,"));
    expect(err.code).toBe("observation-incomplete");
    expect(err.message).toContain("use actual times from 0 to 600 seconds.");
  });

  test("a lost flag that disagrees with the status (csv.ts:304)", () => {
    const err = refusalForCsv(csv("2,particle,p1,0,100,200,1,,measured,,cal-1,"));
    expect(err.code).toBe("observations-inconsistent");
    expect(err.message).toContain("lost, point_status and loss_reason must agree.");
  });

  test("an exclusion reason on a point that is not excluded (csv.ts:311)", () => {
    const err = refusalForCsv(csv("2,particle,p1,0,100,200,0,,measured,blurred,cal-1,"));
    expect(err.code).toBe("kitchen-input-invalid");
    expect(err.message).toContain(
      "give a reason for an excluded point only; keep its coordinates.",
    );
  });

  test("a coordinate outside the source frame (csv.ts:321)", () => {
    const err = refusalForCsv(csv("2,particle,p1,0,200000,200,0,,measured,,cal-1,"));
    expect(err.code).toBe("kitchen-input-invalid");
    expect(err.message).toContain("coordinates must be within ±100000 source pixels.");
    expect(err.field).toBe("x_px");
  });
});

describe("csv.ts refusals: one label across several observations", () => {
  test("a particle time that does not strictly increase (csv.ts:342)", () => {
    const err = refusalForCsv(csv(GOOD_ROW, "2,particle,p1,0,110,200,0,,measured,,cal-1,"));
    expect(err.code).toBe("kitchen-input-invalid");
    expect(err.message).toContain("particle times must strictly increase");
  });

  test("a reacquisition with no identity decision (csv.ts:349)", () => {
    const err = refusalForCsv(
      csv("2,particle,p1,0,,,1,edge,lost,,cal-1,", "2,particle,p1,1,100,200,0,,measured,,cal-1,"),
    );
    expect(err.code).toBe("kitchen-input-invalid");
    expect(err.message).toContain("choose reacquired-same or new-object after losing this label.");
  });

  test("an identity decision where nothing was lost (csv.ts:356)", () => {
    const err = refusalForCsv(csv("2,particle,p1,0,100,200,0,,measured,,cal-1,reacquired-same"));
    expect(err.code).toBe("kitchen-input-invalid");
    expect(err.message).toContain("an identity decision belongs on the first point after a loss.");
  });

  test("a stationary row that is not a measured click (csv.ts:363)", () => {
    const err = refusalForCsv(csv("2,stationary,s1,0,100,200,0,,interpolated,,cal-1,"));
    expect(err.code).toBe("kitchen-input-invalid");
    expect(err.message).toContain(
      "stationary and calibration rows must be measured, independent clicks.",
    );
  });
});

describe("csv.ts refusals: the frame stamp", () => {
  test("a frame identity outside its range (csv.ts:398)", () => {
    const err = refusalFrom(() => parseKitchenCsv(framed(`${GOOD_ROW},0,frame-callback,1,0`)));
    expect(err.code).toBe("kitchen-input-invalid");
    expect(err.message).toContain("invalid frame identity, time or timing provenance.");
  });

  test("timing provenance that disagrees with the times (csv.ts:411)", () => {
    const err = refusalFrom(() => parseKitchenCsv(framed(`${GOOD_ROW},1,frame-callback,1,1`)));
    expect(err.code).toBe("kitchen-input-invalid");
    expect(err.message).toContain("timing provenance disagrees with the actual/requested times");
  });

  test("one frame id carrying two different stamps (csv.ts:419)", () => {
    const err = refusalFrom(() =>
      parseKitchenCsv(
        framed(
          `${GOOD_ROW},0,frame-callback,1,1`,
          `2,particle,p1,1,110,200,0,,measured,,cal-1,,1,frame-callback,1,1`,
        ),
      ),
    );
    expect(err.code).toBe("kitchen-input-invalid");
    expect(err.message).toContain(
      "one acquired frame cannot have conflicting times or provenance.",
    );
    expect(err.field).toBe("frame_id");
  });

  test("a well-formed frame stamp is accepted, not refused", () => {
    const document = parseKitchenCsv(framed(`${GOOD_ROW},0,frame-callback,1,1`));
    expect(document.points[0]?.capture?.frameId).toBe(1);
  });
});

describe("csv.ts refusals: the export side", () => {
  test("a metadata value carrying a newline (csv.ts:456)", () => {
    const document = parseKitchenCsv(csv(GOOD_ROW));
    const broken = { ...document, metadata: { ...document.metadata, sample: "one\ntwo" } };
    const err = refusalFrom(() => exportKitchenCsv(broken));
    expect(err.code).toBe("metadata-invalid");
    expect(err.message).toContain("metadata values cannot contain newlines.");
  });

  test("a document that round-trips is exported, not refused", () => {
    const document = parseKitchenCsv(csv(GOOD_ROW));
    expect(parseKitchenCsv(exportKitchenCsv(document)).points).toEqual(document.points);
  });
});
