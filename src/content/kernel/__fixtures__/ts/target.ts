/**
 * SI: temperature K, viscosity Pa s, radius m, output m2/s.
 */
export function evaluateStokesEinstein(T: number, eta: number, a: number): number {
  const k = 1.380649e-23;
  const D = (k * T) / (6 * Math.PI * eta * a);
  return D;
}

export const helperNotTheKernel = 1;
