// EPG time handling (02-backend/epg-and-catchup.md §1-4), with explicit parsers instead of
// `new Date(string)` / moment, and the Q-behaviour-fixes #9 correction: the Xtream server
// offset applies only to wall-clock strings, never to unix timestamps.
import CryptoJS from "crypto-js";

const MINUTE = 60_000;

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD HH:mm[:ss]" (or with "T") as device-local wall-clock time. */
export function parseWallClock(value: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value.trim());
  if (!m) return undefined;
  const [, y, mo, d, h, mi, s] = m;
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s ?? 0),
  );
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** XMLTV "YYYYMMDDHHmmss +HHMM" (zone optional: then device-local). */
function parseXmltv(value: string): Date | undefined {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-])(\d{2})(\d{2}))?/.exec(value);
  if (!m) return undefined;
  const [, y, mo, d, h, mi, s, sign, zh, zm] = m;
  if (!sign)
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  const offset = (Number(zh) * 60 + Number(zm)) * (sign === "-" ? -1 : 1);
  return new Date(utc - offset * MINUTE);
}

/**
 * getLocalChannelTime: a provider time → device-local Date. Unix seconds/ms and zoned XMLTV
 * strings are absolute. Wall-clock strings are the server's clock: + `timeDiffMin`.
 */
export function getLocalChannelTime(value: string | number, timeDiffMin: number): Date | undefined {
  const s = String(value).trim();
  if (/^\d{10}$/.test(s)) return new Date(Number(s) * 1000);
  if (/^\d{13}$/.test(s)) return new Date(Number(s));
  if (/^\d{14}/.test(s)) return parseXmltv(s);
  const wall = parseWallClock(s);
  return wall ? new Date(wall.getTime() + timeDiffMin * MINUTE) : undefined;
}

export function formatYmdHm(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatYmdHms(date: Date): string {
  return `${formatYmdHm(date)}:${pad(date.getSeconds())}`;
}

/** "YYYY-MM-DD HH:mm[:ss]" → "HH:mm". */
export function epgClock(value: string): string {
  return String(value || "").substring(11, 16);
}

/**
 * Xtream server offset at login (xtream.md §8): device UTC offset − server UTC offset, in
 * minutes. `time_now` is the server's wall clock, read as device-local.
 */
export function serverOffsetMinutes(timeNow: string, timestampNow: number): number {
  const local = parseWallClock(timeNow);
  if (!local || !Number.isFinite(timestampNow)) return 0;
  return Math.trunc((timestampNow * 1000 - local.getTime()) / MINUTE);
}

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * getAtob: base64 → UTF-8 text, or the input unchanged when it is not valid base64/UTF-8
 * (as `atob` + percent-decoding would fail). Xtream titles only; Stalker titles are plain.
 */
export function decodeBase64Title(text: string): string {
  const compact = text.replace(/\s+/g, "");
  if (compact === "" || compact.length % 4 === 1 || !BASE64.test(compact)) return text;
  try {
    const decoded = CryptoJS.enc.Base64.parse(compact).toString(CryptoJS.enc.Utf8);
    return decoded;
  } catch {
    return text;
  }
}

export interface EpgProgramme {
  /** Device-local "YYYY-MM-DD HH:mm" (XC, catch-up) or "YYYY-MM-DD HH:mm:ss" (Stalker now/next). */
  start: string;
  stop: string;
  title: string;
  description?: string;
  /** Stalker catch-up: the original portal item (id, real_id…). */
  raw?: Record<string, unknown>;
}

function unix(value: string): number {
  return (parseWallClock(value)?.getTime() ?? NaN) / 1000;
}

/** getNextProgrammes: up to 4 programmes that have not ended; whether the first is running. */
export function getNextProgrammes(list: readonly EpgProgramme[], now: Date = new Date()) {
  const nowS = now.getTime() / 1000;
  let currentExists = false;
  const programmes: EpgProgramme[] = [];
  for (const p of list) {
    if (unix(p.stop) >= nowS) {
      if (unix(p.start) <= nowS) currentExists = true;
      programmes.push(p);
      if (programmes.length >= 4) break;
    }
  }
  return {
    currentExists,
    programmes,
    current: currentExists ? programmes[0] : undefined,
    next: currentExists ? programmes[1] : programmes[0],
  };
}

/** Progress % of a programme: clamp(round(elapsed/length*100), 0, 100); 0 for an invalid span. */
export function programmeProgress(p: EpgProgramme, now: Date = new Date()): number {
  const start = unix(p.start);
  const stop = unix(p.stop);
  if (!(stop > start)) return 0;
  const pct = Math.round(((now.getTime() / 1000 - start) / (stop - start)) * 100);
  return Math.min(100, Math.max(0, pct));
}

export interface CatchupDay {
  /** "YYYY-MM-DD" */
  date: string;
  programmes: EpgProgramme[];
}

/** sortProgrammesByDate: finished programmes grouped by day, oldest day first. */
export function groupFinishedByDay(
  list: readonly EpgProgramme[],
  now: Date = new Date(),
): CatchupDay[] {
  const nowS = now.getTime() / 1000;
  const days = new Map<string, EpgProgramme[]>();
  for (const p of list) {
    if (unix(p.start) >= nowS || unix(p.stop) >= nowS) break;
    const key = p.start.substring(0, 10);
    const day = days.get(key) ?? [];
    day.push(p);
    days.set(key, day);
  }
  return [...days].map(([date, programmes]) => ({ date, programmes }));
}

interface GuideSlot {
  start: Date;
  stop: Date;
  title: string;
  description: string;
}

/** EPG guide normalisation (§4): sort, clamp overlaps, drop empty slots, merge repeats. */
export function normalizeGuide(slots: GuideSlot[]): GuideSlot[] {
  const sorted = [...slots].sort((a, b) => a.start.getTime() - b.start.getTime());
  const out: GuideSlot[] = [];
  let prevEnd = 0;
  for (const slot of sorted) {
    const p = { ...slot };
    if (p.start.getTime() < prevEnd) p.start = new Date(prevEnd);
    if (p.stop.getTime() <= p.start.getTime()) continue;
    prevEnd = p.stop.getTime();
    const last = out[out.length - 1];
    if (
      last &&
      last.title.trim().toLowerCase() === p.title.trim().toLowerCase() &&
      p.start.getTime() - last.stop.getTime() <= MINUTE
    ) {
      last.stop = p.stop;
      if (!last.description && p.description) last.description = p.description;
      continue;
    }
    out.push(p);
  }
  return out;
}
