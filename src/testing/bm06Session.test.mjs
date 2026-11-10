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
test("copying D from a named BM-01 instance records source identity and is never a live subscription", async () => {
  const { app } = session();
  const source = {
    instanceId: "bm01-tracer-a",
    runId: "run-1905-1",
    snapshotVersion: 3,
    value: 7e-13,
  };
  const outcome = app.copyDiffusivityFrom(source);
  assert.equal(outcome.kind, "accepted");
  await settled(app);
  const accepted = app.getSnapshot().accepted;
  assert.equal(accepted.parameters.copiedDiffusivityInstanceId, "bm01-tracer-a");
  assert.equal(accepted.parameters.copiedDiffusivityRunId, "run-1905-1");
  assert.equal(accepted.parameters.copiedDiffusivitySnapshotVersion, 3);
  assert.equal(accepted.parameters.copiedDiffusivityValue, 7e-13);
  assert.equal(
    accepted.outputs.find((o) => o.quantityId === "activeDiffusionCoefficient").value,
    7e-13,
  );
  // Mutating the source object after copying must not reach back into the accepted snapshot:
  // the copy is a one-time value read, never a live subscription to BM-01's own state.
  source.value = 9e-9;
  source.instanceId = "mutated-after-the-fact";
  assert.equal(app.getSnapshot().accepted.parameters.copiedDiffusivityValue, 7e-13);
  assert.equal(app.getSnapshot().accepted.parameters.copiedDiffusivityInstanceId, "bm01-tracer-a");
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
    `${link}&T=300`,
    `${link}&rogue=1`,
    link.replace("bm=2", "bm=3"),
    link.replace("T=293.15", "T=Infinity"),
    link.replace("T=293.15", "T=1e400"),
    link.replace("gridEnabled=0", "gridEnabled=false"),
    `?${"a".repeat(2100)}`,
  ])
    assert.equal(decodeBm06Settings(bad).kind, "invalid");
});
test("changing the initial distribution creates a new run; refused settings preserve and share the accepted profile", async () => {
  const { app } = session();
  const two = { ...BM06_DEFAULTS, gridEnabled: true, gridProfile: "two-spikes" };
  app.apply(two);
  await settled(app);
  const first = app.getSnapshot().accepted;
  assert.equal(first.parameters.gridProfile, "two-spikes");
  app.apply({ ...two, gridProfile: "step" });
  await settled(app);
  const step = app.getSnapshot().accepted;
  assert.notEqual(step.runId, first.runId);
  assert.equal(step.parameters.gridProfile, "step");
  assert.equal(
    step.outputs.find((o) => o.quantityId === "cellProbabilities").status,
    "not-applicable",
  );
  app.apply({ ...two, steps: 1 });
  await settled(app);
  assert.equal(app.getSnapshot().status, "refused");
  assert.equal(app.getSnapshot().accepted, step);
  assert.equal(app.acceptedParameters().gridProfile, "step");
  const shared = decodeBm06Settings(encodeBm06Settings(app.acceptedParameters()));
  assert.equal(shared.kind, "settings");
  assert.equal(shared.parameters.gridProfile, "step");
  const beforeInvalid = app.getSnapshot();
  assert.equal(app.apply({ ...two, gridProfile: "unknown" }).kind, "refused");
  assert.equal(app.getSnapshot(), beforeInvalid);
  app.disconnect();
});
test("a copied diffusivity stays active when the worker remeasures an interval", async () => {
  const { app } = session();
  app.copyDiffusivityFrom({
    instanceId: "bm01-copy",
    runId: "source-run",
    snapshotVersion: 1,
    value: 8e-13,
  });
  await settled(app);
  const copied = app.acceptedParameters();
  app.apply({ ...copied, lower: 0, upper: 0.5e-6 });
  await settled(app);
  const remeasured = app.getSnapshot().accepted;
  const probability = remeasured.outputs.find((o) => o.quantityId === "intervalProbability").value;
  // A fresh session cannot use the host's interval cache; it must produce the same probability.
  const fresh = session().app;
  fresh.apply({ ...copied, lower: 0, upper: 0.5e-6 });
  await settled(fresh);
  assert.equal(
    probability,
    fresh.getSnapshot().accepted.outputs.find((o) => o.quantityId === "intervalProbability").value,
  );
  assert.equal(
    remeasured.outputs.find((o) => o.quantityId === "activeDiffusionCoefficient").value,
    8e-13,
  );
  app.disconnect();
  fresh.disconnect();
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
test("a prepared JSON profile is validated before it can become an accepted snapshot (session.ts:31)", () => {
  for (const gridProfile of ["unknown", "0", 0, undefined]) {
    const altered = { ...example, parameters: { ...example.parameters, gridProfile } };
    assert.throws(
      () =>
        createBm06Session("invalid-profile", altered, () => {
          throw new Error("must never start a worker");
        }),
      {
        name: "LabProtocolError",
        code: "malformed-response",
        message: "Invalid prepared laboratory settings.",
      },
    );
  }
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
