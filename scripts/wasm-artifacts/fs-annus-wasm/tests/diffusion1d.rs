//! diffusion1d_frames at the pinned revision, through the transport envelope.

mod common;

use common::{assert_refusal, envelope};
use fs_annus_wasm::{diffusion1d_frames_transport, stability_ratio};

/// Exactly representable: D dt / dx^2 = 0.25 * 0.5 / 0.25 = 0.5, the FTCS limit.
const D_EDGE: f64 = 0.25;
const DX_EDGE: f64 = 0.5;
const DT_EDGE: f64 = 0.5;

#[test]
fn stability_refusal_is_typed_at_the_first_ratio_above_one_half() {
    assert_eq!(stability_ratio(D_EDGE, DT_EDGE, DX_EDGE), 0.5);
    // r == 0.5 is admitted.
    let at = diffusion1d_frames_transport(11, 3, 2, D_EDGE, DX_EDGE, DT_EDGE, 0);
    assert_eq!(envelope(&at.envelope).0, "ok", "{}", at.envelope);
    assert_eq!(at.values.len(), 33);

    // The next representable dt makes r > 0.5: refused, typed, no field.
    let dt_up = f64::from_bits(DT_EDGE.to_bits() + 1);
    assert!(stability_ratio(D_EDGE, dt_up, DX_EDGE) > 0.5);
    let t = diffusion1d_frames_transport(11, 3, 2, D_EDGE, DX_EDGE, dt_up, 0);
    let body = assert_refusal(&t, "refusal", "ftcs-unstable");
    let details = body.get("details");
    assert!(details.get("ratio").f64() > 0.5);
    assert_eq!(details.get("limit").f64(), 0.5);

    // Each offered repair names a parameter and a value that is itself admitted.
    let repairs = details.get("repairs").arr();
    assert_eq!(repairs.len(), 3);
    for r in repairs {
        let v = r.get("value").f64();
        let (d, dx, dt) = match r.get("parameterId").str() {
            "dt" => (D_EDGE, DX_EDGE, v),
            "dx" => (D_EDGE, v, dt_up),
            "diffusion" => (v, DX_EDGE, dt_up),
            other => panic!("unknown repair parameter {other}"),
        };
        let fixed = diffusion1d_frames_transport(11, 3, 2, d, dx, dt, 0);
        assert_eq!(envelope(&fixed.envelope).0, "ok", "repair {r:?} is not admitted: {}", fixed.envelope);
    }

    // Far above the limit it is the same typed refusal, never a blown-up field.
    let far = diffusion1d_frames_transport(11, 3, 2, D_EDGE, DX_EDGE, 50.0, 0);
    assert_refusal(&far, "refusal", "ftcs-unstable");
}

fn mass(frame: &[f64], dx: f64) -> f64 {
    frame.iter().sum::<f64>() * dx
}

/// Zero-flux boundaries conserve mass. The bound is a floating-point budget
/// (64 ulps per cell-step), far below what a leaking boundary loses: a
/// Dirichlet edge on the step profile loses about r of the boundary cell's
/// value per step.
#[test]
fn zero_flux_boundaries_conserve_mass_for_every_profile() {
    let (n, frames, spf) = (101usize, 40usize, 25usize);
    let (dx, d) = (0.01, 1.0e-3);
    let dt = 0.4 * dx * dx / d;
    let bound = 64.0 * (n * frames * spf) as f64 * f64::EPSILON;
    let expected_initial = [1.0, 0.5, 1.0]; // spike 1/dx; 50 cells of 1; two spikes of 0.5/dx
    for profile in 0u32..=2 {
        let t = diffusion1d_frames_transport(n, frames, spf, d, dx, dt, profile);
        let (kind, body) = envelope(&t.envelope);
        assert_eq!(kind, "ok", "{}", t.envelope);
        assert_eq!(body.get("quantityId").str(), "probabilityDensity");
        assert_eq!(body.get("layout").get("index").str(), "f*n+i");
        assert_eq!(t.values.len(), n * frames);
        let m0 = mass(&t.values[..n], dx);
        assert!((m0 - expected_initial[profile as usize]).abs() < 1e-12, "profile {profile} initial mass {m0}");
        let mut worst = 0.0f64;
        for f in 0..frames {
            let frame = &t.values[f * n..(f + 1) * n];
            assert!(frame.iter().all(|&u| u.is_finite() && u >= 0.0), "profile {profile} frame {f}");
            worst = worst.max(((mass(frame, dx) - m0) / m0).abs());
        }
        println!("{{\"testId\":\"zero_flux_mass\",\"profile\":{profile},\"worstRelativeDrift\":{worst},\"bound\":{bound}}}");
        assert!(worst <= bound, "profile {profile}: mass drift {worst} > {bound}");
        // The field actually moved (a frozen field conserves mass too).
        assert_ne!(&t.values[..n], &t.values[(frames - 1) * n..]);
    }
}

/// Away from the walls the spike's variance grows by exactly 2 r dx^2 per
/// step, i.e. sigma^2 = 2 D t: the same law brownian_frames obeys, reached
/// here from the continuum side.
#[test]
fn spike_variance_grows_as_2_d_t() {
    let (n, frames, spf) = (401usize, 5usize, 20usize);
    let (dx, d) = (1.0e-6, 5.0e-13);
    let dt = 0.25 * dx * dx / d;
    let t = diffusion1d_frames_transport(n, frames, spf, d, dx, dt, 0);
    assert_eq!(envelope(&t.envelope).0, "ok");
    let centre = (n / 2) as f64;
    let mut worst = 0.0f64;
    for f in 1..frames {
        let frame = &t.values[f * n..(f + 1) * n];
        let m: f64 = frame.iter().sum();
        let var = frame
            .iter()
            .enumerate()
            .map(|(i, u)| u * ((i as f64 - centre) * dx).powi(2))
            .sum::<f64>()
            / m;
        let elapsed = (f * spf) as f64 * dt;
        worst = worst.max((var / (2.0 * d * elapsed) - 1.0).abs());
    }
    println!("{{\"testId\":\"spike_variance_grows_as_2_d_t\",\"worstRelative\":{worst}}}");
    assert!(worst < 1e-9, "variance deviates from 2 D t by {worst}");
}

#[test]
fn other_refusals_are_typed() {
    assert_refusal(&diffusion1d_frames_transport(2, 3, 2, 0.1, 1.0, 0.1, 0), "refusal", "invalid-parameter");
    assert_refusal(&diffusion1d_frames_transport(11, 0, 2, 0.1, 1.0, 0.1, 0), "refusal", "invalid-parameter");
    assert_refusal(&diffusion1d_frames_transport(11, 3, 2, 0.1, 1.0, 0.1, 3), "refusal", "unsupported-kernel");
    assert_refusal(&diffusion1d_frames_transport(11, 3, 2, f64::INFINITY, 1.0, 0.1, 0), "refusal", "nonfinite-input");
    assert_refusal(&diffusion1d_frames_transport(11, 3, 2, 0.1, 0.0, 0.1, 0), "refusal", "invalid-parameter");
    assert_refusal(
        &diffusion1d_frames_transport(2_097_153, 1, 1, 0.1, 1.0, 0.1, 0),
        "refusal",
        "budget-exhausted",
    );
}
