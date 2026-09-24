const PALETTE = ['#ff8a5b', '#5b7cff', '#1fc28b', '#b64cff', '#ffb23f', '#ff6f91', '#16a3c9', '#8a5bff'];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.38, background: PALETTE[hash(name) % PALETTE.length] }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, total, size = 28 }: { names: string[]; total: number; size?: number }) {
  const extra = total - names.length;
  return (
    <span className="avatar-stack">
      {names.map((n, i) => (
        <Avatar key={`${n}-${i}`} name={n} size={size} />
      ))}
      {extra > 0 && (
        <span className="avatar avatar--more" style={{ width: size, height: size, fontSize: size * 0.34 }}>
          +{extra}
        </span>
      )}
    </span>
  );
}
