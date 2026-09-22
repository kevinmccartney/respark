import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type CardThumbProps = {
  src: string | null | undefined;
  alt?: string;
  /** Larger image for hover preview; falls back to `src`. */
  previewSrc?: string | null;
};

type PreviewPos = { top: number; left: number };

/**
 * Small table thumbnail with a larger fixed-position preview on hover
 * (portal escapes overflow-x scroll containers).
 */
export const CardThumb = ({ src, alt = '', previewSrc }: CardThumbProps) => {
  const thumbRef = useRef<HTMLSpanElement | null>(null);
  const previewId = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PreviewPos | null>(null);

  const showPreview = () => {
    const el = thumbRef.current;
    if (!el || !src) return;
    const rect = el.getBoundingClientRect();
    const previewWidth = 200;
    const previewHeight = 280;
    const gap = 8;
    const preferRight = rect.right + gap + previewWidth <= window.innerWidth;
    const left = preferRight ? rect.right + gap : Math.max(gap, rect.left - gap - previewWidth);
    const top = Math.min(
      Math.max(gap, rect.top + rect.height / 2 - previewHeight / 2),
      window.innerHeight - previewHeight - gap,
    );
    setPos({ top, left });
    setOpen(true);
  };

  const hidePreview = () => {
    setOpen(false);
    setPos(null);
  };

  useEffect(() => {
    if (!open) return;
    const onScroll = () => hidePreview();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  if (!src) {
    return <span className="block h-14 w-10 shrink-0 rounded bg-muted" aria-hidden />;
  }

  return (
    <>
      <span
        ref={thumbRef}
        className="relative inline-flex"
        onMouseEnter={showPreview}
        onMouseLeave={hidePreview}
        onFocus={showPreview}
        onBlur={hidePreview}
      >
        <img
          src={src}
          alt={alt}
          className="h-14 w-10 shrink-0 rounded object-cover ring-1 ring-foreground/10"
          loading="lazy"
          aria-describedby={open ? previewId : undefined}
        />
      </span>
      {open && pos
        ? createPortal(
            <div
              id={previewId}
              role="tooltip"
              className="pointer-events-none fixed z-50 overflow-hidden rounded-lg bg-card shadow-xl ring-1 ring-foreground/15"
              style={{ top: pos.top, left: pos.left, width: 200 }}
            >
              <img src={previewSrc || src} alt="" className="block h-auto w-full" />
            </div>,
            document.body,
          )
        : null}
    </>
  );
};
