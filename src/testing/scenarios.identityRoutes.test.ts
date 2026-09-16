import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateScenario } from "../content/schemas/experiment.ts";
import { checkIdentityIndependence, readOwnerSource } from "./scenario-registry/identityRoutes.ts";
import { loadScenarioFile } from "./scenario-registry/load.ts";
import { ownerSourceMap } from "./scenario-registry/owners.ts";
import { runLoadedScenarios } from "./scenario-registry/run.ts";

describe("identity routes", () => {
  test("two distinct owners pass independence", () => {
    const sources: Record<string, string> = {};
    for (const [id, path] of Object.entries(ownerSourceMap())) sources[id] = readOwnerSource(path);
    const check = checkIdentityIndependence(
      [
        { routeId: "a", owner: "selfTest.timesTwoClosed", description: "product" },
        { routeId: "b", owner: "selfTest.timesTwoFromAdd", description: "sum" },
      ],
      sources,
    );
    expect(check.ok).toBe(true);
  });

  test("the same owner twice fails", () => {
    const sources: Record<string, string> = {};
    for (const [id, path] of Object.entries(ownerSourceMap())) sources[id] = readOwnerSource(path);
    const check = checkIdentityIndependence(
      [
        { routeId: "a", owner: "selfTest.timesTwoClosed", description: "a" },
        { routeId: "b", owner: "selfTest.timesTwoClosed", description: "b" },
      ],
      sources,
    );
    expect(check.ok).toBe(false);
  });

  test("a thin wrapper route fails the import-graph check", () => {
    const sources: Record<string, string> = {};
    for (const [id, path] of Object.entries(ownerSourceMap())) sources[id] = readOwnerSource(path);
    const check = checkIdentityIndependence(
      [
        { routeId: "a", owner: "selfTest.timesTwoClosed", description: "product" },
        { routeId: "b", owner: "selfTest.timesTwoWrapper", description: "wrapper" },
      ],
      sources,
    );
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.message.includes("thin wrapper")).toBe(true);
  });

  test("a missing second route reports not-available", () => {
    const dir = join(process.cwd(), "src/testing/scenario-fixtures/negatives");
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "identity-missing-route.yaml");
    writeFileSync(
      path,
      `id: self-test-identity-missing
kind: identity
title: missing
constantSetId: modern-si-2019
owner: selfTest.timesTwoClosed
inputs:
  x: { value: 1, unit: "1" }
routes:
  - routeId: a
    owner: selfTest.timesTwoClosed
    description: product
  - routeId: b
    owner: selfTest.notYetImplemented
    description: missing owner
expected:
  outputs:
    - outputId: value
      value: 2
      comparisonKind: tolerance
      tolerance: { relative: 1.0e-9, rationale: "n/a" }
modelVersion: 1
schemaVersion: 1
`,
    );
    const loaded = loadScenarioFile(path);
    const { results } = runLoadedScenarios([loaded]);
    expect(results[0]?.status).toBe("not-available");
  });

  test("schema rejects two routes with the same owner", () => {
    expect(() =>
      validateScenario({
        id: "x",
        kind: "identity",
        title: "x",
        constantSetId: "modern-si-2019",
        owner: "selfTest.timesTwoClosed",
        inputs: {},
        routes: [
          { routeId: "a", owner: "selfTest.timesTwoClosed", description: "a" },
          { routeId: "b", owner: "selfTest.timesTwoClosed", description: "b" },
        ],
        expected: { outputs: [] },
        modelVersion: 1,
        schemaVersion: 1,
      }),
    ).toThrow();
  });
});
