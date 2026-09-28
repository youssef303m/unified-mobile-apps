import {
  crashReportingEnabled,
  installGlobalErrorHandler,
  reportError,
  resetCrashReportingForTests,
  setCrashSink,
} from "../crashReporting";

afterEach(() => resetCrashReportingForTests());

describe("crash reporting hook (Q-crash-reporting)", () => {
  it("is disabled until a sink is set, and reporting does nothing", () => {
    expect(crashReportingEnabled()).toBe(false);
    expect(() => reportError(new Error("boom"))).not.toThrow();
  });

  it("sends errors to the sink, wrapping non-errors", () => {
    const sink = jest.fn();
    setCrashSink(sink);
    reportError(new Error("boom"), { route: "/player" });
    reportError("text");
    expect(sink).toHaveBeenNthCalledWith(1, expect.objectContaining({ message: "boom" }), {
      route: "/player",
    });
    expect(sink.mock.calls[1][0]).toBeInstanceOf(Error);
    expect(sink.mock.calls[1][0].message).toBe("text");
  });

  it("never throws when the sink fails", () => {
    setCrashSink(() => {
      throw new Error("sink down");
    });
    expect(() => reportError(new Error("boom"))).not.toThrow();
  });

  it("reports uncaught errors, then calls React Native's own handler, once", () => {
    const sink = jest.fn();
    setCrashSink(sink);
    const previous = jest.fn();
    let handler: ((e: unknown, fatal?: boolean) => void) | undefined;
    const utils = {
      getGlobalHandler: () => previous,
      setGlobalHandler: jest.fn((h: (e: unknown, fatal?: boolean) => void) => {
        handler = h;
      }),
    };
    installGlobalErrorHandler(utils);
    installGlobalErrorHandler(utils);
    expect(utils.setGlobalHandler).toHaveBeenCalledTimes(1);
    const error = new Error("uncaught");
    handler?.(error, true);
    expect(sink).toHaveBeenCalledWith(error, { fatal: true, source: "global" });
    expect(previous).toHaveBeenCalledWith(error, true);
  });
});
