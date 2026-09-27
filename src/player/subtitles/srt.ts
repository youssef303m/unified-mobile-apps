// SRT parsing and sync, reproduced exactly (01-product/player.md §5.4). The app renders external
// subtitles itself (a custom overlay), so the delay and the colours work as on TV.

export interface Cue {
  id: string;
  /** Seconds. */
  start: number;
  end: number;
  text: string;
}

const SRT_COMMA = /(\d+)\n(\d{1,2}:\d{2}:\d{2},\d{1,3}) --> (\d{1,2}:\d{2}:\d{2},\d{1,3})/g;
const SRT_DOT = /(\d+)\n(\d{1,2}:\d{2}:\d{2}\.\d{1,3}) --> (\d{1,2}:\d{2}:\d{2}\.\d{1,3})/g;

/** "0:00:28.9" → "00:00:28,900". */
export function normalizeTimestamp(value: string): string {
  const [hms = "", ms = ""] = value.replace(".", ",").split(",");
  const parts = hms.split(":").map((p) => p.padStart(2, "0"));
  return `${parts.join(":")},${ms.padEnd(3, "0").slice(0, 3)}`;
}

/** h*3600 + m*60 + s + ms/1000, from a normalised timestamp. */
export function timestampSeconds(value: string): number {
  const [hms = "", ms = "0"] = normalizeTimestamp(value).split(",");
  const [h = 0, m = 0, s = 0] = hms.split(":").map(Number);
  return h * 3600 + m * 60 + s + Number(ms) / 1000;
}

/** Remove \r, split on "id\nstart --> end" (commas, else dots). Empty input gives no cues. */
export function parseSrt(input: string): Cue[] {
  const data = input.replace(/\r/g, "");
  let parts = data.split(SRT_COMMA);
  if (parts.length === 1) parts = data.split(SRT_DOT);
  const cues: Cue[] = [];
  for (let i = 1; i + 2 < parts.length; i += 4) {
    const [id, start, end, text] = [parts[i], parts[i + 1], parts[i + 2], parts[i + 3]];
    if (id === undefined || start === undefined || end === undefined) break;
    cues.push({
      id,
      start: timestampSeconds(start),
      end: timestampSeconds(end),
      text: (text ?? "").trim(),
    });
  }
  return cues;
}

/**
 * Finds the cue for a video time. `offset = −delay` in whole seconds (parseInt): a positive delay
 * shows subtitles later.
 */
export class SubtitleCursor {
  private index = -1;
  private offset = 0;

  constructor(private readonly cues: readonly Cue[]) {}

  /** The delay in seconds; applying it clears the cue on screen and re-searches. */
  setDelay(delay: number): void {
    this.offset = -Math.trunc(delay);
    this.index = -1;
  }

  /** After a seek: forget the position (the screen calls `at` again 200 ms later). */
  reset(): void {
    this.index = -1;
  }

  /** The cue to show at `videoTime`, if any. */
  at(videoTime: number): Cue | undefined {
    const t = videoTime + this.offset;
    const current = this.cues[this.index];
    if (current) {
      if (t >= current.start && t < current.end) return current;
      const next = this.cues[this.index + 1];
      if (t >= current.end && (!next || t < next.start)) return undefined;
      if (next && t >= next.start && t < next.end) {
        this.index += 1;
        return next;
      }
    }
    this.index = this.search(t);
    const found = this.cues[this.index];
    return found && t >= found.start && t < found.end ? found : undefined;
  }

  /** The cue whose [start, end) contains t, else the last cue that starts before t. */
  private search(t: number): number {
    let lo = 0;
    let hi = this.cues.length - 1;
    let last = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const cue = this.cues[mid];
      if (!cue) break;
      if (cue.start <= t) {
        last = mid;
        if (t < cue.end) return mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return last;
  }
}

export interface CueSpan {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

/**
 * Cue rendering: only <i> <b> <u> <br> are kept; other tags are stripped and their text kept.
 * Returns styled spans; line breaks are "\n" inside the text.
 */
export function cueSpans(text: string): CueSpan[] {
  const spans: CueSpan[] = [];
  const style = { bold: 0, italic: 0, underline: 0 };
  const push = (chunk: string) => {
    if (!chunk) return;
    spans.push({
      text: chunk,
      bold: style.bold > 0,
      italic: style.italic > 0,
      underline: style.underline > 0,
    });
  };
  const tag = /<\s*(\/?)\s*([a-z]+)[^>]*>/gi;
  let at = 0;
  for (const match of text.matchAll(tag)) {
    push(text.slice(at, match.index));
    at = match.index + match[0].length;
    const closing = match[1] === "/";
    const name = (match[2] ?? "").toLowerCase();
    if (name === "br") push("\n");
    else if (name === "b") style.bold += closing ? -1 : 1;
    else if (name === "i") style.italic += closing ? -1 : 1;
    else if (name === "u") style.underline += closing ? -1 : 1;
    style.bold = Math.max(0, style.bold);
    style.italic = Math.max(0, style.italic);
    style.underline = Math.max(0, style.underline);
  }
  push(text.slice(at));
  return spans;
}
