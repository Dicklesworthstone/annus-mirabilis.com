/**
 * Diagnose the pin-toolchain rust-lld SIGABRT. The crash is dyld missing
 * libLLVM.dylib on Darwin rpath, not an invalid wasm-bindgen export list.
 */
import { posix as path } from "node:path";

export type LldRpathDiagnosis = {
  loadsLibLLVM: boolean;
  rpaths: string[];
  rustLldDir: string;
  resolvedLibSearch: string[];
  rpathHasLibLLVM: boolean;
  toolchainLibHasLibLLVM: boolean;
  pinLayoutBroken: boolean;
  reason: string;
};

const LOADER = "@loader_path/";

export function diagnoseRustLldRpath(
  otoolL: string,
  rustLldPath: string,
  existingFiles: readonly string[] = [],
): LldRpathDiagnosis {
  const loadsLibLLVM = /@rpath\/libLLVM\.dylib/.test(otoolL);
  const rpaths: string[] = [];
  for (const match of otoolL.matchAll(/cmd LC_RPATH[\s\S]*?path (\S+)/g)) {
    const path = match[1]?.trim();
    if (path) rpaths.push(path);
  }
  const slash = rustLldPath.lastIndexOf("/");
  const rustLldDir = slash === -1 ? "." : rustLldPath.slice(0, slash);
  const resolvedLibSearch = rpaths.map((rpath) => {
    if (rpath.startsWith(LOADER)) return path.resolve(rustLldDir, rpath.slice(LOADER.length));
    return rpath;
  });
  const present = new Set(existingFiles);
  const rpathHasLibLLVM = resolvedLibSearch.some((dir) => present.has(`${dir}/libLLVM.dylib`));
  const toolchainRoot = rustLldPath.split("/lib/rustlib/")[0];
  const toolchainLibHasLibLLVM =
    toolchainRoot !== undefined && present.has(`${toolchainRoot}/lib/libLLVM.dylib`);
  const pinLayoutBroken = loadsLibLLVM && toolchainLibHasLibLLVM && !rpathHasLibLLVM;
  const reason = pinLayoutBroken
    ? "rust-lld LC_RPATH is @loader_path/../lib, so it looks in rustlib/<triple>/lib/ for libLLVM.dylib. nightly-2026-07-06 on Darwin ships libLLVM.dylib in the toolchain lib/ directory instead. That is a toolchain layout defect, not an invalid wasm-bindgen export list."
    : rpathHasLibLLVM
      ? "rust-lld loads libLLVM via @rpath and libLLVM.dylib is present on that rpath."
      : "rust-lld does not load a resolvable libLLVM.dylib in this dump.";
  return {
    loadsLibLLVM,
    rpaths,
    rustLldDir,
    resolvedLibSearch,
    rpathHasLibLLVM,
    toolchainLibHasLibLLVM,
    pinLayoutBroken,
    reason,
  };
}

export function classifyWasmLinkTranscript(
  transcript: string,
): "toolchain-lld" | "linked" | "other" {
  if (
    /Finished `dev` profile/.test(transcript) &&
    /error: linking with `rust-lld` failed/.test(transcript) === false
  ) {
    return "linked";
  }
  if (
    /linking with `rust-lld` failed/.test(transcript) ||
    /signal: 6/.test(transcript) ||
    /libLLVM\.dylib/.test(transcript)
  ) {
    return "toolchain-lld";
  }
  return "other";
}
