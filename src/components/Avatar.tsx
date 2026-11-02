/* eslint-disable @next/next/no-img-element */

/** A round picture, or the first letter of the name on a pastel circle. */
export default function Avatar({ name, url, size = 40 }: { name: string; url: string | null; size?: number }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const hue = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  return url && url.startsWith('https://') ? (
    <img className="avatar" src={url} alt="" width={size} height={size} referrerPolicy="no-referrer" loading="lazy" />
  ) : (
    <span className="avatar letter" aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.45, background: `hsl(${hue} 70% 86%)`, color: `hsl(${hue} 45% 28%)` }}>
      {initial}
    </span>
  );
}
