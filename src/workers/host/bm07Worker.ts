import { createBm07Host } from "./bm07Host.ts";
import { BM07_SOURCE_DIGEST } from "../../generated/bm07-provenance.ts";
const scope = self as unknown as {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
};
// Structured-clone copy transport keeps the cached field owned by the worker.
const host = createBm07Host(message => scope.postMessage(message), BM07_SOURCE_DIGEST);
scope.addEventListener("message", event => {
  void host.receive(event.data).catch(error => { setTimeout(() => { throw error; }, 0); });
});
host.hello();
