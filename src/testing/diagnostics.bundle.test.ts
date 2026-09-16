import { describe, expect, test } from "bun:test";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isDiagnosticsRegistryEnabled,
  readDiagnostics,
  recordDraw,
  registerOwner,
  registerSubscription,
  unregisterOwner,
} from "../experiments/store/diagnostics.ts";

// This repository has no `bun-types` devDependency yet, so the ambient
// `Bun` global is untyped under `tsc`; this local declaration covers only
// the `Bun.build` shape this file actually calls, rather than pulling in a
// whole types package for one function.
declare const Bun: {
  build(options: {
    entrypoints: string[];
    target?: string;
    minify?: boolean;
    define?: Record<string, string>;
  }): Promise<{ success: boolean; logs: unknown[]; outputs: { text(): Promise<string> }[] }>;
};

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.resolve(HERE, "../experiments/store/diagnostics.ts");

async function bundleWithNodeEnv(nodeEnv: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [ENTRY],
    target: "browser",
    minify: true,
    define: { "process.env.NODE_ENV": JSON.stringify(nodeEnv) },
  });
  if (!result.success) {
    throw new AggregateError(result.logs, `bundling ${ENTRY} with NODE_ENV=${nodeEnv} failed`);
  }
  const output = result.outputs[0];
  if (!output) throw new Error("bundle produced no output");
  return await output.text();
}

describe("diagnostics registry logic (this process's real NODE_ENV, never production in tests)", () => {
  test("owners, subscriptions, and draw counters are tracked per instance", () => {
    expect(isDiagnosticsRegistryEnabled()).toBe(true);
    registerOwner("BM06:1");
    registerOwner("BM06:1");
    const unsubscribe = registerSubscription("BM06:1");
    recordDraw("BM06:1", "philox", 3);
    recordDraw("BM06:1", "philox", 2);
    expect(readDiagnostics("BM06:1")).toEqual({
      instanceId: "BM06:1",
      ownerCount: 2,
      subscriptionCount: 1,
      drawCounters: { philox: 5 },
    });
    unregisterOwner("BM06:1");
    expect(readDiagnostics("BM06:1")?.ownerCount).toBe(1);
    unsubscribe();
    unsubscribe(); // idempotent: a second call is a no-op, never a double-decrement
    unregisterOwner("BM06:1");
    expect(readDiagnostics("BM06:1")).toBeUndefined();
  });

  test("an unknown instance id reads as undefined, never a fabricated zeroed record", () => {
    expect(readDiagnostics("no-such-instance")).toBeUndefined();
  });
});

describe("diagnostics registry exists only in test builds (bundle check, requirement 12)", () => {
  test("a non-production bundle retains the registry's backing Map", async () => {
    const code = await bundleWithNodeEnv("development");
    expect(code).toContain("new Map");
  });

  test("a production bundle contains no diagnostics registry Map at all", async () => {
    const code = await bundleWithNodeEnv("production");
    expect(code).not.toContain("new Map");
  });
});
