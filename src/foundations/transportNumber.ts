/** Decimal input for the transport lessons; an unfinished or underflowed entry is never zero. */
export function readTransportNumber(
  text: string,
): Readonly<{ kind: "number"; value: number }> | Readonly<{ kind: "refused"; message: string }> {
  const token = text.trim().replaceAll("−", "-");
  if (
    text.length > 48 ||
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(token) ||
    !Number.isFinite(Number(token))
  )
    return {
      kind: "refused",
      message: "Enter a finite decimal number without units or expressions.",
    };
  const value = Number(token);
  if (value === 0 && /[1-9]/u.test(token.split(/[eE]/u)[0] ?? ""))
    return {
      kind: "refused",
      message: "That nonzero number is too small to represent. Use a larger value.",
    };
  return { kind: "number", value: value === 0 ? 0 : value };
}
