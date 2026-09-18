import { afterAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { bundleFixtureApp, fixtureBundlePath } from "../../../scripts/e2e/fixtures/bundleFixtures.ts";
import {
  FIXTURE_APP_REGISTRY,
  validateFixtureAppRegistry,
} from "../../../scripts/e2e/fixtures/fixtureApps.ts";

const ROOT = process.cwd();
const TEMP_BASE = fs.existsSync("/Volumes/USBNVME16TB/temp_agent_space")
  ? "/Volumes/USBNVME16TB/temp_agent_space"
  : os.tmpdir();

describe("View Kit Fixture Application Conformance (am-inst-2d-view-kit-u75r)", () => {
  const createdDirs: string[] = [];

  afterAll(async () => {
    for (const dir of createdDirs) {
      try {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      } catch {
        // best effort cleanup
      }
    }
  });

  test("view-kit fixture app entry is registered in FIXTURE_APP_REGISTRY with correct metadata", () => {
    const entry = FIXTURE_APP_REGISTRY.find((e) => e.id === "view-kit");
    expect(entry).toBeDefined();
    if (!entry) throw new Error("view-kit fixture not found in registry");

    expect(entry.id).toBe("view-kit");
    expect(entry.owner).toBe("am-inst-2d-view-kit-u75r");
    expect(entry.entry).toBe("src/testing/e2e/fixture-apps/view-kit/");
    expect(entry.outDir).toBe("artifacts/e2e-fixtures/view-kit/");

    // Passes harness registry validation
    const issues = validateFixtureAppRegistry([entry]);
    expect(issues).toEqual([]);

    // Serves at /apps/view-kit/
    const route = `/apps/${entry.id}/`;
    expect(route).toBe("/apps/view-kit/");
  });

  test("view-kit source entrypoint exists and exports interactive fixture app", () => {
    const entry = FIXTURE_APP_REGISTRY.find((e) => e.id === "view-kit");
    if (!entry) throw new Error("view-kit fixture not found");

    const entryFile = path.resolve(ROOT, entry.entry, "index.ts");
    expect(fs.existsSync(entryFile)).toBe(true);

    const source = fs.readFileSync(entryFile, "utf8");
    expect(source).toContain("ViewKitFixtureApp");
    expect(source).toContain("createFixtureScale");
  });

  test("view-kit fixture application bundles successfully into standalone browser bundle", async () => {
    const entry = FIXTURE_APP_REGISTRY.find((e) => e.id === "view-kit");
    if (!entry) throw new Error("view-kit fixture not found");

    const tempDir = fs.mkdtempSync(path.join(TEMP_BASE, "view-kit-bundle-test-"));
    createdDirs.push(tempDir);

    const bundled = await bundleFixtureApp({ ...entry, outDir: tempDir }, ROOT);
    expect(bundled.id).toBe("view-kit");
    expect(bundled.bundleFiles).toContain("bundle.js");
    expect(bundled.bundleFiles).toContain("bundle.js.map");

    const bundlePath = fixtureBundlePath({ outDir: tempDir }, ROOT);
    expect(fs.existsSync(bundlePath)).toBe(true);

    const bundleContent = fs.readFileSync(bundlePath, "utf8");
    expect(bundleContent.length).toBeGreaterThan(1000);
    // Bundle contains view-kit primitives and identity attributes
    expect(bundleContent).toContain("data-instance-id");
    expect(bundleContent).toContain("data-snapshot-version");
  });
});
