//! fs-annus-wasm: the slim browser surface for Annus Mirabilis.
//!
//! This crate is a composition and transport boundary, never an owner. The
//! laws live in FrankenSim and are compiled here BY REFERENCE, unchanged, from
//! a read-only checkout beside this repository at [`FRANKENSIM_REVISION`]:
//!
//! - `crates/fs-wasm/src/brownian.rs` (BM-01, BM-05): [`brownian_frames`];
//! - `crates/fs-wasm/src/diffusion1d.rs` (BM-06): [`diffusion1d_frames`];
//! - `crates/fs-wasm/src/philox_normals.rs`, a re-export of
//!   `fs_rand::philox_normals`: [`philox_normals`].
//!
//! What this file adds is transport only. Each export returns an envelope
//! string beside a value buffer, built by the upstream modules' own envelope
//! functions (`ok_envelope_json`, `Refusal::to_json`,
//! `philox_normals_envelope_json`). A refusal crosses the boundary as
//! `{"refusal":{"code",...}}` (or, for a philox budget miss,
//! `{"execution":{"code",...}}`) with an empty buffer; the empty buffer is
//! never itself the refusal. The shapes match the `#[wasm_bindgen]` layer of
//! FrankenSim's `fs-wasm/src/lib.rs` at the same revision, so a host written
//! against either sees the same interface.
//!
//! The transport functions ([`brownian_frames_transport`] and its siblings)
//! are plain Rust so the native tests exercise the exact envelope the browser
//! receives; the `#[wasm_bindgen]` layer at the bottom only forwards to them.

#[path = "../../../../../frankensim/crates/fs-wasm/src/brownian.rs"]
pub mod brownian;
#[path = "../../../../../frankensim/crates/fs-wasm/src/diffusion1d.rs"]
pub mod diffusion1d;
#[path = "../../../../../frankensim/crates/fs-wasm/src/philox_normals.rs"]
pub mod philox_normals;

pub use brownian::{BROWNIAN_MAX_OUTPUT_LEN, BROWNIAN_STREAM_KERNEL_ID, brownian_frames};
pub use diffusion1d::{DIFFUSION1D_MAX_OUTPUT_LEN, diffusion1d_frames, stability_ratio};
pub use philox_normals::{PHILOX_NORMALS_MAX_COUNT, philox_normals};

// FRANKENSIM_REVISION and the pinned digests. build.rs refuses to compile this
// crate unless the referenced FrankenSim files are exactly those bytes.
include!("pins.rs");

/// Identity of this transport crate, reported beside the upstream kernel ids.
pub const TRANSPORT_VERSION: &str = concat!("fs-annus-wasm ", env!("CARGO_PKG_VERSION"));

/// One export's result as it crosses the boundary: an envelope that is always
/// present, and a buffer that is empty only when the envelope is a refusal or
/// an execution outcome.
#[derive(Debug, Clone, PartialEq)]
pub struct Transport {
    /// `{"ok":{...}}`, `{"refusal":{...}}` or `{"execution":{...}}`.
    pub envelope: String,
    /// The accepted values, or empty beside a refusal envelope.
    pub values: Vec<f64>,
}

/// `{"transport":...,"frankensimRevision":...}` for provenance records.
#[must_use]
pub fn build_identity() -> String {
    format!(
        "{{\"transport\":\"{TRANSPORT_VERSION}\",\"frankensimRevision\":\"{FRANKENSIM_REVISION}\",\"exports\":[\"brownian_frames\",\"philox_normals\",\"diffusion1d_frames\"]}}"
    )
}

/// Admit-or-refuse envelope for `brownian_frames`, without generating values.
#[must_use]
pub fn admit_brownian_frames_envelope(
    n_particles: usize,
    steps: usize,
    step_kernel: u32,
    seed: u64,
    diffusion: f64,
    dt: f64,
) -> String {
    match brownian::admit_brownian_frames(n_particles, steps, step_kernel, seed, diffusion, dt) {
        Ok(spec) => {
            let n = spec.n_particles() * (spec.steps() + 1);
            brownian::ok_envelope_json(&spec, n)
        }
        Err(r) => r.to_json(),
    }
}

