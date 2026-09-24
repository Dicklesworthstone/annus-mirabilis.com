//! brownian_frames at the pinned revision, through the transport envelope.

mod common;

use common::{assert_refusal, envelope};
use fs_annus_wasm::{BROWNIAN_MAX_OUTPUT_LEN, BROWNIAN_STREAM_KERNEL_ID, brownian_frames_transport};
use fs_math::det;
use fs_rand::{Stream, StreamCheckpoint, StreamKey};

/// 0.5 um^2/s, about the diffusivity of Einstein's 1 um sphere in water.
const D: f64 = 5.0e-13;
const DT: f64 = 1.0 / 64.0;
const STEPS: usize = 64;
const N: usize = 16_384;
const SEED: u64 = 9_007_199_254_740_993; // 2^53 + 1: not representable as a JS number

/// Largest |msd / (2 D t) - 1| over steps 1, 16 and 64. For Gaussian
/// increments, x^2 has variance 2 sigma^4, so the sample mean over N
/// independent particles has relative standard error sqrt(2 / N).
fn worst_msd_deviation(values: &[f64], n: usize, steps: usize, d: f64, dt: f64) -> f64 {
    let cols = steps + 1;
    [1usize, 16, 64]
        .iter()
        .map(|&s| {
            let msd = (0..n).map(|p| values[p * cols + s].powi(2)).sum::<f64>() / n as f64;
            (msd / (2.0 * d * s as f64 * dt) - 1.0).abs()
        })
        .fold(0.0, f64::max)
}

#[test]
fn kernel_3_mean_square_displacement_is_2_d_t() {
    let t = brownian_frames_transport(N, STEPS, 3, SEED, D, DT);
    let (kind, body) = envelope(&t.envelope);
    assert_eq!(kind, "ok", "{}", t.envelope);
    assert_eq!(body.get("quantityId").str(), "latentPosition1d");
    assert_eq!(body.get("unit").str(), "metre");
    assert_eq!(body.get("layout").get("index").str(), "p*(steps+1)+s");
    assert_eq!(body.get("valueCount").u64() as usize, N * (STEPS + 1));
    assert_eq!(t.values.len(), N * (STEPS + 1));
    assert!(t.values.iter().all(|x| x.is_finite()));
    assert!((0..N).all(|p| t.values[p * (STEPS + 1)] == 0.0), "every walk starts at 0");

    let tolerance = 4.0 * (2.0 / N as f64).sqrt(); // 4 standard errors = 0.0442
    let worst = worst_msd_deviation(&t.values, N, STEPS, D, DT);
    println!(
        "{{\"testId\":\"kernel_3_mean_square_displacement_is_2_d_t\",\"particles\":{N},\"steps\":{STEPS},\"worst\":{worst},\"tolerance\":{tolerance}}}"
    );
    assert!(worst < tolerance, "msd deviates {worst} > {tolerance}");

    // Negative control, kept permanently beside the check. A kernel that
    // scaled steps by sqrt(D dt) instead of sqrt(2 D dt) (the commonest wrong
    // implementation) emits exactly the correct walk for D / 2. The same
    // check must reject it, or it could not have caught the bug.
    let half = brownian_frames_transport(N, STEPS, 3, SEED, D / 2.0, DT);
    let wrong = worst_msd_deviation(&half.values, N, STEPS, D, DT);
    assert!(wrong > 10.0 * tolerance, "the check cannot see a factor-2 variance error ({wrong})");
}

