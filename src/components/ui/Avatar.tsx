// Avatar com iniciais + cor (deriva de User). Portado de components.jsx.
import type { AvatarUser } from "@/lib/types";

export function Avatar({
  user,
  size = 32,
  ring = true,
}: {
  user: AvatarUser;
  size?: number;
  ring?: boolean;
}) {
  return (
    <span
      className="av"
      title={user.name}
      style={{
        width: size,
        height: size,
        background: user.color,
        fontSize: size * 0.38,
        borderWidth: ring ? 2 : 0,
      }}
    >
      {user.initials}
    </span>
  );
}

export function AvatarStack({
  users,
  size = 30,
  max = 4,
}: {
  users: AvatarUser[];
  size?: number;
  max?: number;
}) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <div className="av-stack">
      {shown.map((u, i) => (
        <Avatar key={i} user={u} size={size} />
      ))}
      {extra > 0 && (
        <span className="av-more" style={{ width: size, height: size }}>
          +{extra}
        </span>
      )}
    </div>
  );
}
