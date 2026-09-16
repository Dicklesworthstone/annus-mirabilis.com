import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getLogger } from "../../testing/log/logger.ts";
import { extractRustFunction } from "./extractRust.ts";
import { KERNEL_BEAD_ID } from "./types.ts";

const fixture = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "__fixtures__/rust/lib.rs"),
  "utf8",
);
const logger = getLogger("show-the-code");

describe("extractRustFunction", () => {
  test("extracts a nested generic owner law", () => {
    const extracted = extractRustFunction(fixture, "inner_law", {
      filePath: "src/content/kernel/__fixtures__/rust/lib.rs",
      revision: "fixture",
    });
    expect(extracted.source).toContain("pub fn inner_law<T: Copy>(x: T) -> T");
    expect(extracted.identifiers).toContain("inner_law");
    logger.log({
      testId: "extract-rust-generic",
      beadId: KERNEL_BEAD_ID,
      outcome: "passed",
      message: "Nested generic function extracted",
      extra: { function: extracted.exportName, sourceHash: extracted.sourceHash },
    });
  });

  test("extracts a #[wasm_bindgen] wrapper that delegates to the owner", () => {
    const extracted = extractRustFunction(fixture, "brownian_frames_export", {
      filePath: "src/content/kernel/__fixtures__/rust/lib.rs",
      revision: "fixture",
    });
    expect(extracted.source).toContain("#[wasm_bindgen]");
    expect(extracted.source).toContain("brownian_frames(");
    expect(extracted.identifiers).toContain("brownian_frames");
    logger.log({
      testId: "extract-rust-wasm-wrapper",
      beadId: KERNEL_BEAD_ID,
      outcome: "passed",
      message: "wasm_bindgen wrapper extracted with owner call",
      extra: { function: extracted.exportName, sourceHash: extracted.sourceHash },
    });
  });

  test("hash is stable across two scans", () => {
    const a = extractRustFunction(fixture, "brownian_frames", {
      filePath: "lib.rs",
      revision: "fixture",
    });
    const b = extractRustFunction(fixture, "brownian_frames", {
      filePath: "lib.rs",
      revision: "fixture",
    });
    expect(a.sourceHash).toBe(b.sourceHash);
    expect(a.source).toContain("pub fn brownian_frames");
    logger.log({
      testId: "extract-rust-hash-stable",
      beadId: KERNEL_BEAD_ID,
      outcome: "passed",
      message: "Rust hash stable",
      extra: { sourceHash: a.sourceHash },
    });
  });
});
