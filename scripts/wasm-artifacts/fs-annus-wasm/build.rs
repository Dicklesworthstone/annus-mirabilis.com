//! Refuses to compile fs-annus-wasm from any FrankenSim bytes other than the
//! pinned revision's. This runs on whatever host compiles the crate (a remote
//! build worker included), against the files that host's rustc will read, so
//! it holds where a `git rev-parse` check cannot: a worker's mirror has no git.

use std::path::PathBuf;

include!("src/pins.rs");

fn main() {
    let manifest = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").expect("cargo sets it"));
    let root = manifest.join(FRANKENSIM_RELATIVE_ROOT);
    let mut read = |rel: &str| -> Vec<u8> {
        let p = root.join(rel);
        println!("cargo:rerun-if-changed={}", p.display());
        std::fs::read(&p).unwrap_or_else(|e| {
            panic!(
                "fs-annus-wasm: cannot read {} ({e}). A read-only FrankenSim checkout at {FRANKENSIM_REVISION} must sit at {}.",
                p.display(),
                root.display()
            )
        })
    };
    for (rel, want, len) in BY_REFERENCE {
        let bytes = read(rel);
        let got = fs_blake3::hash_bytes(&bytes).to_hex();
        assert!(
            bytes.len() == len && got == want,
            "fs-annus-wasm refuses to build: {rel} is not FrankenSim {FRANKENSIM_REVISION} (blake3 {got}, {} bytes; pinned {want}, {len} bytes)",
            bytes.len()
        );
    }
    let got = fs_blake3::hash_bytes(&closure_stream(&mut read)).to_hex();
    assert!(
        got == CLOSURE_DIGEST,
        "fs-annus-wasm refuses to build: fs-math / fs-rand / fs-sparse or the FrankenSim workspace manifest are not FrankenSim {FRANKENSIM_REVISION} (closure blake3 {got}; pinned {CLOSURE_DIGEST})"
    );
    println!("cargo:rerun-if-changed=src/pins.rs");
}
