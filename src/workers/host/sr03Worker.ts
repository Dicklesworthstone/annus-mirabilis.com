import { SR03_SOURCE_DIGEST } from "../../generated/sr03-provenance.ts";
import { createSr03Host } from "./sr03Host.ts";

const scope = self as unknown as {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
};

const host = createSr03Host((message) => scope.postMessage(message), SR03_SOURCE_DIGEST);
scope.addEventListener("message", (event) => {
  void host.receive(event.data).catch((error) => {
    setTimeout(() => {
      throw error;
    }, 0);
  });
});
host.hello();
