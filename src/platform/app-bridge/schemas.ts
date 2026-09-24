/**
 * The native-edition bridge, version 1 (App plan §7; bead am-app-bridge-protocol-ai2g).
 *
 * One closed schema per message, checked the same way on both sides: the iPhone
 * app decodes the same golden fixtures and must reach the same verdict. Nothing
 * in the website imports this module. It is used by the app's document-start
 * user script (userScripts.ts) and by the app's tests, so the website's routes,
 * bundles and behaviour are unchanged.
 *
 * Hand-written validators, not zod: zod is not a dependency of this repository,
 * and a closed record check is short enough to read in full.
 */

export const BRIDGE_VERSION = 1;

/** `window.webkit.messageHandlers.<name>` that the app registers. */
export const MESSAGE_HANDLER_NAME = "amEdition";

/** Bodies over this are refused before they are parsed further. */
export const MAX_MESSAGE_BYTES = 256 * 1024;

/** Per message type, per second. */
export const RATE_LIMIT_PER_SECOND = 50;

/**
 * The longest shareable URL, tape permalink included. Equal to
 * MAX_PERMALINK_URL_LENGTH in src/experiments/permalink/codec.ts, which a test
 * asserts; not imported, because that module pulls in node:zlib.
 */
export const MAX_SHARE_URL_LENGTH = 2048;

export const SITE_ORIGIN = "https://annus-mirabilis.com";

export const EDITION_MESSAGE_TYPES = [
  "hello",
  "storage.read",
  "storage.write",
  "storage.list",
  "storage.clear",
  "storage.export",
  "settings.changed",
  "route.changed",
  "share.request",
  "external.open",
  "facsimile.status",
  "facsimile.request",
  "print.request",
  "test.log",
  "test.snapshot",
] as const;

export type EditionMessageType = (typeof EDITION_MESSAGE_TYPES)[number];

/** Handled only by DEBUG and test builds of the app; a release build rejects them as unknown. */
export const TEST_ONLY_MESSAGE_TYPES: readonly EditionMessageType[] = ["test.log", "test.snapshot"];

/** The only events native may send into the page, through `__AM_APP__.dispatch`. */
export const NATIVE_EVENT_NAMES = [
  "settings.changed",
  "lifecycle.memoryWarning",
  "lifecycle.thermalState",
  "lifecycle.visibility",
  "facsimile.updated",
] as const;

export type NativeEventName = (typeof NATIVE_EVENT_NAMES)[number];

export type RejectionCode =
  | "not-an-object"
  | "unknown-version"
  | "unknown-type"
  | "unknown-field"
  | "missing-field"
  | "wrong-type"
  | "oversized"
  | "bad-url"
  | "rate-limited";

/** Replies are results, never exceptions, so no bridge failure throws into rendering code. */
export type BridgeResult<T = unknown> =
  | { readonly status: "ok"; readonly value?: T }
  | { readonly status: "missing" }
  | { readonly status: "unavailable" }
  | { readonly status: "corrupt" }
  | { readonly status: "quota" }
  | { readonly status: "rejected"; readonly reason: RejectionCode };

type FieldKind = "string" | "boolean" | "number" | "string|null";

type FieldSpec = {
  readonly kind: FieldKind;
  readonly optional?: boolean;
  readonly maxLength?: number;
};

const KEY = { kind: "string", maxLength: 256 } as const satisfies FieldSpec;

/** Each body's exact fields. A field not listed is refused, so the schema is closed. */
const BODIES: Readonly<Record<EditionMessageType, Readonly<Record<string, FieldSpec>>>> = {
  hello: {},
  "storage.read": { namespace: KEY, key: KEY },
  "storage.write": {
    namespace: KEY,
    key: KEY,
    value: { kind: "string", maxLength: MAX_MESSAGE_BYTES },
  },
  "storage.list": { namespace: KEY },
  "storage.clear": { namespace: KEY },
  "storage.export": { namespace: { ...KEY, optional: true } },
  "settings.changed": {
    theme: { kind: "string", optional: true, maxLength: 64 },
    detail: { kind: "string", optional: true, maxLength: 64 },
    perspective: { kind: "string", optional: true, maxLength: 64 },
    notation: { kind: "string", optional: true, maxLength: 64 },
    readingOnly: { kind: "boolean", optional: true },
    typeSize: { kind: "number", optional: true },
  },
  "route.changed": {
    route: { kind: "string", maxLength: MAX_SHARE_URL_LENGTH },
    anchor: { kind: "string|null", maxLength: 256 },
    title: { kind: "string", maxLength: 512 },
  },
  "share.request": { url: { kind: "string", maxLength: MAX_SHARE_URL_LENGTH } },
  "external.open": { url: { kind: "string", maxLength: MAX_SHARE_URL_LENGTH } },
  "facsimile.status": { key: { kind: "string", maxLength: 32 } },
  "facsimile.request": { key: { kind: "string", maxLength: 32 } },
  "print.request": {},
  "test.log": {
    level: { kind: "string", maxLength: 8 },
    message: { kind: "string", maxLength: 8192 },
  },
  "test.snapshot": { route: { kind: "string", maxLength: MAX_SHARE_URL_LENGTH } },
};

