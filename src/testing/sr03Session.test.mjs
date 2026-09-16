import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateSr03 } from "../../scripts/generate-sr03.mjs";
import { SR03_DEFAULTS } from "../experiments/sr03/definition.ts";
import { decodeSr03Settings, encodeSr03Settings } from "../experiments/sr03/permalink.ts";
import { createSr03Session } from "../experiments/sr03/session.ts";
import { createSr03Host } from "../workers/host/sr03Host.ts";

await generateSr03();
const example = JSON.parse(
  await readFile(new URL("../generated/sr03-example.json", import.meta.url), "utf8"),
);

function session() {
  let creations = 0;
  let disposals = 0;
  const app = createSr03Session("prepared", example, () => {
    creations++;
    let send = null;
    const host = createSr03Host(
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

test("prepared SR-03 data is readable before a worker starts, with identical server/client snapshots", () => {
  const { app, counts } = session();
  assert.equal(counts().creations, 0);
  assert.equal(app.getSnapshot(), app.getServerSnapshot());
  assert.equal(app.getSnapshot().status, "accepted");
  assert.equal(
    app.getSnapshot().accepted.outputs.find((o) => o.quantityId === "gammaFactor").value,
    1.25,
  );
  app.disconnect();
  assert.equal(counts().disposals, 0);
});

test("parameter edits publish correctly labeled results; invalid edits do not publish", async () => {
  const { app, counts } = session();
  const before = app.getSnapshot();
  assert.equal(app.apply({ ...SR03_DEFAULTS, v: 0.99 }).kind, "refused");
  assert.equal(app.getSnapshot(), before);
  app.apply({ ...SR03_DEFAULTS, v: 0.8, L0: 20 });
  await settled(app);
  const after = app.getSnapshot().accepted;
  assert.equal(after.parameters.v, 0.8);
  assert.equal(after.parameters.L0, 20);
  assert.equal(after.snapshotVersion, 2);
  assert.equal(counts().creations, 1);
  app.disconnect();
  assert.equal(counts().disposals, 1);
});

test("sharing uses accepted settings rather than refused values", async () => {
  const { app } = session();
  const accepted = app.acceptedParameters();
  const res = app.apply({ ...SR03_DEFAULTS, v: 0.98 });
  assert.equal(res.kind, "refused");
  assert.deepEqual(app.acceptedParameters(), accepted);
  assert.deepEqual(
    decodeSr03Settings(encodeSr03Settings(app.acceptedParameters())).parameters,
    accepted,
  );
  app.disconnect();
});

test("tampered prepared outputs are rejected during initialization", () => {
  const altered = structuredClone(example);
  altered.results[0] = JSON.stringify({ ...JSON.parse(altered.results[0]), unit: "invalid-unit" });
  assert.throws(() =>
    createSr03Session("bad", altered, () => {
      throw new Error("must never run");
    }),
  );
});
