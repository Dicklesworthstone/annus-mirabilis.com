import { BM06_SOURCE_DIGEST } from "../../generated/bm06-provenance.ts";
import { createBm06Host } from "./bm06Host.ts";

const scope = self as unknown as {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
};
// Structured-clone copy transport keeps the cached field owned by the worker.
const host = createBm06Host((message) => scope.postMessage(message), BM06_SOURCE_DIGEST);
scope.addEventListener("message", (event) => {
  void host.receive(event.data).catch((error) => {
    setTimeout(() => {
      throw error;
    }, 0);
  });
});
host.hello();
