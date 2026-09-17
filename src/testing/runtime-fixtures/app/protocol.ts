/**
 * Host protocol for the runtime-conformance fixture worker
 * (am-rt-browser-conformance-09i5). Same envelope the dedicated scheduler
 * already speaks: hello, then request/result. A planted mismatch uses a
 * different version string so decodeHello throws with code protocol-mismatch.
 */
export const RUNTIME_FIXTURE_PROTOCOL = "runtime-fixture-v1";
export const RUNTIME_FIXTURE_SOURCE_DIGEST = "runtime-fixture-host-v1";
export const RUNTIME_FIXTURE_EXPERIMENT_ID = "rt-01";

export type RuntimeFixtureHook = "none" | "crash" | "protocol-mismatch" | "stale";
