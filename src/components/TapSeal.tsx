'use client';

import { useState, type ReactNode } from 'react';

/** A seal that spins when tapped, for playing with the legend. */
export default function TapSeal({ cls, children }: { cls: string; children: ReactNode }) {
  const [turn, setTurn] = useState(0);
  return (
    <button key={turn} type="button" className={`seal ${cls} tap-seal${turn ? ' spun' : ''}`} onClick={() => setTurn((t) => t + 1)}>
      <span>{children}</span>
    </button>
  );
}
