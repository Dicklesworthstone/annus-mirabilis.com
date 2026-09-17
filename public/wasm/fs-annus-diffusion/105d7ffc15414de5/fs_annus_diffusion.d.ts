/**
 * TypeScript definitions for fs-annus-diffusion.
 */

export function kernel_version(): string;

export function philox_normals(
  seed: string | bigint | number,
  stream_kernel: number,
  tile: number,
  start_index: string | bigint | number,
  count: number,
): Float64Array;

export function brownian_frames(
  n_particles: number,
  steps: number,
  step_kernel: number,
  seed: string | bigint | number,
  diffusion: number,
  dt: number,
): Float64Array;

export function brownian_frames_window(
  n_particles: number,
  start_step: number,
  steps: number,
  step_kernel: number,
  seed: string | bigint | number,
  diffusion: number,
  dt: number,
  start_positions: Float64Array | readonly number[],
): Float64Array;

export function diffusion1d_frames(
  n: number,
  frames: number,
  steps_per_frame: number,
  diffusion: number,
  dx: number,
  dt: number,
  profile: number,
): Float64Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly touch_wasm: () => number;
  readonly __wbindgen_malloc?: (a: number, b: number) => number;
  readonly __wbindgen_free?: (a: number, b: number, c: number) => void;
  readonly __wbindgen_realloc?: (a: number, b: number, c: number, d: number) => number;
}

export default function __wbg_init(
  module_or_path?:
    | { module_or_path: InitInput | Promise<InitInput> }
    | InitInput
    | Promise<InitInput>,
  maybe_memory?: WebAssembly.Memory,
): Promise<InitOutput>;