export type EditionMessage = {
  readonly v: typeof BRIDGE_VERSION;
  readonly type: EditionMessageType;
  readonly body: Readonly<Record<string, unknown>>;
};

export type Verdict =
  | { readonly ok: true; readonly message: EditionMessage }
  | { readonly ok: false; readonly reason: RejectionCode; readonly detail: string };

function reject(reason: RejectionCode, detail: string): Verdict {
  return { ok: false, reason, detail };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** A canonical page of the website: https, this host, a path, nothing else in the authority. */
export function isCanonicalSiteURL(text: string): boolean {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.host === "annus-mirabilis.com" &&
    url.username === "" &&
    url.password === "" &&
    url.pathname.startsWith("/") &&
    text.length <= MAX_SHARE_URL_LENGTH
  );
}

/** An address to open outside the reader: https with a host, never javascript:, data: or file:. */
export function isExternalURL(text: string): boolean {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" && url.hostname !== "" && url.username === "" && url.password === ""
  );
}

const FACSIMILE_KEY = /^ap-\d{2}-\d{1,4}$/;

/**
 * Validates one message from the page. The verdict names the first problem
 * found; the app logs it in test builds and replies `rejected` with the reason.
 */
export function validateEditionMessage(raw: unknown): Verdict {
  let serialized: string;
  try {
    serialized = JSON.stringify(raw) ?? "";
  } catch {
    return reject("not-an-object", "the message does not serialize");
  }
  if (utf8Length(serialized) > MAX_MESSAGE_BYTES) {
    return reject("oversized", `the message is over ${MAX_MESSAGE_BYTES} bytes`);
  }
  if (!isPlainObject(raw)) {
    return reject("not-an-object", "the message is not an object");
  }
  for (const key of Object.keys(raw)) {
    if (key !== "v" && key !== "type" && key !== "body") {
      return reject("unknown-field", `envelope field '${key}'`);
    }
  }
  if (raw.v !== BRIDGE_VERSION) {
    return reject("unknown-version", `version ${String(raw.v)}`);
  }
  const type = raw.type;
  if (typeof type !== "string" || !(EDITION_MESSAGE_TYPES as readonly string[]).includes(type)) {
    return reject("unknown-type", `type ${String(type)}`);
  }
  const body = raw.body;
  if (!isPlainObject(body)) {
    return reject("wrong-type", "body is not an object");
  }
  const spec = BODIES[type as EditionMessageType];
  for (const key of Object.keys(body)) {
    if (!(key in spec)) {
      return reject("unknown-field", `${type}.${key}`);
    }
  }
  for (const [field, rule] of Object.entries(spec)) {
    const value = body[field];
    if (value === undefined) {
      if (rule.optional === true) {
        continue;
      }
      return reject("missing-field", `${type}.${field}`);
    }
    const kindOk =
      rule.kind === "string|null"
        ? value === null || typeof value === "string"
        : rule.kind === "number"
          ? typeof value === "number" && Number.isFinite(value)
          : typeof value === rule.kind;
    if (!kindOk) {
      return reject("wrong-type", `${type}.${field} must be ${rule.kind}`);
    }
    if (
      typeof value === "string" &&
      rule.maxLength !== undefined &&
      value.length > rule.maxLength
    ) {
      return reject("oversized", `${type}.${field} is over ${rule.maxLength} characters`);
    }
  }
  if (type === "route.changed" && !(body.route as string).startsWith("/")) {
    return reject("bad-url", "route.changed.route must start with /");
  }
  if (type === "share.request" && !isCanonicalSiteURL(body.url as string)) {
    return reject("bad-url", "share.request.url must be a page of https://annus-mirabilis.com");
  }
  if (type === "external.open" && !isExternalURL(body.url as string)) {
    return reject("bad-url", "external.open.url must be https with a host");
  }
  if (
    (type === "facsimile.status" || type === "facsimile.request") &&
    !FACSIMILE_KEY.test(body.key as string)
  ) {
    return reject("wrong-type", `${type}.key must be a bibliographic key like ap-17-549`);
  }
  if (type === "test.log" && !["log", "warn", "error"].includes(body.level as string)) {
    return reject("wrong-type", "test.log.level must be log, warn or error");
  }
  return { ok: true, message: { v: BRIDGE_VERSION, type: type as EditionMessageType, body } };
}

/**
 * A per-type limiter over a sliding one-second window. `now` is passed in, so
 * the limiter is a pure function of the times it has seen.
 */
export function createRateLimiter(limitPerSecond: number = RATE_LIMIT_PER_SECOND) {
  const seen = new Map<string, number[]>();
  return (type: string, now: number): boolean => {
    const recent = (seen.get(type) ?? []).filter((time) => now - time < 1000);
    if (recent.length >= limitPerSecond) {
      seen.set(type, recent);
      return false;
    }
    recent.push(now);
    seen.set(type, recent);
    return true;
  };
}
