import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Traps Tab focus inside `ref` while `enabled`, focusing it when enabled. Prior focus is
 * restored on unmount. Nested modals pass `enabled` only for the top one.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, enabled = true) {
  const previous = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previous.current = document.activeElement as HTMLElement | null;
    return () => previous.current?.focus?.();
  }, []);

  useEffect(() => {
    const root = ref.current;
    if (!root || !enabled) return;
    const items = () => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
    (items()[0] ?? root).focus();

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const list = items();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !root!.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !root!.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ref, enabled]);
}
