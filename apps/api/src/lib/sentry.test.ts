import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * We replace the entire @sentry/node module with vi.mock so we never
 * fire a real network call — the contract under test is the wrapper's
 * fail-open behaviour, not Sentry's transport. ESM bans spyOn against
 * a module namespace, so vi.mock is the right tool.
 */
vi.mock("@sentry/node", () => {
  const init = vi.fn();
  const captureException = vi.fn();
  const flush = vi.fn(async (_ms?: number) => true);
  const withScope = vi.fn((cb: (scope: unknown) => void) => {
    cb({
      setTag: vi.fn(),
      setExtra: vi.fn(),
    });
  });
  return { init, captureException, flush, withScope };
});

// Import AFTER the mock is registered so the wrapper picks up the stubs.
import * as Sentry from "@sentry/node";
import {
  initSentry,
  captureException,
  flushSentry,
  __resetSentryForTests,
} from "./sentry";

const initMock = Sentry.init as unknown as ReturnType<typeof vi.fn>;
const captureMock = Sentry.captureException as unknown as ReturnType<
  typeof vi.fn
>;
const flushMock = Sentry.flush as unknown as ReturnType<typeof vi.fn>;
const withScopeMock = Sentry.withScope as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  __resetSentryForTests();
  initMock.mockReset();
  captureMock.mockReset();
  flushMock.mockReset();
  withScopeMock.mockReset();
  // Default impl restored so each test starts from a clean slate.
  withScopeMock.mockImplementation((cb: (scope: unknown) => void) => {
    cb({ setTag: vi.fn(), setExtra: vi.fn() });
  });
  flushMock.mockResolvedValue(true);

  delete process.env.SENTRY_DSN;
  delete process.env.SENTRY_ENVIRONMENT;
  delete process.env.SENTRY_RELEASE;
  delete process.env.SENTRY_TRACES_SAMPLE_RATE;
});

afterEach(() => {
  delete process.env.SENTRY_DSN;
});

describe("initSentry (no DSN)", () => {
  it("does NOT call Sentry.init when SENTRY_DSN is unset", () => {
    initSentry();
    expect(initMock).not.toHaveBeenCalled();
  });

  it("does NOT call Sentry.init when SENTRY_DSN is an empty string", () => {
    process.env.SENTRY_DSN = "   ";
    initSentry();
    expect(initMock).not.toHaveBeenCalled();
  });
});

describe("initSentry (DSN present)", () => {
  it("initialises Sentry exactly once on repeated calls", () => {
    process.env.SENTRY_DSN = "https://abc@sentry.io/1";
    initSentry();
    initSentry();
    initSentry();
    expect(initMock).toHaveBeenCalledTimes(1);
  });

  it("passes environment + release + traces sample rate through", () => {
    process.env.SENTRY_DSN = "https://abc@sentry.io/1";
    process.env.SENTRY_ENVIRONMENT = "staging";
    process.env.SENTRY_RELEASE = "roots-api@abc123";
    process.env.SENTRY_TRACES_SAMPLE_RATE = "0.25";
    initSentry();
    expect(initMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://abc@sentry.io/1",
        environment: "staging",
        release: "roots-api@abc123",
        tracesSampleRate: 0.25,
        sendDefaultPii: false,
      })
    );
  });

  it("falls back to a default sample rate when env var is malformed", () => {
    process.env.SENTRY_DSN = "https://abc@sentry.io/1";
    process.env.SENTRY_TRACES_SAMPLE_RATE = "not-a-number";
    initSentry();
    expect(initMock).toHaveBeenCalledWith(
      expect.objectContaining({ tracesSampleRate: 0.1 })
    );
  });

  it("swallows errors from Sentry.init so boot never crashes", () => {
    initMock.mockImplementationOnce(() => {
      throw new Error("sentry transport down");
    });
    process.env.SENTRY_DSN = "https://abc@sentry.io/1";
    expect(() => initSentry()).not.toThrow();
  });
});

describe("captureException", () => {
  it("is a no-op when Sentry was never initialised", () => {
    captureException(new Error("boom"));
    expect(withScopeMock).not.toHaveBeenCalled();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("forwards errors + tags + extra after init", () => {
    process.env.SENTRY_DSN = "https://abc@sentry.io/1";
    initSentry();
    const err = new Error("kaboom");
    captureException(err, {
      tags: { route: "/v1/portal/quotes" },
      extra: { orgId: "demo-org" },
    });
    expect(withScopeMock).toHaveBeenCalledTimes(1);
    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock).toHaveBeenCalledWith(err);
  });

  it("swallows internal Sentry errors so callers never see telemetry crashes", () => {
    process.env.SENTRY_DSN = "https://abc@sentry.io/1";
    initSentry();
    withScopeMock.mockImplementationOnce(() => {
      throw new Error("sentry scope broke");
    });
    expect(() => captureException(new Error("user err"))).not.toThrow();
  });
});

describe("flushSentry", () => {
  it("is a no-op when Sentry was never initialised", async () => {
    await flushSentry(50);
    expect(flushMock).not.toHaveBeenCalled();
  });

  it("delegates to Sentry.flush with the supplied timeout", async () => {
    process.env.SENTRY_DSN = "https://abc@sentry.io/1";
    initSentry();
    await flushSentry(500);
    expect(flushMock).toHaveBeenCalledWith(500);
  });
});
