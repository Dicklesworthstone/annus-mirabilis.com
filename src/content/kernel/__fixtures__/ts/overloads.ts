/** First overload. */
export function parseKernel(x: string): number;
/** Second overload. */
export function parseKernel(x: number): string;
export function parseKernel(x: string | number): string | number {
  return x;
}
