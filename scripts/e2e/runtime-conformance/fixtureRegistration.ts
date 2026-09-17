import type { FixtureAppEntry } from "../fixtures/fixtureApps.ts";

export const RUNTIME_FIXTURE_OWNER = "am-rt-browser-conformance-09i5";
export const RUNTIME_FIXTURE_ID = "runtime";

export function assertRuntimeRegistration(entry: FixtureAppEntry | undefined): FixtureAppEntry {
  if (!entry || entry.id !== RUNTIME_FIXTURE_ID) {
    throw new Error('harness registry is missing the "runtime" fixture application');
  }
  if (entry.owner !== RUNTIME_FIXTURE_OWNER) {
    throw new Error(`runtime fixture owner is "${entry.owner}"; expected ${RUNTIME_FIXTURE_OWNER}`);
  }
  if (entry.entry !== "src/testing/runtime-fixtures/app/") {
    throw new Error(`runtime fixture entry directory is "${entry.entry}"`);
  }
  if (entry.outDir !== "artifacts/e2e-fixtures/runtime/") {
    throw new Error(`runtime fixture outDir is "${entry.outDir}"`);
  }
  if (!entry.staticInputs || entry.staticInputs.length === 0) {
    throw new Error(
      "runtime fixture registration is missing staticInputs; the harness registry in scripts/e2e/fixtures/fixtureApps.ts must copy the pinned WASM artifact and public/wasm/manifest.json",
    );
  }
  return entry;
}
