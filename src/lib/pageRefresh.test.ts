import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscribePageRefresh } from "./pageRefresh";

class FakeWindow extends EventTarget {
  setInterval = windowSetInterval;
  clearInterval = windowClearInterval;
}

class FakeDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";
}

function windowSetInterval(handler: TimerHandler, timeout?: number): number {
  return globalThis.setInterval(handler, timeout) as unknown as number;
}

function windowClearInterval(id: number): void {
  globalThis.clearInterval(id as unknown as ReturnType<typeof setInterval>);
}

let fakeWindow: FakeWindow;
let fakeDocument: FakeDocument;

beforeEach(() => {
  fakeWindow = new FakeWindow();
  fakeDocument = new FakeDocument();
  vi.stubGlobal("window", fakeWindow);
  vi.stubGlobal("document", fakeDocument);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("subscribePageRefresh", () => {
  it("refreshes when the window regains focus", () => {
    const refresh = vi.fn();
    const unsubscribe = subscribePageRefresh(refresh);

    fakeWindow.dispatchEvent(new Event("focus"));

    expect(refresh).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("refreshes when a hidden document becomes visible", () => {
    const refresh = vi.fn();
    fakeDocument.visibilityState = "visible";
    const unsubscribe = subscribePageRefresh(refresh);

    fakeDocument.dispatchEvent(new Event("visibilitychange"));

    expect(refresh).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("runs the interval only while the document is visible", () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    fakeDocument.visibilityState = "visible";
    const unsubscribe = subscribePageRefresh(refresh, { intervalMs: 15_000 });

    vi.advanceTimersByTime(15_000);
    expect(refresh).toHaveBeenCalledTimes(1);

    fakeDocument.visibilityState = "hidden";
    vi.advanceTimersByTime(15_000);
    expect(refresh).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it("removes listeners and timer on unsubscribe", () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const unsubscribe = subscribePageRefresh(refresh, { intervalMs: 15_000 });

    unsubscribe();
    fakeWindow.dispatchEvent(new Event("focus"));
    fakeDocument.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(30_000);

    expect(refresh).not.toHaveBeenCalled();
  });
});