/// Every position is the running sum of the particle's own Philox stream
/// (key: seed, kernel 0x19050001, tile = particle), each normal scaled by
/// det::sqrt(2 D dt). The stream's draws are pinned against an independent
/// oracle in tests/philox.rs, so this ties the export to those vectors.
#[test]
fn positions_are_the_particles_own_stream_bitwise() {
    let (n, steps) = (5usize, 40usize);
    let t = brownian_frames_transport(n, steps, 3, SEED, D, DT);
    let scale = det::sqrt(2.0 * D * DT);
    for p in [0usize, 1, 4] {
        let key = StreamKey { seed: SEED, kernel: BROWNIAN_STREAM_KERNEL_ID, tile: p as u32 };
        let mut s = Stream::resume(StreamCheckpoint::current(key, 0)).unwrap();
        let mut x = 0.0f64;
        for step in 1..=steps {
            x += s.next_normal() * scale;
            assert_eq!(
                t.values[p * (steps + 1) + step].to_bits(),
                x.to_bits(),
                "particle {p} step {step}"
            );
        }
        assert_eq!(s.index(), 2 * steps as u64, "kernel 3 consumes two draws per step");
    }
    // Particle p's path does not depend on how many other particles run.
    let wide = brownian_frames_transport(9, steps, 3, SEED, D, DT);
    assert_eq!(&wide.values[..(steps + 1)], &t.values[..(steps + 1)]);
}

#[test]
fn same_seed_is_bitwise_identical_and_the_neighbouring_seed_differs() {
    let a = brownian_frames_transport(8, 32, 3, SEED, D, DT);
    let b = brownian_frames_transport(8, 32, 3, SEED, D, DT);
    assert_eq!(a, b);
    let c = brownian_frames_transport(8, 32, 3, SEED - 1, D, DT);
    assert_ne!(a.values, c.values, "seeds 2^53+1 and 2^53 must differ");
}

#[test]
fn kernels_bind_their_declared_quantities() {
    let unit_walk = brownian_frames_transport(4, 8, 2, 1, D, DT);
    let (_, body) = envelope(&unit_walk.envelope);
    assert_eq!(body.get("quantityId").str(), "walkStepCoordinate1d");
    assert_eq!(body.get("unit").str(), "step");
    for k in [0u32, 1] {
        let (_, body) = envelope(&brownian_frames_transport(4, 8, k, 1, D, DT).envelope);
        assert_eq!(body.get("quantityId").str(), "latentPosition1d", "kernel {k}");
    }
    let still = brownian_frames_transport(3, 5, 3, 1, 0.0, DT);
    assert!(still.values.iter().all(|&x| x == 0.0), "diffusion 0 is admitted and stays at 0");
}

#[test]
fn refusals_are_typed_and_carry_no_values() {
    assert_refusal(&brownian_frames_transport(4, 8, 4, 1, D, DT), "refusal", "unsupported-kernel");
    assert_refusal(&brownian_frames_transport(4, 8, 3, 1, -D, DT), "refusal", "invalid-parameter");
    assert_refusal(&brownian_frames_transport(4, 8, 3, 1, D, 0.0), "refusal", "invalid-parameter");
    assert_refusal(&brownian_frames_transport(4, 8, 3, 1, f64::NAN, DT), "refusal", "nonfinite-input");
    assert_refusal(&brownian_frames_transport(0, 8, 3, 1, D, DT), "refusal", "invalid-parameter");
    assert_refusal(&brownian_frames_transport(4, 0, 3, 1, D, DT), "refusal", "invalid-parameter");
    // One value over the declared output budget. Upstream's brownian module
    // writes its budget miss under the "refusal" key, unlike philox_normals'
    // "execution"; recorded here as the shape that actually crosses.
    let over = brownian_frames_transport(BROWNIAN_MAX_OUTPUT_LEN / 2 + 1, 1, 3, 1, D, DT);
    let body = assert_refusal(&over, "refusal", "budget-exhausted");
    assert_eq!(body.get("details").get("allowed").u64() as usize, BROWNIAN_MAX_OUTPUT_LEN);
    // Exactly at the budget is admitted.
    let at = brownian_frames_transport(BROWNIAN_MAX_OUTPUT_LEN / 2, 1, 0, 1, D, DT);
    assert_eq!(envelope(&at.envelope).0, "ok");
    assert_eq!(at.values.len(), BROWNIAN_MAX_OUTPUT_LEN);
}
