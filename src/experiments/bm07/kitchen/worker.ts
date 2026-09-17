import { KITCHEN_SOURCE_DIGEST } from "../../../generated/kitchen-provenance.ts";
import { createKitchenHost } from "./host.ts";

const scope = self as unknown as {
  postMessage(message: unknown): void;
  addEventListener(event: "message", fn: (event: MessageEvent<unknown>) => void): void;
};
const host = createKitchenHost((message) => scope.postMessage(message), KITCHEN_SOURCE_DIGEST);
scope.addEventListener("message", (event) => {
  void host.receive(event.data).catch((error) =>
    setTimeout(() => {
      throw error;
    }, 0),
  );
});
