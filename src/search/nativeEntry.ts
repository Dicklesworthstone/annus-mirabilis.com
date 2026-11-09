import { createNativeSearchSession } from "./native.ts";

/** Bundled as one IIFE for JavaScriptCore; never injected into a reader's web view. */
Object.defineProperty(globalThis, "AnnusMirabilisSearch", {
  value: createNativeSearchSession(),
  writable: false,
  configurable: false,
});
