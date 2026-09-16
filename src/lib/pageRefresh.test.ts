import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribePageRefresh } from "./pageRefresh";

afterEach(() => {
  vi.useRealTimers();
});

describe("subscribePageRefresh", () => {
  it("refreshes when the window regains focus", () => {
    const refresh = vi.fn();
    const unsubscribe = subscribePageRefresh(refresh);

    window.dispatchEvent(new Event("focus"));

    expect(refresh).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("refreshes when a hidden document becomes visible", () => {
    const refresh = vi.fn();
    const visibility = vi.spyOn(document, "visibilityState", "get");
    visibility.mockReturnValue("visible");
    const unsubscribe = subscribePageRefresh(refresh);

    document.dispatchEvent(new Event("visibilitychange"));

    expect(refresh).toHaveBeenCalledTimes(1);
    unsubscribe();
    visibility.mockRestore();
  });

  it("runs the interval only while the document is visible", () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const visibility = vi.spyOn(document, "visibilityState", "get");
    visibility.mockReturnValue("visible");
    const unsubscribe = subscribePageRefresh(refresh, { intervalMs: 15_000 });

    vi.advanceTimersByTime(15_000);
    expect(refresh).toHaveBeenCalledTimes(1);

    visibility.mockReturnValue("hidden");
    vi.advanceTimersByTime(15_000);
    expect(refresh).toHaveBeenCalledTimes(1);

    unsubscribe();
    visibility.mockRestore();
  });

  it("removes listeners and timer on unsubscribe", () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const unsubscribe = subscribePageRefresh(refresh, { intervalMs: 15_000 });

    unsubscribe();
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(30_000);

    expect(refresh).not.toHaveBeenCalled();
  });
});
