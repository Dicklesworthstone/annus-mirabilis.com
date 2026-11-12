import type { Publication, RequestToken } from "../../experiments/store/instanceStore.ts";
import type { HostProtocol, WorkerChannel } from "./scheduler.ts";

/** Additional owner metadata remains outside the public result store. */
export type VerifiablePublication = Publication & Readonly<{ recordingCheckpoint?: unknown }>;
export type PublicationVerifier = (publication: VerifiablePublication) => Promise<string | null>;

/**
 * Hold a decoded worker result until its request-specific scientific check completes. A failed
 * check reaches the scheduler as an outcome, so it cannot replace the last accepted snapshot.
 * Closing the channel also invalidates checks already awaiting Web Crypto; they never publish
 * into a later connection. Ordinary requests retain the scheduler's synchronous path.
 */
export function createVerifiedWorkerChannel(
  channel: WorkerChannel,
  protocol: HostProtocol,
  sourceDigest: string,
  verifierFor: (token: RequestToken) => PublicationVerifier | undefined,
): WorkerChannel {
  let sent: RequestToken | undefined;
  let closed = false;
  let generation = 0;
  const verifying = new WeakSet<RequestToken>();
  return {
    send(message) {
      if (
        message &&
        typeof message === "object" &&
        "messageKind" in message &&
        message.messageKind === "request" &&
        "token" in message
      )
        sent = message.token as RequestToken;
      channel.send(message);
    },
    listen(onMessage, onError) {
      const current = ++generation;
      const deliver = (message: unknown) => {
        if (!closed && generation === current) onMessage(message);
      };
      const unsubscribe = channel.listen((message) => {
        const token = sent;
        const verify = token && verifierFor(token);
        if (!token || !verify) {
          deliver(message);
          return;
        }
        let response: ReturnType<HostProtocol["decodeResponse"]>;
        try {
          response = protocol.decodeResponse(message, token, sourceDigest);
        } catch {
          // The scheduler remains the owner of protocol/transport failure classification.
          deliver(message);
          return;
        }
        if (response.result.kind !== "accepted") {
          deliver(message);
          return;
        }
        // One request has one final result. An overlapping duplicate must not replace the
        // checkpoint candidate while the first valid publication is awaiting verification.
        if (verifying.has(token)) return;
        verifying.add(token);
        // Forward the same validated copy we hash, not a transport object that could be mutated
        // while the asynchronous verifier is running.
        const envelope = {
          messageKind: "result",
          protocolVersion: protocol.version,
          sourceDigest,
          ...response,
        };
        const publication = { ...response.token, ...response.result.data, final: true };
        const finish = (notice: string | null) =>
          deliver(
            notice === null
              ? envelope
              : {
                  ...envelope,
                  result: {
                    kind: "outcome",
                    outcome: {
                      outcome: "invariant-violation",
                      ...executionOutcomeRegistry["invariant-violation"],
                      details: { checkpointNotice: notice },
                    },
                  },
                },
          );
        void Promise.resolve()
          .then(() => verify(publication))
          .then(finish)
          .catch(() => finish("The recorded scientific checkpoint could not be verified."));
      }, onError);
      return () => {
        generation++;
        unsubscribe();
      };
    },
    dispose() {
      closed = true;
      generation++;
      channel.dispose();
    },
  };
}

import { executionOutcomeRegistry } from "../../experiments/results/outcomes.ts";
