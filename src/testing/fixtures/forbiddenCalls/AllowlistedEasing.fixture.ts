/** Allowlisted rendering helper for easing. */
export function easeOutQuad(t: number): number {
  return Math.sqrt(Math.max(0, t));
}

export function easeExp(t: number): number {
  return t === 0 ? 0 : Math.exp(t - 1);
}
