/**
 * Targeted tests for the refusals in schema.ts, one per throw site (am-p465, am-kd9h).
 *
 * Batch 5b. Each case cites the site it reaches as `(schema.ts:NN)` and asserts the MESSAGE as
 * well as the code, because five sites share `kitchen-input-invalid` and three share
 * `range-invalid`: a code-only assertion would credit a line the case never reached.
 *
 * ONE SITE IS DELIBERATELY ABSENT. schema.ts:141 guards `!rawA || !rawB` after the regex
 * /^\[([^,]+),([^,]+)\]$/ has matched. `[^,]+` is one-or-more, so neither group can be empty, and
 * the guard is unreachable at runtime: it exists to satisfy noUncheckedIndexedAccess, which types
 * a capture group as `string | undefined`. It also carries the same code AND the same message as
 * schema.ts:139, so no assertion could distinguish the two even if it did fire. It is left
 * untested and counted rather than covered by a test that would in fact reach 150.
 */

import { describe, expect, test } from "bun:test";
import {
  intervalMetadata,
  KitchenInputError,
  kitchenNumber,
  validateKitchenMetadata,
} from "./schema.ts";

/** Runs `run` and returns the refusal, or fails if none is raised. */
function refusalFrom(run: () => unknown): KitchenInputError {
  try {
    run();
  } catch (err) {
    if (err instanceof KitchenInputError) return err;
    throw err;
  }
  throw new Error("The input was accepted when it should have been refused.");
}

/** A metadata record that validates, so each case below changes exactly one value. */
const BASE: Record<string, string> = {
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

const metadataRefusal = (patch: Record<string, string>) =>
  refusalFrom(() => validateKitchenMetadata({ ...BASE, ...patch }));

/** The base must validate, or every case below would pass for the wrong reason. */
test("the base metadata record is accepted (schema.ts guard for this file)", () => {
  expect(() => validateKitchenMetadata({ ...BASE })).not.toThrow();
});

describe("schema.ts refusals: a single number", () => {
  test("a spreadsheet formula is not a number (schema.ts:129)", () => {
    const err = refusalFrom(() => kitchenNumber("=SUM(A1:A9)", "t_s", 4));
    expect(err.code).toBe("number-invalid");
    expect(err.message).toContain("enter a finite decimal number, not a formula.");
    expect(err.row).toBe(4);
    expect(err.field).toBe("t_s");
  });

  test("a magnitude that overflows to infinity (schema.ts:133)", () => {
    const err = refusalFrom(() => kitchenNumber("1e999", "x_px"));
    expect(err.code).toBe("number-invalid");
    expect(err.message).toContain("the number is outside the supported range.");
  });

  test("a magnitude that underflows a nonzero mantissa to zero (schema.ts:133)", () => {
    const err = refusalFrom(() => kitchenNumber("1e-999", "x_px"));
    expect(err.code).toBe("number-invalid");
    expect(err.message).toContain("the number is outside the supported range.");
  });
});

describe("schema.ts refusals: an interval", () => {
  test("prose where a bracketed pair belongs (schema.ts:139)", () => {
    const err = refusalFrom(() => intervalMetadata("1 to 2", "radius_interval_um"));
    expect(err.code).toBe("range-invalid");
    expect(err.message).toContain("use [lower,upper] or leave it blank.");
  });

  test("a reversed pair (schema.ts:145)", () => {
    const err = refusalFrom(() => intervalMetadata("[2,1]", "radius_interval_um"));
    expect(err.code).toBe("range-invalid");
    expect(err.message).toContain("bounds must be positive and ordered.");
  });

  test("a lower bound at zero (schema.ts:145)", () => {
    const err = refusalFrom(() => intervalMetadata("[0,1]", "radius_interval_um"));
    expect(err.code).toBe("range-invalid");
    expect(err.message).toContain("bounds must be positive and ordered.");
  });

  test("a blank interval is accepted, not refused", () => {
    expect(intervalMetadata("", "radius_interval_um")).toBeNull();
  });
});

describe("schema.ts refusals: the metadata block", () => {
  test("a required declaration is absent (schema.ts:169)", () => {
    const { source_width_px: _dropped, ...without } = BASE;
    const err = refusalFrom(() => validateKitchenMetadata(without));
    expect(err.code).toBe("metadata-invalid");
    expect(err.message).toContain("the metadata declaration is missing");
    expect(err.field).toBe("source_width_px");
  });

  test("a number outside its declared range (schema.ts:173)", () => {
    const err = metadataRefusal({ source_width_px: "99999" });
    expect(err.code).toBe("kitchen-input-invalid");
    expect(err.message).toContain("use a number from 1 to 4096.");
  });

  test("a fractional pixel count (schema.ts:180)", () => {
    const err = metadataRefusal({ source_width_px: "640.5" });
    expect(err.code).toBe("number-invalid");
    expect(err.message).toContain("use a whole number of pixels.");
  });

  test("a value outside a fixed choice (schema.ts:194)", () => {
    const err = metadataRefusal({ rotation_degrees: "45" });
    expect(err.code).toBe("kitchen-input-invalid");
    expect(err.message).toContain("choose 0, 90, 180, 270.");
  });

  test("a coverage claim with no provenance behind it (schema.ts:211)", () => {
    const err = metadataRefusal({ physical_input_coverage: "0.95" });
    expect(err.code).toBe("kitchen-input-invalid");
    expect(err.message).toContain("describe the source and simultaneous-coverage basis");
    expect(err.field).toBe("physical_input_provenance");
  });

  test("a declared calibrated axis with no scale (schema.ts:221)", () => {
    const err = metadataRefusal({ calibration_axes: "x", pixels_per_um_x: "" });
    expect(err.code).toBe("kitchen-input-invalid");
    expect(err.message).toContain("the declared calibrated axis needs a scale.");
    expect(err.field).toBe("pixels_per_um_x");
  });

  test("an interval that excludes its own point value (schema.ts:242)", () => {
    const err = metadataRefusal({ temperature_interval_k: "[300,310]" });
    expect(err.code).toBe("range-invalid");
    expect(err.message).toContain("the range must contain the declared point value.");
    expect(err.field).toBe("temperature_interval_k");
  });

  test("an exposure longer than the interval between frames (schema.ts:272)", () => {
    const err = metadataRefusal({ exposure_s: "2", declared_interval_s: "1" });
    expect(err.code).toBe("observations-inconsistent");
    expect(err.message).toContain("overlapping exposures are not supported.");
  });

  test("a viscosity with no stated source (schema.ts:248)", () => {
    const err = metadataRefusal({ viscosity_source: "   " });
    expect(err.code).toBe("kitchen-input-invalid");
    expect(err.message).toContain("name the source or the approximation you chose.");
    expect(err.field).toBe("viscosity_source");
  });
});
