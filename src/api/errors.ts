// Typed errors (04-build/architecture.md "Error handling"). Everything src/api throws is one
// of these, so hooks can map it to the matching locale message.

export class ApiError extends Error {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = new.target.name;
    this.cause = cause;
  }
}

/** No HTTP response: DNS, offline, connection refused, TLS. */
export class NetworkError extends ApiError {}

/** Every IBO panel server failed at the transport level (overview.md §4.3). */
export class AllServersFailedError extends NetworkError {}

export class TimeoutError extends ApiError {}

/** The request was aborted by the caller (not a failure to show). */
export class CancelledError extends ApiError {}

export type AuthReason =
  | "unauthorized"
  | "token"
  | "provider_auth"
  | "provider_expired"
  | "provider_banned"
  | "provider_disabled";

/** Credentials rejected or session expired. */
export class AuthError extends ApiError {
  constructor(
    message: string,
    readonly reason: AuthReason = "unauthorized",
    readonly status?: number,
    cause?: unknown,
  ) {
    super(message, cause);
  }
}

/** An HTTP error status the caller cannot handle (5xx, or a 4xx other than 401/403). */
export class ServerError extends ApiError {
  constructor(
    message: string,
    readonly status: number,
    cause?: unknown,
  ) {
    super(message, cause);
  }
}

/** The response arrived but could not be decoded or has the wrong shape. */
export class ParseError extends ApiError {}
