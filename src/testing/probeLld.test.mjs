import assert from "node:assert/strict";
import test from "node:test";
import { classifyWasmLinkTranscript, diagnoseRustLldRpath } from "./probeLld.ts";

const PIN_OTOOL = `Load command 14
          cmd LC_LOAD_DYLIB
      cmdsize 48
         name @rpath/libLLVM.dylib (offset 24)
Load command 17
          cmd LC_RPATH
      cmdsize 32
         path @loader_path/../lib (offset 12)
Load command 18
          cmd LC_RPATH
      cmdsize 80
         path /Users/runner/work/rust/rust/build/aarch64-apple-darwin/llvm/lib (offset 12)
`;

const LATER_NIGHTLY_OTOOL = `Load command 14
          cmd LC_LOAD_DYLIB
         name @rpath/libLLVM.dylib (offset 24)
Load command 17
          cmd LC_RPATH
         path @loader_path/../lib (offset 12)
`;

test("pin rust-lld rpath is @loader_path/../lib, which is rustlib lib not toolchain lib", () => {
  const rustLld =
    "/Users/jemanuel/.rustup/toolchains/nightly-2026-07-06-aarch64-apple-darwin/lib/rustlib/aarch64-apple-darwin/bin/rust-lld";
  const d = diagnoseRustLldRpath(PIN_OTOOL, rustLld, [
    "/Users/jemanuel/.rustup/toolchains/nightly-2026-07-06-aarch64-apple-darwin/lib/libLLVM.dylib",
  ]);
  assert.equal(d.loadsLibLLVM, true);
  assert.deepEqual(d.rpaths, [
    "@loader_path/../lib",
    "/Users/runner/work/rust/rust/build/aarch64-apple-darwin/llvm/lib",
  ]);
  assert.ok(d.resolvedLibSearch[0].endsWith("lib/rustlib/aarch64-apple-darwin/lib"));
  assert.equal(d.rpathHasLibLLVM, false);
  assert.equal(d.toolchainLibHasLibLLVM, true);
  assert.equal(d.pinLayoutBroken, true);
  assert.match(d.reason, /toolchain layout defect/);
  assert.match(d.reason, /not an invalid wasm-bindgen export list/);
});

test("a later nightly that places libLLVM on the rustlib rpath is not the pin defect", () => {
  const rustLld =
    "/Users/jemanuel/.rustup/toolchains/nightly-2026-08-31-aarch64-apple-darwin/lib/rustlib/aarch64-apple-darwin/bin/rust-lld";
  const d = diagnoseRustLldRpath(LATER_NIGHTLY_OTOOL, rustLld, [
    "/Users/jemanuel/.rustup/toolchains/nightly-2026-08-31-aarch64-apple-darwin/lib/rustlib/aarch64-apple-darwin/lib/libLLVM.dylib",
    "/Users/jemanuel/.rustup/toolchains/nightly-2026-08-31-aarch64-apple-darwin/lib/libLLVM.dylib",
  ]);
  assert.equal(d.loadsLibLLVM, true);
  assert.equal(d.rpathHasLibLLVM, true);
  assert.equal(d.pinLayoutBroken, false);
});

test("SIGABRT + rust-lld is a toolchain crash; a finished wasm link is not; native-runtime is other", () => {
  assert.equal(
    classifyWasmLinkTranscript(
      "error: linking with `rust-lld` failed: signal: 6 (SIGABRT)\ndyld: Library not loaded: @rpath/libLLVM.dylib",
    ),
    "toolchain-lld",
  );
  assert.equal(
    classifyWasmLinkTranscript(
      "    Finished `dev` profile [unoptimized + debuginfo] target(s) in 12.0s",
    ),
    "linked",
  );
  assert.equal(
    classifyWasmLinkTranscript(
      "error: feature `native-runtime` is forbidden on wasm32 browser builds.",
    ),
    "other",
  );
  assert.notEqual(
    classifyWasmLinkTranscript("error: failed to load manifest for dependency `fsqlite`"),
    "toolchain-lld",
  );
});
