import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIdleTimer } from "./useIdleTimer";

// #646: exercise the real hook (via renderHook) instead of re-implementing its timers.
// #644: two hook instances share a mocked BroadcastChannel to simulate two tabs.

const TIMEOUT = 5000;
const WARN_BEFORE = 1000;

// --- Mock BroadcastChannel: every instance with the same name shares a bus. ---
type Listener = (ev: MessageEvent) => void;

class MockBroadcastChannel {
  static buses = new Map<string, Set<MockBroadcastChannel>>();
  name: string;
  onmessage: Listener | null = null;
  private listeners = new Set<Listener>();

  constructor(name: string) {
    this.name = name;
    if (!MockBroadcastChannel.buses.has(name)) {
      MockBroadcastChannel.buses.set(name, new Set());
    }
    MockBroadcastChannel.buses.get(name)!.add(this);
  }

  postMessage(data: unknown) {
    const bus = MockBroadcastChannel.buses.get(this.name);
    if (!bus) return;
    for (const peer of bus) {
      if (peer === this) continue;
      const ev = { data } as MessageEvent;
      peer.onmessage?.(ev);
      peer.listeners.forEach((l) => l(ev));
    }
  }

  addEventListener(_type: string, listener: Listener) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: string, listener: Listener) {
    this.listeners.delete(listener);
  }

  close() {
    MockBroadcastChannel.buses.get(this.name)?.delete(this);
    this.listeners.clear();
  }
}

function setup() {
  const onWarn = vi.fn();
  const onIdle = vi.fn();
  const hook = renderHook(() =>
    useIdleTimer({ timeoutMs: TIMEOUT, warnBeforeMs: WARN_BEFORE, onWarn, onIdle }),
  );
  return { onWarn, onIdle, hook };
}

describe("#287/#646 useIdleTimer — timer logic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockBroadcastChannel.buses.clear();
    vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("fires onWarn after (timeout - warnBefore) ms and onIdle at timeout", () => {
    const { onWarn, onIdle } = setup();

    act(() => {
      vi.advanceTimersByTime(TIMEOUT - WARN_BEFORE);
    });
    expect(onWarn).toHaveBeenCalledOnce();
    expect(onIdle).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(WARN_BEFORE);
    });
    expect(onIdle).toHaveBeenCalledOnce();
  });

  it("reset() before the warn threshold delays both callbacks", () => {
    const { onWarn, onIdle, hook } = setup();

    // Activity at 3000 ms resets the timers.
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    act(() => {
      hook.result.current.reset();
    });

    // 3000 + (TIMEOUT - WARN_BEFORE) = 7000 ms: warn fires, idle has not.
    act(() => {
      vi.advanceTimersByTime(TIMEOUT - WARN_BEFORE);
    });
    expect(onWarn).toHaveBeenCalledOnce();
    expect(onIdle).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(WARN_BEFORE);
    });
    expect(onIdle).toHaveBeenCalledOnce();
  });

  it("exposes a remaining-seconds value that decreases while warning", () => {
    const { hook } = setup();

    act(() => {
      vi.advanceTimersByTime(TIMEOUT - WARN_BEFORE);
    });
    const first = hook.result.current.remainingSeconds;
    expect(first).toBeGreaterThan(0);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(hook.result.current.remainingSeconds).toBeLessThan(first);
  });
});

