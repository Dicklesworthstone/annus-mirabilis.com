import type { RequestToken } from "../../../experiments/store/instanceStore.ts";
import type { Computation } from "../../../physics/reference/diffusion/ftcs.ts";
import type { HostProtocol } from "../../../workers/scheduler/scheduler.ts";
import { RUNTIME_FIXTURE_PROTOCOL, RUNTIME_FIXTURE_SOURCE_DIGEST } from "./protocol.ts";

function mismatch(message: string): never {
  const error = new Error(message) as Error & { code: string };
  error.code = "protocol-mismatch";
  throw error;
}

export function runtimeHostProtocol(): HostProtocol {
  return {
    version: RUNTIME_FIXTURE_PROTOCOL,
    decodeHello(message: unknown, digest: string): unknown {
      if (!message || typeof message !== "object") mismatch("hello was not an object");
      const record = message as Record<string, unknown>;
      if (record.messageKind !== "hello") mismatch("expected hello");
      if (record.protocolVersion !== RUNTIME_FIXTURE_PROTOCOL) mismatch("protocol-mismatch");
      if (record.sourceDigest !== digest) mismatch("source digest mismatch");
      return record;
    },
    decodeResponse(message: unknown, token: RequestToken, digest: string) {
      if (!message || typeof message !== "object") mismatch("result was not an object");
      const record = message as Record<string, unknown>;
      if (record.protocolVersion !== RUNTIME_FIXTURE_PROTOCOL) mismatch("protocol-mismatch");
      if (record.sourceDigest !== digest && record.sourceDigest !== RUNTIME_FIXTURE_SOURCE_DIGEST) {
        mismatch("source digest mismatch");
      }
      if (record.messageKind !== "result") mismatch("expected result");
      return {
        token: (record.token as RequestToken | undefined) ?? token,
        result: record.result as Computation<{
          outputs: readonly {
            status: "value";
            quantityId: string;
            unit: string;
            semanticKind: string;
            ownerId: string;
            value: number;
          }[];
          stepIndex: number;
          simulationTime: number;
        }>,
      };
    },
  };
}
