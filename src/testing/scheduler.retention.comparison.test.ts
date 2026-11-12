import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { PreparedBm01Comparison } from "../experiments/bm01/comparison.ts";
import { createBm01ComparisonSession } from "../experiments/bm01/comparisonSession.ts";
import { createBm08ComparisonSession } from "../experiments/bm08/comparisonSession.ts";
import { createBm08Session, type PreparedBm08Example } from "../experiments/bm08/session.ts";
import preparedBm01 from "../generated/bm01-comparison.json";
import preparedBm08 from "../generated/bm08-example.json";
import { createBm01Host } from "../workers/host/bm01Host.ts";
import { createBm08Host } from "../workers/host/bm08Host.ts";
import type { WorkerChannel } from "../workers/scheduler/scheduler.ts";

const cameraExample = preparedBm08 as PreparedBm08Example;
async function until(condition: () => boolean) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.ok(condition(), "The comparison owner did not settle.");
}

function channelFactory(
  createHost: (send: (message: unknown) => void) => Readonly<{
    hello(): void;
    receive(message: unknown): Promise<void>;
    dispose(): void;
  }>,
) {
  const workers: { disposed: boolean }[] = [];
  const factory = (): WorkerChannel => {
    const worker = { disposed: false };
    let receive: ((message: unknown) => void) | undefined;
    let failed: (() => void) | undefined;
    const host = createHost((message) => {
      if (!worker.disposed) receive?.(structuredClone(message));
    });
    workers.push(worker);
    return {
      listen(onMessage, onError) {
        receive = onMessage;
        failed = onError;
        queueMicrotask(() => host.hello());
        return () => {
          receive = undefined;
          failed = undefined;
        };
      },
      send(message) {
        void host.receive(structuredClone(message)).catch(() => failed?.());
      },
      dispose() {
        worker.disposed = true;
        host.dispose();
      },
    };
  };
  return { factory, workers };
}

/** Ordinary completed laboratories really fill the production device pool; no fake pool entries. */
async function fillIdlePool(t: TestContext, label: string) {
  const channels: ReturnType<typeof channelFactory>[] = [];
  for (let index = 0; index < 3; index++) {
    const channel = channelFactory((send) => createBm08Host(send, cameraExample.sourceDigest));
    channels.push(channel);
    const peer = createBm08Session(label + "-peer-" + index, cameraExample, channel.factory);
    t.after(() => peer.disconnect());
    peer.apply({
      ...cameraExample.parameters,
      seed: String(9007199254740993n + BigInt(index)),
      M: 6,
      clicks: 5,
      coverageTrials: 0,
    });
    await until(() => !peer.getSnapshot().pending);
    assert.equal(peer.getSnapshot().status, "accepted");
  }
  assert.equal(
    channels[0]?.workers[0]?.disposed,
    true,
    "Peer pressure must actually reclaim an idle owner.",
  );
}

for (const owner of ["bm01", "bm08"] as const) {
  test(
    owner + " controlled comparisons retain the warm recording their scientific contract requires",
    async (t) => {
      const tracerExample = preparedBm01 as PreparedBm01Comparison;
      const channel = channelFactory(
        owner === "bm01"
          ? (send) => createBm01Host(send, tracerExample.baseline.sourceDigest)
          : (send) => createBm08Host(send, cameraExample.sourceDigest),
      );
      const comparison =
        owner === "bm01"
          ? createBm01ComparisonSession("retention-bm01-comparison", tracerExample, channel.factory)
          : createBm08ComparisonSession(
              "retention-bm08-comparison",
              cameraExample,
              channel.factory,
            );
      t.after(() => comparison.disconnect());
      comparison.connect();
      assert.equal(comparison.start(), true);
      await until(() => !comparison.getSnapshot().pending);
      assert.equal(comparison.getSnapshot().phase, "live");
      assert.equal(comparison.getSnapshot().error, "");
      const baseline = comparison.getSnapshot().baselineSnapshot;

      await fillIdlePool(t, owner);
      assert.equal(
        channel.workers[0]?.disposed,
        false,
        "A declared warm-reuse owner remains pinned.",
      );
      assert.equal(
        comparison.apply({
          ...baseline.parameters,
          ...(owner === "bm01" ? { interval: 2 } : { exposure: 0 }),
        }),
        true,
      );
      await until(() => !comparison.getSnapshot().pending);
      const accepted = comparison.getSnapshot();
      assert.equal(accepted.error, "");
      assert.equal(accepted.result.kind, "accepted");
      assert.equal(accepted.variantSnapshot.runId, baseline.runId);
      assert.equal(channel.workers.length, 1);
      const reused = accepted.variantSnapshot.outputs.find(
        (output) => output.quantityId === "reusedRecording",
      );
      assert.equal(reused?.status === "value" ? reused.value : undefined, 1);
    },
  );
}
