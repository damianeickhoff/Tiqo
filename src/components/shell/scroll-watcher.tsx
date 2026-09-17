"use client";

import { useEffect } from "react";

const IDLE_MS = 700;

/**
 * Marks the document while anything on the page is scrolling, which is what
 * globals.css uses to fade the scrollbars in and back out.
 *
 * The listener is on the capture phase because scroll does not bubble: this is
 * the only way one handler can hear a nested pane as well as the window.
 */
export function ScrollWatcher() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    function onScroll() {
      document.documentElement.dataset.scrolling = "true";
      clearTimeout(timer);
      timer = setTimeout(() => {
        delete document.documentElement.dataset.scrolling;
      }, IDLE_MS);
    }

    window.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
      clearTimeout(timer);
      delete document.documentElement.dataset.scrolling;
    };
  }, []);

  return null;
}
