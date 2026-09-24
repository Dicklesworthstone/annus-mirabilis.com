import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateExperiment } from "../content/schemas/experiment.ts";
import { strictParse } from "../content/schemas/strictParse.ts";

/**
 * Every laboratory manifest the site ships passes the full experiment schema (dispatch 141).
 *
 * Nothing ran validateExperiment over content/experiments/, so two of 33 manifests had failed it
 * unnoticed: lq-06.yaml's mapping kind "logarithmic" and me-03.yaml's missing realRate (fixed in
 * 8c06bcaa). The count comes from the directory, so a manifest added later is checked without anyone
 * listing it, and an empty directory fails rather than passing on nothing.
 */
const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../../content/experiments");

describe("every content/experiments manifest passes validateExperiment", () => {
  test("validated N of N, N from the directory", () => {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".yaml"))
      .sort();
    const failures: string[] = [];
    for (const file of files) {
      try {
        validateExperiment(strictParse(readFileSync(resolve(dir, file), "utf8"), "yaml"));
      } catch (err) {
        failures.push(`${file}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    console.log(
      `[experiment manifests] validated ${files.length - failures.length} of ${files.length}`,
    );
    expect(files.length).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  });
});
