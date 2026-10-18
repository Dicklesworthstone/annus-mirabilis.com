import { afterAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  bundleFixtureApp,
  fixtureBundlePath,
} from "../../../scripts/e2e/fixtures/bundleFixtures.ts";
import {
  FIXTURE_APP_REGISTRY,
  validateFixtureAppRegistry,
} from "../../../scripts/e2e/fixtures/fixtureApps.ts";
import { startFixtureServer } from "../../../scripts/e2e/fixtures/fixtureServer.ts";

const ROOT = process.cwd();
// am-yhus: always the OS temp dir.
const TEMP_BASE = os.tmpdir();

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

    /*
     * It declares a PAGE. `/apps/<id>/` resolves to `<appPath>index.html`, so an entry with no
     * index.html bundles a `bundle.js` that nothing loads. This used to read
     *
     *     const route = `/apps/${entry.id}/`;
     *     expect(route).toBe("/apps/view-kit/");
     *
     * under the comment "Serves at /apps/view-kit/", which asserts that a template literal
     * built from an id equals the string that id necessarily produces -- and `entry.id` is
     * asserted to be "view-kit" eight lines above. It could not fail, and it was standing in
     * for this bead's requirement that the app SERVES. It did not: there was no page at all.
     * The test below opens the route over the real fixture server instead.
     */
    const servedPaths = (entry.staticInputs ?? []).map((input) => input.servedPath);
    expect(servedPaths).toContain("index.html");
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
  /**
   * THE REQUIREMENT ITSELF: "the `view-kit` fixture application is registered, bundles, and
   * SERVES at `/apps/view-kit/`". Registration and bundling were covered; serving was not, and
   * the app did not serve.
   *
   * This bundles into a temporary apps root and asks the real `startFixtureServer` for the
   * route, which is the same server `scripts/e2e/controls.e2e.test.ts` opens `/apps/controls-kit/`
   * on. A 404 for a missing file in the same app is asserted too: a server that answered every
   * path with the page would make the 200 above meaningless.
   */
  test("the fixture server serves the app at /apps/view-kit/, with its bundle and stylesheets", async () => {
    const entry = FIXTURE_APP_REGISTRY.find((e) => e.id === "view-kit");
    if (!entry) throw new Error("view-kit fixture not found");

    const appsRoot = fs.mkdtempSync(path.join(TEMP_BASE, "view-kit-serve-test-"));
    createdDirs.push(appsRoot);
    const outDir = path.join(appsRoot, "view-kit");

    const bundled = await bundleFixtureApp({ ...entry, outDir }, ROOT);
    expect(bundled.staticInputsCopied).toContain("index.html");

    const server = await startFixtureServer({ staticRoot: appsRoot, appsRoot });
    try {
      const page = await fetch(`${server.url}/apps/view-kit/`);
      expect(page.status).toBe(200);
      expect(page.headers.get("content-type")).toContain("text/html");
      const html = await page.text();
      // The page must actually load the bundle, or it serves an empty shell.
      expect(html).toContain('src="/apps/view-kit/bundle.js"');
      expect(html).toContain('id="app"');

      const script = await fetch(`${server.url}/apps/view-kit/bundle.js`);
      expect(script.status).toBe(200);
      expect((await script.text()).length).toBeGreaterThan(1000);

      // Every stylesheet the page links must resolve, since the kit's non-colour identity rules
      // live in them; a 404 here would leave the fixture reporting on unstyled marks.
      for (const sheet of ["globals.css", "themes.css", "visuals.css", "legends.css"]) {
        const response = await fetch(`${server.url}/apps/view-kit/${sheet}`);
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("text/css");
      }

      // The negative control: this server does not answer everything with the page.
      const missing = await fetch(`${server.url}/apps/view-kit/no-such-file.js`);
      expect(missing.status).toBe(404);
    } finally {
      await server.close();
    }
  });
});
