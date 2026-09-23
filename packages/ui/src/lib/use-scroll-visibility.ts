import { useEffect, useRef, useState, type RefObject } from 'react';

export const scrollParentOf = (el: HTMLElement | null): HTMLElement | null => {
  let node = el?.parentElement ?? null;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') return node;
    node = node.parentElement;
  }
  return null;
};

export type ScrollVisibilityMode = 'show-on-scroll-up' | 'show-on-scroll-down';

type Options = {
  /** Min scroll delta (px) before toggling. */
  threshold?: number;
  /**
   * When near the top of the scroller, force visible.
   * Useful for sticky headers (`show-on-scroll-up`).
   */
  forceVisibleBelow?: number;
  /**
   * When within this many px of the scroller bottom, force visible.
   * Useful for sticky footers (`show-on-scroll-down`).
   */
  forceVisibleAboveBottom?: number;
  /** Listen to this scroller instead of walking up from `ref`. */
  scrollerRef?: RefObject<HTMLElement | null>;
  /**
   * When false, skip attaching. Flip to true after the scroller mounts
   * (e.g. after async data) so the effect re-runs.
   */
  enabled?: boolean;
};

/**
 * Toggle visibility from scroll direction.
 * - `show-on-scroll-up`: hide while scrolling down (headers)
 * - `show-on-scroll-down`: hide while scrolling up (footers)
 */
export const useScrollVisibility = (mode: ScrollVisibilityMode, options: Options = {}) => {
  const {
    threshold = 6,
    forceVisibleBelow = 16,
    forceVisibleAboveBottom = 48,
    scrollerRef,
    enabled = true,
  } = options;
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    const scroller = scrollerRef?.current ?? scrollParentOf(ref.current);
    if (!scroller) return;

    let lastTop = scroller.scrollTop;
    const onScroll = () => {
      const top = scroller.scrollTop;
      const delta = top - lastTop;
      lastTop = top;

      if (mode === 'show-on-scroll-up') {
        if (top < forceVisibleBelow) {
          setVisible(true);
          return;
        }
        if (delta > threshold) setVisible(false);
        else if (delta < -threshold) setVisible(true);
        return;
      }

      // show-on-scroll-down (footers)
      const distanceFromBottom = scroller.scrollHeight - scroller.clientHeight - top;
      if (distanceFromBottom <= forceVisibleAboveBottom) {
        setVisible(true);
        return;
      }
      if (top < forceVisibleBelow) {
        setVisible(true);
        return;
      }
      if (delta > threshold) setVisible(true);
      else if (delta < -threshold) setVisible(false);
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [mode, threshold, forceVisibleBelow, forceVisibleAboveBottom, scrollerRef, enabled]);

  return { visible, ref };
};
