// Node twin of src/workers/host/bm01Worker.ts (am-frankensim-repin-and-bind-jvhg): same
// order, with the pinned module read from disk instead of fetched. workerData.wasmPath
// names the bytes to load; a wrong or tampered file makes the loader refuse, and the host
// recorder takes over, exactly as in the browser.
import { readFile } from "node:fs/promises";
import { parentPort, workerData } from "node:worker_threads";
import { createBm01Host } from "../../workers/host/bm01Host.ts";
import { frankensimTracerRecorder } from "../../workers/wasm/frankensimTracerRecorder.ts";
import { loadPinnedBundle } from "../../workers/wasm/pinnedBundle.ts";

const post = (message) => parentPort.postMessage(message);
const host = loadPinnedBundle({ wasmUrl: workerData.wasmPath, readBytes: (p) => readFile(p) }).then(
  (bundle) => {
    parentPort.postMessage({ fixtureBundle: bundle.kind, outcome: bundle.outcome ?? null });
    return createBm01Host(
      post,
      workerData.digest,
      bundle.kind === "loaded" ? frankensimTracerRecorder(bundle.exports) : undefined,
    );
  },
);
parentPort.on("message", (message) => {
  void host
    .then((h) => h.receive(message))
    .catch((error) => {
      setTimeout(() => {
        throw error;
      }, 0);
    });
});
void host.then((h) => h.hello());