/// `brownian_frames` across the boundary. Layout `p * (steps + 1) + s`.
#[must_use]
pub fn brownian_frames_transport(
    n_particles: usize,
    steps: usize,
    step_kernel: u32,
    seed: u64,
    diffusion: f64,
    dt: f64,
) -> Transport {
    match brownian::admit_brownian_frames(n_particles, steps, step_kernel, seed, diffusion, dt) {
        Ok(spec) => {
            let n = spec.n_particles() * (spec.steps() + 1);
            Transport {
                envelope: brownian::ok_envelope_json(&spec, n),
                values: brownian::brownian_frames_admitted(&spec),
            }
        }
        Err(r) => Transport {
            envelope: r.to_json(),
            values: Vec::new(),
        },
    }
}

/// Admit-or-refuse envelope for `philox_normals`, without drawing.
#[must_use]
pub fn admit_philox_normals_envelope(
    seed: u64,
    stream_kernel: u32,
    tile: u32,
    start_index: u64,
    count: usize,
) -> String {
    match philox_normals::admit_philox_normals(seed, stream_kernel, tile, start_index, count) {
        Ok(_) => format!(
            "{{\"ok\":{{\"kernel\":\"{}\",\"export\":\"philox_normals\"}}}}",
            fs_rand::philox_normals::KERNEL_VERSION
        ),
        Err(_) => {
            philox_normals::philox_normals_envelope_json(seed, stream_kernel, tile, start_index, count)
        }
    }
}

/// `philox_normals` across the boundary. `start_index` counts draws; each
/// normal consumes two. The ok envelope carries every value's IEEE-754 bits
/// as hex (`valuesBits`), so a host can compare bitwise without trusting a
/// float round trip.
#[must_use]
pub fn philox_normals_transport(
    seed: u64,
    stream_kernel: u32,
    tile: u32,
    start_index: u64,
    count: usize,
) -> Transport {
    let envelope =
        philox_normals::philox_normals_envelope_json(seed, stream_kernel, tile, start_index, count);
    match philox_normals::philox_normals(seed, stream_kernel, tile, start_index, count) {
        Ok(values) => Transport { envelope, values },
        Err(_) => Transport {
            envelope,
            values: Vec::new(),
        },
    }
}

/// Admit-or-refuse envelope for `diffusion1d_frames`, without stepping.
#[must_use]
pub fn admit_diffusion1d_frames_envelope(
    n: usize,
    frames: usize,
    steps_per_frame: usize,
    diffusion: f64,
    dx: f64,
    dt: f64,
    profile: u32,
) -> String {
    match diffusion1d::admit_diffusion1d_frames(n, frames, steps_per_frame, diffusion, dx, dt, profile)
    {
        Ok(spec) => diffusion1d::ok_envelope_json(&spec, spec.frames() * spec.n()),
        Err(r) => r.to_json(),
    }
}

/// `diffusion1d_frames` across the boundary. Layout `f * n + i`. Refuses with
/// `ftcs-unstable` when `diffusion * dt / dx^2 > 0.5`; never a blown-up field.
#[must_use]
pub fn diffusion1d_frames_transport(
    n: usize,
    frames: usize,
    steps_per_frame: usize,
    diffusion: f64,
    dx: f64,
    dt: f64,
    profile: u32,
) -> Transport {
    match diffusion1d::admit_diffusion1d_frames(n, frames, steps_per_frame, diffusion, dx, dt, profile)
    {
        Ok(spec) => match diffusion1d::diffusion1d_frames_admitted(&spec) {
            Ok(values) => Transport {
                envelope: diffusion1d::ok_envelope_json(&spec, values.len()),
                values,
            },
            Err(r) => Transport {
                envelope: r.to_json(),
                values: Vec::new(),
            },
        },
        Err(r) => Transport {
            envelope: r.to_json(),
            values: Vec::new(),
        },
    }
}

/* ----------------------------------------------------------------------- */

#[cfg(target_arch = "wasm32")]
mod wasm {
    use wasm_bindgen::prelude::*;

    /// `{"transport","frankensimRevision","exports"}` for the model note.
    #[wasm_bindgen]
    pub fn build_identity() -> String {
        super::build_identity()
    }

