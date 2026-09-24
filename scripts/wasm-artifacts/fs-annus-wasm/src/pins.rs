// The pinned FrankenSim bytes this crate compiles. One definition, read by
// three consumers: build.rs (which refuses to compile the crate from any other
// bytes), src/lib.rs (which reports the revision to hosts), and
// tests/pinned_sources.rs (which re-reads the files at test time).
//
// Every digest is BLAKE3 over the git OBJECT at the revision
// (`git show <rev>:<path> | b3sum`), never over a working tree, so a dirty or
// stale checkout cannot pass. Moving the pin means replacing all of these
// together, plus Cargo.toml's [package.metadata.frankensim].

/// FrankenSim commit whose bytes are compiled.
pub const FRANKENSIM_REVISION: &str = "01824653087a69272d5a9c0c6ea2e2789ad05f54";

/// Where the read-only checkout sits, relative to this crate's manifest.
pub const FRANKENSIM_RELATIVE_ROOT: &str = "../../../../frankensim";

/// The three export modules compiled by `#[path]`: (path, blake3, bytes).
pub const BY_REFERENCE: [(&str, &str, usize); 3] = [
    (
        "crates/fs-wasm/src/brownian.rs",
        "4b8d9b827898f474850f9c6a5e47604ab5b2af5f751618bce8eba7742208af17",
        22557,
    ),
    (
        "crates/fs-wasm/src/diffusion1d.rs",
        "65e52aa8219e726351d98d2ed3c6c33b1d8d5445fea43120061b6bd01728e9af",
        14801,
    ),
    (
        "crates/fs-wasm/src/philox_normals.rs",
        "57a3cc56c665f9b6e177b5933c3ea763cc6a6f699fc9c017799472a5c4a4f07e",
        2515,
    ),
];

/// Every tracked Cargo.toml and src/**/*.rs of the path dependencies that
/// enter the wasm32 graph (fs-math, fs-rand, fs-sparse), plus the workspace
/// manifest they inherit from, in this order.
pub const CLOSURE: [&str; 32] = [
    "Cargo.toml",
    "crates/fs-math/Cargo.toml",
    "crates/fs-math/src/c64.rs",
    "crates/fs-math/src/dd.rs",
    "crates/fs-math/src/det.rs",
    "crates/fs-math/src/eft.rs",
    "crates/fs-math/src/lib.rs",
    "crates/fs-math/src/payne.rs",
    "crates/fs-math/src/qd.rs",
    "crates/fs-rand/Cargo.toml",
    "crates/fs-rand/src/cbc.rs",
    "crates/fs-rand/src/cbc_cert.rs",
    "crates/fs-rand/src/cbc_exec.rs",
    "crates/fs-rand/src/cbc_limb.rs",
    "crates/fs-rand/src/dist.rs",
    "crates/fs-rand/src/lib.rs",
    "crates/fs-rand/src/philox.rs",
    "crates/fs-rand/src/philox_normals.rs",
    "crates/fs-rand/src/qmc.rs",
    "crates/fs-rand/src/ziggurat.rs",
    "crates/fs-sparse/Cargo.toml",
    "crates/fs-sparse/src/accelerator_pilot.rs",
    "crates/fs-sparse/src/bsr.rs",
    "crates/fs-sparse/src/direct.rs",
    "crates/fs-sparse/src/fma/mod.rs",
    "crates/fs-sparse/src/interop.rs",
    "crates/fs-sparse/src/interop_fnp.rs",
    "crates/fs-sparse/src/lib.rs",
    "crates/fs-sparse/src/ops.rs",
    "crates/fs-sparse/src/perf.rs",
    "crates/fs-sparse/src/precond.rs",
    "crates/fs-sparse/src/sell.rs",
];

/// BLAKE3 over, for each CLOSURE path in order: the path's UTF-8 bytes, 0x00,
/// the file length as u64 little-endian, then the file's bytes.
pub const CLOSURE_DIGEST: &str = "c1afabbac0bf17301bbfa68d196da46c1401fb97455b3c45995a8ac1e2f95e75";

/// The closure stream CLOSURE_DIGEST is computed over.
pub fn closure_stream(read: &mut dyn FnMut(&str) -> Vec<u8>) -> Vec<u8> {
    let mut stream = Vec::new();
    for rel in CLOSURE {
        let bytes = read(rel);
        stream.extend_from_slice(rel.as_bytes());
        stream.push(0);
        stream.extend_from_slice(&(bytes.len() as u64).to_le_bytes());
        stream.extend_from_slice(&bytes);
    }
    stream
}
