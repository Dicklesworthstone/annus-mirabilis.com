/** Fixture: overload signatures must never be extracted in place of the implementation. */
export function format(value: number): string;
export function format(value: string): string;
export function format(value: number | string): string {
  return typeof value === "number" ? value.toFixed(2) : value;
}
