import { Badge } from "~/components/ui/Badge";
import type { TaskKind } from "~/engine/types";

export const KIND_LABEL: Record<TaskKind, string> = { light: "Light", heavy: "Heavy" };

/** "Light" / "Heavy" pill for a task's kind. */
export function KindBadge({ kind, size = "md" }: { kind: TaskKind; size?: "sm" | "md" }) {
  return (
    <Badge tone={kind} size={size}>
      {KIND_LABEL[kind]}
    </Badge>
  );
}
