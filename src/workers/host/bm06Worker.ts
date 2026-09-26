import { BM06_SOURCE_DIGEST } from "../../generated/bm06-provenance.ts";
import { frankensimGridStepper } from "../wasm/frankensimFtcsGrid.ts";
import { loadPinnedBundle } from "../wasm/pinnedBundle.ts";
import { createBm06Host } from "./bm06Host.ts";

const scope = self as unknown as {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
};
const post = (message: unknown) => scope.postMessage(message);
/**
 * The pinned FrankenSim module steps the optional grid when it loads and verifies (digest, link,
 * build_identity). Otherwise the host reference steps it, and the page labels the grid a host
 * calculation, because the snapshot's owner says so. The choice is made once, before the first
 * request, and holds for this worker's lifetime (am-frankensim-repin-and-bind-jvhg). The worker
 * itself starts only after a reader applies settings (bm06/browser.ts), so no reader downloads
 * the module by arriving. Structured-clone copy transport keeps the cached field owned by the
 * worker.
 */
const host = loadPinnedBundle().then(
  (bundle) =>
    createBm06Host(
      post,
      BM06_SOURCE_DIGEST,
      bundle.kind === "loaded" ? frankensimGridStepper(bundle.exports) : undefined,
    ),
  () => createBm06Host(post, BM06_SOURCE_DIGEST),
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
