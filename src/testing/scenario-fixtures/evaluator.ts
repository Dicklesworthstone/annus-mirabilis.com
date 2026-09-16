/** Self-test owners for the scenario runner. Real paper owners live in src/physics/reference/. */

export function timesTwoClosed(x: number): number {
  return 2 * x;
}

export function timesTwoFromAdd(x: number): number {
  return x + x;
}

export function halfScale(value: number): number {
  return value / 2;
}

export function rootTwoScale(value: number): number {
  return value / Math.SQRT2;
}

export function magnetFrameEmf(B: number, v: number, ell: number): number {
  return B * v * ell;
}

export function conductorFrameEmf(B: number, v: number, ell: number, c: number): number {
  const beta = v / c;
  const gamma = 1 / Math.sqrt(1 - beta * beta);
  return gamma * B * v * ell;
}

export function fresnelDraggedIncrement(n: number, flow: number): number {
  return flow * (1 - 1 / (n * n));
}

export function relativisticDraggedIncrement(n: number, flow: number, c: number): number {
  const w = c / n;
  return (w + flow) / (1 + (w * flow) / (c * c)) - w;
}

export function parsePrintedNumber(printed: string): number {
  const match = printed.replace(",", ".").match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i);
  if (!match) throw new RangeError(`No number in printed value "${printed}".`);
  const value = Number(match[0]);
  const text = printed.toLowerCase();
  if (text.includes("mikron") || text.includes("μm") || text.includes("um")) return value * 1e-6;
  if (text.includes("volt") || text.includes(" v")) return value;
  return value;
}
