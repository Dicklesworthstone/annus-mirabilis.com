import assert from "node:assert/strict";
import test from "node:test";
import { classifyNetworkRequest } from "./networkLogClassifier.ts";

test("network-log classifier distinguishes worker, WASM, and page requests", () => {
  assert.equal(classifyNetworkRequest("blob:http://127.0.0.1/worker"), "worker");
  assert.equal(classifyNetworkRequest("/apps/runtime/wasm/fs_annus_diffusion_bg.wasm"), "wasm");
  assert.equal(classifyNetworkRequest("/apps/runtime/bundle.js"), "page");
  assert.equal(classifyNetworkRequest("/runtime-conformance.html"), "page");
});
