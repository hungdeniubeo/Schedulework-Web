export function subscribePageRefresh(
  refresh: () => void,
  options: { intervalMs?: number } = {},
): () => void {
  const onFocus = () => refresh();
  const onVisibility = () => {
    if (document.visibilityState === "visible") refresh();
  };

  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisibility);

  const timer = options.intervalMs
    ? window.setInterval(() => {
        if (document.visibilityState === "visible") refresh();
      }, options.intervalMs)
    : null;

  return () => {
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVisibility);
    if (timer !== null) window.clearInterval(timer);
  };
}
