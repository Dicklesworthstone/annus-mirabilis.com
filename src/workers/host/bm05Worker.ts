import { BM05_SOURCE_DIGEST } from "../../generated/bm05-provenance.ts";
import { createBm05Host } from "./bm05Host.ts";

const scope = self as unknown as {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
};
// Structured-clone copy transport keeps the cached field owned by the worker.
const host = createBm05Host((message) => scope.postMessage(message), BM05_SOURCE_DIGEST);
scope.addEventListener("message", (event) => {
  void host.receive(event.data).catch((error) => {
    setTimeout(() => {
      throw error;
    }, 0);
  });
});
host.hello();
