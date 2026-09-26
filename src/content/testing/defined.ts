// Test helper: narrows `T | undefined` without a non-null assertion.
export function defined<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) throw new Error("Expected a value");
  return value;
}
