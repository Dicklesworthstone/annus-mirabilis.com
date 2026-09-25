import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateDriftDiffusion } from "../../scripts/generate-drift-diffusion.mjs";
import { BM04_DEFAULTS } from "../experiments/bm04/definition.ts";
import { decodeBm04Settings, encodeBm04Settings } from "../experiments/bm04/permalink.ts";
import { createBm04Session } from "../experiments/bm04/session.ts";
import { createBm04Host } from "../workers/host/bm04Host.ts";

await generateDriftDiffusion();
const example = JSON.parse(
  await readFile(new URL("../generated/bm04-example.json", import.meta.url), "utf8"),
);

function session() {
  let creations = 0,
    disposals = 0;
  const app = createBm04Session("prepared", example, () => {
    creations++;
    let send = null;
    const host = createBm04Host(
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

test("prepared BM-04 data is readable before a worker starts, with identical server/client snapshots", () => {
  const { app, counts } = session();
  assert.equal(counts().creations, 0);
  assert.equal(app.getSnapshot(), app.getServerSnapshot());
  assert.equal(app.getSnapshot().status, "accepted");
  assert.equal(
    app.getSnapshot().accepted.outputs.find((o) => o.quantityId === "diffusionCoefficient").value,
    JSON.parse(example.results.find((r) => r.includes("diffusionCoefficient"))).value,
  );
  app.disconnect();
  assert.equal(counts().disposals, 0);
});

test("parameter edits publish correctly labeled results; invalid edits do not publish", async () => {
  const { app, counts } = session();
  const before = app.getSnapshot();
  assert.equal(app.apply({ ...BM04_DEFAULTS, T: -1 }).kind, "refused");
  assert.equal(app.getSnapshot(), before);
  app.apply({ ...BM04_DEFAULTS, eta: 0.002, m: 2 });
  await settled(app);
  const after = app.getSnapshot().accepted;
  assert.equal(after.parameters.eta, 0.002);
  assert.equal(after.parameters.m, 2);
  assert.equal(after.snapshotVersion, 2);
  assert.equal(counts().creations, 1);
  app.disconnect();
  assert.equal(counts().disposals, 1);
});

test("sharing uses accepted settings rather than refused or still-requested values", async () => {
  const { app } = session();
  const accepted = app.acceptedParameters();
  // 0.1 s: inside the declared 0.01-1000 ms range, and about 8.6 times the explicit scheme's
  // stability limit dx^2/(2D) = 0.0117 s at the defaults, so the worker, not the range check,
  // refuses it. (100 s is now refused by the declared range before it reaches the worker.)
  app.apply({ ...BM04_DEFAULTS, dt: 0.1 }); // Unstable dt
  await settled(app);
  assert.equal(app.getSnapshot().status, "refused");
  assert.deepEqual(app.acceptedParameters(), accepted);
  assert.deepEqual(
    decodeBm04Settings(encodeBm04Settings(app.acceptedParameters())).parameters,
    accepted,
  );
  app.disconnect();
});

test("tampered prepared outputs are rejected during initialization", () => {
  const altered = structuredClone(example);
  altered.results[0] = JSON.stringify({ ...JSON.parse(altered.results[0]), unit: "invalid-unit" });
  assert.throws(() =>
    createBm04Session("bad", altered, () => {
      throw new Error("must never run");
    }),
  );
});
