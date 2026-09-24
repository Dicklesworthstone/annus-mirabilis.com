/* tslint:disable */
/* eslint-disable */

/**
 * JS result of `brownian_frames`. `envelope` is always present; `values`
 * is empty only when `envelope` is a refusal.
 */
export class BrownianJs {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly envelope: string;
    readonly values: Float64Array;
}

/**
 * JS result of `diffusion1d_frames`. Empty `values` only when `envelope`
 * names a refusal.
 */
export class Diffusion1dJs {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly envelope: string;
    readonly values: Float64Array;
}

/**
 * JS result of `philox_normals`. Empty `values` only when `envelope`
 * names a refusal or budget miss.
 */
export class PhiloxNormalsJs {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly envelope: string;
    readonly values: Float64Array;
}

export function admit_brownian_frames(n_particles: number, steps: number, step_kernel: number, seed: bigint, diffusion: number, dt: number): string;

export function admit_diffusion1d_frames(n: number, frames: number, steps_per_frame: number, diffusion: number, dx: number, dt: number, profile: number): string;

export function admit_philox_normals(seed: bigint, stream_kernel: number, tile: number, start_index: bigint, count: number): string;

export function brownian_frames(n_particles: number, steps: number, step_kernel: number, seed: bigint, diffusion: number, dt: number): BrownianJs;

/**
 * `{"transport","frankensimRevision","exports"}` for the model note.
 */
export function build_identity(): string;

export function diffusion1d_frames(n: number, frames: number, steps_per_frame: number, diffusion: number, dx: number, dt: number, profile: number): Diffusion1dJs;

export function philox_normals(seed: bigint, stream_kernel: number, tile: number, start_index: bigint, count: number): PhiloxNormalsJs;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_brownianjs_free: (a: number, b: number) => void;
    readonly admit_brownian_frames: (a: number, b: number, c: number, d: number, e: bigint, f: number, g: number) => void;
    readonly admit_diffusion1d_frames: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly admit_philox_normals: (a: number, b: bigint, c: number, d: number, e: bigint, f: number) => void;
    readonly brownian_frames: (a: number, b: number, c: number, d: bigint, e: number, f: number) => number;
    readonly brownianjs_envelope: (a: number, b: number) => void;
    readonly brownianjs_values: (a: number, b: number) => void;
    readonly build_identity: (a: number) => void;
    readonly diffusion1d_frames: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
    readonly philox_normals: (a: bigint, b: number, c: number, d: bigint, e: number) => number;
    readonly __wbg_diffusion1djs_free: (a: number, b: number) => void;
    readonly __wbg_philoxnormalsjs_free: (a: number, b: number) => void;
    readonly diffusion1djs_envelope: (a: number, b: number) => void;
    readonly diffusion1djs_values: (a: number, b: number) => void;
    readonly philoxnormalsjs_envelope: (a: number, b: number) => void;
    readonly philoxnormalsjs_values: (a: number, b: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
