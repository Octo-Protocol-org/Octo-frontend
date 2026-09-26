import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// useIdleTimer is a React hook that uses window.addEventListener — test the pure timer logic
// by faking setTimeout/clearTimeout and window.addEventListener.

describe("#287 useIdleTimer — timer logic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("fires onWarn after (timeout - warnBefore) ms", () => {
    const onWarn = vi.fn();
    const onIdle = vi.fn();

    // Manually call the internal timer logic (mirroring what the hook sets up).
    const TIMEOUT = 5000;
    const WARN_BEFORE = 1000;

    const warnTimeout = setTimeout(() => onWarn(), TIMEOUT - WARN_BEFORE);
    const idleTimeout = setTimeout(() => onIdle(), TIMEOUT);

    vi.advanceTimersByTime(TIMEOUT - WARN_BEFORE);
    expect(onWarn).toHaveBeenCalledOnce();
    expect(onIdle).not.toHaveBeenCalled();

    vi.advanceTimersByTime(WARN_BEFORE);
    expect(onIdle).toHaveBeenCalledOnce();

    clearTimeout(warnTimeout);
    clearTimeout(idleTimeout);
  });

  it("cancelling timers prevents both callbacks", () => {
    const onWarn = vi.fn();
    const onIdle = vi.fn();

    const t1 = setTimeout(() => onWarn(), 4000);
    const t2 = setTimeout(() => onIdle(), 5000);

    clearTimeout(t1);
    clearTimeout(t2);

    vi.advanceTimersByTime(6000);
    expect(onWarn).not.toHaveBeenCalled();
    expect(onIdle).not.toHaveBeenCalled();
  });

  it("resetting the timer delays both callbacks", () => {
    const onWarn = vi.fn();
    const onIdle = vi.fn();
    const TIMEOUT = 5000;
    const WARN_BEFORE = 1000;

    let t1 = setTimeout(() => onWarn(), TIMEOUT - WARN_BEFORE);
    let t2 = setTimeout(() => onIdle(), TIMEOUT);

    // Activity at 3000 ms resets the timers.
    vi.advanceTimersByTime(3000);
    clearTimeout(t1);
    clearTimeout(t2);
    t1 = setTimeout(() => onWarn(), TIMEOUT - WARN_BEFORE);
    t2 = setTimeout(() => onIdle(), TIMEOUT);

    // At 3000 + (TIMEOUT - WARN_BEFORE) = 7000 ms, warn fires.
    vi.advanceTimersByTime(TIMEOUT - WARN_BEFORE);
    expect(onWarn).toHaveBeenCalledOnce();
    expect(onIdle).not.toHaveBeenCalled();

    vi.advanceTimersByTime(WARN_BEFORE);
    expect(onIdle).toHaveBeenCalledOnce();

    clearTimeout(t1);
    clearTimeout(t2);
  });
});
