// Lenient readers for server JSON. Q-response-shapes: the documented replies are rebuilt from
// the fields the TV reads, so only the fields used are validated and everything else is ignored.

export type JsonObject = Record<string, unknown>;

export function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asObject(value: unknown): JsonObject {
  return isObject(value) ? value : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** String form of a string or number; `fallback` for anything else. */
export function str(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

export function optStr(value: unknown): string | undefined {
  const s = str(value);
  return s === "" ? undefined : s;
}

export function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** JavaScript truthiness, which the TV code relies on for flags. */
export function truthy(value: unknown): boolean {
  return Boolean(value);
}
