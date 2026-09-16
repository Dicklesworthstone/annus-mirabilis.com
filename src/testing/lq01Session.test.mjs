import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateWaveDescription } from "../../scripts/generate-wave-description.mjs";
import { LQ01_DEFAULTS } from "../experiments/lq01/definition.ts";
import { decodeLq01Settings, encodeLq01Settings } from "../experiments/lq01/permalink.ts";
import { createLq01Session } from "../experiments/lq01/session.ts";
import { createLq01Host } from "../workers/host/lq01Host.ts";

await generateWaveDescription();
const example = JSON.parse(
  await readFile(new URL("../generated/lq01-example.json", import.meta.url), "utf8"),
);

function session() {
  let creations = 0,
    disposals = 0;
  const app = createLq01Session("prepared", example, () => {
    creations++;
    let send = null;
    const host = createLq01Host(
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

test("prepared LQ-01 data is readable before a worker starts, with identical server/client snapshots", () => {
  const { app, counts } = session();
  assert.equal(counts().creations, 0);
  assert.equal(app.getSnapshot(), app.getServerSnapshot());
  assert.equal(app.getSnapshot().status, "accepted");
  assert.equal(
    app.getSnapshot().accepted.outputs.find((o) => o.quantityId === "centerIntensity").value,
    JSON.parse(example.results.find((r) => r.includes("centerIntensity"))).value,
  );
  app.disconnect();
  assert.equal(counts().disposals, 0);
});

test("parameter edits publish correctly labeled results; invalid edits do not publish", async () => {
  const { app, counts } = session();
  const before = app.getSnapshot();
  assert.equal(app.apply({ ...LQ01_DEFAULTS, r: -1 }).kind, "refused");
  assert.equal(app.getSnapshot(), before);
  app.apply({ ...LQ01_DEFAULTS, delta: Math.PI, A2: 0.5 });
  await settled(app);
  const after = app.getSnapshot().accepted;
  assert.equal(after.parameters.delta, Math.PI);
  assert.equal(after.parameters.A2, 0.5);
  assert.equal(after.snapshotVersion, 2);
  assert.equal(counts().creations, 1);
  app.disconnect();
  assert.equal(counts().disposals, 1);
});

test("sharing uses accepted settings rather than refused or still-requested values", async () => {
  const { app } = session();
  const accepted = app.acceptedParameters();
  const outcome = app.apply({ ...LQ01_DEFAULTS, r: -50 });
  assert.equal(outcome.kind, "refused");
  assert.deepEqual(app.acceptedParameters(), accepted);
  assert.deepEqual(
    decodeLq01Settings(encodeLq01Settings(app.acceptedParameters())).parameters,
    accepted,
  );
  app.disconnect();
});

test("tampered prepared outputs are rejected during initialization", () => {
  const altered = structuredClone(example);
  altered.results[0] = JSON.stringify({ ...JSON.parse(altered.results[0]), unit: "invalid-unit" });
  assert.throws(() =>
    createLq01Session("bad", altered, () => {
      throw new Error("must never run");
    }),
  );
});
