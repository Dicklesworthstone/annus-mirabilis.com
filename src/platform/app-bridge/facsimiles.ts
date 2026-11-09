import { BRIDGE_VERSION, MESSAGE_HANDLER_NAME } from "./schemas.ts";

export const FACSIMILE_UPDATED_EVENT = "am-app:facsimile.updated";
export const FACSIMILE_STATES = [
  "not-downloaded",
  "downloading",
  "verified",
  "failed",
  "evicted",
  "unavailable",
] as const;
export type NativeFacsimileState = (typeof FACSIMILE_STATES)[number];
export interface NativeFacsimileStatus {
  readonly key: string;
  readonly state: NativeFacsimileState;
  readonly bytesExpected: number;
  readonly bytesReceived: number;
  readonly progress: number;
  readonly reason?: string;
  readonly path?: string;
}
export interface FacsimileIdentity {
  readonly key: string;
  readonly pdfUrl: string;
}
export interface NativeFacsimileClient {
  readonly status: () => Promise<NativeFacsimileStatus | null>;
  readonly request: () => Promise<NativeFacsimileStatus | null>;
}
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const bytes = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** Native owns the byte verification. The page still refuses another document's state or URL. */
export function parseNativeFacsimileStatus(
  value: unknown,
  identity: FacsimileIdentity,
): NativeFacsimileStatus | null {
  if (
    !record(value) ||
    value.key !== identity.key ||
    !FACSIMILE_STATES.includes(value.state as NativeFacsimileState) ||
    !bytes(value.bytesExpected) ||
    !bytes(value.bytesReceived) ||
    typeof value.progress !== "number" ||
    !Number.isFinite(value.progress) ||
    value.progress < 0 ||
    value.progress > 1 ||
    (value.reason !== undefined &&
      (typeof value.reason !== "string" || value.reason.length > 1024)) ||
    (value.path !== undefined && value.path !== identity.pdfUrl)
  )
    return null;
  if (
    value.state === "verified" &&
    (value.path !== identity.pdfUrl ||
      value.bytesExpected < 5 ||
      value.bytesReceived !== value.bytesExpected ||
      value.progress !== 1)
  )
    return null;
  if (value.state !== "verified" && value.path !== undefined) return null;
  if (value.state !== "unavailable" && value.bytesExpected < 5) return null;
  return {
    key: identity.key,
    state: value.state as NativeFacsimileState,
    bytesExpected: value.bytesExpected,
    bytesReceived: value.bytesReceived,
    progress: value.progress,
    ...(typeof value.reason === "string" ? { reason: value.reason } : {}),
    ...(typeof value.path === "string" ? { path: value.path } : {}),
  };
}

/** Read-only status on mount; only an explicit reader action calls request(). */
export function nativeFacsimileClient(
  window: Window,
  identity: FacsimileIdentity,
): NativeFacsimileClient | null {
  const host = window as unknown as {
    __AM_APP__?: { bridgeVersion?: unknown };
    webkit?: { messageHandlers?: Record<string, { postMessage?: unknown }> };
  };
  if (host.__AM_APP__?.bridgeVersion !== BRIDGE_VERSION) return null;
  const handler = host.webkit?.messageHandlers?.[MESSAGE_HANDLER_NAME];
  if (!handler || typeof handler.postMessage !== "function") return null;
  const post = handler.postMessage as (message: unknown) => unknown;
  const send = async (type: "facsimile.status" | "facsimile.request") => {
    let timer: number | undefined;
    try {
      const reply: unknown = await Promise.race([
        Promise.resolve(
          post.call(handler, { v: BRIDGE_VERSION, type, body: { key: identity.key } }),
        ),
        new Promise<null>((resolve) => {
          timer = window.setTimeout(() => resolve(null), 12_000);
        }),
      ]);
      if (!record(reply)) return null;
      if (reply.status === "unavailable" || reply.status === "missing")
        return {
          key: identity.key,
          state: "unavailable" as const,
          bytesExpected: 0,
          bytesReceived: 0,
          progress: 0,
          reason: "This edition does not offer a downloadable PDF for this source.",
        };
      return reply.status === "ok" ? parseNativeFacsimileStatus(reply.value, identity) : null;
    } catch {
      return null;
    } finally {
      if (timer !== undefined) window.clearTimeout(timer);
    }
  };
  return { status: () => send("facsimile.status"), request: () => send("facsimile.request") };
}
