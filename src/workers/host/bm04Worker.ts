import { BM04_SOURCE_DIGEST } from "../../generated/bm04-provenance.ts";
import { createBm04Host } from "./bm04Host.ts";

const scope = self as unknown as {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
};

const host = createBm04Host((message) => scope.postMessage(message), BM04_SOURCE_DIGEST);
scope.addEventListener("message", (event) => {
  void host.receive(event.data).catch((error) => {
    setTimeout(() => {
      throw error;
    }, 0);
  });
});
host.hello();