    /// JS result of `brownian_frames`. `envelope` is always present; `values`
    /// is empty only when `envelope` is a refusal.
    #[wasm_bindgen]
    pub struct BrownianJs {
        envelope: String,
        values: Vec<f64>,
    }

    #[wasm_bindgen]
    impl BrownianJs {
        #[wasm_bindgen(getter)]
        pub fn envelope(&self) -> String {
            self.envelope.clone()
        }

        #[wasm_bindgen(getter)]
        pub fn values(&self) -> Vec<f64> {
            self.values.clone()
        }
    }

    #[wasm_bindgen]
    pub fn admit_brownian_frames(
        n_particles: usize,
        steps: usize,
        step_kernel: u32,
        seed: u64,
        diffusion: f64,
        dt: f64,
    ) -> String {
        super::admit_brownian_frames_envelope(n_particles, steps, step_kernel, seed, diffusion, dt)
    }

    #[wasm_bindgen]
    pub fn brownian_frames(
        n_particles: usize,
        steps: usize,
        step_kernel: u32,
        seed: u64,
        diffusion: f64,
        dt: f64,
    ) -> BrownianJs {
        let t =
            super::brownian_frames_transport(n_particles, steps, step_kernel, seed, diffusion, dt);
        BrownianJs {
            envelope: t.envelope,
            values: t.values,
        }
    }

    /// JS result of `philox_normals`. Empty `values` only when `envelope`
    /// names a refusal or budget miss.
    #[wasm_bindgen]
    pub struct PhiloxNormalsJs {
        envelope: String,
        values: Vec<f64>,
    }

    #[wasm_bindgen]
    impl PhiloxNormalsJs {
        #[wasm_bindgen(getter)]
        pub fn envelope(&self) -> String {
            self.envelope.clone()
        }

        #[wasm_bindgen(getter)]
        pub fn values(&self) -> Vec<f64> {
            self.values.clone()
        }
    }

    #[wasm_bindgen]
    pub fn admit_philox_normals(
        seed: u64,
        stream_kernel: u32,
        tile: u32,
        start_index: u64,
        count: usize,
    ) -> String {
        super::admit_philox_normals_envelope(seed, stream_kernel, tile, start_index, count)
    }

    #[wasm_bindgen]
    pub fn philox_normals(
        seed: u64,
        stream_kernel: u32,
        tile: u32,
        start_index: u64,
        count: usize,
    ) -> PhiloxNormalsJs {
        let t = super::philox_normals_transport(seed, stream_kernel, tile, start_index, count);
        PhiloxNormalsJs {
            envelope: t.envelope,
            values: t.values,
        }
    }

    /// JS result of `diffusion1d_frames`. Empty `values` only when `envelope`
    /// names a refusal.
    #[wasm_bindgen]
    pub struct Diffusion1dJs {
        envelope: String,
        values: Vec<f64>,
    }

    #[wasm_bindgen]
    impl Diffusion1dJs {
        #[wasm_bindgen(getter)]
        pub fn envelope(&self) -> String {
            self.envelope.clone()
        }

        #[wasm_bindgen(getter)]
        pub fn values(&self) -> Vec<f64> {
            self.values.clone()
        }
    }

    #[wasm_bindgen]
    pub fn admit_diffusion1d_frames(
        n: usize,
        frames: usize,
        steps_per_frame: usize,
        diffusion: f64,
        dx: f64,
        dt: f64,
        profile: u32,
    ) -> String {
        super::admit_diffusion1d_frames_envelope(n, frames, steps_per_frame, diffusion, dx, dt, profile)
    }

    #[wasm_bindgen]
    pub fn diffusion1d_frames(
        n: usize,
        frames: usize,
        steps_per_frame: usize,
        diffusion: f64,
        dx: f64,
        dt: f64,
        profile: u32,
    ) -> Diffusion1dJs {
        let t = super::diffusion1d_frames_transport(
            n,
            frames,
            steps_per_frame,
            diffusion,
            dx,
            dt,
            profile,
        );
        Diffusion1dJs {
            envelope: t.envelope,
            values: t.values,
        }
    }
}
