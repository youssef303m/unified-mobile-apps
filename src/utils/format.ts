// Display formatting.

/** "15 Aug 2025" in the UI language; the raw text when it is not a date. */
export function formatDate(value: string, language: string): string {
  const time = Date.parse(value.replace(" ", "T"));
  if (Number.isNaN(time)) return value;
  return new Date(time).toLocaleDateString(language, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
