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

/** A playback position: "38:12", or "1:02:03" from one hour. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** Hours and minutes of a provider duration ("02:46:00", or seconds). */
export function durationParts(
  duration: string | number | undefined,
): { h: number; m: number } | undefined {
  let secs: number | undefined;
  if (typeof duration === "number") secs = duration;
  else if (duration && /^\d{1,2}:\d{2}(:\d{2})?$/.test(duration)) {
    const [a = 0, b = 0, c] = duration.split(":").map(Number);
    secs = c === undefined ? a * 60 + b : a * 3600 + b * 60 + c;
  } else if (duration && /^\d+$/.test(duration)) secs = Number(duration) * 60;
  if (secs === undefined || !(secs > 0)) return undefined;
  return { h: Math.floor(secs / 3600), m: Math.round((secs % 3600) / 60) };
}

/** The year of a provider date ("2024-02-27" → "2024"). */
export function yearOf(date: string | undefined): string | undefined {
  return /^(\d{4})/.exec(date ?? "")?.[1];
}

/** "Drama / Comedy" or "Sci-Fi, Adventure" → ["Drama", "Comedy"]. */
export function genreList(genre: string | undefined): string[] {
  return (genre ?? "")
    .split(/[,/|]/)
    .map((g) => g.trim())
    .filter(Boolean);
}
