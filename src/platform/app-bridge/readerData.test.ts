/**
 * The app lists and exports the reader's data from the registry this module writes into the
 * edition manifest, and the Swift tests check the app's export against readerDataExport.json.
 * These tests hold both to the site: the registry projection to `storageKeyRegistry`, and the
 * fixture to what the site's own `exportNamespaces` computes today.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { storageKeyRegistry } from "../storage/keys.ts";
import {
  FIXTURE_REGISTRY,
  READER_DATA_FIXTURE,
  readerDataExportCases,
  readerDataFixtureText,
} from "./fixtures/readerDataExportCases.ts";
import { readerDataManifest } from "./readerData.ts";
import { SNAPSHOT_RECORD } from "./userScripts.ts";

describe("the reader-data manifest", () => {
  it("names the record the bridge mirrors into", () => {
    assert.deepEqual(readerDataManifest().snapshot, { ...SNAPSHOT_RECORD });
  });

  it("carries every registered key, in the registry's order, with the site's label and kind", () => {
    const projected = readerDataManifest().registry;
    const registered = storageKeyRegistry.all();
    assert.ok(projected.length > 0, "an empty registry would make every export empty");
    assert.deepEqual(
      projected.map((entry) => [entry.key, entry.kind, entry.label, entry.exportable]),
      registered.map((entry) => [entry.key, entry.kind, entry.label, entry.exportable]),
    );
  });
});

describe("the export golden the Swift tests read", () => {
  it("equals what the site's exportNamespaces computes now", () => {
    const onDisk = readFileSync(READER_DATA_FIXTURE, "utf8");
    assert.equal(
      onDisk,
      readerDataFixtureText(),
      "readerDataExport.json is stale: run bun src/platform/app-bridge/fixtures/readerDataExportCases.ts",
    );
  });

  it("still finds every key it chose in the site's registry", () => {
    const registered = new Set(storageKeyRegistry.all().map((entry) => entry.key));
    const missing = FIXTURE_REGISTRY.map(([key]) => key).filter((key) => !registered.has(key));
    assert.deepEqual(missing, [], `the site no longer registers ${missing.join(", ")}`);
  });

  it("exercises each shape it exists to pin", () => {
    const [all, withheld, one, family] = readerDataExportCases();
    assert.ok(all && withheld && one && family);
    const values = new Map(all.expected.namespaces.map((entry) => [entry.key, entry.value]));
    // A document is parsed, an unreadable one stays text, a setting stays text, null stays null.
    assert.equal(typeof values.get("am:discovery-notes:v1:brownian-motion"), "object");
    assert.equal(typeof values.get("am:notebook:v1"), "string");
    assert.equal(values.get("am:settings:v1:theme"), "kramgasse-night");
    assert.ok(values.has("am:predictions:v1"));
    assert.equal(values.get("am:predictions:v1"), null);
    // Keys outside the registry never leave, nor does a registered key with nothing saved.
    for (const exported of [all, withheld, one, family]) {
      const keys = exported.expected.namespaces.map((entry) => entry.key);
      assert.ok(!keys.includes("am:unregistered:v1") && !keys.includes("another-site"));
      assert.ok(!keys.includes("am:journeys:v1"));
    }
    assert.ok(all.registry.some((entry) => entry.key === "am:journeys:v1"));
    assert.ok(all.expected.namespaces.some((entry) => entry.key === "am:tours:v1"));
    assert.ok(!withheld.expected.namespaces.some((entry) => entry.key === "am:tours:v1"));
    assert.deepEqual(
      one.expected.namespaces.map((entry) => entry.key),
      ["am:discovery-notes:v1:brownian-motion"],
    );
    assert.deepEqual(
      family.expected.namespaces.map((entry) => entry.key),
      ["am:discovery-notes:v1:brownian-motion", "am:discovery-notes:v1:mass-energy"],
    );
  });
});
