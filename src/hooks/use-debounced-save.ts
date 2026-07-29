import { useEffect, useRef } from "react";

export function useDebouncedSave<T>(value: T, callback: (value: T) => void, delay = 700, enabled = true) {
  const callbackRef = useRef(callback);
  const firstRun = useRef(true);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const timer = window.setTimeout(() => callbackRef.current(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, enabled, value]);
}
