'use client';

import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';

/** A sideways row that shows there is more: a soft edge and a thin line that follows the scrolling. */
export default function ScrollRow({ children, ...rest }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ size: number; at: number; more: boolean } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const room = el.scrollWidth - el.clientWidth;
      if (room < 4) return setBar(null);
      const at = Math.abs(el.scrollLeft) / room; // right-to-left pages count this as negative
      setBar({ size: el.clientWidth / el.scrollWidth, at, more: at < 0.98 });
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => { el.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); };
  }, []);

  return (
    <div className={`scroll-row${bar?.more ? ' has-more' : ''}`}>
      <div ref={box} {...rest}>{children}</div>
      {bar && (
        <span className="scroll-line" aria-hidden="true">
          <i style={{ inlineSize: `${bar.size * 100}%`, marginInlineStart: `${bar.at * (1 - bar.size) * 100}%` }} />
        </span>
      )}
    </div>
  );
}