// #645: timers are throttled/suspended in background tabs and while the machine
// sleeps, so returning to the page must re-check elapsed wall-clock time.
describe("#645 useIdleTimer — catch-up after sleep / background throttling", () => {
  let visibilityState: DocumentVisibilityState;

  function setVisibility(state: DocumentVisibilityState) {
    visibilityState = state;
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibilityState,
    });
  }

  function dispatchVisibilityChange() {
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
    setVisibility("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (document as unknown as { visibilityState?: DocumentVisibilityState })
      .visibilityState;
  });

  it("fires onIdle immediately on visibilitychange when 2× timeout elapsed without timers", () => {
    const { onWarn, onIdle } = setup();

    // Simulate the machine sleeping: wall-clock time advances, but no timers run.
    vi.setSystemTime(Date.now() + TIMEOUT * 2);
    expect(onIdle).not.toHaveBeenCalled();

    dispatchVisibilityChange();

    expect(onIdle).toHaveBeenCalledOnce();
    expect(onWarn).not.toHaveBeenCalled();
  });

  it("fires onWarn (not onIdle) on visibilitychange when elapsed is within the warn window", () => {
    const { onWarn, onIdle } = setup();

    // Elapsed is past the warn threshold but before the full timeout.
    vi.setSystemTime(Date.now() + (TIMEOUT - WARN_BEFORE) + 100);
    expect(onWarn).not.toHaveBeenCalled();

    dispatchVisibilityChange();

    expect(onWarn).toHaveBeenCalledOnce();
    expect(onIdle).not.toHaveBeenCalled();
  });

  it("fires onIdle on focus after a long sleep", () => {
    const { onIdle } = setup();

    vi.setSystemTime(Date.now() + TIMEOUT * 2);
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(onIdle).toHaveBeenCalledOnce();
  });

  it("fires onIdle on pageshow after a long sleep", () => {
    const { onIdle } = setup();

    vi.setSystemTime(Date.now() + TIMEOUT * 2);
    act(() => {
      window.dispatchEvent(new Event("pageshow"));
    });

    expect(onIdle).toHaveBeenCalledOnce();
  });

  it("does not fire onIdle on visibilitychange when elapsed is below the warn threshold", () => {
    const { onWarn, onIdle } = setup();

    vi.setSystemTime(Date.now() + 100);
    dispatchVisibilityChange();

    expect(onWarn).not.toHaveBeenCalled();
    expect(onIdle).not.toHaveBeenCalled();
  });
});

describe("#644 useIdleTimer — cross-tab coordination", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockBroadcastChannel.buses.clear();
    vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("activity in one tab keeps the other tab alive", () => {
    const tabA = setup();
    const tabB = setup();

    // Advance close to the warn threshold in both tabs.
    act(() => {
      vi.advanceTimersByTime(TIMEOUT - WARN_BEFORE - 500);
    });
    expect(tabA.onWarn).not.toHaveBeenCalled();
    expect(tabB.onWarn).not.toHaveBeenCalled();

    // Tab A reports activity; tab B must pick it up and stay alive.
    act(() => {
      tabA.hook.result.current.reset();
    });

    // Without coordination, tab B would warn/idle here.
    act(() => {
      vi.advanceTimersByTime(TIMEOUT - WARN_BEFORE - 500);
    });
    expect(tabB.onWarn).not.toHaveBeenCalled();
    expect(tabB.onIdle).not.toHaveBeenCalled();

    // And the full timeout from the shared activity point must not idle tab B.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(tabB.onIdle).not.toHaveBeenCalled();
  });

  it("inactivity across all tabs fires onIdle in both tabs at the same time", () => {
    const tabA = setup();
    const tabB = setup();

    act(() => {
      vi.advanceTimersByTime(TIMEOUT - WARN_BEFORE);
    });
    expect(tabA.onWarn).toHaveBeenCalledOnce();
    expect(tabB.onWarn).toHaveBeenCalledOnce();
    expect(tabA.onIdle).not.toHaveBeenCalled();
    expect(tabB.onIdle).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(WARN_BEFORE);
    });
    expect(tabA.onIdle).toHaveBeenCalledOnce();
    expect(tabB.onIdle).toHaveBeenCalledOnce();
  });

  it("'Stay signed in' in one tab resets the warning in every tab", () => {
    const tabA = setup();
    const tabB = setup();

    act(() => {
      vi.advanceTimersByTime(TIMEOUT - WARN_BEFORE);
    });
    expect(tabA.onWarn).toHaveBeenCalledOnce();
    expect(tabB.onWarn).toHaveBeenCalledOnce();

    // Tab A's "Stay signed in" resets both tabs.
    act(() => {
      tabA.hook.result.current.reset();
    });

    // Tab B should no longer be in the warning window.
    expect(tabB.hook.result.current.remainingSeconds).toBeGreaterThan(WARN_BEFORE / 1000);

    // Neither tab idles at the original deadline.
    act(() => {
      vi.advanceTimersByTime(WARN_BEFORE);
    });
    expect(tabA.onIdle).not.toHaveBeenCalled();
    expect(tabB.onIdle).not.toHaveBeenCalled();
  });
});
