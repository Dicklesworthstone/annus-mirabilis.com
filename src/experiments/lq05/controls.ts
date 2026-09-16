import type { Lq05Parameters, Lq05View } from "./definition.ts";

export type Lq05Draft = Readonly<{
  n: string;
  f: string;
  view: Lq05View;
  locked: boolean;
  seed: string;
  trials: string;
}>;

export function toLq05Draft(p: Lq05Parameters): Lq05Draft {
  return {
    n: String(p.n),
    f: String(p.f),
    view: p.view,
    locked: p.locked,
    seed: p.seed,
    trials: String(p.trials),
  };
}

export function fromLq05Draft(d: Lq05Draft): Lq05Parameters {
  return {
    n: Math.round(Number.parseFloat(d.n)),
    f: Number.parseFloat(d.f),
    view: d.view,
    locked: d.locked,
    seed: d.seed.trim(),
    trials: Math.round(Number.parseFloat(d.trials)),
  };
}
