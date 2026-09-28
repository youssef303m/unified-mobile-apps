// Crash reporting (04-build/tech-stack.md, Q-crash-reporting): the hook is in place and disabled.
// No SDK is bundled until the owner provides an account (a Sentry DSN); enabling it means calling
// `setCrashSink` once at start with the SDK's capture function (docs/decisions.md D-079).
// Reports never carry playlist URLs or credentials: `context` holds route names and ids only.

export type CrashContext = Record<string, string | number | boolean | undefined>;
export type CrashSink = (error: Error, context: CrashContext) => void;

let sink: CrashSink | undefined;

export function setCrashSink(next: CrashSink | undefined): void {
  sink = next;
}

export function crashReportingEnabled(): boolean {
  return sink !== undefined;
}

function asError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === "string" ? error : "Non-error thrown");
}

/** Sends an error to the crash reporter, if one is set. Never throws. */
export function reportError(error: unknown, context: CrashContext = {}): void {
  if (!sink) return;
  try {
    sink(asError(error), context);
  } catch {
    // A failing reporter must never take the app down with it.
  }
}

interface GlobalErrorUtils {
  getGlobalHandler(): (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler(handler: (error: unknown, isFatal?: boolean) => void): void;
}

let installed = false;

/**
 * Reports uncaught JavaScript errors, then hands them to React Native's own handler (the red
 * screen in development, the crash in release). Safe to call more than once.
 */
export function installGlobalErrorHandler(
  utils: GlobalErrorUtils | undefined = (globalThis as { ErrorUtils?: GlobalErrorUtils })
    .ErrorUtils,
): void {
  if (installed || !utils) return;
  installed = true;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    reportError(error, { fatal: isFatal === true, source: "global" });
    previous(error, isFatal);
  });
}

/** Tests only. */
export function resetCrashReportingForTests(): void {
  sink = undefined;
  installed = false;
}
