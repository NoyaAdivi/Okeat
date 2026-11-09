'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/** Accessible dialog: focuses its first field, closes on Esc and backdrop click, returns focus on close. */
export default function Modal({ title, subtitle, onClose, children }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    // On a phone, focusing a field opens the keyboard and pushes the whole screen up.
    // There the dialog itself gets the focus, and the keyboard opens only when a field is tapped.
    const touch = window.matchMedia('(pointer: coarse)').matches;
    if (touch) panel.current?.focus({ preventScroll: true });
    else panel.current?.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea, button')?.focus();
    // When the keyboard closes, the page goes back to where it was instead of staying pushed up.
    const settle = () => setTimeout(() => {
      const el = document.activeElement;
      if (!el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) window.scrollTo(0, 0);
    }, 80);
    const box = panel.current;
    box?.addEventListener('focusout', settle);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
      // keep Tab inside the dialog
      if (e.key === 'Tab' && panel.current) {
        const items = panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea');
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      box?.removeEventListener('focusout', settle);
      previous?.focus?.({ preventScroll: true });
    };
  }, []);

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={panel} tabIndex={-1}>
        <h2 id="modal-title">{title}</h2>
        {subtitle && <p className="sub">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
