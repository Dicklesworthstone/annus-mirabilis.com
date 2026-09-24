//! philox_normals and the Philox stream it draws from, at the pinned revision.
//!
//! Two independent references, both bitwise:
//! 1. tests/fixtures/philox_vectors.tsv, a column-for-column transcription of
//!    src/physics/reference/philox.vectors.json (the vectors the site's
//!    TypeScript port is checked against: 315 positions and 2 normal
//!    sequences, emitted by fs-rand at 5bbbfae). The pinned 01824653 build
//!    must reproduce every one; a drift here means the port and the artifact
//!    no longer agree. (Transcribed rather than read in place because a
//!    remote build host receives this crate directory, not the site tree.)
//! 2. Draws for the Brownian stream kernel 0x19050001, which that file does not
//!    cover, derived by an independent Python Philox4x32-10 written from the
//!    Random123 definition (validated first against the 3 Random123 known
//!    answers and all 315 recorded positions). Recorded below as literals.

mod common;

use common::{assert_refusal, envelope};
use fs_annus_wasm::{BROWNIAN_STREAM_KERNEL_ID, philox_normals, philox_normals_transport};
use fs_rand::{Stream, StreamCheckpoint, StreamKey};

const VECTORS: &str = include_str!("fixtures/philox_vectors.tsv");

struct Position {
    seed: u64,
    kernel: u32,
    tile: u32,
    index: u64,
    block: Vec<String>,
    u64: u64,
    f64_bits: String,
    normal_bits: String,
}

struct Sequence {
    seed: u64,
    kernel: u32,
    tile: u32,
    start: u64,
    count: usize,
    normal_bits: Vec<String>,
}

fn rows(kind: &str) -> Vec<Vec<&'static str>> {
    VECTORS
        .lines()
        .filter(|l| !l.starts_with('#'))
        .map(|l| l.split('\t').collect::<Vec<_>>())
        .filter(|f| f[0] == kind)
        .collect()
}

fn positions() -> Vec<Position> {
    rows("position")
        .into_iter()
        .map(|f| {
            assert_eq!(f.len(), 12, "{f:?}");
            Position {
                seed: f[1].parse().unwrap(),
                kernel: f[2].parse().unwrap(),
                tile: f[3].parse().unwrap(),
                index: f[4].parse().unwrap(),
                block: f[5..9].iter().map(|s| (*s).to_string()).collect(),
                u64: f[9].parse().unwrap(),
                f64_bits: f[10].to_string(),
                normal_bits: f[11].to_string(),
            }
        })
        .collect()
}

fn sequences() -> Vec<Sequence> {
    rows("sequence")
        .into_iter()
        .map(|f| {
            assert_eq!(f.len(), 7, "{f:?}");
            Sequence {
                seed: f[1].parse().unwrap(),
                kernel: f[2].parse().unwrap(),
                tile: f[3].parse().unwrap(),
                start: f[4].parse().unwrap(),
                count: f[5].parse().unwrap(),
                normal_bits: f[6].split(',').map(str::to_string).collect(),
            }
        })
        .collect()
}

fn stream(seed: u64, kernel: u32, tile: u32, index: u64) -> Stream {
    Stream::resume(StreamCheckpoint::current(StreamKey { seed, kernel, tile }, index)).unwrap()
}

fn hex32(block: [u32; 4]) -> Vec<String> {
    block.iter().map(|w| format!("{w:08x}")).collect()
}

#[test]
fn recorded_positions_reproduce_bitwise() {
    let all = positions();
    assert_eq!(all.len(), 315, "the recorded vector population changed");
    let mut checked = 0usize;
    for p in &all {
        let (seed, kernel, tile, index) = (p.seed, p.kernel, p.tile, p.index);
        let at = format!("seed {seed} kernel {kernel} tile {tile} index {index}");
        assert_eq!(hex32(Stream::at(StreamKey { seed, kernel, tile }, index)), p.block, "block {at}");
        assert_eq!(stream(seed, kernel, tile, index).next_u64(), p.u64, "u64 {at}");
        let f = stream(seed, kernel, tile, index).next_f64();
        assert_eq!(format!("{:016x}", f.to_bits()), p.f64_bits, "f64 {at}");
        let z = stream(seed, kernel, tile, index).next_normal();
        assert_eq!(format!("{:016x}", z.to_bits()), p.normal_bits, "normal {at}");
        checked += 1;
    }
    println!("{{\"suite\":\"fs-annus-wasm\",\"testId\":\"recorded_positions_reproduce_bitwise\",\"checked\":{checked}}}");
    assert_eq!(checked, 315);
}

/// The export itself, through the transport envelope: values and the
/// envelope's `valuesBits` must both equal the recorded bits.
#[test]
fn recorded_normal_sequences_reproduce_through_the_export() {
    let seqs = sequences();
    assert_eq!(seqs.len(), 2);
    for sq in &seqs {
        let t = philox_normals_transport(sq.seed, sq.kernel, sq.tile, sq.start, sq.count);
        let (kind, body) = envelope(&t.envelope);
        assert_eq!(kind, "ok", "{}", t.envelope);
        assert_eq!(body.get("export").str(), "philox_normals");
        assert_eq!(body.get("layout").get("indexRule").str(), "draws");
        let got: Vec<String> = t.values.iter().map(|z| format!("{:016x}", z.to_bits())).collect();
        assert_eq!(got, sq.normal_bits, "values, seed {} start {}", sq.seed, sq.start);
        let bits: Vec<String> =
            body.get("valuesBits").arr().iter().map(|j| j.str().to_string()).collect();
        assert_eq!(bits, sq.normal_bits, "envelope valuesBits, seed {} start {}", sq.seed, sq.start);
    }
}

