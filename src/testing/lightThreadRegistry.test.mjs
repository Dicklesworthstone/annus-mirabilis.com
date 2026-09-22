import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { REGISTERED_IDS, resolveCatalogueAddress } from "../experiments/catalogue.ts";
import { registryEntry, registryParityViolations } from "../experiments/registry.ts";

test("light thread is registered with its actual session and an authored question", () => {
  assert.ok(REGISTERED_IDS.includes("light-thread"));
  assert.deepEqual(resolveCatalogueAddress("light-thread"), { id: "light-thread", mode: null });
  const entry = registryEntry("light-thread");
  assert.equal(entry.status, "registered");
  assert.deepEqual(entry.owner, {
    kind: "reference-evaluator",
    module: "src/experiments/lightThread/session.ts",
    function: "createLightThreadSession",
  });
  assert.ok(entry.question?.includes("assumptions"));
  assert.deepEqual(registryParityViolations(), []);
  const source = readFileSync(
    new URL("../experiments/lightThread/session.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /export function createLightThreadSession\(/);
});

test("connections lead to the real laboratory route rather than an isolated catalogue entry", () => {
  const connections = readFileSync(new URL("../app/connections/page.tsx", import.meta.url), "utf8");
  const laboratory = readFileSync(
    new URL("../app/lab/light-thread/page.tsx", import.meta.url),
    "utf8",
  );
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  // The site header's links moved out of layout.tsx into PrimaryNavLinks (which marks the
  // current section), so the /connections/ link is asserted where it now lives, and the layout
  // is asserted to render that component. Checking layout.tsx for the literal href went red on
  // a refactor that kept the link.
  const nav = readFileSync(
    new URL("../components/chrome/PrimaryNavLinks.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(connections.includes('href="/lab/light-thread"'));
  assert.ok(laboratory.includes("<LightThreadLab />"));
  assert.ok(layout.includes("<PrimaryNavLinks"));
  assert.ok(nav.includes('href: "/connections/"'));
  assert.ok(laboratory.includes('canonical: "/lab/light-thread/"'));
});
