import { BM01_SOURCE_DIGEST } from "../../generated/bm01-provenance.ts";
import { createBm01Host } from "./bm01Host.ts";

const scope = self as unknown as {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
};
// Structured-clone copy transport keeps the cached field owned by the worker.
const host = createBm01Host((message) => scope.postMessage(message), BM01_SOURCE_DIGEST);
scope.addEventListener("message", (event) => {
  void host.receive(event.data).catch((error) => {
    setTimeout(() => {
      throw error;
    }, 0);
  });
});
host.hello();
