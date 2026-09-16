import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateLab } from "../../scripts/generate-lab.mjs";
import { BM06_DEFAULTS } from "../experiments/bm06/definition.ts";
import { decodeBm06Settings, encodeBm06Settings } from "../experiments/bm06/permalink.ts";
import { createBm06Session } from "../experiments/bm06/session.ts";
import { createBm06Host } from "../workers/host/bm06Host.ts";

await generateLab();
const example = JSON.parse(
  await readFile(new URL("../generated/bm06-example.json", import.meta.url), "utf8"),
);
function session() {
  let creations = 0,
    disposals = 0;
  const app = createBm06Session("prepared", example, () => {
    creations++;
    let send = null;
    const host = createBm06Host(
      (message) => send?.(structuredClone(message)),
      example.sourceDigest,
    );
    return {
      send: (message) => {
        void host.receive(structuredClone(message));
      },
      listen(onMessage) {
        send = onMessage;
        queueMicrotask(() => host.hello());
        return () => {
          send = null;
        };
      },
      dispose() {
        disposals++;
        host.dispose();
      },
    };
  });
  return { app, counts: () => ({ creations, disposals }) };
}
const settled = (app) =>
  new Promise((resolve) => {
    if (!app.getSnapshot().pending) {
      resolve();
      return;
    }
    const unsub = app.subscribe(() => {
      if (!app.getSnapshot().pending) {
        unsub();
        resolve();
      }
    });
  });
test("prepared data is readable before a worker starts, with identical server/client snapshots", () => {
  const { app, counts } = session();
  assert.equal(counts().creations, 0);
  assert.equal(app.getSnapshot(), app.getServerSnapshot());
  assert.equal(app.getSnapshot().status, "accepted");
  assert.equal(
    app.getSnapshot().accepted.outputs.find((o) => o.quantityId === "diffusionCoefficient").value,
    JSON.parse(example.results[0]).value,
  );
  app.disconnect();
  assert.equal(counts().disposals, 0);
});
test("mixed setup/interval edits publish one correctly labeled result; invalid edits do not publish", async () => {
  const { app, counts } = session();
  const before = app.getSnapshot();
  assert.equal(app.apply({ ...BM06_DEFAULTS, T: -1 }).kind, "refused");
  assert.equal(app.getSnapshot(), before);
  app.apply({ ...BM06_DEFAULTS, eta: 0.002, lower: 0 });
  await settled(app);
  const after = app.getSnapshot().accepted;
  assert.equal(after.parameters.eta, 0.002);
  assert.equal(after.parameters.lower, 0);
  assert.equal(after.snapshotVersion, 2);
  assert.equal(counts().creations, 1);
  app.disconnect();
  assert.equal(counts().disposals, 1);
  app.apply({ ...BM06_DEFAULTS, t: 0 });
  await settled(app);
  assert.equal(counts().creations, 2);
  app.disconnect();
});
test("sharing uses accepted settings rather than refused or still-requested values", async () => {
  const { app } = session();
  const accepted = app.acceptedParameters();
  app.apply({ ...BM06_DEFAULTS, gridEnabled: true, steps: 1 });
  await settled(app);
  assert.equal(app.getSnapshot().status, "refused");
  assert.deepEqual(app.acceptedParameters(), accepted);
  assert.deepEqual(
    decodeBm06Settings(encodeBm06Settings(app.acceptedParameters())).parameters,
    accepted,
  );
  app.disconnect();
});
test("versioned SI settings links roundtrip and reject duplicates, unknown fields and oversized payloads", () => {
  const link = encodeBm06Settings(BM06_DEFAULTS);
  assert.deepEqual(decodeBm06Settings(link), { kind: "settings", parameters: BM06_DEFAULTS });
  assert.equal(decodeBm06Settings("").kind, "absent");
  for (const bad of [
    link + "&T=300",
    link + "&rogue=1",
    link.replace("bm=1", "bm=2"),
    link.replace("T=293.15", "T=Infinity"),
    link.replace("T=293.15", "T=1e400"),
    link.replace("gridEnabled=0", "gridEnabled=false"),
    "?" + "a".repeat(2100),
  ])
    assert.equal(decodeBm06Settings(bad).kind, "invalid");
});
test("prepared output tampering is refused instead of becoming SSR scientific content", () => {
  const altered = structuredClone(example);
  altered.results[0] = JSON.stringify({ ...JSON.parse(altered.results[0]), unit: "kg" });
  assert.throws(() =>
    createBm06Session("bad", altered, () => {
      throw new Error("must never run");
    }),
  );
});
test("static example and provenance generation are reproducible", async () => {
  const before = await readFile(new URL("../generated/bm06-example.json", import.meta.url), "utf8");
  const generated = await generateLab();
  assert.equal(generated.sourceDigest, example.sourceDigest);
  assert.equal(
    before,
    await readFile(new URL("../generated/bm06-example.json", import.meta.url), "utf8"),
  );
});
