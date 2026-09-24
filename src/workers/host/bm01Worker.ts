import { BM01_SOURCE_DIGEST } from "../../generated/bm01-provenance.ts";
import { frankensimTracerRecorder } from "../wasm/frankensimTracerRecorder.ts";
import { loadPinnedBundle } from "../wasm/pinnedBundle.ts";
import { createBm01Host } from "./bm01Host.ts";

const scope = self as unknown as {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
};
const post = (message: unknown) => scope.postMessage(message);
/**
 * The pinned FrankenSim module records the ensemble when it loads and verifies (digest, link,
 * build_identity). Otherwise the host reference records it, and the page labels it a host
 * calculation, because the snapshot's owner says so. The choice is made once, before the first
 * request, and holds for this worker's lifetime (am-frankensim-repin-and-bind-jvhg).
 * Structured-clone copy transport keeps the cached field owned by the worker.
 */
const host = loadPinnedBundle().then(
  (bundle) =>
    createBm01Host(
      post,
      BM01_SOURCE_DIGEST,
      bundle.kind === "loaded" ? frankensimTracerRecorder(bundle.exports) : undefined,
    ),
  () => createBm01Host(post, BM01_SOURCE_DIGEST),
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
