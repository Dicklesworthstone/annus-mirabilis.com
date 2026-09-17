import { analyzeKitchen } from "./analyze.ts";
import { parseKitchenCsv } from "./csv.ts";
import {
  decodeKitchenRequest,
  KITCHEN_PROTOCOL,
  type KitchenResponse,
  optionsFromToken,
} from "./protocol.ts";
import type { KitchenDocument } from "./schema.ts";
/** Dedicated local owner. One bounded document cache; no network or persistent storage. */
export function createKitchenHost(send: (message: KitchenResponse) => void, sourceDigest: string) {
  let cache: { digest: string; csv: string; document: KitchenDocument } | null = null;
  let instance: string | null = null,
    disposed = false;
  return {
    async receive(input: unknown) {
      const request = await decodeKitchenRequest(input, sourceDigest);
      if (disposed) return;
      if (instance !== null && instance !== request.token.instanceId)
        throw new TypeError("A local observation owner cannot serve another instance.");
      instance = request.token.instanceId;
      let result: KitchenResponse["result"];
      try {
        const same =
          cache !== null &&
          cache.digest === request.token.parameters.documentDigest &&
          cache.csv === request.csv;
        const document = same ? cache!.document : parseKitchenCsv(request.csv);
        const analysis = analyzeKitchen(document, optionsFromToken(request.token));
        cache = {
          digest: String(request.token.parameters.documentDigest),
          csv: request.csv,
          document,
        };
        result = { kind: "accepted", analysis };
      } catch (error) {
        result = {
          kind: "refused",
          message:
            error instanceof Error ? error.message : "The observation file could not be analyzed.",
        };
      }
      if (!disposed)
        send({ version: KITCHEN_PROTOCOL, sourceDigest, token: request.token, result });
    },
    dispose() {
      disposed = true;
      cache = null;
    },
  };
}
