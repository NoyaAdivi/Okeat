/** The Okeat seal: a scalloped stamp with a fork-tined check mark. Colors follow the theme tokens. */
export default function Logo({ size = 40, title = 'Okeat' }: { size?: number; title?: string }) {
  return (
    <svg viewBox="0 0 128 128" width={size} height={size} role="img" aria-label={title} className="logo-mark">
      <g style={{ fill: "var(--logo-seal, #FFB4A2)" }}><circle cx="114.00" cy="64.00" r="9.5"/><circle cx="109.05" cy="85.69" r="9.5"/><circle cx="95.17" cy="103.09" r="9.5"/><circle cx="75.13" cy="112.75" r="9.5"/><circle cx="52.87" cy="112.75" r="9.5"/><circle cx="32.83" cy="103.09" r="9.5"/><circle cx="18.95" cy="85.69" r="9.5"/><circle cx="14.00" cy="64.00" r="9.5"/><circle cx="18.95" cy="42.31" r="9.5"/><circle cx="32.83" cy="24.91" r="9.5"/><circle cx="52.87" cy="15.25" r="9.5"/><circle cx="75.13" cy="15.25" r="9.5"/><circle cx="95.17" cy="24.91" r="9.5"/><circle cx="109.05" cy="42.31" r="9.5"/><circle cx="64" cy="64" r="50"/></g>
  <circle cx="64" cy="64" r="41" style={{ fill: "var(--logo-face, #FFF6F1)" }}/>
  <circle cx="64" cy="64" r="45.5" fill="none" style={{ stroke: "var(--logo-face, #FFF6F1)" }} strokeWidth="1.6" strokeDasharray="3 3.2"/>
  <g style={{ stroke: "var(--logo-ink, #2B2140)" }} strokeLinecap="round" strokeLinejoin="round" fill="none">
    <path d="M38 64 L55 81 L84.00 50.00" strokeWidth="9"/>
    <line x1="80.20" y1="46.45" x2="87.80" y2="53.55" strokeWidth="5"/>
    <g strokeWidth="3.6"><line x1="80.20" y1="46.45" x2="90.45" y2="35.49"/><line x1="84.00" y1="50.00" x2="94.25" y2="39.05"/><line x1="87.80" y1="53.55" x2="98.04" y2="42.60"/></g>
  </g>
    </svg>
  );
}
