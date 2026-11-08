import type { ReactNode } from "react";

export default function EmptyState({
  icon,
  message,
}: {
  icon: ReactNode;
  message: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      {message}
    </div>
  );
}
