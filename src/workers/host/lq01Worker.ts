import { LQ01_SOURCE_DIGEST } from "../../generated/lq01-provenance.ts";
import { createLq01Host } from "./lq01Host.ts";

const scope = self as unknown as {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
};

const host = createLq01Host((message) => scope.postMessage(message), LQ01_SOURCE_DIGEST);
scope.addEventListener("message", (event) => {
  void host.receive(event.data).catch((error) => {
    setTimeout(() => {
      throw error;
    }, 0);
  });
});
host.hello();