/// Each recorded position is also reachable as a one-normal export call,
/// except where two draws from `index` would pass 2^64 - 1: there the export
/// must refuse with the typed stream-index-overflow, never wrap.
#[test]
fn every_recorded_position_through_the_export_or_a_typed_overflow() {
    let (mut ok, mut refused) = (0usize, 0usize);
    for p in &positions() {
        let t = philox_normals_transport(p.seed, p.kernel, p.tile, p.index, 1);
        if p.index.checked_add(2).is_none() {
            let body = assert_refusal(&t, "refusal", "stream-index-overflow");
            assert_eq!(body.get("details").get("startIndex").str(), p.index.to_string());
            refused += 1;
        } else {
            let (kind, _) = envelope(&t.envelope);
            assert_eq!(kind, "ok");
            assert_eq!(format!("{:016x}", t.values[0].to_bits()), p.normal_bits);
            ok += 1;
        }
    }
    println!("{{\"testId\":\"every_recorded_position_through_the_export\",\"ok\":{ok},\"refused\":{refused}}}");
    assert!(ok > 0 && refused > 0, "both arms must be exercised: ok {ok}, refused {refused}");
    assert_eq!(ok + refused, 315);
}

/// (seed, tile, index, u64) for StreamKey.kernel = 0x19050001, from the
/// independent Python oracle (scratch philox_oracle.py, 2026-09-24).
const BROWNIAN_KERNEL_DRAWS: [(u64, u32, u64, u64); 12] = [
    (0, 0, 0, 8832736720984678913),
    (0, 0, 1, 14402554597613016748),
    (0, 1, 0, 14812108452496749974),
    (0, 4095, 1, 5897035308490397525),
    (1, 0, 0, 922547226609622803),
    (1, 1, 1, 3656884943596862151),
    (20250630, 0, 0, 7186367770846976693),
    (20250630, 4095, 127, 1627644239796335492),
    (9007199254740993, 0, 4294967296, 7127743847106654595),
    (9007199254740993, 1, 3, 12978951017752362989),
    (18446744073709551615, 4095, 2, 7999373850989107047),
    (18446744073709551615, 4095, 4294967296, 13275137275299110729),
];

#[test]
fn brownian_stream_kernel_draws_match_the_independent_oracle() {
    assert_eq!(BROWNIAN_STREAM_KERNEL_ID, 0x1905_0001);
    for &(seed, tile, index, want) in &BROWNIAN_KERNEL_DRAWS {
        let mut s = stream(seed, BROWNIAN_STREAM_KERNEL_ID, tile, index);
        assert_eq!(s.next_u64(), want, "seed {seed} tile {tile} index {index}");
    }
}

#[test]
fn same_request_twice_is_bitwise_identical_and_a_neighbour_differs() {
    let a = philox_normals(9007199254740993, BROWNIAN_STREAM_KERNEL_ID, 3, 10, 64).unwrap();
    let b = philox_normals(9007199254740993, BROWNIAN_STREAM_KERNEL_ID, 3, 10, 64).unwrap();
    let bits = |v: &[f64]| v.iter().map(|z| z.to_bits()).collect::<Vec<_>>();
    assert_eq!(bits(&a), bits(&b));
    let c = philox_normals(9007199254740992, BROWNIAN_STREAM_KERNEL_ID, 3, 10, 64).unwrap();
    assert_ne!(bits(&a), bits(&c), "seeds 2^53 and 2^53+1 must be different streams");
    // start_index counts draws: normal k of a call from 10 is normal 0 of a call from 10 + 2k.
    let d = philox_normals(9007199254740993, BROWNIAN_STREAM_KERNEL_ID, 3, 20, 1).unwrap();
    assert_eq!(a[5].to_bits(), d[0].to_bits());
}

#[test]
fn refusals_are_typed_and_never_an_empty_ok() {
    assert_refusal(&philox_normals_transport(1, 0, 0, 0, 0), "refusal", "invalid-parameter");
    assert_refusal(
        &philox_normals_transport(0, 0, 0, u64::MAX - 1, 1),
        "refusal",
        "stream-index-overflow",
    );
    // The last accepted pair, per the refusal's own repair text.
    let last = philox_normals_transport(0, 0, 0, u64::MAX - 2, 1);
    assert_eq!(envelope(&last.envelope).0, "ok");
    assert_eq!(last.values.len(), 1);
    // A budget miss is an execution outcome, not a model refusal.
    let over = fs_annus_wasm::PHILOX_NORMALS_MAX_COUNT + 1;
    assert_refusal(&philox_normals_transport(0, 0, 0, 0, over), "execution", "budget-exhausted");
}
