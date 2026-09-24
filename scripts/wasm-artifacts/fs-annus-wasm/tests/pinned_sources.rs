//! The FrankenSim bytes this crate compiles are the pinned revision's bytes.
//!
//! build.rs already refuses to compile otherwise. This is the second reader,
//! kept in the test lane on purpose: if build.rs ever stopped checking (a
//! skipped rerun, a guard edited to warn), the build lane would stay green and
//! only this would notice. The pins themselves are one definition, src/pins.rs.

use fs_annus_wasm::{
    BY_REFERENCE, CLOSURE, CLOSURE_DIGEST, FRANKENSIM_RELATIVE_ROOT, FRANKENSIM_REVISION,
    closure_stream,
};
use std::path::PathBuf;

fn read(rel: &str) -> Vec<u8> {
    let p = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(FRANKENSIM_RELATIVE_ROOT).join(rel);
    std::fs::read(&p).unwrap_or_else(|e| panic!("cannot read {}: {e}", p.display()))
}

#[test]
fn the_hasher_is_standard_blake3() {
    // BLAKE3 test vectors: the empty input, and 0..=250 repeated for 1024 bytes.
    assert_eq!(
        fs_blake3::hash_bytes(b"").to_hex(),
        "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262"
    );
    let input: Vec<u8> = (0..1024u32).map(|i| (i % 251) as u8).collect();
    assert_eq!(
        fs_blake3::hash_bytes(&input).to_hex(),
        "42214739f095a406f3fc83deb889744ac00df831c10daa55189b5d121c855af7"
    );
}

#[test]
fn by_reference_modules_are_the_pinned_bytes() {
    for (rel, want, len) in BY_REFERENCE {
        let bytes = read(rel);
        assert_eq!(bytes.len(), len, "{rel} length");
        assert_eq!(fs_blake3::hash_bytes(&bytes).to_hex(), want, "{rel} is not {FRANKENSIM_REVISION}");
    }
}

#[test]
fn generic_crate_closure_is_the_pinned_bytes() {
    assert_eq!(CLOSURE.len(), 32);
    assert_eq!(
        fs_blake3::hash_bytes(&closure_stream(&mut |rel| read(rel))).to_hex(),
        CLOSURE_DIGEST,
        "fs-math / fs-rand / fs-sparse or the workspace manifest differ from {FRANKENSIM_REVISION}"
    );
}

#[test]
fn the_crate_reports_one_revision_everywhere() {
    assert_eq!(FRANKENSIM_REVISION, "01824653087a69272d5a9c0c6ea2e2789ad05f54");
    let manifest = include_str!("../Cargo.toml");
    assert!(manifest.contains(&format!("revision = \"{FRANKENSIM_REVISION}\"")));
    let id = fs_annus_wasm::build_identity();
    assert!(id.contains(FRANKENSIM_REVISION), "{id}");
}
