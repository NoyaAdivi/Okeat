import Link from 'next/link';
import type { ReactNode } from 'react';

interface Props {
  href: string;
  emoji: string;
  name: string;
  sub?: string;
  /** seals shown under the name */
  seals?: ReactNode;
  /** a small action outside the link, such as remove */
  action?: ReactNode;
  index?: number;
}

/** One place as a small scalloped card. Used wherever places are shown together. */
export default function PlaceTile({ href, emoji, name, sub, seals, action, index = 0 }: Props) {
  return (
    <li className="tile" style={{ '--i': Math.min(index, 14) } as React.CSSProperties}>
      <Link href={href}>
        <span className="tile-top" aria-hidden="true"><span>{emoji}</span></span>
        <span className="tile-body">
          <b>{name}</b>
          {sub && <small>{sub}</small>}
          {seals}
        </span>
      </Link>
      {action && <span className="tile-action">{action}</span>}
    </li>
  );
}
