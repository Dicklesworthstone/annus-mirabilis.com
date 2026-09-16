//! Fixture crate for Rust kernel extraction.

mod nested {
    pub fn inner_law<T: Copy>(x: T) -> T {
        x
    }
}

/// Owner law. The wasm export delegates here.
pub fn brownian_frames(n_particles: usize, steps: usize, kernel: u32, diffusion: f64) -> Vec<f64> {
    let _ = (n_particles, steps, kernel, diffusion);
    nested::inner_law(0.0);
    Vec::new()
}

#[wasm_bindgen]
pub fn brownian_frames_export(n_particles: usize) -> Vec<f64> {
    brownian_frames(n_particles, 1, 0, 1.0)
}
