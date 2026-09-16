/**
 * Coordinate projectors and axis scale helpers (am-inst-2d-view-kit-u75r).
 *
 * Provides linear and logarithmic continuous mappings from domain coordinates
 * to SVG/Canvas pixel coordinates.
 */

import type { Projector } from "./types.ts";

export interface LinearProjectorOptions {
  readonly domain: readonly [number, number];
  readonly range: readonly [number, number];
  readonly clamp?: boolean;
}

export interface LogProjectorOptions {
  readonly domain: readonly [number, number];
  readonly range: readonly [number, number];
  readonly base?: number;
  readonly clamp?: boolean;
}

export function createLinearProjector(options: LinearProjectorOptions): Projector {
  const [d0, d1] = options.domain;
  const [r0, r1] = options.range;

  if (!Number.isFinite(d0) || !Number.isFinite(d1) || d0 === d1) {
    throw new Error(`Invalid linear domain [${d0}, ${d1}]`);
  }
  if (!Number.isFinite(r0) || !Number.isFinite(r1)) {
    throw new Error(`Invalid linear range [${r0}, ${r1}]`);
  }

  const span = d1 - d0;
  const rSpan = r1 - r0;

  const project = (value: number): number => {
    if (!Number.isFinite(value)) return Number.NaN;
    let clamped = value;
    if (options.clamp) {
      const min = Math.min(d0, d1);
      const max = Math.max(d0, d1);
      clamped = Math.max(min, Math.min(max, value));
    }
    const ratio = (clamped - d0) / span;
    return r0 + ratio * rSpan;
  };

  project.invert = (pixel: number): number => {
    if (!Number.isFinite(pixel)) return Number.NaN;
    const ratio = (pixel - r0) / rSpan;
    return d0 + ratio * span;
  };

  project.domain = [d0, d1] as const;
  project.range = [r0, r1] as const;

  return project;
}

export function createLogProjector(options: LogProjectorOptions): Projector {
  const [d0, d1] = options.domain;
  const [r0, r1] = options.range;
  const base = options.base ?? 10;

  if (d0 <= 0 || d1 <= 0 || !Number.isFinite(d0) || !Number.isFinite(d1) || d0 === d1) {
    throw new Error(
      `Logarithmic domain must have positive finite endpoints with d0 != d1; got [${d0}, ${d1}]`,
    );
  }
  if (base <= 1 || !Number.isFinite(base)) {
    throw new Error(`Logarithmic base must be > 1; got ${base}`);
  }

  const logBase = (x: number) => Math.log(x) / Math.log(base);
  const logD0 = logBase(d0);
  const logD1 = logBase(d1);
  const logSpan = logD1 - logD0;
  const rSpan = r1 - r0;

  const project = (value: number): number => {
    if (!Number.isFinite(value) || value <= 0) return Number.NaN;
    let clamped = value;
    if (options.clamp) {
      const min = Math.min(d0, d1);
      const max = Math.max(d0, d1);
      clamped = Math.max(min, Math.min(max, value));
    }
    const logVal = logBase(clamped);
    const ratio = (logVal - logD0) / logSpan;
    return r0 + ratio * rSpan;
  };

  project.invert = (pixel: number): number => {
    if (!Number.isFinite(pixel)) return Number.NaN;
    const ratio = (pixel - r0) / rSpan;
    const logVal = logD0 + ratio * logSpan;
    return base ** logVal;
  };

  project.domain = [d0, d1] as const;
  project.range = [r0, r1] as const;

  return project;
}

export interface TickMark {
  readonly value: number;
  readonly position: number;
  readonly label: string;
}

export function generateLinearTicks(
  projector: Projector,
  desiredCount = 5,
  formatter?: (val: number) => string,
): readonly TickMark[] {
  const [d0, d1] = projector.domain;
  const min = Math.min(d0, d1);
  const max = Math.max(d0, d1);
  const span = max - min;
  if (span <= 0) return [];

  const rawStep = span / Math.max(1, desiredCount - 1);
  const power = Math.floor(Math.log10(rawStep));
  const magnitude = 10 ** power;
  const normalized = rawStep / magnitude;

  let step: number;
  if (normalized >= 7.5) step = 10 * magnitude;
  else if (normalized >= 3.5) step = 5 * magnitude;
  else if (normalized >= 1.5) step = 2 * magnitude;
  else step = magnitude;

  const firstTick = Math.ceil(min / step) * step;
  const ticks: TickMark[] = [];

  for (let val = firstTick; val <= max + step * 0.001; val += step) {
    const fixedVal = Number(val.toPrecision(10));
    if (fixedVal >= min - 1e-12 && fixedVal <= max + 1e-12) {
      const pos = projector(fixedVal);
      const label = formatter ? formatter(fixedVal) : String(fixedVal);
      ticks.push({ value: fixedVal, position: pos, label });
    }
  }

  return Object.freeze(ticks);
}

export function generateLogTicks(
  projector: Projector,
  base = 10,
  formatter?: (val: number) => string,
): readonly TickMark[] {
  const [d0, d1] = projector.domain;
  const min = Math.min(d0, d1);
  const max = Math.max(d0, d1);
  if (min <= 0) return [];

  const minPower = Math.floor(Math.log(min) / Math.log(base));
  const maxPower = Math.ceil(Math.log(max) / Math.log(base));

  const ticks: TickMark[] = [];
  for (let p = minPower; p <= maxPower; p++) {
    const val = base ** p;
    if (val >= min * 0.999 && val <= max * 1.001) {
      const pos = projector(val);
      const label = formatter ? formatter(val) : `10^${p}`;
      ticks.push({ value: val, position: pos, label });
    }
  }

  return Object.freeze(ticks);
}
