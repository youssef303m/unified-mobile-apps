// Plain messages for player errors (01-product/player.md §6 Mobile): react-native-video reports
// Media3 errors as "2" + the PlaybackException code, and the HTTP status only in the stack trace
// ("InvalidResponseCodeException: Response code: 403").

export type PlaybackErrorKind =
  "access_denied" | "not_found" | "unsupported" | "network" | "generic";

export interface PlayerErrorPayload {
  errorCode?: string;
  errorString?: string;
  errorException?: string;
  errorStackTrace?: string;
}

/** Media3 PlaybackException codes. */
const DECODER_OR_FORMAT = new Set([3003, 3004, 4001, 4002, 4003, 4004, 4005]);
const NETWORK = new Set([2001, 2002]);

export function httpStatusOf(error: PlayerErrorPayload): number | undefined {
  const text = `${error.errorStackTrace ?? ""}\n${error.errorException ?? ""}`;
  const match = /Response code: (\d{3})/.exec(text);
  return match ? Number(match[1]) : undefined;
}

function media3Code(error: PlayerErrorPayload): number | undefined {
  const code = error.errorCode ?? "";
  if (!/^2\d{4}$/.test(code)) return undefined;
  return Number(code.slice(1));
}

export function classifyPlaybackError(error: PlayerErrorPayload): PlaybackErrorKind {
  const status = httpStatusOf(error);
  if (status === 401 || status === 403) return "access_denied";
  if (status === 404 || status === 410) return "not_found";
  const code = media3Code(error);
  if (code !== undefined && DECODER_OR_FORMAT.has(code)) return "unsupported";
  if (code !== undefined && NETWORK.has(code)) return "network";
  return "generic";
}
