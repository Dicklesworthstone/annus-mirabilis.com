import { BM05_SOURCE_DIGEST } from "../../generated/bm05-provenance.ts";
import { frankensimWalkNormals } from "../wasm/frankensimWalkNormals.ts";
import { loadPinnedBundle } from "../wasm/pinnedBundle.ts";
import { createBm05Host } from "./bm05Host.ts";

const scope = self as unknown as {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
};
const post = (message: unknown) => scope.postMessage(message);
/**
 * The pinned FrankenSim module draws a Gaussian walk's normals when it loads and verifies (digest,
 * link, build_identity). Otherwise this reference's Philox stream draws them, and the page labels
 * the walk a host calculation, because the snapshot's owner says so. The choice is made once,
 * before the first request, and holds for this worker's lifetime (dispatch 269). The worker
 * itself starts only after a reader applies settings, so no reader downloads the module by
 * arriving. Structured-clone copy transport keeps the cached field owned by the worker.
 */
const host = loadPinnedBundle().then(
  (bundle) =>
    createBm05Host(
      post,
      BM05_SOURCE_DIGEST,
      bundle.kind === "loaded" ? frankensimWalkNormals(bundle.exports) : undefined,
    ),
  () => createBm05Host(post, BM05_SOURCE_DIGEST),
);
// Registered synchronously, so no message can arrive before a listener exists. Each message
// waits on the same promise, so arrival order is kept.
scope.addEventListener("message", (event) => {
  void host
    .then((h) => h.receive(event.data))
    .catch((error) => {
      setTimeout(() => {
        throw error;
      }, 0);
    });
});
void host.then((h) => h.hello());
